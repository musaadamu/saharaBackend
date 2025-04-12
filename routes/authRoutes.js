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
const { register, login, logout, forgotPassword, updateUser, getProfile, createAdmin } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);
router.put('/profile', protect, updateUser); // Route for updating user
router.get('/profile', protect, getProfile); // Route for getting user profile
router.get('/me', protect, getProfile); // Alias for /profile to match frontend expectations
router.post('/create-admin', protect, adminOnly, createAdmin); // Route for creating admin users (admin only)

module.exports = router;
