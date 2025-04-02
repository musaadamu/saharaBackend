const fs = require("fs");
const fsPromises = require("fs").promises;
const Journal = require("../models/Journal");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");

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

// Improved file filter to only allow .docx files
const fileFilter = (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype;
    const isDocx = extname === '.docx' && 
        (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
         mimetype === 'application/docx' ||
         mimetype === 'application/vnd.ms-word');

    if (isDocx) {
        return cb(null, true);
    } else {
        cb(new Error('Only .docx files are allowed!'), false);
    }
};

const upload = multer({ 
    storage, 
    fileFilter,
    limits: { 
        fileSize: 50 * 1024 * 1024 // 50MB file size limit
    } 
});

// Validation function
const validateJournalInput = (req) => {
    const { title, abstract, authors, keywords } = req.body;
    const errors = [];

    if (!title || (typeof title === 'string' && title.trim() === '')) {
        errors.push('Title is required');
    }
    
    if (!abstract || (typeof abstract === 'string' && abstract.trim() === '')) {
        errors.push('Abstract is required');
    }
    
    if (!authors || (Array.isArray(authors) && authors.length === 0) || (!Array.isArray(authors) && !authors)) {
        errors.push('At least one author is required');
    }
    
    if (!keywords || 
        (Array.isArray(keywords) && keywords.length === 0) || 
        (typeof keywords === 'string' && keywords.trim() === '')) {
        errors.push('Keywords are required');
    }
    
    if (!req.file) errors.push('DOCX file is required');

    return errors;
};

// Upload and convert DOCX to PDF
exports.uploadJournal = async (req, res) => {
    try {
        const validationErrors = validateJournalInput(req);
        if (validationErrors.length > 0) {
            if (req.file) {
                await fsPromises.unlink(req.file.path).catch(() => {});
            }
            return res.status(400).json({ 
                message: "Validation Failed", 
                errors: validationErrors 
            });
        }

        const { title, abstract, authors, keywords } = req.body;
        const file = req.file;

        const docxFilePath = file.path;
        const pdfFilePath = path.join(
            path.dirname(docxFilePath), 
            `${path.basename(docxFilePath, '.docx')}.pdf`
        );

        let extractedText;
        try {
            const buffer = await fsPromises.readFile(docxFilePath);
            extractedText = await mammoth.extractRawText({ buffer });
        } catch (error) {
            throw new Error('Failed to extract text from DOCX');
        }

        await new Promise((resolve, reject) => {
            const pdfDoc = new PDFDocument();
            const pdfStream = fs.createWriteStream(pdfFilePath);
            
            pdfDoc.pipe(pdfStream);
            pdfDoc.text(extractedText.value);
            pdfDoc.end();

            pdfStream.on('finish', resolve);
            pdfStream.on('error', reject);
        });

        const authorIds = Array.isArray(authors) 
            ? authors.map(author => author.trim()) 
            : [authors.trim()];

        const processedKeywords = Array.isArray(keywords) 
            ? keywords.map(kw => kw.trim())
            : keywords.split(",").map((kw) => kw.trim());

        const newJournal = new Journal({
            title: title.trim(),
            abstract: abstract.trim(),
            authors: authorIds,
            docxFilePath,
            pdfFilePath,
            keywords: processedKeywords,
            status: "submitted",
        });

        await newJournal.save();

        res.status(201).json({ 
            message: "Journal uploaded successfully", 
            journal: newJournal 
        });
    } catch (error) {
        console.error(error);
        
        if (req.file) {
            await fsPromises.unlink(req.file.path).catch(() => {});
            const potentialPdfPath = req.file.path.replace('.docx', '.pdf');
            await fsPromises.unlink(potentialPdfPath).catch(() => {});
        }

        res.status(500).json({ 
            message: "Failed to upload journal", 
            error: error.message 
        });
    }
};

// Get all journals with pagination and filtering
exports.getJournals = async (req, res) => {
    try {
        console.log('GET Journals Request Received');
        console.log('Query Parameters:', req.query);

        const { 
            page = 1, 
            limit = 10, 
            status, 
            sortBy = 'createdAt', 
            sortOrder = 'desc' 
        } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const journals = await Journal.find(filter)
            // .populate("authors", "name email")
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Journal.countDocuments(filter);

        console.log('Journals Found:', journals.length);

        res.json({
            journals,
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
            totalJournals: total
        });
    } catch (error) {
        console.error('Get Journals Error:', error);
        res.status(500).json({ 
            message: "Failed to retrieve journals", 
            error: error.message 
        });
    }
};

// Get a single journal by ID
exports.getJournalById = async (req, res) => {
    try {
        const journal = await Journal.findById(req.params.id)
            // .populate("authors", "name email");
        
        if (!journal) {
            return res.status(404).json({ message: "Journal not found" });
        }

        res.json(journal);
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to retrieve journal", 
            error: error.message 
        });
    }
};

// Update journal status
exports.updateJournalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['submitted', 'under-review', 'accepted', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: "Invalid status", 
                validStatuses 
            });
        }

        const journal = await Journal.findByIdAndUpdate(
            id, 
            { status }, 
            { new: true, runValidators: true }
        ).populate("authors", "name email");

        if (!journal) {
            return res.status(404).json({ message: "Journal not found" });
        }

        res.json({
            message: "Journal status updated successfully",
            journal
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to update journal status", 
            error: error.message 
        });
    }
};

// Delete a journal
exports.deleteJournal = async (req, res) => {
    try {
        const journal = await Journal.findById(req.params.id);
        if (!journal) {
            return res.status(404).json({ message: "Journal not found" });
        }

        try {
            if (journal.docxFilePath) {
                await fsPromises.unlink(journal.docxFilePath);
            }
            if (journal.pdfFilePath) {
                await fsPromises.unlink(journal.pdfFilePath);
            }
        } catch (fileError) {
            console.warn("Could not delete associated files:", fileError);
        }

        await journal.deleteOne();

        res.json({ 
            message: "Journal deleted successfully",
            deletedJournal: journal 
        });
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
        const { query, field = 'title' } = req.query;

        if (!query) {
            return res.status(400).json({ message: "Search query is required" });
        }

        const searchRegex = new RegExp(query, 'i');

        const searchFields = {
            'title': { title: searchRegex },
            'keywords': { keywords: searchRegex },
            'abstract': { abstract: searchRegex }
        };

        if (!searchFields[field]) {
            return res.status(400).json({ 
                message: "Invalid search field", 
                validFields: Object.keys(searchFields) 
            });
        }

        const journals = await Journal.find(searchFields[field])
            // .populate("authors", "name email")
            .limit(20); // Limit to 20 results

        res.json({
            journals,
            totalResults: journals.length
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Search failed", 
            error: error.message 
        });
    }
};

// Export multer upload middleware
exports.uploadMiddleware = upload.single("file");
