const fs = require("fs");
const fsPromises = require("fs").promises;
const Submission = require("../models/Submission");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = "uploads/submissions";
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

// File filter to only allow .docx files
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
const validateSubmissionInput = (req) => {
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
exports.uploadSubmission = async (req, res) => {
    try {
        const validationErrors = validateSubmissionInput(req);
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

        const newSubmission = new Submission({
            title: title.trim(),
            abstract: abstract.trim(),
            authors: authorIds,
            docxFilePath,
            pdfFilePath,
            keywords: processedKeywords,
            status: "submitted",
        });

        await newSubmission.save();

        res.status(201).json({ 
            message: "Submission uploaded successfully", 
            submission: newSubmission 
        });
    } catch (error) {
        console.error(error);
        
        if (req.file) {
            await fsPromises.unlink(req.file.path).catch(() => {});
            const potentialPdfPath = req.file.path.replace('.docx', '.pdf');
            await fsPromises.unlink(potentialPdfPath).catch(() => {});
        }

        res.status(500).json({ 
            message: "Failed to upload submission", 
            error: error.message 
        });
    }
};

// Get all submissions with pagination and filtering
exports.getSubmissions = async (req, res) => {
    try {
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

        const submissions = await Submission.find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Submission.countDocuments(filter);

        res.json({
            submissions,
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
            totalSubmissions: total
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to retrieve submissions", 
            error: error.message 
        });
    }
};

// Get a single submission by ID
exports.getSubmissionById = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        res.json(submission);
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to retrieve submission", 
            error: error.message 
        });
    }
};

// Update submission status
exports.updateSubmissionStatus = async (req, res) => {
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

        const submission = await Submission.findByIdAndUpdate(
            id, 
            { status }, 
            { new: true, runValidators: true }
        );

        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        res.json({
            message: "Submission status updated successfully",
            submission
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to update submission status", 
            error: error.message 
        });
    }
};

// Delete a submission
exports.deleteSubmission = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        try {
            if (submission.docxFilePath) {
                await fsPromises.unlink(submission.docxFilePath);
            }
            if (submission.pdfFilePath) {
                await fsPromises.unlink(submission.pdfFilePath);
            }
        } catch (fileError) {
            console.warn("Could not delete associated files:", fileError);
        }

        await submission.deleteOne();

        res.json({ 
            message: "Submission deleted successfully",
            deletedSubmission: submission 
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to delete submission", 
            error: error.message 
        });
    }
};

// Search submissions
exports.searchSubmissions = async (req, res) => {
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

        const submissions = await Submission.find(searchFields[field])
            .limit(20);

        res.json({
            submissions,
            totalResults: submissions.length
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Search failed", 
            error: error.message 
        });
    }
};

// Export multer upload middleware
exports.uploadMiddleware = upload.single("wordFile");
