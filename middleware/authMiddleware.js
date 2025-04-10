const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = (req, res, next) => {
    let token;
    console.log('Auth headers:', req.headers.authorization);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log('Token extracted:', token ? 'Token found' : 'No token');
    }

    if (!token) {
        console.log('Authorization failed: No token provided');
        return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token verified successfully for user:', decoded.id);
        req.user = decoded; // Assuming the token contains user information
        next();
    } catch (err) {
        console.log('Token verification failed:', err.message);
        return res.status(401).json({ message: 'Not authorized to access this route' });
    }
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
