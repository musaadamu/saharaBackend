const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logSecurityEvent } = require('./errorHandler');

exports.protect = async (req, res, next) => {
    let token;

    // Extract token from Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', req, { reason: 'No token provided' });
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            logSecurityEvent('INVALID_TOKEN_USER_NOT_FOUND', req, { userId: decoded.id });
            return res.status(401).json({
                success: false,
                message: 'Token is no longer valid.'
            });
        }

        // Check if token was issued before password change (if implemented)
        // This would require adding a passwordChangedAt field to User model

        req.user = user;
        next();
    } catch (err) {
        let message = 'Invalid token';
        if (err.name === 'TokenExpiredError') {
            message = 'Token has expired';
            logSecurityEvent('EXPIRED_TOKEN_ACCESS', req, { error: err.message });
        } else if (err.name === 'JsonWebTokenError') {
            message = 'Invalid token format';
            logSecurityEvent('INVALID_TOKEN_ACCESS', req, { error: err.message });
        } else {
            logSecurityEvent('TOKEN_VERIFICATION_ERROR', req, { error: err.message });
        }

        return res.status(401).json({
            success: false,
            message: message
        });
    }
};

// Admin-only access middleware
exports.adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.role !== 'admin') {
        logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', req, {
            userId: req.user.id,
            userRole: req.user.role
        });
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }

    next();
};

// Editor or Admin access middleware
exports.editorOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (!['editor', 'admin'].includes(req.user.role)) {
        logSecurityEvent('UNAUTHORIZED_EDITOR_ACCESS', req, {
            userId: req.user.id,
            userRole: req.user.role
        });
        return res.status(403).json({
            success: false,
            message: 'Access denied. Editor or Admin privileges required.'
        });
    }

    next();
};

// Admin only middleware
exports.adminOnly = async (req, res, next) => {
    try {
        // First check if the user is authenticated
        if (!req.user || !req.user.id) {
            console.log('Admin check failed: No authenticated user');
            return res.status(401).json({ message: 'Not authorized to access this route' });
        }

        // Find the user in the database to check their role
        const user = await User.findById(req.user.id);

        if (!user) {
            console.log('Admin check failed: User not found');
            return res.status(401).json({ message: 'User not found' });
        }

        // Check if the user has admin role
        if (user.role !== 'admin') {
            console.log('Admin check failed: User is not an admin, role:', user.role);
            return res.status(403).json({ message: 'Admin access required' });
        }

        console.log('Admin access granted for user:', user.email);
        next();
    } catch (err) {
        console.error('Admin check error:', err);
        return res.status(500).json({ message: 'Server error during authorization check' });
    }
};
