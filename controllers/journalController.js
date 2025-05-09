const fs = require("fs");
const fsPromises = require("fs").promises;
const Journal = require("../models/Journal");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const cloudinary = require('cloudinary').v2;
const { deleteFile } = require("../utils/googleDrive");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'musaadamu',
  api_key: process.env.CLOUDINARY_API_KEY || '118667176731122',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'QwRlt2-iT57X6GlbzTarDSA5soY',
  secure: true,
});

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

        // Accept both DOCX and PDF files
        const isDocx = extname === '.docx' &&
            (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
             mimetype === 'application/docx' ||
             mimetype === 'application/vnd.ms-word');

        const isPdf = extname === '.pdf' &&
            (mimetype === 'application/pdf');

        if (isDocx || isPdf) {
            console.log('File accepted:', file.originalname);
            cb(null, true);
        } else {
            console.log('File rejected:', file.originalname, 'Mimetype:', mimetype, 'Extension:', extname);
            cb(new Error('Only .docx and .pdf files are allowed!'), false);
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
        files: 2, // Allow up to 2 files (PDF and DOCX)
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

exports.uploadMiddleware = upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'docxFile', maxCount: 1 }
]);

// Removed convertDocxToPdf function and puppeteer import as PDF conversion is no longer needed

// Upload and convert DOCX to PDF
exports.uploadJournal = async (req, res) => {
    try {
        console.log('🔴🔴🔴 UPLOAD JOURNAL PROCESS STARTED - MODIFIED VERSION (TIMESTAMP: ' + new Date().toISOString() + ') 🔴🔴🔴');
        console.log('Upload journal request received');
        console.log('Request body:', req.body);
        console.log('Uploaded files:', req.files ? 'Files received' : 'No files received');
        console.log('SERVER RESTART TEST - THIS LINE SHOULD APPEAR IN LOGS');

        if (req.files) {
            console.log('Files details:', {
                pdfFile: req.files.pdfFile ? req.files.pdfFile[0].filename : 'Not provided',
                docxFile: req.files.docxFile ? req.files.docxFile[0].filename : 'Not provided'
            });
        }

        console.log('Storage path:', process.env.DOCUMENT_STORAGE_PATH);
        console.log('Current directory:', __dirname);

        const { title, abstract } = req.body;
        const pdfFile = req.files?.pdfFile?.[0];
        const docxFile = req.files?.docxFile?.[0];

        // Validate files
        if (!pdfFile) {
            console.log('No PDF file uploaded');
            return res.status(400).json({ message: "No PDF file uploaded" });
        }

        if (!docxFile) {
            console.log('No DOCX file uploaded');
            return res.status(400).json({ message: "No DOCX file uploaded" });
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

        // Create a temporary journal ID for file metadata
        const tempJournalId = new mongoose.Types.ObjectId();
        console.log('Created temporary journal ID for file metadata:', tempJournalId);

        // Upload PDF file to Cloudinary
        console.log('Uploading PDF to Cloudinary');
        let pdfUploadResult = null;
        let pdfUploadError = null;
        try {
            const pdfStats = await fsPromises.stat(pdfFile.path);
            console.log('PDF file exists and is ready for upload, size:', pdfStats.size, 'bytes');

            pdfUploadResult = await cloudinary.uploader.upload(pdfFile.path, {
                folder: 'UploadFiles',
                resource_type: 'raw',
                public_id: `${Date.now()}-${pdfFile.filename}`,
                use_filename: true,
                unique_filename: false,
                overwrite: true,
                access_mode: 'public',
                type: 'upload',
                accessibility: 'public',  // Ensure the file is publicly accessible
                access_control: [{ access_type: 'anonymous' }]  // Allow anonymous access
            });
            console.log('PDF file uploaded to Cloudinary successfully:', pdfUploadResult);
        } catch (error) {
            pdfUploadError = error;
            console.error('Failed to upload PDF to Cloudinary:', error);
            console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            // Continue even if PDF upload fails
            console.warn('WARNING: PDF upload to Cloudinary failed, but continuing with local file path only');
        }

        // Upload DOCX file to Cloudinary
        console.log('Uploading DOCX to Cloudinary');
        let docxUploadResult = null;
        let docxUploadError = null;
        try {
            const docxStats = await fsPromises.stat(docxFile.path);
            console.log('DOCX file exists and is ready for upload, size:', docxStats.size, 'bytes');

            docxUploadResult = await cloudinary.uploader.upload(docxFile.path, {
                folder: 'UploadFiles',
                resource_type: 'raw',
                public_id: `${Date.now()}-${docxFile.filename}`,
                use_filename: true,
                unique_filename: false,
                overwrite: true,
                access_mode: 'public',
                type: 'upload',
                accessibility: 'public',  // Ensure the file is publicly accessible
                access_control: [{ access_type: 'anonymous' }]  // Allow anonymous access
            });
            console.log('DOCX file uploaded to Cloudinary successfully:', docxUploadResult);
        } catch (error) {
            docxUploadError = error;
            console.error('Failed to upload DOCX to Cloudinary:', error);
            console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            // Continue even if DOCX upload fails
            console.warn('WARNING: DOCX upload to Cloudinary failed, but continuing with local file path only');
        }

        // Clean up local files after upload only if Cloudinary upload succeeded
        if (!pdfUploadError) {
            await fsPromises.unlink(pdfFile.path).catch(e => console.error('Error deleting PDF:', e));
        } else {
            console.warn('Local PDF file retained due to Cloudinary upload failure:', pdfFile.filename);
        }

        if (!docxUploadError) {
            await fsPromises.unlink(docxFile.path).catch(e => console.error('Error deleting DOCX:', e));
        } else {
            console.warn('Local DOCX file retained due to Cloudinary upload failure:', docxFile.filename);
        }

        // Create journal record
        let journal;
        try {
            console.log('Creating journal record');
            // Ensure authors and keywords are arrays
            const authorArray = Array.isArray(authors) ? authors : (authors ? [authors] : []);
            const keywordArray = Array.isArray(keywords) ? keywords : (keywords ? [keywords] : []);

            console.log('Creating journal with:', {
                title,
                abstract,
                authors: authorArray,
                keywords: keywordArray,
                docxFileId: docxUploadResult?.public_id || null,
                pdfFileId: pdfUploadResult?.public_id || null,
                docxWebViewLink: docxUploadResult?.secure_url || null,
                pdfWebViewLink: pdfUploadResult?.secure_url || null,
                docxFilePath: docxFile.filename,
                pdfFilePath: pdfFile.filename,
                status: "published"
            });

            journal = new Journal({
                title,
                abstract,
                authors: authorArray,
                keywords: keywordArray,
                // Store Cloudinary public IDs if available
                docxFileId: docxUploadResult?.public_id || null,
                pdfFileId: pdfUploadResult?.public_id || null,
                // Store Cloudinary secure URLs if available
                docxWebViewLink: docxUploadResult?.secure_url || null,
                pdfWebViewLink: pdfUploadResult?.secure_url || null,
                // Store Cloudinary URLs explicitly
                docxCloudinaryUrl: docxUploadResult?.secure_url || null,
                pdfCloudinaryUrl: pdfUploadResult?.secure_url || null,
                // Store the filenames
                docxFilePath: docxFile.filename,
                pdfFilePath: pdfFile.filename,
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

            // Determine upload status message
            let uploadMessage = "Journal uploaded successfully";
            if (pdfUploadError && docxUploadError) {
                uploadMessage = "Journal uploaded successfully but Google Drive uploads failed";
            } else if (pdfUploadError) {
                uploadMessage = "Journal uploaded successfully but PDF Google Drive upload failed";
            } else if (docxUploadError) {
                uploadMessage = "Journal uploaded successfully but DOCX Google Drive upload failed";
            }

            // Send response after successful save
            return res.status(201).json({
                message: uploadMessage,
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
                    googleDriveUploadFailed: !!(pdfUploadError || docxUploadError),
                    googleDriveError: pdfUploadError || docxUploadError ?
                        (pdfUploadError?.message || docxUploadError?.message) : null
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
        console.log('Request files:', req.files);
        console.log('Request headers:', req.headers);

        // Clean up local files if they exist
        if (req.files?.pdfFile?.[0]?.path) {
            console.log('Cleaning up uploaded PDF file:', req.files.pdfFile[0].path);
            await fsPromises.unlink(req.files.pdfFile[0].path).catch(e => console.error('Error deleting uploaded PDF file:', e));
        }

        if (req.files?.docxFile?.[0]?.path) {
            console.log('Cleaning up uploaded DOCX file:', req.files.docxFile[0].path);
            await fsPromises.unlink(req.files.docxFile[0].path).catch(e => console.error('Error deleting uploaded DOCX file:', e));
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

        // Delete files from Cloudinary if needed
        // Note: Cloudinary has its own cleanup policies, so this is optional
        // You can implement Cloudinary deletion here if needed

        res.json({
            message: "Journal deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete journal",
            error: error.message
        });
    }
};

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

// Remove any backend endpoints related to DOCX download if present
// Assuming there was a route or controller method for DOCX download, remove or comment it out here if found
// Since no explicit DOCX download method was found in the current controller, no action needed here


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