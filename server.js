// const dotenv = require('dotenv');
// // Load environment variables first
// dotenv.config();

// // Core dependencies
// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs');
// const morgan = require('morgan');

// // Middleware imports
// const { protect } = require('./middleware/authMiddleware');

// // Route imports
// const submissionRoutes = require('./routes/submissionRoutes');
// const submissionDownloadRoutes = require('./routes/submissionDownloadRoutes');
// const journalRoutes = require('./routes/journalRoutes');
// const journalDownloadRoutes = require('./routes/journalDownloadRoutes');
// const authRoutes = require('./routes/authRoutes');

// // Validate required environment variables
// const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
// const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// if (missingEnvVars.length > 0) {
//     console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
//     process.exit(1);
// }

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Environment check
// const isProduction = process.env.NODE_ENV === 'production';
// console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);

// // Middleware setup
// app.use(bodyParser.json({ limit: '50mb' }));
// app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
// app.use(morgan('dev'));

// // Handle multipart/form-data for file uploads
// const multer = require('multer');
// const upload = multer();
// app.use(upload.any());

// // CORS Configuration for development and production
// const allowedOrigins = [
//     'http://localhost:3000', // Local frontend development
//     'https://sahara-journal-frontend.vercel.app' // Production frontend
// ].filter(Boolean);

// console.log('Allowed CORS origins:', allowedOrigins);

// app.use(cors({
//     origin: function (origin, callback) {
//         if (!origin) {
//             return callback(null, true); // Allow server-to-server requests
//         }

//         const isAllowed = allowedOrigins.some(allowedOrigin => {
//             if (allowedOrigin.includes('*')) {
//                 const pattern = new RegExp(allowedOrigin.replace('*', '.*'));
//                 return pattern.test(origin);
//             }
//             return origin.includes(allowedOrigin);
//         });

//         if (isAllowed) {
//             callback(null, true);
//         } else {
//             console.log(`Origin ${origin} not allowed by CORS`);
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//     exposedHeaders: ['Authorization']
// }));

// // Add headers for all responses
// app.use((req, res, next) => {
//     res.header('Access-Control-Allow-Credentials', 'true');
//     next();
// });

// // Health check endpoint
// app.get('/health', (req, res) => {
//     res.status(200).json({
//         status: 'ok',
//         message: 'Server is running',
//         environment: process.env.NODE_ENV || 'development'
//     });
// });

// // Mount routes
// app.use('/auth', authRoutes);
// app.use('/journals', journalRoutes);
// app.use('/journals', journalDownloadRoutes);
// app.use('/submissions', submissionRoutes);
// app.use('/submissions', submissionDownloadRoutes);

// // Serve static files from uploads directory
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Improved MongoDB Connection
// const connectDB = async () => {
//     try {
//         if (!process.env.MONGODB_URI) {
//             throw new Error('MONGODB_URI is not defined in environment variables');
//         }

//         await mongoose.connect(process.env.MONGODB_URI, {
//             serverSelectionTimeoutMS: 10000,
//             socketTimeoutMS: 45000,
//             retryWrites: true,
//             retryReads: true,
//             maxPoolSize: 10,
//         });

//         console.log('✅ MongoDB connected successfully');
//         console.log(`MongoDB URI: ${process.env.MONGODB_URI.substring(0, 20)}...`);

//         app.listen(PORT, () => {
//             console.log(`🚀 Server running on port ${PORT}`);
//         console.log(`Backend URL: http://localhost:${PORT}`);
//         });
//     } catch (err) {
//         console.error('❌ MongoDB connection error:', err);
//         setTimeout(() => connectDB(), 5000);
//     }
// };

// // Graceful shutdown handling
// process.on('SIGINT', () => {
//     process.env.SHUTTING_DOWN = true;
//     mongoose.connection.close(() => {
//         console.log('MongoDB connection closed due to app termination');
//         process.exit(0);
//     });
// });

// // Enhanced error handling
// app.use((err, req, res, next) => {
//     console.error(err.stack);

//     if (req.accepts('json')) {
//         res.status(500).json({
//             success: false,
//             message: 'Server Error',
//             error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
//         });
//     } else {
//         res.status(500).send('Internal Server Error');
//     }
// });

// // Start the server
// connectDB();
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

// Middleware imports
const { protect } = require('./middleware/authMiddleware');

// Route imports
const submissionRoutes = require('./routes/submissionRoutes');
const submissionDownloadRoutes = require('./routes/submissionDownloadRoutes');
const journalRoutes = require('./routes/journalRoutes');
const journalDownloadRoutes = require('./routes/journalDownloadRoutes');
const authRoutes = require('./routes/authRoutes');

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
    'http://localhost:5173',           // Vite default port
    'https://sahara-journal-frontend.vercel.app', // Production frontend
    'https://sahara-journal.vercel.app'           // Alternative production frontend
].filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

// Log the current environment
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Backend URL:', process.env.NODE_ENV === 'production' ? 'https://saharabackend-v190.onrender.com' : `http://localhost:${PORT}`);
console.log('Frontend URL:', process.env.NODE_ENV === 'production' ? 'https://sahara-journal-frontend.vercel.app' : 'http://localhost:3000');

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) {
            return callback(null, true); // Allow server-to-server requests
        }

        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.includes('*')) {
                const pattern = new RegExp(allowedOrigin.replace('*', '.*'));
                return pattern.test(origin);
            }
            // Fixed origin check logic
            return origin === allowedOrigin || origin.startsWith(allowedOrigin);
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log(`Origin ${origin} not allowed by CORS`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization']
}));

// Add headers for all responses
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Server is running',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Mount routes with /api prefix
app.use('/', authRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/journals', journalDownloadRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/submissions', submissionDownloadRoutes);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add a route to check file existence and paths
app.get('/check-file/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', 'journals', filename);

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