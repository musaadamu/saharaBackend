
const dotenv = require('dotenv');
// Load environment variables first
dotenv.config();

// Core dependencies
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

// Import models
const Journal = require('./models/Journal');

// Middleware imports
const { protect } = require('./middleware/authMiddleware');

// Route imports
const submissionRoutes = require('./routes/submissionRoutes');
const submissionDownloadRoutes = require('./routes/submissionDownloadRoutes');
const journalRoutes = require('./routes/journalRoutes');
const journalDownloadRoutes = require('./routes/journalDownloadRoutes');
const authRoutes = require('./routes/authRoutes');
const diagnosticRoutes = require('./routes/diagnosticRoutes');

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Environment check
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);

// Middleware setup
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// We'll handle multipart/form-data in the specific routes that need it
// Removing global multer middleware to avoid conflicts with route-specific multer configurations

// CORS Configuration for development and production
const allowedOrigins = [
    'http://localhost:3000',           // Local frontend development
    'http://localhost:5000',           // Vite default port
    'https://sahara-journal-frontend.vercel.app', // Production frontend
    'https://sahara-journal.vercel.app'           // Alternative production frontend
].filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

// Log the current environment
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Backend URL:', process.env.NODE_ENV === 'production' ? 'https://saharabackend-v190.onrender.com' : `http://localhost:${PORT}`);
console.log('Frontend URL:', process.env.NODE_ENV === 'production' ? 'https://sahara-journal-frontend.vercel.app' : 'http://localhost:3000');

app.use((req, res, next) => {
    // Custom CORS handling to allow credentials: false for download routes
    const origin = req.headers.origin;
    const isDownloadRoute = req.path.match(/^\/api\/journals\/.+\/download\/.+$/) || req.path.match(/^\/api\/submissions\/.+\/download\/.+$/);

    if (!origin) {
        // Allow requests with no origin (like mobile apps, curl, etc)
        res.header('Access-Control-Allow-Origin', '*');
    } else if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        res.header('Access-Control-Allow-Origin', origin);
    } else {
        console.log('CORS blocked origin:', origin);
        return res.status(403).send('Not allowed by CORS');
    }

    // For download routes, set credentials to false to avoid CORS issues
    if (isDownloadRoute) {
        res.header('Access-Control-Allow-Credentials', 'false');
    } else {
        res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,HEAD');
    // Add 'cache-control' to allowed headers to fix CORS preflight error
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, cache-control');
    res.header('Access-Control-Expose-Headers', 'Authorization, Content-Disposition, Content-Type, Content-Length');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});

// CORS middleware already defined above

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Server is running',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Mount routes with /api prefix
app.use('/', authRoutes); // Auth routes at root path
app.use('/api/auth', authRoutes); // Also mount auth routes at /api/auth for compatibility
app.use('/api/api/auth', authRoutes); // Also mount auth routes at /api/auth for compatibility

app.use('/api/journals', journalRoutes);
app.use('/api/journals', journalDownloadRoutes);
app.use('/journals', journalRoutes);
app.use('/journals', journalDownloadRoutes);
app.use('/api/api/journals', journalRoutes);
app.use('/api/api/journals', journalDownloadRoutes);

// Handle both /api/submissions and /api/api/submissions for backward compatibility
app.use('/api/submissions', submissionRoutes);
app.use('/api/submissions', submissionDownloadRoutes);
app.use('/api/api/submissions', submissionRoutes);
app.use('/api/api/submissions', submissionDownloadRoutes);

// Mount diagnostic routes
app.use('/api/diagnostic', diagnosticRoutes);
// Also mount at root level for easier access
app.use('/diagnostic', diagnosticRoutes);

// Serve static files from uploads directory
// Handle the environment variable path correctly
let uploadsPath;
if (process.env.DOCUMENT_STORAGE_PATH) {
    // If it's a relative path starting with '../', resolve it relative to the current directory
    if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
        // Remove the '../' prefix to get the correct path for static serving
        const staticPath = process.env.DOCUMENT_STORAGE_PATH.replace(/^\.\.\//, '');
        uploadsPath = path.resolve(path.join(__dirname, '..', staticPath));
    } else {
        // Otherwise, use it as is or resolve it if it's a relative path
        uploadsPath = path.resolve(process.env.DOCUMENT_STORAGE_PATH);
    }
} else {
    // Fallback to a default path
    uploadsPath = path.resolve(path.join(__dirname, 'uploads'));
}
console.log('Static files path (absolute):', uploadsPath);
app.use('/uploads', express.static(uploadsPath));

// Also serve the parent directory of uploads to handle the case where DOCUMENT_STORAGE_PATH is '../uploads/journals'
const parentUploadsPath = path.resolve(path.join(__dirname, '..', 'uploads'));
console.log('Parent uploads path (absolute):', parentUploadsPath);
app.use('/uploads', express.static(parentUploadsPath));

// Ensure submissions directory is also served
const submissionsPath = path.resolve(path.join(__dirname, 'uploads', 'submissions'));
console.log('Submissions path (absolute):', submissionsPath);
app.use('/uploads/submissions', express.static(submissionsPath));

// Also serve the parent submissions directory
const parentSubmissionsPath = path.resolve(path.join(__dirname, '..', 'uploads', 'submissions'));
console.log('Parent submissions path (absolute):', parentSubmissionsPath);
app.use('/uploads/submissions', express.static(parentSubmissionsPath));

// Add a route to check file existence and paths
app.get('/check-file/:filename', (req, res) => {
    const filename = req.params.filename;

    // Handle the environment variable path correctly
    let uploadsDir;
    if (process.env.DOCUMENT_STORAGE_PATH) {
        // If it's a relative path starting with '../', resolve it relative to the current directory
        if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
            uploadsDir = path.resolve(path.join(__dirname, '..', process.env.DOCUMENT_STORAGE_PATH));
        } else {
            // Otherwise, use it as is or resolve it if it's a relative path
            uploadsDir = path.resolve(process.env.DOCUMENT_STORAGE_PATH);
        }
    } else {
        // Fallback to a default path
        uploadsDir = path.resolve(path.join(__dirname, 'uploads', 'journals'));
    }

    const filePath = path.join(uploadsDir, filename);
    console.log('Checking file existence at:', filePath);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({
                exists: false,
                requestedPath: filePath,
                error: err.message
            });
        }

        res.json({
            exists: true,
            path: filePath,
            url: `/uploads/journals/${filename}`
        });
    });
});

// Add a direct file serving route for journals
app.get('/direct-file/:type/:filename', (req, res) => {
    const { type, filename } = req.params;

    // Try multiple possible locations for the file
    const possiblePaths = [];

    if (type === 'journals') {
        // Try different possible locations
        possiblePaths.push(
            path.resolve(path.join(__dirname, '..', 'uploads', 'journals', filename)),
            path.resolve(path.join(__dirname, 'uploads', 'journals', filename)),
            path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', filename))
        );

        // Also check if there's a DOCUMENT_STORAGE_PATH environment variable
        if (process.env.DOCUMENT_STORAGE_PATH) {
            if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
                const storagePath = process.env.DOCUMENT_STORAGE_PATH.replace(/^\.\.\//,'');
                possiblePaths.push(
                    path.resolve(path.join(__dirname, '..', storagePath, filename)),
                    path.resolve(path.join(__dirname, '..', '..', storagePath, filename))
                );
            } else {
                possiblePaths.push(
                    path.resolve(path.join(process.env.DOCUMENT_STORAGE_PATH, filename))
                );
            }
        }
    } else if (type === 'submissions') {
        // Try different possible locations for submissions
        possiblePaths.push(
            path.resolve(path.join(__dirname, '..', 'uploads', 'submissions', filename)),
            path.resolve(path.join(__dirname, 'uploads', 'submissions', filename)),
            path.resolve(path.join(__dirname, '..', '..', 'uploads', 'submissions', filename))
        );
    } else {
        return res.status(400).json({ message: 'Invalid file type' });
    }

    // Add backend/uploads/journals path for better file finding
    if (type === 'journals') {
        possiblePaths.push(
            path.resolve(path.join(__dirname, '..', 'backend', 'uploads', 'journals', filename)),
            path.resolve(path.join(__dirname, '..', '..', 'backend', 'uploads', 'journals', filename))
        );

        // Try to handle the case where the filename might be URL-encoded
        if (filename.includes('%20')) {
            const decodedFilename = decodeURIComponent(filename);
            possiblePaths.push(
                path.resolve(path.join(__dirname, '..', 'uploads', 'journals', decodedFilename)),
                path.resolve(path.join(__dirname, 'uploads', 'journals', decodedFilename)),
                path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', decodedFilename)),
                path.resolve(path.join(__dirname, '..', 'backend', 'uploads', 'journals', decodedFilename))
            );
        }
    }

    console.log('Trying to find file in these locations:', possiblePaths);

    // Try each path until we find the file
    let filePath = null;
    for (const pathToCheck of possiblePaths) {
        if (fs.existsSync(pathToCheck)) {
            filePath = pathToCheck;
            console.log('File found at:', filePath);
            break;
        }
    }

    // If no file was found in any location
    if (!filePath) {
        console.error('File not found in any location:', filename);
        return res.status(404).json({ message: 'File not found' });
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === '.pdf') {
        contentType = 'application/pdf';
    } else if (ext === '.docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    // Set headers and send the file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Add CORS headers for better download support
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
        console.error('Error streaming file:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error streaming file', error: err.message });
        }
    });

    fileStream.pipe(res);
});

// Add a route to copy a file to the correct location
app.get('/fix-file/:type/:filename', async (req, res) => {
    const { type, filename } = req.params;
    const results = [];

    // Define source directories to search
    const dirsToSearch = [
        path.resolve(path.join(__dirname, '..', 'uploads', type)),
        path.resolve(path.join(__dirname, 'uploads', type)),
        path.resolve(path.join(__dirname, '..', '..', 'uploads', type)),
        path.resolve(path.join(__dirname, '..', 'uploads')),
        path.resolve(path.join(__dirname, 'uploads')),
        path.resolve(path.join(__dirname, '..', '..', 'uploads'))
    ];

    // Add DOCUMENT_STORAGE_PATH if it exists
    if (process.env.DOCUMENT_STORAGE_PATH) {
        if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
            const storagePath = process.env.DOCUMENT_STORAGE_PATH.replace(/^\.\.\//,'');
            dirsToSearch.push(
                path.resolve(path.join(__dirname, '..', storagePath)),
                path.resolve(path.join(__dirname, '..', '..', storagePath))
            );
        } else {
            dirsToSearch.push(
                path.resolve(process.env.DOCUMENT_STORAGE_PATH)
            );
        }
    }

    // Define target directory
    const targetDir = path.resolve(path.join(__dirname, '..', 'uploads', type));
    const targetPath = path.join(targetDir, filename);

    console.log('Target directory:', targetDir);
    console.log('Target path:', targetPath);

    // Create target directory if it doesn't exist
    try {
        await fs.promises.mkdir(targetDir, { recursive: true });
        console.log('Target directory created or already exists');
    } catch (err) {
        console.error('Error creating target directory:', err);
        return res.status(500).json({ error: 'Failed to create target directory' });
    }

    // Function to search a directory recursively
    const searchDir = async (dir) => {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    await searchDir(fullPath);
                } else if (entry.name.includes(filename)) {
                    // Found a matching file
                    results.push({
                        path: fullPath,
                        name: entry.name,
                        size: (await fs.promises.stat(fullPath)).size
                    });
                }
            }
        } catch (err) {
            console.error(`Error searching directory ${dir}:`, err);
        }
    };

    // Search all directories
    for (const dir of dirsToSearch) {
        try {
            if (fs.existsSync(dir)) {
                await searchDir(dir);
            }
        } catch (err) {
            console.error(`Error accessing directory ${dir}:`, err);
        }
    }

    // If no files found
    if (results.length === 0) {
        return res.json({
            success: false,
            message: 'No matching files found',
            searchedDirectories: dirsToSearch
        });
    }

    // Copy the first matching file to the target location
    try {
        const sourceFile = results[0].path;
        console.log(`Copying file from ${sourceFile} to ${targetPath}`);

        // Read the source file
        const fileContent = await fs.promises.readFile(sourceFile);

        // Write to the target location
        await fs.promises.writeFile(targetPath, fileContent);

        return res.json({
            success: true,
            message: 'File copied successfully',
            source: sourceFile,
            target: targetPath,
            allMatches: results
        });
    } catch (err) {
        console.error('Error copying file:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to copy file',
            message: err.message
        });
    }
});

// Add a route to find a specific file
app.get('/find-file/:filename', async (req, res) => {
    const { filename } = req.params;
    const results = [];

    // Define directories to search
    const dirsToSearch = [
        path.resolve(path.join(__dirname, '..', 'uploads', 'journals')),
        path.resolve(path.join(__dirname, 'uploads', 'journals')),
        path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals')),
        path.resolve(path.join(__dirname, '..', 'uploads')),
        path.resolve(path.join(__dirname, 'uploads')),
        path.resolve(path.join(__dirname, '..', '..', 'uploads'))
    ];

    // Add DOCUMENT_STORAGE_PATH if it exists
    if (process.env.DOCUMENT_STORAGE_PATH) {
        if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
            const storagePath = process.env.DOCUMENT_STORAGE_PATH.replace(/^\.\.\//,'');
            dirsToSearch.push(
                path.resolve(path.join(__dirname, '..', storagePath)),
                path.resolve(path.join(__dirname, '..', '..', storagePath))
            );
        } else {
            dirsToSearch.push(
                path.resolve(process.env.DOCUMENT_STORAGE_PATH)
            );
        }
    }

    console.log('Searching for file in these directories:', dirsToSearch);

    // Function to search a directory recursively
    const searchDir = async (dir) => {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    await searchDir(fullPath);
                } else if (entry.name.includes(filename)) {
                    // Found a matching file
                    results.push({
                        path: fullPath,
                        name: entry.name,
                        size: (await fs.promises.stat(fullPath)).size
                    });
                }
            }
        } catch (err) {
            console.error(`Error searching directory ${dir}:`, err);
        }
    };

    // Search all directories
    for (const dir of dirsToSearch) {
        try {
            if (fs.existsSync(dir)) {
                await searchDir(dir);
            }
        } catch (err) {
            console.error(`Error accessing directory ${dir}:`, err);
        }
    }

    res.json({
        filename,
        searchedDirectories: dirsToSearch,
        results
    });
});

// Add a diagnostic route to check file paths
app.get('/check-file/:journalId/:fileType', async (req, res) => {
    try {
        const { journalId, fileType } = req.params;

        // Find the journal
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ message: 'Journal not found' });
        }

        // Check for Cloudinary URLs first
        let cloudinaryUrl = null;
        if (fileType === 'pdf') {
            cloudinaryUrl = journal.pdfCloudinaryUrl || journal.pdfWebViewLink;
        } else if (fileType === 'docx') {
            cloudinaryUrl = journal.docxCloudinaryUrl || journal.docxWebViewLink;
        } else {
            return res.status(400).json({ message: 'Invalid file type' });
        }

        // If we have a Cloudinary URL, return success
        if (cloudinaryUrl) {
            console.log(`Found Cloudinary URL for ${fileType} file:`, cloudinaryUrl);

            // For PDFs, provide multiple download URL options
            let downloadUrl = cloudinaryUrl;

            // Option 1: Use fl_attachment flag
            if (fileType === 'pdf' && cloudinaryUrl.includes('/upload/') && !cloudinaryUrl.includes('fl_attachment')) {
                downloadUrl = cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/');
                console.log('Modified Cloudinary URL with fl_attachment:', downloadUrl);
            }

            // Option 2: Use Cloudinary's download URL format
            let downloadUrl2 = null;
            if (fileType === 'pdf' && cloudinaryUrl.includes('/upload/')) {
                downloadUrl2 = cloudinaryUrl.replace('/upload/', '/download/');
                console.log('Alternative Cloudinary download URL:', downloadUrl2);
            }

            return res.json({
                exists: true,
                journalId,
                fileType,
                cloudinaryUrl,
                downloadUrl,
                downloadUrl2,
                message: `${fileType.toUpperCase()} file available on Cloudinary`
            });
        }

        // Get the file path based on file type
        let filePath;
        if (fileType === 'pdf') {
            filePath = journal.pdfFilePath;
        } else if (fileType === 'docx') {
            filePath = journal.docxFilePath;
        }

        if (!filePath) {
            return res.status(404).json({
                exists: false,
                message: `No ${fileType} file path found for this journal`,
                journalId,
                fileType
            });
        }

        // Check possible file locations
        const possiblePaths = [
            path.resolve(path.join(__dirname, '..', 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, '..', '..', 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, '..', 'backend', 'uploads', 'journals', path.basename(filePath))),
            path.resolve(path.join(__dirname, '..', '..', 'backend', 'uploads', 'journals', path.basename(filePath)))
        ];

        // Check if DOCUMENT_STORAGE_PATH is defined
        if (process.env.DOCUMENT_STORAGE_PATH) {
            possiblePaths.push(
                path.resolve(path.join(process.env.DOCUMENT_STORAGE_PATH, path.basename(filePath)))
            );
        }

        // Check each path
        const results = [];
        let fileExists = false;
        for (const pathToCheck of possiblePaths) {
            try {
                const exists = fs.existsSync(pathToCheck);
                if (exists) {
                    fileExists = true;
                }
                results.push({
                    path: pathToCheck,
                    exists
                });
            } catch (err) {
                results.push({
                    path: pathToCheck,
                    exists: false,
                    error: err.message
                });
            }
        }

        // Return the results
        if (fileExists) {
            return res.json({
                exists: true,
                journalId,
                fileType,
                filePath,
                fileName: path.basename(filePath),
                possiblePaths: results,
                message: `${fileType.toUpperCase()} file found in local storage`
            });
        } else {
            return res.json({
                exists: false,
                journalId,
                fileType,
                filePath,
                fileName: path.basename(filePath),
                possiblePaths: results,
                message: `${fileType.toUpperCase()} file not found in any location`
            });
        }
    } catch (err) {
        console.error('Error checking file:', err);
        res.status(500).json({
            exists: false,
            message: 'Error checking file',
            error: err.message
        });
    }
});

// Add a route to list all files in the uploads directory
app.get('/list-files', (req, res) => {
    // Handle the environment variable path correctly
    let uploadsDir;
    if (process.env.DOCUMENT_STORAGE_PATH) {
        // If it's a relative path starting with '../', resolve it relative to the current directory
        if (process.env.DOCUMENT_STORAGE_PATH.startsWith('../')) {
            uploadsDir = path.resolve(path.join(__dirname, '..', process.env.DOCUMENT_STORAGE_PATH));
        } else {
            // Otherwise, use it as is or resolve it if it's a relative path
            uploadsDir = path.resolve(process.env.DOCUMENT_STORAGE_PATH);
        }
    } else {
        // Fallback to a default path
        uploadsDir = path.resolve(path.join(__dirname, 'uploads', 'journals'));
    }

    console.log('Listing files in directory:', uploadsDir);

    // Also check the parent directory if using relative path
    const parentUploadsDir = path.resolve(path.join(__dirname, '..', 'uploads', 'journals'));
    console.log('Also checking parent directory:', parentUploadsDir);

    // Check both directories
    const checkDirectory = (dir, callback) => {
        fs.readdir(dir, (err, files) => {
            if (err) {
                console.error(`Error reading directory ${dir}:`, err);
                callback([], dir);
            } else {
                callback(files, dir);
            }
        });
    };

    // Check the main directory
    checkDirectory(uploadsDir, (mainFiles, mainDir) => {
        // Check the parent directory if different
        if (uploadsDir !== parentUploadsDir) {
            checkDirectory(parentUploadsDir, (parentFiles, parentDir) => {
                res.json({
                    directories: [
                        {
                            directory: mainDir,
                            files: mainFiles
                        },
                        {
                            directory: parentDir,
                            files: parentFiles
                        }
                    ]
                });
            });
        } else {
            res.json({
                directories: [
                    {
                        directory: mainDir,
                        files: mainFiles
                    }
                ]
            });
        }
    });
});

// Improved MongoDB Connection
const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            retryReads: true,
            maxPoolSize: 10,
        });

        console.log('✅ MongoDB connected successfully');
        console.log(`MongoDB URI: ${process.env.MONGODB_URI.substring(0, 20)}...`);

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`Backend URL: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        setTimeout(() => connectDB(), 5000);
    }
};

// Graceful shutdown handling
process.on('SIGINT', () => {
    process.env.SHUTTING_DOWN = true;
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed due to app termination');
        process.exit(0);
    });
});

// Enhanced error handling
app.use((err, req, res, next) => {
    console.error(err.stack);

    if (req.accepts('json')) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
        });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

// Start the server
connectDB();