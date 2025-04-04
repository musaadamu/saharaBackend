const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const submissionRoutes = require('./routes/submissionRoutes');
const journalRoutes = require('./routes/journalRoutes');
const journalDownloadRoutes = require('./routes/journalDownloadRoutes');
const authRoutes = require('./routes/authRoutes');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Serve static files with proper headers
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.set('Content-Type', 'application/pdf');
        } else if (filePath.endsWith('.docx')) {
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }
    }
}));

// CORS Configuration
const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/submissionDownload', require('./routes/submissionDownloadRoutes'));
app.use('/api/journals', journalRoutes);
app.use('/api/journals', journalDownloadRoutes); // Mount under /api/journals


// Error handling for file downloads
app.use((err, req, res, next) => {
    if (err.code === 'ENOENT') {
        return res.status(404).json({ 
            success: false,
            message: 'File not found',
            path: err.path 
        });
    }
    next(err);
});

// MongoDB Connection with improved timeout and retry settings
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
})
.then(() => {
    console.log('✅ MongoDB connected successfully');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    if (err.name === 'MongooseServerSelectionError') {
        console.error('Server selection error - check your network connection and MongoDB Atlas whitelist settings');
    }
    process.exit(1);
});

// MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});


// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (req.accepts('json')) {
        res.status(500).json({ 
            success: false,
            message: 'Server Error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

// 404 Handler
app.use((req, res) => {
    if (req.accepts('json')) {
        res.status(404).json({ success: false, message: 'Not Found' });
    } else {
        res.status(404).send('Not Found');
    }
});
