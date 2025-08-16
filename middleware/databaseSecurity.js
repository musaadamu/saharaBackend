const mongoose = require('mongoose');
const { logSecurityEvent } = require('./errorHandler');

// MongoDB query sanitization middleware
const sanitizeMongoQuery = (req, res, next) => {
    // Remove any keys that start with $ or contain dots (potential injection)
    const sanitizeObject = (obj) => {
        if (obj && typeof obj === 'object') {
            for (const key in obj) {
                if (key.startsWith('$') || key.includes('.')) {
                    logSecurityEvent('MONGODB_INJECTION_ATTEMPT', req, {
                        suspiciousKey: key,
                        value: obj[key]
                    });
                    delete obj[key];
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            }
        }
    };

    // Sanitize query parameters, body, and params
    if (req.query) sanitizeObject(req.query);
    if (req.body) sanitizeObject(req.body);
    if (req.params) sanitizeObject(req.params);

    next();
};

// Safe MongoDB query builder
const buildSafeQuery = (searchFields, searchValue, options = {}) => {
    const {
        caseSensitive = false,
        exactMatch = false,
        maxResults = 100
    } = options;

    // Validate search value
    if (!searchValue || typeof searchValue !== 'string') {
        throw new Error('Invalid search value');
    }

    // Escape special regex characters
    const escapedValue = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Build query
    const query = {};
    
    if (Array.isArray(searchFields) && searchFields.length > 0) {
        query.$or = searchFields.map(field => {
            if (exactMatch) {
                return { [field]: caseSensitive ? searchValue : new RegExp(`^${escapedValue}$`, 'i') };
            } else {
                return { [field]: new RegExp(escapedValue, caseSensitive ? 'g' : 'gi') };
            }
        });
    }

    return query;
};

// Safe pagination helper
const buildSafePagination = (page = 1, limit = 10) => {
    const safePage = Math.max(1, Math.min(parseInt(page) || 1, 1000));
    const safeLimit = Math.max(1, Math.min(parseInt(limit) || 10, 100));
    const skip = (safePage - 1) * safeLimit;

    return {
        page: safePage,
        limit: safeLimit,
        skip: skip
    };
};

// MongoDB ObjectId validation
const validateObjectId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid ObjectId format');
    }
    return new mongoose.Types.ObjectId(id);
};

// Safe aggregation pipeline builder
const buildSafeAggregation = (pipeline) => {
    // List of dangerous aggregation operators to block
    const dangerousOperators = [
        '$where',
        '$function',
        '$accumulator',
        '$expr'
    ];

    const validateStage = (stage) => {
        if (typeof stage !== 'object' || stage === null) {
            throw new Error('Invalid aggregation stage');
        }

        for (const operator in stage) {
            if (dangerousOperators.includes(operator)) {
                throw new Error(`Dangerous aggregation operator detected: ${operator}`);
            }
            
            // Recursively validate nested objects
            if (typeof stage[operator] === 'object' && stage[operator] !== null) {
                validateStage(stage[operator]);
            }
        }
    };

    if (!Array.isArray(pipeline)) {
        throw new Error('Aggregation pipeline must be an array');
    }

    pipeline.forEach(validateStage);
    return pipeline;
};

// Database connection security configuration
const getSecureConnectionOptions = () => {
    return {
        // Connection pool settings
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        
        // Timeout settings
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        
        // Retry settings
        retryWrites: true,
        retryReads: true,
        
        // Security settings
        authSource: 'admin',
        ssl: process.env.NODE_ENV === 'production',
        
        // Monitoring
        monitorCommands: process.env.NODE_ENV === 'development'
    };
};

// Query performance monitoring
const monitorQueryPerformance = (model, operation) => {
    return async function(...args) {
        const startTime = Date.now();
        
        try {
            const result = await model[operation](...args);
            const duration = Date.now() - startTime;
            
            // Log slow queries (> 1 second)
            if (duration > 1000) {
                console.warn(`Slow query detected: ${model.modelName}.${operation} took ${duration}ms`);
            }
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`Query error in ${model.modelName}.${operation} after ${duration}ms:`, error.message);
            throw error;
        }
    };
};

// Database security middleware for routes
const databaseSecurityMiddleware = (req, res, next) => {
    // Add security helpers to request object
    req.dbSecurity = {
        buildSafeQuery,
        buildSafePagination,
        validateObjectId,
        buildSafeAggregation
    };
    
    next();
};

// Schema security enhancements
const addSecurityToSchema = (schema) => {
    // Add indexes for commonly queried fields
    schema.index({ createdAt: -1 });
    
    // Add pre-save validation
    schema.pre('save', function(next) {
        // Validate that required fields are not empty
        const requiredFields = [];
        schema.eachPath((pathname, schematype) => {
            if (schematype.isRequired) {
                requiredFields.push(pathname);
            }
        });
        
        for (const field of requiredFields) {
            if (!this[field] || (typeof this[field] === 'string' && this[field].trim() === '')) {
                return next(new Error(`Required field ${field} is empty`));
            }
        }
        
        next();
    });
    
    // Add pre-update validation
    schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function(next) {
        // Prevent updating sensitive fields directly
        const sensitiveFields = ['_id', '__v', 'createdAt'];
        const update = this.getUpdate();
        
        for (const field of sensitiveFields) {
            if (update[field] || (update.$set && update.$set[field])) {
                return next(new Error(`Cannot update sensitive field: ${field}`));
            }
        }
        
        next();
    });
    
    return schema;
};

// Rate limiting for database operations
const createDatabaseRateLimit = () => {
    const operations = new Map();
    const WINDOW_SIZE = 60000; // 1 minute
    const MAX_OPERATIONS = 100; // Max operations per minute per IP
    
    return (req, res, next) => {
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!operations.has(clientId)) {
            operations.set(clientId, []);
        }
        
        const clientOps = operations.get(clientId);
        
        // Remove old operations outside the window
        const validOps = clientOps.filter(timestamp => now - timestamp < WINDOW_SIZE);
        
        if (validOps.length >= MAX_OPERATIONS) {
            logSecurityEvent('DATABASE_RATE_LIMIT_EXCEEDED', req, {
                operationsCount: validOps.length,
                windowSize: WINDOW_SIZE
            });
            
            return res.status(429).json({
                success: false,
                message: 'Too many database operations. Please slow down.'
            });
        }
        
        validOps.push(now);
        operations.set(clientId, validOps);
        
        next();
    };
};

module.exports = {
    sanitizeMongoQuery,
    buildSafeQuery,
    buildSafePagination,
    validateObjectId,
    buildSafeAggregation,
    getSecureConnectionOptions,
    monitorQueryPerformance,
    databaseSecurityMiddleware,
    addSecurityToSchema,
    createDatabaseRateLimit
};
