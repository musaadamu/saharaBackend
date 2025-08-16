const fs = require('fs');
const path = require('path');

// Security-focused error handler
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for debugging (but not sensitive info)
    logError(err, req);

    // Default error response
    let statusCode = 500;
    let message = 'Internal Server Error';
    let details = null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        // Mongoose validation error
        statusCode = 400;
        message = 'Validation Error';
        details = Object.values(err.errors).map(val => ({
            field: val.path,
            message: val.message
        }));
    } else if (err.code === 11000) {
        // Mongoose duplicate key error
        statusCode = 400;
        message = 'Duplicate field value';
        const field = Object.keys(err.keyValue)[0];
        details = `${field} already exists`;
    } else if (err.name === 'CastError') {
        // Mongoose bad ObjectId
        statusCode = 400;
        message = 'Invalid ID format';
    } else if (err.name === 'JsonWebTokenError') {
        // JWT error
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        // JWT expired
        statusCode = 401;
        message = 'Token expired';
    } else if (err.code === 'LIMIT_FILE_SIZE') {
        // Multer file size error
        statusCode = 413;
        message = 'File too large';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        // Multer unexpected file error
        statusCode = 400;
        message = 'Unexpected file upload';
    } else if (err.message && err.message.includes('Only .docx and .pdf files are allowed')) {
        // File type error
        statusCode = 400;
        message = 'Invalid file type';
    } else if (err.statusCode) {
        // Custom error with status code
        statusCode = err.statusCode;
        message = err.message;
    }

    // In production, don't leak error details
    const isProduction = process.env.NODE_ENV === 'production';
    
    const response = {
        success: false,
        message: message,
        ...(details && { details }),
        ...((!isProduction && err.stack) && { stack: err.stack }),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    };

    res.status(statusCode).json(response);
};

// Security-focused error logger
const logError = (err, req) => {
    const logData = {
        timestamp: new Date().toISOString(),
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack
        },
        request: {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id || 'anonymous'
        }
    };

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
        console.error('Error occurred:', logData);
    }

    // Log to file (ensure logs directory exists)
    try {
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        const logFile = path.join(logsDir, `error-${new Date().toISOString().split('T')[0]}.log`);
        const logEntry = JSON.stringify(logData) + '\n';
        
        fs.appendFileSync(logFile, logEntry);
    } catch (logErr) {
        console.error('Failed to write error log:', logErr);
    }
};

// 404 handler
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Route ${req.originalUrl} not found`);
    error.statusCode = 404;
    next(error);
};

// Security event logger
const logSecurityEvent = (event, req, details = {}) => {
    const logData = {
        timestamp: new Date().toISOString(),
        event: event,
        request: {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id || 'anonymous'
        },
        details: details
    };

    // Log security events
    try {
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        const logFile = path.join(logsDir, `security-${new Date().toISOString().split('T')[0]}.log`);
        const logEntry = JSON.stringify(logData) + '\n';
        
        fs.appendFileSync(logFile, logEntry);
        
        // Also log to console in development
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Security Event:', logData);
        }
    } catch (logErr) {
        console.error('Failed to write security log:', logErr);
    }
};

module.exports = {
    errorHandler,
    notFoundHandler,
    logSecurityEvent
};
