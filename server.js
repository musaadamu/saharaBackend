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

// Route imports
const submissionRoutes = require('./routes/submissionRoutes');
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

// ...existing middleware setup...

// Enhanced CORS Configuration
const allowedOrigins = [
    'http://localhost:3000',
    'https://sahara-journal-frontend.vercel.app',
    'https://sahara-journal-frontend-git-main.vercel.app',
    'https://sahara-journal-frontend-*.vercel.app', // Allow all Vercel preview deployments
    process.env.CLIENT_URL
].filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

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
            return origin.includes(allowedOrigin);
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
    allowedHeaders: ['Content-Type', 'Authorization']
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

// ...existing routes...

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
            console.log(`Backend URL: ${isProduction ? 'https://saharabackend-v190.onrender.com' : `http://localhost:${PORT}`}`);
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
