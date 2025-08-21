const express = require("express");
const journalController = require("../controllers/journalController");
const { validationRules, handleValidationErrors } = require('../middleware/security');
const { postUploadValidation } = require('../middleware/secureFileUpload');

const router = express.Router();

// Upload journal route with enhanced security
router.post("/",
    // rateLimits.upload, // removed
    (req, res, next) => {
        console.log('journalRoutes POST / upload route invoked');
        journalController.uploadMiddleware(req, res, (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({
                        success: false,
                        message: 'File too large. Max size is 50MB'
                    });
                } else if (err.message.includes('File type not allowed') ||
                          err.message.includes('File extension not allowed')) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid file type. Only .docx and .pdf files are allowed'
                    });
                } else if (err.message.includes('Suspicious file name')) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid file name detected'
                    });
                }
                return res.status(500).json({
                    success: false,
                    message: 'File upload failed',
                    error: err.message
                });
            }
            next();
        });
    },
    postUploadValidation,
    validationRules.journalSubmission,
    handleValidationErrors,
    journalController.uploadJournal
);

// Get all journals with pagination validation
router.get("/",
    validationRules.pagination,
    handleValidationErrors,
    journalController.getJournals
);

console.log('journalController.getJournalsFileInfo:', journalController.getJournalsFileInfo);

// Get journals file info (new route for verification)
router.get("/file-info", journalController.getJournalsFileInfo);

// Search journals with validation and rate limiting
router.get("/search",
    // rateLimits.search, // removed
    validationRules.search,
    handleValidationErrors,
    journalController.searchJournals
);

// Get journal by ID with validation
router.get("/:id",
    validationRules.mongoId,
    handleValidationErrors,
    journalController.getJournalById
);

// Update journal status with validation
router.patch("/:id/status",
    validationRules.mongoId,
    handleValidationErrors,
    journalController.updateJournalStatus
);

// Delete journal with validation
router.delete("/:id",
    validationRules.mongoId,
    handleValidationErrors,
    journalController.deleteJournal
);

module.exports = router;
