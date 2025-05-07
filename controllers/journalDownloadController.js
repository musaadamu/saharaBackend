const path = require('path');
const fs = require('fs');
const Journal = require('../models/Journal');
const { downloadFile } = require('../utils/googleDrive');

async function streamFile(res, filePath, contentType, fileName, isTemp = false) {
    console.log(`Streaming file: ${filePath}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`Filename: ${fileName}`);
    console.log(`Is temporary file: ${isTemp}`);

    try {
        // Check if file exists and is readable
        await fs.promises.access(filePath, fs.constants.R_OK);

        // Get file stats
        const stats = await fs.promises.stat(filePath);
        console.log(`File size: ${stats.size} bytes`);

        if (stats.size === 0) {
            throw new Error('File is empty (0 bytes)');
        }

        // Set headers with more robust error handling
        try {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Cache-Control', 'no-cache');

            // Add CORS headers to prevent issues
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        } catch (headerError) {
            console.error('Error setting headers:', headerError);
            // Continue anyway, as some headers might have been set successfully
        }

        // Stream the file with improved error handling
        try {
            const fileStream = fs.createReadStream(filePath);

            // Set up error handler before piping
            fileStream.on('error', (err) => {
                console.error(`Error streaming file ${filePath}:`, err);
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error streaming file', error: err.message });
                } else if (!res.finished) {
                    res.end();
                }
            });

            // Handle cleanup when streaming is done
            fileStream.on('end', async () => {
                console.log(`Finished streaming file: ${filePath}`);

                // Delete temp files
                if (isTemp) {
                    try {
                        await fs.promises.unlink(filePath);
                        console.log(`Deleted temp file: ${filePath}`);
                    } catch (err) {
                        console.error('Error deleting temp file:', err);
                    }
                }
            });

            // Handle response close/finish
            res.on('close', () => {
                fileStream.destroy();
                console.log('Response closed, stream destroyed');
            });

            // Now pipe the file to the response
            fileStream.pipe(res);
        } catch (streamError) {
            console.error('Error creating read stream:', streamError);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error creating file stream', error: streamError.message });
            }
        }
    } catch (error) {
        console.error(`Error preparing file ${filePath} for streaming:`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error preparing file for download', error: error.message });
        }
    }
}

exports.downloadPdfFile = async (req, res) => {
    console.log('\n\n🔴🔴🔴 DOWNLOAD PDF FILE REQUESTED 🔴🔴🔴');
    console.log('Request received at:', new Date().toISOString());

    try {
        const journalId = req.params.id;
        console.log('Journal ID:', journalId);

        // Find the journal
        const journal = await Journal.findById(journalId);
        if (!journal) {
            console.error('Journal not found with ID:', journalId);
            return res.status(404).json({ message: 'Journal not found' });
        }

        console.log('Journal found:', {
            id: journal._id,
            title: journal.title,
            pdfFileId: journal.pdfFileId || 'Not set',
            pdfFilePath: journal.pdfFilePath || 'Not set'
        });

        // Try multiple methods to download the file
        let downloadSuccess = false;

        // Method 1: Try Google Drive if we have a file ID
        if (journal.pdfFileId) {
            try {
                console.log('Method 1: Downloading PDF from Google Drive with ID:', journal.pdfFileId);
                const tempDir = path.join(__dirname, '..', 'temp');
                await fs.promises.mkdir(tempDir, { recursive: true });
                const tempFilePath = path.join(tempDir, `${journal.pdfFileId}.pdf`);

                await downloadFile(journal.pdfFileId, tempFilePath);
                await streamFile(res, tempFilePath, 'application/pdf', `${journal.title}.pdf`, true);
                downloadSuccess = true;
                console.log('Successfully downloaded PDF from Google Drive');
                return;
            } catch (driveError) {
                console.error('Failed to download from Google Drive:', driveError);
                // Continue to next method
            }
        }

        // Method 2: Try local file path
        if (!downloadSuccess && journal.pdfFilePath) {
            try {
                console.log('Method 2: Using local PDF file path:', journal.pdfFilePath);

                // Try multiple possible locations for the file
                const possiblePaths = [];

                // Add path based on DOCUMENT_STORAGE_PATH if it exists
                if (process.env.DOCUMENT_STORAGE_PATH) {
                    if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
                        const storagePath = process.env.DOCUMENT_STORAGE_PATH.replace(/^\.\.\//, '');
                        possiblePaths.push(
                            path.resolve(path.join(__dirname, '..', storagePath, path.basename(journal.pdfFilePath)))
                        );
                    } else {
                        possiblePaths.push(
                            path.resolve(path.join(process.env.DOCUMENT_STORAGE_PATH, path.basename(journal.pdfFilePath)))
                        );
                    }
                }

                // Add other possible paths
                possiblePaths.push(
                    path.resolve(path.join(__dirname, '..', 'uploads', 'journals', path.basename(journal.pdfFilePath))),
                    path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', path.basename(journal.pdfFilePath))),
                    path.resolve(path.join(__dirname, '..', '..', '..', 'uploads', 'journals', path.basename(journal.pdfFilePath)))
                );

                console.log('Looking for PDF file in these locations:', possiblePaths);

                // Find the first path that exists
                let filePath = null;
                for (const possiblePath of possiblePaths) {
                    if (fs.existsSync(possiblePath)) {
                        filePath = possiblePath;
                        break;
                    }
                }

                if (!filePath) {
                    console.error('PDF file not found in any of the possible locations');
                    // Continue to next method
                } else {
                    console.log('PDF file found at:', filePath);
                    await streamFile(res, filePath, 'application/pdf', `${journal.title}.pdf`, false);
                    downloadSuccess = true;
                    return;
                }
            } catch (localError) {
                console.error('Failed to download from local path:', localError);
                // Continue to next method
            }
        }

        // If we get here, no file was found or all methods failed
        if (!downloadSuccess) {
            console.error('All download methods failed for PDF file');
            return res.status(404).json({
                message: 'No PDF file found for this journal',
                journalId,
                pdfFileId: journal.pdfFileId || 'Not set',
                pdfFilePath: journal.pdfFilePath || 'Not set'
            });
        }
    } catch (error) {
        console.error('Error downloading PDF file:', error);
        res.status(500).json({
            message: 'Server error during PDF download',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

exports.downloadDocxFile = async (req, res) => {
    console.log('\n\n🔴🔴🔴 DOWNLOAD DOCX FILE REQUESTED 🔴🔴🔴');
    console.log('Request received at:', new Date().toISOString());

    try {
        const journalId = req.params.id;
        console.log('Journal ID:', journalId);

        // Find the journal
        const journal = await Journal.findById(journalId);
        if (!journal) {
            console.error('Journal not found with ID:', journalId);
            return res.status(404).json({ message: 'Journal not found' });
        }

        console.log('Journal found:', {
            id: journal._id,
            title: journal.title,
            docxFileId: journal.docxFileId || 'Not set',
            docxFilePath: journal.docxFilePath || 'Not set'
        });

        // Try multiple methods to download the file
        let downloadSuccess = false;

        // Method 1: Try Google Drive if we have a file ID
        if (journal.docxFileId) {
            try {
                console.log('Method 1: Downloading DOCX from Google Drive with ID:', journal.docxFileId);
                const tempDir = path.join(__dirname, '..', 'temp');
                await fs.promises.mkdir(tempDir, { recursive: true });
                const tempFilePath = path.join(tempDir, `${journal.docxFileId}.docx`);

                await downloadFile(journal.docxFileId, tempFilePath);
                await streamFile(res, tempFilePath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `${journal.title}.docx`, true);
                downloadSuccess = true;
                console.log('Successfully downloaded DOCX from Google Drive');
                return;
            } catch (driveError) {
                console.error('Failed to download from Google Drive:', driveError);
                // Continue to next method
            }
        }

        // Method 2: Try local file path
        if (!downloadSuccess && journal.docxFilePath) {
            try {
                console.log('Method 2: Using local DOCX file path:', journal.docxFilePath);

                // Try multiple possible locations for the file
                const possiblePaths = [];

                // Add path based on DOCUMENT_STORAGE_PATH if it exists
                if (process.env.DOCUMENT_STORAGE_PATH) {
                    if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
                        const storagePath = process.env.DOCUMENT_STORAGE_PATH.replace(/^\.\.\//, '');
                        possiblePaths.push(
                            path.resolve(path.join(__dirname, '..', storagePath, path.basename(journal.docxFilePath)))
                        );
                    } else {
                        possiblePaths.push(
                            path.resolve(path.join(process.env.DOCUMENT_STORAGE_PATH, path.basename(journal.docxFilePath)))
                        );
                    }
                }

                // Add other possible paths
                possiblePaths.push(
                    path.resolve(path.join(__dirname, '..', 'uploads', 'journals', path.basename(journal.docxFilePath))),
                    path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', path.basename(journal.docxFilePath))),
                    path.resolve(path.join(__dirname, '..', '..', '..', 'uploads', 'journals', path.basename(journal.docxFilePath)))
                );

                console.log('Looking for DOCX file in these locations:', possiblePaths);

                // Find the first path that exists
                let filePath = null;
                for (const possiblePath of possiblePaths) {
                    if (fs.existsSync(possiblePath)) {
                        filePath = possiblePath;
                        break;
                    }
                }

                if (!filePath) {
                    console.error('DOCX file not found in any of the possible locations');
                    // Continue to next method
                } else {
                    console.log('DOCX file found at:', filePath);
                    await streamFile(res, filePath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `${journal.title}.docx`, false);
                    downloadSuccess = true;
                    return;
                }
            } catch (localError) {
                console.error('Failed to download from local path:', localError);
                // Continue to next method
            }
        }

        // If we get here, no file was found or all methods failed
        if (!downloadSuccess) {
            console.error('All download methods failed for DOCX file');
            return res.status(404).json({
                message: 'No DOCX file found for this journal',
                journalId,
                docxFileId: journal.docxFileId || 'Not set',
                docxFilePath: journal.docxFilePath || 'Not set'
            });
        }
    } catch (error) {
        console.error('Error downloading DOCX file:', error);
        res.status(500).json({
            message: 'Server error during DOCX download',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
