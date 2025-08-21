// // routes/authRoutes.js
// const express = require('express');
// const { register, login, logout, forgotPassword } = require('../controllers/authController');
// const { isAuthenticated } = require('../middlewares/authMiddleware');
// const router = express.Router();

// router.post('/register', register);
// router.post('/login', login);
// router.post('/logout', isAuthenticated, logout);
// router.post('/forgot-password', forgotPassword);

// module.exports = router;

const express = require('express');
const { register, login, logout, forgotPassword, resetPassword, updateUser, getProfile, createAdmin } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { validationRules, handleValidationErrors } = require('../middleware/security');
const router = express.Router();

// Apply strict rate limiting to auth routes
// router.use(rateLimits.auth); // Rate limiting removed for auth endpoints

// Registration with validation
router.post('/register',
    validationRules.userRegistration,
    handleValidationErrors,
    register
);

// Login with validation
router.post('/login',
    validationRules.userLogin,
    handleValidationErrors,
    login
);

// Logout (protected)
router.post('/logout', protect, logout);

// Forgot password with validation
router.post('/forgot-password',
    [validationRules.userLogin[0]], // Only email validation
    handleValidationErrors,
    forgotPassword
);

// Reset password routes
router.post('/reset-password/:token', resetPassword);
router.post('/reset-password', resetPassword);

// Profile routes (protected)
router.put('/profile', protect, updateUser);
router.get('/profile', protect, getProfile);
router.get('/me', protect, getProfile);

// Admin routes (protected + admin only)
router.post('/create-admin',
    protect,
    adminOnly,
    validationRules.userRegistration,
    handleValidationErrors,
    createAdmin
);

module.exports = router;
