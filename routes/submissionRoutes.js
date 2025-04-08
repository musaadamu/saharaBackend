const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');

// Upload submission with file
router.post(
    '/',
    submissionController.uploadMiddleware,
    submissionController.uploadSubmission
);

// Get all submissions with pagination and filtering
router.get('/', submissionController.getSubmissions);

// Search submissions
router.get('/search', submissionController.searchSubmissions);

// Get a single submission by ID
router.get('/:id', submissionController.getSubmissionById);

// Update submission status
router.patch('/:id/status', submissionController.updateSubmissionStatus);

// Delete a submission
router.delete('/:id', submissionController.deleteSubmission);

module.exports = router;
