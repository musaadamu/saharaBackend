const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logSecurityEvent } = require('./errorHandler');

// Allowed file types with their MIME types and magic numbers
const ALLOWED_FILE_TYPES = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        extensions: ['.docx'],
        maxSize: 50 * 1024 * 1024, // 50MB
        magicNumbers: [
            [0x50, 0x4B, 0x03, 0x04], // ZIP signature (DOCX is a ZIP file)
            [0x50, 0x4B, 0x05, 0x06], // ZIP signature (empty archive)
            [0x50, 0x4B, 0x07, 0x08]  // ZIP signature (spanned archive)
        ]
    },
    'application/pdf': {
        extensions: ['.pdf'],
        maxSize: 50 * 1024 * 1024, // 50MB
        magicNumbers: [
            [0x25, 0x50, 0x44, 0x46] // %PDF
        ]
    }
};

// Create secure upload directory
const createSecureUploadDir = () => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    const journalsDir = path.join(uploadDir, 'journals');
    const submissionsDir = path.join(uploadDir, 'submissions');
    
    [uploadDir, journalsDir, submissionsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        }
    });
    
    return { uploadDir, journalsDir, submissionsDir };
};

// Secure file name generation
const generateSecureFileName = (originalName, userId = 'anonymous') => {
    const ext = path.extname(originalName).toLowerCase();
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const userHash = crypto.createHash('sha256').update(userId.toString()).digest('hex').substring(0, 8);
    
    return `${timestamp}_${userHash}_${randomBytes}${ext}`;
};

// Magic number validation
const validateFileSignature = (buffer, mimeType) => {
    const allowedType = ALLOWED_FILE_TYPES[mimeType];
    if (!allowedType) return false;
    
    return allowedType.magicNumbers.some(signature => {
        return signature.every((byte, index) => buffer[index] === byte);
    });
};

// Enhanced file filter
const secureFileFilter = (req, file, cb) => {
    try {
        const ext = path.extname(file.originalname).toLowerCase();
        const mimeType = file.mimetype;
        
        // Log file upload attempt
        logSecurityEvent('FILE_UPLOAD_ATTEMPT', req, {
            originalName: file.originalname,
            mimeType: mimeType,
            size: file.size
        });
        
        // Check if file type is allowed
        const allowedType = ALLOWED_FILE_TYPES[mimeType];
        if (!allowedType) {
            logSecurityEvent('REJECTED_FILE_UPLOAD_MIME', req, {
                originalName: file.originalname,
                mimeType: mimeType,
                reason: 'Disallowed MIME type'
            });
            return cb(new Error('File type not allowed'), false);
        }
        
        // Check file extension
        if (!allowedType.extensions.includes(ext)) {
            logSecurityEvent('REJECTED_FILE_UPLOAD_EXT', req, {
                originalName: file.originalname,
                extension: ext,
                reason: 'Disallowed file extension'
            });
            return cb(new Error('File extension not allowed'), false);
        }
        
        // Check for suspicious file names
        const suspiciousPatterns = [
            /\.\./,           // Directory traversal
            /[<>:"|?*]/,      // Invalid characters
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
            /\.(exe|bat|cmd|scr|pif|vbs|js|jar|com|pif)$/i // Executable extensions
        ];
        
        if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
            logSecurityEvent('REJECTED_FILE_UPLOAD_SUSPICIOUS', req, {
                originalName: file.originalname,
                reason: 'Suspicious file name pattern'
            });
            return cb(new Error('Suspicious file name detected'), false);
        }
        
        cb(null, true);
    } catch (error) {
        logSecurityEvent('FILE_FILTER_ERROR', req, {
            error: error.message,
            originalName: file.originalname
        });
        cb(error, false);
    }
};

// Secure storage configuration
const createSecureStorage = (uploadType = 'journals') => {
    const { journalsDir, submissionsDir } = createSecureUploadDir();
    const targetDir = uploadType === 'submissions' ? submissionsDir : journalsDir;
    
    return multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, targetDir);
        },
        filename: (req, file, cb) => {
            try {
                const userId = req.user?.id || 'anonymous';
                const secureFileName = generateSecureFileName(file.originalname, userId);
                
                // Store original filename for reference
                req.originalFileName = file.originalname;
                req.secureFileName = secureFileName;
                
                cb(null, secureFileName);
            } catch (error) {
                cb(error);
            }
        }
    });
};

// Post-upload file validation
const validateUploadedFile = async (filePath, mimeType) => {
    try {
        // Read first 16 bytes for magic number validation
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);
        
        // Validate file signature
        if (!validateFileSignature(buffer, mimeType)) {
            throw new Error('File signature validation failed');
        }
        
        // Additional file size validation
        const stats = fs.statSync(filePath);
        const allowedType = ALLOWED_FILE_TYPES[mimeType];
        
        if (stats.size > allowedType.maxSize) {
            throw new Error('File size exceeds maximum allowed size');
        }
        
        if (stats.size === 0) {
            throw new Error('Empty file detected');
        }
        
        return true;
    } catch (error) {
        // Clean up invalid file
        try {
            fs.unlinkSync(filePath);
        } catch (cleanupError) {
            console.error('Failed to cleanup invalid file:', cleanupError);
        }
        throw error;
    }
};

// Create secure multer instance
const createSecureUpload = (uploadType = 'journals', fieldConfig = null) => {
    const upload = multer({
        storage: createSecureStorage(uploadType),
        fileFilter: secureFileFilter,
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB
            files: 2, // Maximum 2 files
            parts: 50, // Maximum 50 parts
            fieldNameSize: 100, // Maximum field name size
            fieldSize: 1024 * 1024, // Maximum field value size (1MB)
            headerPairs: 20 // Maximum header pairs
        }
    });
    
    // Return appropriate upload middleware based on field configuration
    if (fieldConfig) {
        return upload.fields(fieldConfig);
    } else {
        return upload.single('file');
    }
};

// Post-upload validation middleware
const postUploadValidation = (req, res, next) => {
    if (!req.file && !req.files) {
        return next();
    }
    
    const filesToValidate = [];
    
    if (req.file) {
        filesToValidate.push(req.file);
    }
    
    if (req.files) {
        if (Array.isArray(req.files)) {
            filesToValidate.push(...req.files);
        } else {
            Object.values(req.files).forEach(fileArray => {
                if (Array.isArray(fileArray)) {
                    filesToValidate.push(...fileArray);
                } else {
                    filesToValidate.push(fileArray);
                }
            });
        }
    }
    
    // Validate each uploaded file
    Promise.all(filesToValidate.map(async (file) => {
        try {
            await validateUploadedFile(file.path, file.mimetype);
            logSecurityEvent('FILE_UPLOAD_SUCCESS', req, {
                originalName: file.originalname,
                secureFileName: file.filename,
                size: file.size,
                mimeType: file.mimetype
            });
        } catch (error) {
            logSecurityEvent('FILE_UPLOAD_VALIDATION_FAILED', req, {
                originalName: file.originalname,
                error: error.message
            });
            throw error;
        }
    }))
    .then(() => next())
    .catch(next);
};

module.exports = {
    createSecureUpload,
    postUploadValidation,
    generateSecureFileName,
    validateFileSignature,
    ALLOWED_FILE_TYPES
};
