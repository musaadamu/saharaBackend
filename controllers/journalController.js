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
        const uploadDir = "uploads/journals";
        try {
            await fsPromises.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const fileFilter = (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype;
    const isDocx = extname === '.docx' && 
        (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
         mimetype === 'application/docx' ||
         mimetype === 'application/vnd.ms-word');

    if (isDocx) {
        cb(null, true);
    } else {
        cb(new Error('Only .docx files are allowed!'), false);
    }
};

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
        const { title, abstract, authors, keywords } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Validate required fields
        if (!title || !abstract) {
            return res.status(400).json({ message: "Title and abstract are required" });
        }

        const docxFilePath = file.path;
        const pdfFilePath = path.join(
            path.dirname(docxFilePath), 
            `${path.basename(docxFilePath, '.docx')}.pdf`
        );

        // Convert DOCX to PDF
        let result;
        try {
            result = await mammoth.extractRawText({ path: docxFilePath });
        } catch (err) {
            console.error('DOCX conversion error:', err);
            await fsPromises.unlink(docxFilePath); // Clean up uploaded file
            return res.status(400).json({ message: "Invalid DOCX file format" });
        }

        // Create PDF
        await new Promise((resolve, reject) => {
            const pdfDoc = new PDFDocument();
            const stream = fs.createWriteStream(pdfFilePath);
            pdfDoc.pipe(stream);
            pdfDoc.text(result.value);
            pdfDoc.end();
            
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        // Create journal record
        const journal = new Journal({
            title,
            abstract,
            authors: Array.isArray(authors) ? authors : [authors],
            keywords: Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim()),
            docxFilePath,
            pdfFilePath,
            status: "submitted"
        });

        await journal.save();

        res.status(201).json({
            message: "Journal uploaded successfully",
            journal
        });
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up files if they were created
        if (req.file?.path) {
            try { await fsPromises.unlink(req.file.path); } catch (err) {}
        }
        if (pdfFilePath) {
            try { await fsPromises.unlink(pdfFilePath); } catch (err) {}
        }

        res.status(500).json({ 
            message: "Failed to upload journal",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
