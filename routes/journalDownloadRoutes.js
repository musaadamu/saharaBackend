const express = require('express');
const router = express.Router();
const { 
    downloadDocxFile, 
    downloadPdfFile, 
    readFileContent 
} = require('../controllers/journalDownloadController');

// Routes for downloading files
router.get('/journals/:id/download/pdf', downloadPdfFile);
router.get('/journals/:id/download/docx', downloadDocxFile);

// Optional: Route for reading file content
router.get('/journals/:id/content', readFileContent);

module.exports = router;
