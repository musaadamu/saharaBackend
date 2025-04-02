const path = require('path');
const fs = require('fs').promises;
const Journal = require('../models/Journal');

// Use an absolute path that includes 'backend'
const DOCUMENT_STORAGE_PATH = path.join(__dirname, '..', 'uploads', 'journals');

exports.downloadPdfFile = async (req, res) => {
    try {
        const journalId = req.params.id;

        // Find the journal by ID
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }

        // Use the stored PDF file path
        const filePath = path.join(__dirname, '..', journal.pdfFilePath.replace(/\\/g, '/'));

        console.log('Attempting to download PDF file:', filePath);

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

        // Use the stored DOCX file path
        const filePath = path.join(__dirname, '..', journal.docxFilePath.replace(/\\/g, '/'));

        console.log('Attempting to download DOCX file:', filePath);

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

        // Use the stored PDF file path
        const filePath = path.join(__dirname, '..', journal.pdfFilePath.replace(/\\/g, '/'));

        console.log('Attempting to read file content:', filePath);

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
