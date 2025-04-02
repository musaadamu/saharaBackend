const express = require("express");
const journalController = require("../controllers/journalController");

const router = express.Router();

// Upload journal
router.post("/", 
    journalController.uploadMiddleware, 
    journalController.uploadJournal
);

// Get all journals
router.get("/", journalController.getJournals);

// Search journals
router.get("/search", journalController.searchJournals);

// Get journal by ID
router.get("/:id", journalController.getJournalById);

// Update journal status
router.patch("/:id/status", journalController.updateJournalStatus);

// Delete journal
router.delete("/:id", journalController.deleteJournal);

module.exports = router;