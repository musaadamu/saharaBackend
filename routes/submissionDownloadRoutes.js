const express = require('express');
const router = express.Router();
const submissionDownloadController = require('../controllers/submissionDownloadController');
const authMiddleware = require('../middleware/authMiddleware');

// PDF download endpoint
router.get(
    '/:id/download/pdf',
    authMiddleware.protect,
    submissionDownloadController.downloadPdfFile
);

// DOCX download endpoint
router.get(
    '/:id/download/docx',
    authMiddleware.protect,
    submissionDownloadController.downloadDocxFile
);

// Direct download endpoints (no authentication required)
router.get(
    '/:id/direct-download/pdf',
    submissionDownloadController.downloadPdfFile
);

router.get(
    '/:id/direct-download/docx',
    submissionDownloadController.downloadDocxFile
);

// File content reading endpoint
router.get(
    '/content/:id',
    authMiddleware.protect,
    submissionDownloadController.readFileContent
);

// Legacy endpoints for backward compatibility
router.get(
    '/pdf/:id',
    authMiddleware.protect,
    submissionDownloadController.downloadPdfFile
);

router.get(
    '/docx/:id',
    authMiddleware.protect,
    submissionDownloadController.downloadDocxFile
);

module.exports = router;
