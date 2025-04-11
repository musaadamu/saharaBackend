const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');

// Upload submission with file - use the same approach as journalRoutes
router.post("/", (req, res, next) => {
    submissionController.uploadMiddleware(req, res, (err) => {
        if (err) {
            console.error('Multer error in route handler:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    message: 'File too large. Max size is 50MB'
                });
            } else if (err.message.includes('Only .docx files are allowed')) {
                return res.status(400).json({
                    message: 'Invalid file type. Only .docx files are allowed'
                });
            }
            return res.status(500).json({
                message: 'File upload failed',
                error: err.message
            });
        }
        console.log('File upload successful in route handler:', req.file);
        next();
    });
}, submissionController.uploadSubmission);

// Test endpoint for file uploads
router.post("/test-upload", (req, res, next) => {
    submissionController.uploadMiddleware(req, res, (err) => {
        if (err) {
            console.error('Multer error in test endpoint:', err);
            return res.status(500).json({
                message: 'File upload failed',
                error: err.message
            });
        }
        console.log('Test upload endpoint called');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);

        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded',
                receivedFields: Object.keys(req.body || {})
            });
        }

        res.status(200).json({
            message: 'File upload test successful',
            file: req.file,
            body: req.body
        });
    });
});

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
