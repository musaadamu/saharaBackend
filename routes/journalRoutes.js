const express = require("express");
const journalController = require("../controllers/journalController");

const router = express.Router();

// Upload journal route (no authentication required)
router.post("/", (req, res, next) => {
    console.log('journalRoutes POST / upload route invoked');
    journalController.uploadMiddleware(req, res, (err) => {
        if (err) {
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
        next();
    });
}, journalController.uploadJournal);

// Get all journals
router.get("/", journalController.getJournals);

console.log('journalController.getJournalsFileInfo:', journalController.getJournalsFileInfo);

// Get journals file info (new route for verification)
router.get("/file-info", journalController.getJournalsFileInfo);

// Search journals
router.get("/search", journalController.searchJournals);

// Get journal by ID
router.get("/:id", journalController.getJournalById);

// Update journal status
router.patch("/:id/status", journalController.updateJournalStatus);

// Delete journal
router.delete("/:id", journalController.deleteJournal);

module.exports = router;
