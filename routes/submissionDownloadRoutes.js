const express = require('express');
const router = express.Router();
const submissionDownloadController = require('../controllers/submissionDownloadController');
const authMiddleware = require('../middleware/authMiddleware');

// PDF download endpoint
router.get(
    '/pdf/:id',
    authMiddleware.protect,
    submissionDownloadController.downloadPdfFile
);

// DOCX download endpoint
router.get(
    '/docx/:id',
    authMiddleware.protect,
    submissionDownloadController.downloadDocxFile
);

// File content reading endpoint
router.get(
    '/content/:id',
    authMiddleware.protect,
    submissionDownloadController.readFileContent
);

module.exports = router;
