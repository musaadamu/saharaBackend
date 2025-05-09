const fs = require("fs");
const fsPromises = require("fs").promises;
const Submission = require("../models/Submission");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        // Use absolute path to avoid path resolution issues
        let uploadDir;
        if (process.env.DOCUMENT_STORAGE_PATH) {
            // If it's a relative path starting with '../', resolve it relative to the current directory
            if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
                uploadDir = path.resolve(path.join(__dirname, '..', process.env.DOCUMENT_STORAGE_PATH.replace('journals', 'submissions')));
            } else {
                // Otherwise, use it as is or resolve it if it's a relative path
                uploadDir = path.resolve(process.env.DOCUMENT_STORAGE_PATH.replace('journals', 'submissions'));
            }
        } else {
            // Fallback to a default path
            uploadDir = path.resolve(path.join(__dirname, '..', 'uploads', 'submissions'));
        }

        console.log('Submission upload directory (absolute):', uploadDir);

        try {
            await fsPromises.mkdir(uploadDir, { recursive: true });
            console.log('Submission upload directory created or already exists');
            cb(null, uploadDir);
        } catch (error) {
            console.error('Error creating submission upload directory:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        const filename = `${Date.now()}-${file.originalname}`;
        console.log('Generated filename for upload:', filename);
        cb(null, filename);
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

    console.log('Validating submission input:');
    console.log('- title:', title);
    console.log('- abstract:', abstract);
    console.log('- authors:', authors);
    console.log('- keywords:', keywords);
    console.log('- file:', req.file);

    if (!title || (typeof title === 'string' && title.trim() === '')) {
        errors.push('Title is required');
    }

    if (!abstract || (typeof abstract === 'string' && abstract.trim() === '')) {
        errors.push('Abstract is required');
    }

    // Handle authors which might be a string, array, or JSON string
    let authorsValid = false;
    if (authors) {
        if (Array.isArray(authors) && authors.length > 0) {
            authorsValid = true;
        } else if (typeof authors === 'string') {
            if (authors.trim() !== '') {
                // If it's a comma-separated string
                if (authors.includes(',')) {
                    authorsValid = true;
                } else if (authors.startsWith('[') && authors.endsWith(']')) {
                    // If it's a JSON string array
                    try {
                        const parsed = JSON.parse(authors);
                        authorsValid = Array.isArray(parsed) && parsed.length > 0;
                    } catch (e) {
                        // Not valid JSON, but still a non-empty string
                        authorsValid = true;
                    }
                } else {
                    // Single author as string
                    authorsValid = true;
                }
            }
        }
    }

    if (!authorsValid) {
        errors.push('At least one author is required');
    }

    // Handle keywords which might be a string, array, or JSON string
    let keywordsValid = false;
    if (keywords) {
        if (Array.isArray(keywords) && keywords.length > 0) {
            keywordsValid = true;
        } else if (typeof keywords === 'string') {
            if (keywords.trim() !== '') {
                // If it's a comma-separated string
                if (keywords.includes(',')) {
                    keywordsValid = true;
                } else if (keywords.startsWith('[') && keywords.endsWith(']')) {
                    // If it's a JSON string array
                    try {
                        const parsed = JSON.parse(keywords);
                        keywordsValid = Array.isArray(parsed) && parsed.length > 0;
                    } catch (e) {
                        // Not valid JSON, but still a non-empty string
                        keywordsValid = true;
                    }
                } else {
                    // Single keyword as string
                    keywordsValid = true;
                }
            }
        }
    }

    if (!keywordsValid) {
        errors.push('Keywords are required');
    }

    if (!req.file) {
        errors.push('DOCX file is required');
        console.error('No file uploaded. Received fields:', Object.keys(req.body));
    }

    if (errors.length > 0) {
        console.log('Validation errors:', errors);
    }

    return errors;
};

// Upload and convert DOCX to PDF - using Cloudinary for storage
exports.uploadSubmission = async (req, res) => {
    try {
        console.log('Upload submission request received');
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
                        // If parsing fails, treat as a single author
                        authors = [req.body.authors];
                    }
                } else {
                    // Treat as a single author
                    authors = [req.body.authors];
                }
            }
        } catch (error) {
            console.error('Error processing authors:', error);
            authors = [];
        }

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
                        // If parsing fails, split by comma
                        keywords = req.body.keywords.split(',').map(k => k.trim());
                    }
                } else {
                    // Split by comma
                    keywords = req.body.keywords.split(',').map(k => k.trim());
                }
            }
        } catch (error) {
            console.error('Error processing keywords:', error);
            keywords = [];
        }

        const docxFilePath = file.path;
        const pdfFilePath = path.join(
            path.dirname(docxFilePath),
            `${path.basename(docxFilePath, '.docx')}.pdf`
        );

        console.log('DOCX file path:', docxFilePath);
        console.log('PDF file path:', pdfFilePath);

        // Extract text from DOCX and create PDF
        let extractedText;
        try {
            console.log('Reading DOCX file for text extraction');
            const buffer = await fsPromises.readFile(docxFilePath);
            extractedText = await mammoth.extractRawText({ buffer });
            console.log('Text extracted successfully, length:', extractedText.value.length);
        } catch (error) {
            console.error('Failed to extract text from DOCX:', error);
            throw new Error('Failed to extract text from DOCX: ' + error.message);
        }

        try {
            console.log('Creating PDF from extracted text');
            await new Promise((resolve, reject) => {
                const pdfDoc = new PDFDocument();
                const pdfStream = fs.createWriteStream(pdfFilePath);

                pdfDoc.pipe(pdfStream);
                pdfDoc.text(extractedText.value);
                pdfDoc.end();

                pdfStream.on('finish', () => {
                    console.log('PDF creation completed');
                    resolve();
                });
                pdfStream.on('error', (err) => {
                    console.error('PDF creation error:', err);
                    reject(err);
                });
            });
        } catch (error) {
            console.error('Failed to create PDF:', error);
            throw new Error('Failed to create PDF: ' + error.message);
        }

        // Upload DOCX file to Cloudinary
        console.log('Uploading DOCX to Cloudinary');
        let docxUploadResult = null;
        let docxUploadError = null;
        try {
            const docxStats = await fsPromises.stat(docxFilePath);
            console.log('DOCX file exists and is ready for upload, size:', docxStats.size, 'bytes');

            docxUploadResult = await cloudinary.uploader.upload(docxFilePath, {
                folder: 'UploadFiles/Submissions',
                resource_type: 'raw',
                public_id: `${Date.now()}-${file.filename}`,
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

        // Upload PDF file to Cloudinary
        console.log('Uploading PDF to Cloudinary');
        let pdfUploadResult = null;
        let pdfUploadError = null;
        try {
            const pdfStats = await fsPromises.stat(pdfFilePath);
            console.log('PDF file exists and is ready for upload, size:', pdfStats.size, 'bytes');

            pdfUploadResult = await cloudinary.uploader.upload(pdfFilePath, {
                folder: 'UploadFiles/Submissions',
                resource_type: 'raw',
                public_id: `${Date.now()}-${path.basename(pdfFilePath)}`,
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

        // Clean up local files after upload only if Cloudinary upload succeeded
        if (!docxUploadError) {
            await fsPromises.unlink(docxFilePath).catch(e => console.error('Error deleting DOCX:', e));
        } else {
            console.warn('Local DOCX file retained due to Cloudinary upload failure:', file.filename);
        }

        if (!pdfUploadError) {
            await fsPromises.unlink(pdfFilePath).catch(e => console.error('Error deleting PDF:', e));
        } else {
            console.warn('Local PDF file retained due to Cloudinary upload failure:', path.basename(pdfFilePath));
        }

        // Process authors and keywords
        const processedAuthors = authors.map(author => author.trim()).filter(Boolean);
        const processedKeywords = keywords.map(kw => kw.trim()).filter(Boolean);

        console.log('Processed authors:', processedAuthors);
        console.log('Processed keywords:', processedKeywords);

        // Create and save the submission
        try {
            console.log('Creating new submission document');
            const newSubmission = new Submission({
                title: title.trim(),
                abstract: abstract.trim(),
                authors: processedAuthors,
                // Store local file paths for backward compatibility
                docxFilePath: docxFilePath,
                pdfFilePath: pdfFilePath,
                // Store Cloudinary public IDs if available
                docxFileId: docxUploadResult?.public_id || null,
                pdfFileId: pdfUploadResult?.public_id || null,
                // Store Cloudinary secure URLs if available
                docxWebViewLink: docxUploadResult?.secure_url || null,
                pdfWebViewLink: pdfUploadResult?.secure_url || null,
                // Store Cloudinary URLs explicitly
                docxCloudinaryUrl: docxUploadResult?.secure_url || null,
                pdfCloudinaryUrl: pdfUploadResult?.secure_url || null,
                keywords: processedKeywords,
                status: "submitted",
            });

            console.log('Saving submission to database');
            await newSubmission.save();
            console.log('Submission saved successfully with ID:', newSubmission._id);

            res.status(201).json({
                message: "Submission uploaded successfully",
                submission: newSubmission
            });
        } catch (error) {
            console.error('Failed to save submission:', error);
            throw new Error('Failed to save submission: ' + error.message);
        }
    } catch (error) {
        console.error('Upload error:', error);

        // Clean up files if there was an error
        if (req.file) {
            console.log('Cleaning up files due to error');
            try {
                await fsPromises.unlink(req.file.path);
                console.log('Deleted DOCX file:', req.file.path);
            } catch (e) {
                console.error('Error deleting DOCX file:', e);
            }

            const potentialPdfPath = req.file.path.replace('.docx', '.pdf');
            try {
                await fsPromises.unlink(potentialPdfPath);
                console.log('Deleted PDF file:', potentialPdfPath);
            } catch (e) {
                console.error('Error deleting PDF file:', e);
            }
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

        // Delete local files if they exist
        try {
            if (submission.docxFilePath) {
                await fsPromises.unlink(submission.docxFilePath).catch(e =>
                    console.warn(`Could not delete local DOCX file: ${e.message}`)
                );
            }
            if (submission.pdfFilePath) {
                await fsPromises.unlink(submission.pdfFilePath).catch(e =>
                    console.warn(`Could not delete local PDF file: ${e.message}`)
                );
            }
        } catch (fileError) {
            console.warn("Could not delete associated local files:", fileError);
        }

        // Delete files from Cloudinary if they exist
        try {
            if (submission.docxFileId) {
                await cloudinary.uploader.destroy(submission.docxFileId, { resource_type: 'raw' })
                    .then(result => console.log('Deleted DOCX from Cloudinary:', result))
                    .catch(error => console.error('Error deleting DOCX from Cloudinary:', error));
            }

            if (submission.pdfFileId) {
                await cloudinary.uploader.destroy(submission.pdfFileId, { resource_type: 'raw' })
                    .then(result => console.log('Deleted PDF from Cloudinary:', result))
                    .catch(error => console.error('Error deleting PDF from Cloudinary:', error));
            }
        } catch (cloudinaryError) {
            console.warn("Could not delete associated Cloudinary files:", cloudinaryError);
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

// Use the same approach as journalController - direct multer middleware
exports.uploadMiddleware = upload.single('file');
