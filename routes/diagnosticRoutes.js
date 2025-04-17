const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Journal = require('../models/Journal');

// Add a diagnostic route to check file paths
router.get('/check-file/:journalId/:fileType', async (req, res) => {
    try {
        const { journalId, fileType } = req.params;
        
        // Find the journal
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }
        
        // Get the file path based on file type
        let filePath;
        if (fileType === 'pdf') {
            filePath = journal.pdfFilePath;
        } else if (fileType === 'docx') {
            filePath = journal.docxFilePath;
        } else {
            return res.status(400).json({ message: 'Invalid file type' });
        }
        
        if (!filePath) {
            return res.status(404).json({ message: `No ${fileType} file path found for this journal` });
        }
        
        // Check possible file locations
        const possiblePaths = [
            path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, '..', 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, '..', '..', '..', 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, '..', '..', 'backend', 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, '..', '..', '..', 'backend', 'uploads', 'journals', path.basename(filePath)))
        ];
        
        // Check if DOCUMENT_STORAGE_PATH is defined
        if (process.env.DOCUMENT_STORAGE_PATH) {
            possiblePaths.push(
                path.resolve(path.join(process.env.DOCUMENT_STORAGE_PATH, path.basename(filePath)))
            );
        }
        
        // Check each path
        const results = [];
        for (const pathToCheck of possiblePaths) {
            try {
                const exists = fs.existsSync(pathToCheck);
                results.push({
                    path: pathToCheck,
                    exists
                });
            } catch (err) {
                results.push({
                    path: pathToCheck,
                    exists: false,
                    error: err.message
                });
            }
        }
        
        // Return the results
        res.json({
            journalId,
            fileType,
            filePath,
            fileName: path.basename(filePath),
            possiblePaths: results
        });
    } catch (err) {
        console.error('Error checking file:', err);
        res.status(500).json({ message: 'Error checking file', error: err.message });
    }
});

// Add a route to fix file paths in the database
router.get('/fix-file-path/:journalId/:fileType', async (req, res) => {
    try {
        const { journalId, fileType } = req.params;
        
        // Find the journal
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }
        
        // Get the current file path
        let currentPath;
        if (fileType === 'pdf') {
            currentPath = journal.pdfFilePath;
        } else if (fileType === 'docx') {
            currentPath = journal.docxFilePath;
        } else {
            return res.status(400).json({ message: 'Invalid file type' });
        }
        
        if (!currentPath) {
            return res.status(404).json({ message: `No ${fileType} file path found for this journal` });
        }
        
        // Extract the filename
        const filename = path.basename(currentPath);
        
        // Create the correct path format
        const correctPath = `uploads/journals/${filename}`;
        
        // Update the journal
        if (fileType === 'pdf') {
            journal.pdfFilePath = correctPath;
        } else if (fileType === 'docx') {
            journal.docxFilePath = correctPath;
        }
        
        // Save the journal
        await journal.save();
        
        // Return success
        res.json({
            success: true,
            journalId,
            fileType,
            oldPath: currentPath,
            newPath: correctPath
        });
    } catch (err) {
        console.error('Error fixing file path:', err);
        res.status(500).json({ message: 'Error fixing file path', error: err.message });
    }
});

module.exports = router;
