const path = require('path');
const fs = require('fs').promises;
const Journal = require('../models/Journal');

// Handle the environment variable path correctly
let DOCUMENT_STORAGE_PATH;
if (process.env.DOCUMENT_STORAGE_PATH) {
    // If it's a relative path starting with '../', resolve it relative to the current directory
    if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
        DOCUMENT_STORAGE_PATH = path.resolve(path.join(__dirname, '..', process.env.DOCUMENT_STORAGE_PATH));
    } else {
        // Otherwise, use it as is or resolve it if it's a relative path
        DOCUMENT_STORAGE_PATH = path.resolve(process.env.DOCUMENT_STORAGE_PATH);
    }
} else {
    // Fallback to a default path
    DOCUMENT_STORAGE_PATH = path.resolve(path.join(__dirname, '..', 'uploads', 'journals'));
}

// Log the storage path for debugging
console.log('Document storage path (absolute):', DOCUMENT_STORAGE_PATH);
console.log('Environment variable value:', process.env.DOCUMENT_STORAGE_PATH);

// Helper function to resolve file paths correctly
const resolveFilePath = (relativePath) => {
    // If the path is already absolute, use it directly
    if (path.isAbsolute(relativePath)) {
        console.log('Path is already absolute:', relativePath);
        return relativePath;
    }

    // Log the original path for debugging
    console.log('Original path:', relativePath);

    // If the path starts with '../', it's relative to the backend directory
    if (relativePath.startsWith('../')) {
        // Resolve it relative to the backend directory
        // First, get the correct path by splitting and joining to ensure proper path separators
        const pathParts = relativePath.split('/');
        // Remove the first '../' element
        pathParts.shift();
        // Join the remaining parts with the correct path separator
        const relativePart = pathParts.join(path.sep);

        const absolutePath = path.resolve(path.join(__dirname, '..', '..', relativePart));
        console.log('Resolved relative path:', absolutePath);
        return absolutePath;
    }

    // Extract the filename regardless of path format
    const filename = path.basename(relativePath);
    console.log('Extracted filename:', filename);

    // Create an absolute path by joining the storage path with the filename
    const absolutePath = path.resolve(path.join(DOCUMENT_STORAGE_PATH, filename));
    console.log('Resolved absolute path:', absolutePath);

    return absolutePath;
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

        try {
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
        } catch (accessError) {
            // If direct access fails, try using the direct-file route
            console.log('Direct file access failed, redirecting to direct-file route');
            const fileName = path.basename(journal.pdfFilePath);
            res.redirect(`/direct-file/journals/${fileName}`);
        }
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
                    path: error.path || 'Path not available'
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

        try {
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
        } catch (accessError) {
            // If direct access fails, try using the direct-file route
            console.log('Direct file access failed, redirecting to direct-file route');
            const fileName = path.basename(journal.docxFilePath);
            res.redirect(`/direct-file/journals/${fileName}`);
        }
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
                    path: error.path || 'Path not available'
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
                    path: error.path || 'Path not available'
                }
            });
        }

        res.status(500).json({ message: 'Server error reading file' });
    }
};
