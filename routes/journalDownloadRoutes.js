const express = require('express');
const router = express.Router();
const {
    downloadDocxFile,
    downloadPdfFile
} = require('../controllers/journalDownloadController');
const {
    directDownloadPdf,
    directDownloadDocx
} = require('../controllers/directDownloadController');
const { validateJournalId } = require('../middleware/validateJournal');

// Download PDF file from Google Drive
router.get('/:id/download/pdf',
    validateJournalId,
    downloadPdfFile
);

// Download DOCX file from Google Drive
router.get('/:id/download/docx',
    validateJournalId,
    downloadDocxFile
);

// Direct download PDF file (bypasses Cloudinary access control)
router.get('/:id/direct-download/pdf',
    validateJournalId,
    directDownloadPdf
);

// Direct download DOCX file (bypasses Cloudinary access control)
router.get('/:id/direct-download/docx',
    validateJournalId,
    directDownloadDocx
);

// New endpoint to check if file exists for diagnostic purposes
router.get('/check-file/:id/:fileType', validateJournalId, async (req, res) => {
    try {
        const journalId = req.params.id;
        const fileType = req.params.fileType.toLowerCase();

        const Journal = require('../models/Journal');
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ exists: false, message: 'Journal not found' });
        }

        let filePath;
        if (fileType === 'pdf') {
            filePath = journal.pdfFilePath;
        } else if (fileType === 'docx') {
            filePath = journal.docxFilePath;
        } else {
            return res.status(400).json({ exists: false, message: 'Invalid file type' });
        }

        const path = require('path');
        const fs = require('fs');

        // Resolve absolute path similar to controller helper
        const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH
            ? (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')
                ? path.resolve(path.join(__dirname, '..', process.env.DOCUMENT_STORAGE_PATH))
                : path.resolve(process.env.DOCUMENT_STORAGE_PATH))
            : path.resolve(path.join(__dirname, '..', 'uploads', 'journals'));

        const resolveFilePath = (relativePath) => {
            if (path.isAbsolute(relativePath)) {
                return relativePath;
            }
            const filename = path.basename(relativePath);
            const possiblePaths = [
                path.resolve(path.join(DOCUMENT_STORAGE_PATH, filename)),
                path.resolve(path.join(__dirname, '..', 'uploads', 'journals', filename)),
                path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', filename))
            ];
            if (relativePath.includes('uploads/journals') || relativePath.includes('uploads\\journals')) {
                let normalizedPath = relativePath.replace(/\.\.\//g, '').replace(/\//g, path.sep).replace(/\\\\/g, path.sep);
                possiblePaths.unshift(
                    path.resolve(path.join(__dirname, '..', '..', normalizedPath)),
                    path.resolve(path.join(__dirname, '..', normalizedPath))
                );
            }
            for (const possiblePath of possiblePaths) {
                try {
                    if (fs.existsSync(possiblePath)) {
                        return possiblePath;
                    }
                } catch (err) {
                    continue;
                }
            }
            return possiblePaths[0];
        };

        const absoluteFilePath = resolveFilePath(filePath);

        if (fs.existsSync(absoluteFilePath)) {
            return res.status(200).json({ exists: true, fileName: path.basename(absoluteFilePath) });
        } else {
            return res.status(404).json({ exists: false, fileName: path.basename(absoluteFilePath) });
        }
    } catch (error) {
        console.error('Check file existence error:', error);
        return res.status(500).json({ exists: false, message: 'Server error checking file existence' });
    }
});

module.exports = router;
