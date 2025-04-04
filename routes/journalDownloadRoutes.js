const express = require('express');
const router = express.Router();
const { 
    downloadDocxFile, 
    downloadPdfFile
} = require('../controllers/journalDownloadController');
const { validateJournalId } = require('../middleware/validateJournal');

// Match frontend URL pattern exactly
router.get('/:id/download/pdf', 
    validateJournalId,
    downloadPdfFile
);

router.get('/:id/download/docx', 
    validateJournalId,
    downloadDocxFile
);

module.exports = router;
