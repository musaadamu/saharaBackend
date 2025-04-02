const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');

// Create a new submission
router.post('/', submissionController.createSubmission);

// Get all submissions
router.get('/', submissionController.getSubmissions);

// Get a single submission by ID
router.get('/:id', submissionController.getSubmissionById);

// Update submission status
router.put('/:id/status', submissionController.updateSubmissionStatus);

// Delete a submission
router.delete('/:id', submissionController.deleteSubmission);

module.exports = router;
