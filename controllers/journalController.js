const fs = require("fs");
const fsPromises = require("fs").promises;
const Journal = require("../models/Journal");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        // Handle the environment variable path correctly
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

// Create uploads directory if it doesn't exist
const ensureUploadsDir = async () => {
    // Handle the environment variable path correctly
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

exports.uploadMiddleware = upload.single('file');

// Upload and convert DOCX to PDF
exports.uploadJournal = async (req, res) => {
    try {
        console.log('Upload journal request received');
        console.log('Request body:', req.body);
        console.log('Uploaded file:', req.file ? 'File received' : 'No file received');
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
        let authors = [];
        try {
            if (Array.isArray(req.body.authors)) {
                authors = req.body.authors;
            } else if (typeof req.body.authors === 'string') {
                // Check if it's a JSON string
                if (req.body.authors.startsWith('[') && req.body.authors.endsWith(']')) {
                    try {
                        authors = JSON.parse(req.body.authors);
                    } catch (e) {
                        // If parsing fails, treat as comma-separated string
                        authors = req.body.authors.split(',').map(a => a.trim());
                    }
                } else {
                    // Treat as comma-separated string
                    authors = req.body.authors.split(',').map(a => a.trim());
                }
            }
        } catch (e) {
            console.error('Error processing authors:', e);
            authors = [];
        }
        console.log('Processed authors:', authors);

        console.log('Processing keywords:', req.body.keywords);
        let keywords = [];
        try {
            if (Array.isArray(req.body.keywords)) {
                keywords = req.body.keywords;
            } else if (typeof req.body.keywords === 'string') {
                // Check if it's a JSON string
                if (req.body.keywords.startsWith('[') && req.body.keywords.endsWith(']')) {
                    try {
                        keywords = JSON.parse(req.body.keywords);
                    } catch (e) {
                        // If parsing fails, treat as comma-separated string
                        keywords = req.body.keywords.split(',').map(k => k.trim());
                    }
                } else {
                    // Treat as comma-separated string
                    keywords = req.body.keywords.split(',').map(k => k.trim());
                }
            }
        } catch (e) {
            console.error('Error processing keywords:', e);
            keywords = [];
        }
        console.log('Processed keywords:', keywords);

        // Store just the filename instead of the full path to avoid path issues
        const docxFilename = path.basename(file.path);
        console.log('Original file path:', file.path);
        console.log('Extracted filename:', docxFilename);

        // Store just the filename in the database
        const docxFilePath = docxFilename;
        // Create a simple PDF path without conversion
        const pdfFilePath = docxFilename + '.pdf';

        // Log the absolute paths for debugging
        // Handle the environment variable path correctly
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
        console.log('Absolute docx path:', path.join(uploadDir, docxFilename));
        console.log('Absolute pdf path:', path.join(uploadDir, docxFilename + '.pdf'));

        console.log('File paths:', {docxFilePath, pdfFilePath});

        // Skip DOCX to PDF conversion for now to simplify the process
        // We'll just save the journal with the DOCX file path
        console.log('Skipping DOCX to PDF conversion for debugging');

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
                docxFilePath,
                pdfFilePath
            });

            journal = new Journal({
                title,
                abstract,
                authors: authorArray,
                keywords: keywordArray,
                docxFilePath,
                pdfFilePath,
                status: "published"
            });

            await journal.save();
            console.log('Journal saved successfully');

            // Send response after successful save
            return res.status(201).json({
                message: "Journal uploaded successfully",
                journal: {
                    title: journal.title,
                    abstract: journal.abstract,
                    authors: journal.authors,
                    status: journal.status
                }
            });
        } catch (err) {
            console.error('Journal save error:', err);
            // Get the full path for cleanup
            // Handle the environment variable path correctly
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
            const fullDocxPath = path.join(uploadDir, docxFilePath);
            const fullPdfPath = path.join(uploadDir, pdfFilePath);

            console.log('Cleaning up files:', {fullDocxPath, fullPdfPath});
            await fsPromises.unlink(fullDocxPath).catch(e => console.error('Error deleting docx:', e));
            await fsPromises.unlink(fullPdfPath).catch(e => console.error('Error deleting pdf:', e));
            return res.status(500).json({ message: "Failed to save journal" });
        }
    } catch (error) {
        console.error('Upload error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

        // Log request information
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Request headers:', req.headers);

        // Clean up files if they were created
        if (req.file?.path) {
            console.log('Cleaning up uploaded file:', req.file.path);
            // Use the actual file path from multer
            await fsPromises.unlink(req.file.path).catch(e => console.error('Error deleting uploaded file:', e));
        }
        if (typeof pdfFilePath !== 'undefined') {
            // Get the full path for cleanup
            // Handle the environment variable path correctly
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
            const fullPdfPath = path.join(uploadDir, pdfFilePath);
            console.log('Cleaning up PDF file:', fullPdfPath);
            await fsPromises.unlink(fullPdfPath).catch(e => console.error('Error deleting pdf file:', e));
        }

        return res.status(500).json({
            message: "Failed to upload journal",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get all journals
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

        // Delete associated files
        try {
            await fsPromises.unlink(journal.docxFilePath);
            await fsPromises.unlink(journal.pdfFilePath);
        } catch (err) {
            console.error("Error deleting files:", err);
        }

        res.json({ message: "Journal deleted successfully" });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete journal",
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
