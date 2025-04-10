const path = require('path');
const fs = require('fs').promises;
const Journal = require('../models/Journal');

// Use environment variable or fallback to a default path
const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || path.join(__dirname, '..', 'uploads', 'journals');

// Log the storage path for debugging
console.log('Document storage path:', DOCUMENT_STORAGE_PATH);

// Helper function to resolve file paths correctly
const resolveFilePath = (relativePath) => {
    // If the path is already absolute, use it directly
    if (path.isAbsolute(relativePath)) {
        return relativePath;
    }

    // If the path starts with 'uploads/', remove that prefix as we'll add the full path
    const normalizedPath = relativePath.replace(/^uploads[\\/]/, '');

    // Join with the storage path
    return path.join(DOCUMENT_STORAGE_PATH, normalizedPath);
};

exports.downloadPdfFile = async (req, res) => {
    try {
        const journalId = req.params.id;

        // Find the journal by ID
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }

        // Use the stored PDF file path with our helper function
        const filePath = resolveFilePath(journal.pdfFilePath);

        console.log('Journal PDF path from DB:', journal.pdfFilePath);
        console.log('Resolved PDF file path:', filePath);
        console.log('Attempting to download PDF file');

        // Check if file exists
        await fs.access(filePath);

        // Extract filename from the path
        const fileName = path.basename(filePath);

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        // Stream the file
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error downloading file' });
                }
            }
        });
    } catch (error) {
        console.error('File download error:', error);

        // Log additional error details
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            path: error.path
        });

        if (error.code === 'ENOENT') {
            return res.status(404).json({
                message: 'File not found',
                details: {
                    journalId: req.params.id,
                    storedPath: journal.pdfFilePath
                }
            });
        }

        res.status(500).json({ message: 'Server error during file download' });
    }
};

exports.downloadDocxFile = async (req, res) => {
    try {
        const journalId = req.params.id;

        // Find the journal by ID
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }

        // Use the stored DOCX file path with our helper function
        const filePath = resolveFilePath(journal.docxFilePath);

        console.log('Journal DOCX path from DB:', journal.docxFilePath);
        console.log('Resolved DOCX file path:', filePath);
        console.log('Attempting to download DOCX file');

        // Check if file exists
        await fs.access(filePath);

        // Extract filename from the path
        const fileName = path.basename(filePath);

        // Set headers for DOCX download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        // Stream the file
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error downloading file' });
                }
            }
        });
    } catch (error) {
        console.error('File download error:', error);

        // Log additional error details
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            path: error.path
        });

        if (error.code === 'ENOENT') {
            return res.status(404).json({
                message: 'File not found',
                details: {
                    journalId: req.params.id,
                    storedPath: journal.docxFilePath
                }
            });
        }

        res.status(500).json({ message: 'Server error during file download' });
    }
};

exports.readFileContent = async (req, res) => {
    try {
        const journalId = req.params.id;

        // Find the journal by ID
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }

        // Use the stored PDF file path with our helper function
        const filePath = resolveFilePath(journal.pdfFilePath);

        console.log('Journal PDF path from DB:', journal.pdfFilePath);
        console.log('Resolved PDF file path:', filePath);
        console.log('Attempting to read file content');

        // Check if file exists
        await fs.access(filePath);

        // Stream the file content
        res.sendFile(filePath);
    } catch (error) {
        console.error('File read error:', error);

        // Log additional error details
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            path: error.path
        });

        if (error.code === 'ENOENT') {
            return res.status(404).json({
                message: 'File not found',
                details: {
                    journalId: req.params.id,
                    storedPath: journal.pdfFilePath
                }
            });
        }

        res.status(500).json({ message: 'Server error reading file' });
    }
};
