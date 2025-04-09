const express = require("express");
const journalController = require("../controllers/journalController");

const router = express.Router();

// Public routes
router.get("/", journalController.getJournals);
router.get("/search", journalController.searchJournals);
router.get("/:id", journalController.getJournalById);

// Protected routes would go here if needed
// router.post("/", protect, journalController.uploadJournal);
// router.patch("/:id/status", protect, journalController.updateJournalStatus);
// router.delete("/:id", protect, journalController.deleteJournal);

module.exports = router;
