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
const { register, login, logout, forgotPassword, updateUser, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);
router.put('/profile', protect, updateUser); // Route for updating user
router.get('/profile', protect, getProfile); // Route for getting user profile

module.exports = router;
