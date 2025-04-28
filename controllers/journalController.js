
const fs = require("fs");
const fsPromises = require("fs").promises;
const Journal = require("../models/Journal");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const { uploadFile, deleteFile } = require("../utils/googleDrive");

// Helper function to get the upload directory path
const getUploadDir = () => {
    let uploadDir;
    if (process.env.DOCUMENT_STORAGE_PATH) {
        // If it's a relative path starting with '../', resolve it relative to the current directory
        if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
            uploadDir = path.resolve(path.join(__dirname, '..', process.env.DOCUMENT_STORAGE_PATH));
        } else {
            // Otherwise, use it as is or resolve it if it's a relative path
            uploadDir = path.resolve(process.env.DOCUMENT_STORAGE_PATH);
        }
    } else {
        // Fallback to a default path
        uploadDir = path.resolve(path.join(__dirname, '..', 'uploads', 'journals'));
    }
    return uploadDir;
};

// Create uploads directory if it doesn't exist
const ensureUploadsDir = async () => {
    const uploadDir = getUploadDir();
    console.log('Ensuring upload directory exists (absolute path):', uploadDir);
    try {
        await fsPromises.mkdir(uploadDir, { recursive: true });
        console.log(`Ensured upload directory exists: ${uploadDir}`);
        return true;
    } catch (error) {
        console.error(`Failed to create upload directory: ${uploadDir}`, error);
        return false;
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = getUploadDir();
        console.log('Upload directory (absolute):', uploadDir);
        try {
            // Create the directory with recursive option to create parent directories if they don't exist
            await fsPromises.mkdir(uploadDir, { recursive: true });
            console.log('Upload directory created or already exists');
            cb(null, uploadDir);
        } catch (error) {
            console.error('Error creating upload directory:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const fileFilter = (req, file, cb) => {
    try {
        console.log('Filtering file:', file.originalname, file.mimetype);
        const extname = path.extname(file.originalname).toLowerCase();
        const mimetype = file.mimetype;
        const isDocx = extname === '.docx' &&
            (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
             mimetype === 'application/docx' ||
             mimetype === 'application/vnd.ms-word');

        if (isDocx) {
            console.log('File accepted:', file.originalname);
            cb(null, true);
        } else {
            console.log('File rejected:', file.originalname, 'Mimetype:', mimetype, 'Extension:', extname);
            cb(new Error('Only .docx files are allowed!'), false);
        }
    } catch (error) {
        console.error('Error in file filter:', error);
        cb(error, false);
    }
};

// Call this function to ensure the directory exists
ensureUploadsDir();

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
        parts: 50
    }
});

// Helper function to process array data from form
const processArrayData = (data) => {
    let result = [];
    try {
        if (Array.isArray(data)) {
            result = data;
        } else if (typeof data === 'string') {
            // Check if it's a JSON string
            if (data.startsWith('[') && data.endsWith(']')) {
                try {
                    result = JSON.parse(data);
                } catch (e) {
                    // If parsing fails, treat as comma-separated string
                    result = data.split(',').map(item => item.trim());
                }
            } else {
                // Treat as comma-separated string
                result = data.split(',').map(item => item.trim());
            }
        }
    } catch (e) {
        console.error('Error processing array data:', e);
        result = [];
    }
    return result;
};

// Helper function to clean up files
const cleanupFiles = async (docxPath, pdfPath) => {
    try {
        if (docxPath) {
            console.log('Cleaning up docx file:', docxPath);
            await fsPromises.unlink(docxPath).catch(e => console.error('Error deleting docx:', e));
        }
        if (pdfPath) {
            console.log('Cleaning up PDF file:', pdfPath);
            await fsPromises.unlink(pdfPath).catch(e => console.error('Error deleting pdf:', e));
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
};

exports.uploadMiddleware = upload.single('file');

// Convert DOCX to PDF using mammoth HTML extraction and Puppeteer for better formatting
const puppeteer = require('puppeteer');

async function convertDocxToPdf(docxPath) {
    console.log('=== PDF CONVERSION STARTED (HTML + Puppeteer) ===');
    console.log('Converting DOCX to PDF:', docxPath);
    const pdfPath = docxPath.replace('.docx', '.pdf');
    console.log('Target PDF path:', pdfPath);

    try {
        // Check if DOCX file exists
        try {
            await fsPromises.access(docxPath, fs.constants.F_OK);
            const stats = await fsPromises.stat(docxPath);
            console.log('DOCX file exists, size:', stats.size, 'bytes');
            if (stats.size === 0) {
                throw new Error('DOCX file is empty (0 bytes)');
            }
        } catch (err) {
            console.error('ERROR: DOCX file does not exist or cannot be accessed:', err);
            throw err;
        }

        // Extract HTML from DOCX
        console.log('Reading DOCX file for HTML extraction');
        const buffer = await fsPromises.readFile(docxPath);
        console.log('DOCX file read successfully, buffer size:', buffer.length, 'bytes');

        console.log('Extracting HTML from DOCX...');
        const extractedHtml = await mammoth.convertToHtml({ buffer });
        console.log('HTML extracted successfully, length:', extractedHtml.value.length, 'characters');

        if (extractedHtml.value.length === 0) {
            console.error('ERROR: Extracted HTML is empty');
            throw new Error('Extracted HTML is empty');
        }

        // Launch Puppeteer to render HTML to PDF
        console.log('Launching Puppeteer to render PDF');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Set content with basic styling for better PDF appearance
        const htmlContent = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; }
                    th { background-color: #f2f2f2; text-align: left; }
                    p, h1, h2, h3, h4, h5, h6 { margin: 0 0 10px 0; }
                    .center { text-align: center; }
                </style>
            </head>
            <body>
                ${extractedHtml.value}
            </body>
            </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });

        await browser.close();

        // Verify PDF was created
        try {
            const pdfStats = await fsPromises.stat(pdfPath);
            console.log('PDF created successfully at:', pdfPath, 'size:', pdfStats.size, 'bytes');
            if (pdfStats.size === 0) {
                throw new Error('Generated PDF file is empty (0 bytes)');
            }
        } catch (err) {
            console.error('ERROR: PDF verification failed:', err);
            throw err;
        }

        console.log('=== PDF CONVERSION COMPLETED SUCCESSFULLY ===');
        return pdfPath;
    } catch (error) {
        console.error('=== PDF CONVERSION FAILED ===');
        console.error('Failed to convert DOCX to PDF:', error);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        throw new Error('Failed to convert DOCX to PDF: ' + error.message);
    }
}

// Upload and convert DOCX to PDF
exports.uploadJournal = async (req, res) => {
    try {
        console.log('🔴🔴🔴 UPLOAD JOURNAL PROCESS STARTED - MODIFIED VERSION (TIMESTAMP: ' + new Date().toISOString() + ') 🔴🔴🔴');
        console.log('Upload journal request received');
        console.log('Request body:', req.body);
        console.log('Uploaded file:', req.file ? 'File received' : 'No file received');
        console.log('SERVER RESTART TEST - THIS LINE SHOULD APPEAR IN LOGS');
        if (req.file) {
            console.log('File details:', {
                filename: req.file.filename,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path
            });
        }
        console.log('Storage path:', process.env.DOCUMENT_STORAGE_PATH);
        console.log('Current directory:', __dirname);
        console.log('Google Drive Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
        console.log('Google Drive Credentials:');
        console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'Not set');
        console.log('- Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + '...' : 'Not set');
        console.log('- Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN ? process.env.GOOGLE_REFRESH_TOKEN.substring(0, 10) + '...' : 'Not set');

        const { title, abstract } = req.body;
        const file = req.file;

        if (!file) {
            console.log('No file uploaded');
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Validate required fields
        if (!title || !abstract) {
            console.log('Missing required fields:', {title, abstract});
            return res.status(400).json({ message: "Title and abstract are required" });
        }

        // Process authors and keywords from form data
        console.log('Processing authors:', req.body.authors);
        const authors = processArrayData(req.body.authors);
        console.log('Processed authors:', authors);

        console.log('Processing keywords:', req.body.keywords);
        const keywords = processArrayData(req.body.keywords);
        console.log('Processed keywords:', keywords);

        // Convert DOCX to PDF
        let pdfPath = null;
        try {
            pdfPath = await convertDocxToPdf(file.path);
            console.log('PDF generated at:', pdfPath);
        } catch (error) {
            console.error('PDF conversion failed:', error);
            // Continue with upload even if PDF conversion fails
        }

        // Create a temporary journal ID for file metadata
        const tempJournalId = new mongoose.Types.ObjectId();
        console.log('Created temporary journal ID for file metadata:', tempJournalId);

        // Upload DOCX file to Google Drive
        console.log('Uploading DOCX to Google Drive');
        console.log('Google Drive Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
        console.log('Google Drive Credentials:');
        console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'Not set');
        console.log('- Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + '...' : 'Not set');
        console.log('- Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN ? process.env.GOOGLE_REFRESH_TOKEN.substring(0, 10) + '...' : 'Not set');

        let docxUploadResult = null;
        let docxUploadError = null;
        try {
            // Verify file exists before upload
            await fsPromises.access(file.path, fs.constants.F_OK);
            const stats = await fsPromises.stat(file.path);
            console.log('DOCX file exists and is ready for upload, size:', stats.size, 'bytes');

            // Attempt to upload to Google Drive
            docxUploadResult = await uploadFile(
                file.path,
                file.filename,
                process.env.GOOGLE_DRIVE_FOLDER_ID,
                tempJournalId
            );
            console.log('DOCX file uploaded to Google Drive successfully:', docxUploadResult);
        } catch (error) {
            docxUploadError = error;
            console.error('CRITICAL ERROR: Failed to upload DOCX to Google Drive:', error);
            console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            // Don't throw here, we'll handle it later
        }

        // Upload PDF file to Google Drive if conversion was successful
        let pdfUploadResult = null;
        let pdfUploadError = null;
        if (pdfPath) {
            console.log('Uploading PDF to Google Drive');
            try {
                // Verify PDF file exists before upload
                await fsPromises.access(pdfPath, fs.constants.F_OK);
                const stats = await fsPromises.stat(pdfPath);
                console.log('PDF file exists and is ready for upload, size:', stats.size, 'bytes');

                const pdfFilename = path.basename(pdfPath);
                pdfUploadResult = await uploadFile(
                    pdfPath,
                    pdfFilename,
                    process.env.GOOGLE_DRIVE_FOLDER_ID,
                    tempJournalId
                );
                console.log('PDF file uploaded to Google Drive successfully:', pdfUploadResult);
            } catch (error) {
                pdfUploadError = error;
                console.error('Failed to upload PDF to Google Drive:', error);
                console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
                // Continue even if PDF upload fails
                console.warn('WARNING: PDF upload to Google Drive failed, but continuing with local file path only');
            }
        }

        // Clean up local files after upload
        await fsPromises.unlink(file.path).catch(e => console.error('Error deleting DOCX:', e));
        if (pdfPath) {
            await fsPromises.unlink(pdfPath).catch(e => console.error('Error deleting PDF:', e));
        }

        // Create journal record
        let journal;
        try {
            console.log('Creating journal record');
            // Ensure authors and keywords are arrays
            const authorArray = Array.isArray(authors) ? authors : (authors ? [authors] : []);
            const keywordArray = Array.isArray(keywords) ? keywords : (keywords ? [keywords] : []);

            // Generate filenames for storage
            const docxFilename = file.filename;
            const pdfFilename = docxFilename.replace('.docx', '.pdf');

            // Check if Google Drive upload was successful
            if (docxUploadError) {
                console.warn('WARNING: Google Drive upload failed, but continuing with local file paths only');
                console.warn('Upload error:', docxUploadError.message);
            }

            console.log('Creating journal with:', {
                title,
                abstract,
                authors: authorArray,
                keywords: keywordArray,
                docxFileId: docxUploadResult?.id || null,
                pdfFileId: pdfUploadResult?.id || null,
                docxWebViewLink: docxUploadResult?.webViewLink || null,
                pdfWebViewLink: pdfUploadResult?.webViewLink || null,
                docxFilePath: docxFilename,
                pdfFilePath: pdfFilename,
                googleDriveUploadFailed: !!docxUploadError
            });

            journal = new Journal({
                title,
                abstract,
                authors: authorArray,
                keywords: keywordArray,
                // Store Google Drive file IDs if available
                docxFileId: docxUploadResult?.id || null,
                pdfFileId: pdfUploadResult?.id || null,
                // Store Google Drive web view links if available
                docxWebViewLink: docxUploadResult?.webViewLink || null,
                pdfWebViewLink: pdfUploadResult?.webViewLink || null,
                // Always store the filenames for backward compatibility
                docxFilePath: docxFilename,
                pdfFilePath: pdfFilename,
                status: "published"
            });

            await journal.save();
            console.log('Journal saved successfully with ID:', journal._id);

            // Log a summary of the entire process
            console.log('=== JOURNAL UPLOAD PROCESS SUMMARY ===');
            console.log('Journal ID:', journal._id);
            console.log('Title:', journal.title);
            console.log('DOCX File ID:', journal.docxFileId || 'Not available');
            console.log('PDF File ID:', journal.pdfFileId || 'Not available');
            console.log('DOCX Web Link:', journal.docxWebViewLink || 'Not available');
            console.log('PDF Web Link:', journal.pdfWebViewLink || 'Not available');
            console.log('=== JOURNAL UPLOAD COMPLETED SUCCESSFULLY ===');

            // Send response after successful save
            return res.status(201).json({
                message: docxUploadError ? "Journal uploaded successfully but Google Drive upload failed" : "Journal uploaded successfully",
                journal: {
                    id: journal._id,
                    title: journal.title,
                    abstract: journal.abstract,
                    authors: journal.authors,
                    status: journal.status,
                    hasDocx: !!journal.docxFileId,
                    hasPdf: !!journal.pdfFileId,
                    docxLink: journal.docxWebViewLink || null,
                    pdfLink: journal.pdfWebViewLink || null,
                    googleDriveUploadFailed: !!docxUploadError,
                    googleDriveError: docxUploadError ? docxUploadError.message : null
                }
            });
        } catch (err) {
            console.error('Journal save error:', err);
            // No local files to clean up since already deleted
            return res.status(500).json({ message: "Failed to save journal", error: err.message });
        }
    } catch (error) {
        console.error('=== JOURNAL UPLOAD PROCESS FAILED ===');
        console.error('Upload error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

        // Log request information
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Request headers:', req.headers);

        // Clean up local file if it exists
        if (req.file?.path) {
            console.log('Cleaning up uploaded file:', req.file.path);
            await fsPromises.unlink(req.file.path).catch(e => console.error('Error deleting uploaded file:', e));
        }

        // Check for specific error types and provide better error messages
        let errorMessage = "Failed to upload journal";
        let statusCode = 500;

        if (error.message && error.message.includes('File does not exist') || error.message.includes('cannot be accessed')) {
            errorMessage = "File upload failed: The uploaded file could not be processed";
            statusCode = 400;
        } else if (error.message && error.message.includes('empty')) {
            errorMessage = "File upload failed: The uploaded file is empty";
            statusCode = 400;
        } else if (error.message && error.message.includes('Google Drive')) {
            errorMessage = "File upload failed: Could not upload to Google Drive";
        }

        return res.status(statusCode).json({
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Get all journals with IDs and file paths only (new endpoint for verification)
exports.getJournalsFileInfo = async (req, res) => {
    try {
        const journals = await Journal.find({}, { _id: 1, docxFilePath: 1, pdfFilePath: 1 }).sort({ createdAt: -1 });
        res.json(journals);
    } catch (error) {
        res.status(500).json({
            message: "Failed to get journals file info",
            error: error.message
        });
    }
};

// Get journal by ID
exports.getJournalById = async (req, res) => {
    try {
        const journal = await Journal.findById(req.params.id);
        if (!journal) {
            return res.status(404).json({ message: "Journal not found" });
        }
        res.json(journal);
    } catch (error) {
        res.status(500).json({
            message: "Failed to get journal",
            error: error.message
        });
    }
};

// Update journal status
exports.updateJournalStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const journal = await Journal.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!journal) {
            return res.status(404).json({ message: "Journal not found" });
        }
        res.json(journal);
    } catch (error) {
        res.status(500).json({
            message: "Failed to update journal status",
            error: error.message
        });
    }
};

// Delete journal
exports.deleteJournal = async (req, res) => {
    try {
        const journal = await Journal.findByIdAndDelete(req.params.id);
        if (!journal) {
            return res.status(404).json({ message: "Journal not found" });
        }

        // Delete associated local files if they exist
        const uploadDir = getUploadDir();
        if (journal.docxFilePath) {
            const fullDocxPath = path.join(uploadDir, journal.docxFilePath);
            await cleanupFiles(fullDocxPath, null);
        }

        if (journal.pdfFilePath) {
            const fullPdfPath = path.join(uploadDir, journal.pdfFilePath);
            await cleanupFiles(null, fullPdfPath);
        }

        // Delete files from Google Drive
        let deletedFromDrive = [];

        if (journal.docxFileId) {
            try {
                await deleteFile(journal.docxFileId);
                deletedFromDrive.push('DOCX');
                console.log('Deleted DOCX file from Google Drive:', journal.docxFileId);
            } catch (error) {
                console.error('Error deleting DOCX from Google Drive:', error);
            }
        }

        if (journal.pdfFileId) {
            try {
                await deleteFile(journal.pdfFileId);
                deletedFromDrive.push('PDF');
                console.log('Deleted PDF file from Google Drive:', journal.pdfFileId);
            } catch (error) {
                console.error('Error deleting PDF from Google Drive:', error);
            }
        }

        res.json({
            message: "Journal deleted successfully",
            deletedFromDrive: deletedFromDrive.length > 0 ? deletedFromDrive : null
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete journal",
            error: error.message
        });
    }
};

// Add the missing getJournals method
exports.getJournals = async (req, res) => {
    try {
        const journals = await Journal.find().sort({ createdAt: -1 });
        res.json(journals);
    } catch (error) {
        res.status(500).json({
            message: "Failed to get journals",
            error: error.message
        });
    }
};


// Search journals
exports.searchJournals = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: "Search query is required" });
        }

        const journals = await Journal.find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { abstract: { $regex: query, $options: 'i' } },
                { keywords: { $regex: query, $options: 'i' } }
            ]
        }).sort({ createdAt: -1 });

        res.json(journals);
    } catch (error) {
        res.status(500).json({
            message: "Search failed",
            error: error.message
        });
    }
};