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

    // Extract the filename regardless of path format
    const filename = path.basename(relativePath);
    console.log('Extracted filename:', filename);

    // Create an array of possible file locations to check
    const possiblePaths = [
        // Check in the main uploads/journals directory
        path.resolve(path.join(DOCUMENT_STORAGE_PATH, filename)),
        // Check in the backend/uploads/journals directory
        path.resolve(path.join(__dirname, '..', 'uploads', 'journals', filename)),
        // Check in the parent directory's uploads/journals
        path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', filename))
    ];

    // If the path includes 'uploads/journals' or 'uploads\journals', try that specific path first
    if (relativePath.includes('uploads/journals') || relativePath.includes('uploads\\journals')) {
        // For paths like 'uploads/journals/file.pdf' or '../uploads/journals/file.pdf'
        let normalizedPath = relativePath.replace(/\.\.\//g, '').replace(/\//g, path.sep).replace(/\\\\/g, path.sep);

        // Add the specific path to the beginning of the array (highest priority)
        possiblePaths.unshift(
            path.resolve(path.join(__dirname, '..', '..', normalizedPath)),
            path.resolve(path.join(__dirname, '..', normalizedPath))
        );
    }

    // Check each path and return the first one that exists
    for (const possiblePath of possiblePaths) {
        try {
            if (require('fs').existsSync(possiblePath)) {
                console.log('File found at:', possiblePath);
                return possiblePath;
            }
        } catch (err) {
            // Continue to the next path
        }
    }

    // If no file was found, return the default path (first in the array)
    // This will likely fail later, but we need to return something
    console.log('No file found, using default path:', possiblePaths[0]);
    return possiblePaths[0];
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

            // Add CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
            console.log('Direct file access failed, trying alternative methods');

            // Try to find the file in common locations
            const fileName = path.basename(journal.pdfFilePath);
            const alternativePaths = [
                path.join(DOCUMENT_STORAGE_PATH, fileName),
                path.join(__dirname, '..', 'uploads', 'journals', fileName),
                path.join(__dirname, '..', '..', 'uploads', 'journals', fileName)
            ];

            // Check each alternative path
            let fileFound = false;
            for (const altPath of alternativePaths) {
                try {
                    if (require('fs').existsSync(altPath)) {
                        console.log('File found at alternative location:', altPath);

                        // Set headers for PDF download
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

                        // Add CORS headers
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'GET');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

                        // Stream the file
                        res.sendFile(altPath, (err) => {
                            if (err) {
                                console.error('Download error from alternative path:', err);
                                if (!res.headersSent) {
                                    res.status(500).json({ message: 'Error downloading file' });
                                }
                            }
                        });

                        fileFound = true;
                        break;
                    }
                } catch (err) {
                    // Continue to the next path
                }
            }

            // If no alternative path worked, redirect to direct-file route as last resort
            if (!fileFound) {
                console.log('No alternative paths worked, redirecting to direct-file route');
                res.redirect(`/direct-file/journals/${fileName}`);
            }
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

            // Add CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
            console.log('Direct file access failed, trying alternative methods');

            // Try to find the file in common locations
            const fileName = path.basename(journal.docxFilePath);
            const alternativePaths = [
                path.join(DOCUMENT_STORAGE_PATH, fileName),
                path.join(__dirname, '..', 'uploads', 'journals', fileName),
                path.join(__dirname, '..', '..', 'uploads', 'journals', fileName)
            ];

            // Check each alternative path
            let fileFound = false;
            for (const altPath of alternativePaths) {
                try {
                    if (require('fs').existsSync(altPath)) {
                        console.log('File found at alternative location:', altPath);

                        // Set headers for DOCX download
                        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

                        // Add CORS headers
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'GET');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

                        // Stream the file
                        res.sendFile(altPath, (err) => {
                            if (err) {
                                console.error('Download error from alternative path:', err);
                                if (!res.headersSent) {
                                    res.status(500).json({ message: 'Error downloading file' });
                                }
                            }
                        });

                        fileFound = true;
                        break;
                    }
                } catch (err) {
                    // Continue to the next path
                }
            }

            // If no alternative path worked, redirect to direct-file route as last resort
            if (!fileFound) {
                console.log('No alternative paths worked, redirecting to direct-file route');
                res.redirect(`/direct-file/journals/${fileName}`);
            }
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
