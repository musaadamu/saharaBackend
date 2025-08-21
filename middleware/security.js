const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const { body, query, param, validationResult } = require('express-validator');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: message,
                retryAfter: Math.round(windowMs / 1000)
            });
        }
    });
};

// Different rate limits for different endpoints
const rateLimits = {
    // General API rate limit
    general: createRateLimit(15 * 60 * 1000, 100, 'Too many requests, please try again later'),
    
    // Strict rate limit for authentication endpoints
    auth: createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts, please try again later'),
    
    // File upload rate limit
    upload: createRateLimit(60 * 60 * 1000, 10, 'Too many file uploads, please try again later'),
    
    // Search rate limit
    search: createRateLimit(1 * 60 * 1000, 20, 'Too many search requests, please slow down')
};

// Security headers middleware
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize against NoSQL injection
    mongoSanitize.sanitize(req.body);
    mongoSanitize.sanitize(req.query);
    mongoSanitize.sanitize(req.params);
    
    // XSS protection for string fields
    const sanitizeObject = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = xss(obj[key], {
                    whiteList: {}, // No HTML tags allowed
                    stripIgnoreTag: true,
                    stripIgnoreTagBody: ['script']
                });
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    };
    
    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    
    next();
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

// Common validation rules
const validationRules = {
    // User registration validation
    userRegistration: [
        body('name')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters')
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Name can only contain letters and spaces'),
        
        body('email')
            .trim()
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email address')
            .isLength({ max: 100 })
            .withMessage('Email must not exceed 100 characters'),
        
        body('password')
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8 and 128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
        
        body('role')
            .optional()
            .isIn(['author', 'editor', 'admin'])
            .withMessage('Invalid role specified')
    ],

    // User login validation
    userLogin: [
        body('email')
            .trim()
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email address'),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ],

    // Journal submission validation
    journalSubmission: [
        body('title')
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage('Title must be between 5 and 200 characters'),

        body('abstract')
            .trim()
            .isLength({ min: 50 })
            .withMessage('Abstract must be at least 50 characters'),

        // Allow authors as a string or array, and allow special characters
        body('authors')
            .custom((value) => {
                if (Array.isArray(value)) {
                    return value.length > 0 && value.every(
                        (author) => typeof author === 'string' && author.trim().length >= 2 && author.trim().length <= 100
                    );
                } else if (typeof value === 'string') {
                    return value.trim().length >= 2 && value.trim().length <= 500;
                }
                return false;
            })
            .withMessage('Authors must be a non-empty string or array of names (2-100 chars each, special characters allowed).'),

        // Allow keywords as a string or array
        body('keywords')
            .optional()
            .custom((value) => {
                if (Array.isArray(value)) {
                    return value.every(
                        (kw) => typeof kw === 'string' && kw.trim().length >= 2 && kw.trim().length <= 50
                    );
                } else if (typeof value === 'string') {
                    return value.trim().length >= 2 && value.trim().length <= 200;
                }
                return false;
            })
            .withMessage('Keywords must be a string (2-200 chars) or array of strings (2-50 chars each)')
    ],

    // Search validation
    search: [
        query('query')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Search query must be between 1 and 100 characters')
            .matches(/^[a-zA-Z0-9\s\-_]+$/)
            .withMessage('Search query contains invalid characters'),
        
        query('field')
            .optional()
            .isIn(['title', 'abstract', 'keywords', 'authors'])
            .withMessage('Invalid search field')
    ],

    // MongoDB ObjectId validation
    mongoId: [
        param('id')
            .isMongoId()
            .withMessage('Invalid ID format')
    ],

    // Pagination validation
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .withMessage('Page must be a positive integer between 1 and 1000'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
    ]
};

module.exports = {
    rateLimits,
    securityHeaders,
    sanitizeInput,
    handleValidationErrors,
    validationRules,
    hpp: hpp()
};
