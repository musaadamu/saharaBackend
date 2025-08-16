#!/usr/bin/env node

/**
 * Deployment Verification Script
 * This script checks if all modules can be loaded correctly before deployment
 */

console.log('🔍 Verifying deployment readiness...\n');

const modules = [
    // Core modules
    { name: 'Express', path: 'express' },
    { name: 'Mongoose', path: 'mongoose' },
    { name: 'Dotenv', path: 'dotenv' },
    
    // Security modules
    { name: 'Helmet', path: 'helmet' },
    { name: 'Express Rate Limit', path: 'express-rate-limit' },
    { name: 'Express Validator', path: 'express-validator' },
    { name: 'Express Mongo Sanitize', path: 'express-mongo-sanitize' },
    { name: 'XSS', path: 'xss' },
    { name: 'HPP', path: 'hpp' },
    
    // File upload
    { name: 'Multer', path: 'multer' },
    
    // Authentication
    { name: 'Bcryptjs', path: 'bcryptjs' },
    { name: 'Jsonwebtoken', path: 'jsonwebtoken' },
    
    // Other dependencies
    { name: 'CORS', path: 'cors' },
    { name: 'Morgan', path: 'morgan' },
    { name: 'Cookie Parser', path: 'cookie-parser' }
];

const customModules = [
    // Custom middleware
    { name: 'Security Middleware', path: './middleware/security' },
    { name: 'Error Handler', path: './middleware/errorHandler' },
    { name: 'Auth Middleware', path: './middleware/authMiddleware' },
    { name: 'Database Security', path: './middleware/databaseSecurity' },
    { name: 'Secure File Upload', path: './middleware/secureFileUpload' },
    
    // Models
    { name: 'User Model', path: './models/User' },
    { name: 'Journal Model', path: './models/Journal' },
    
    // Controllers
    { name: 'Auth Controller', path: './controllers/authController' },
    { name: 'Journal Controller', path: './controllers/journalController' },
    { name: 'Submission Controller', path: './controllers/submissionController' },
    
    // Routes
    { name: 'Auth Routes', path: './routes/authRoutes' },
    { name: 'Journal Routes', path: './routes/journalRoutes' },
    { name: 'Submission Routes', path: './routes/submissionRoutes' }
];

let errors = 0;
let warnings = 0;

// Test module loading
console.log('📦 Testing NPM Dependencies...');
for (const module of modules) {
    try {
        require(module.path);
        console.log(`✅ ${module.name}`);
    } catch (error) {
        console.log(`❌ ${module.name}: ${error.message}`);
        errors++;
    }
}

console.log('\n🔧 Testing Custom Modules...');
for (const module of customModules) {
    try {
        require(module.path);
        console.log(`✅ ${module.name}`);
    } catch (error) {
        console.log(`❌ ${module.name}: ${error.message}`);
        errors++;
    }
}

// Test environment variables
console.log('\n🌍 Checking Environment Variables...');
const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'PORT'
];

const optionalEnvVars = [
    'NODE_ENV',
    'DOCUMENT_STORAGE_PATH',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];

for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
        console.log(`✅ ${envVar} is set`);
    } else {
        console.log(`❌ ${envVar} is missing (required)`);
        errors++;
    }
}

for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
        console.log(`✅ ${envVar} is set`);
    } else {
        console.log(`⚠️  ${envVar} is not set (optional)`);
        warnings++;
    }
}

// Test file structure
console.log('\n📁 Checking File Structure...');
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    'server.js',
    'package.json',
    'middleware/security.js',
    'middleware/errorHandler.js',
    'middleware/authMiddleware.js',
    'middleware/databaseSecurity.js',
    'middleware/secureFileUpload.js',
    'models/User.js',
    'models/Journal.js',
    'controllers/authController.js',
    'controllers/journalController.js',
    'controllers/submissionController.js',
    'routes/authRoutes.js',
    'routes/journalRoutes.js',
    'routes/submissionRoutes.js'
];

for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} is missing`);
        errors++;
    }
}

// Test basic server instantiation
console.log('\n🚀 Testing Server Instantiation...');
try {
    // Load environment variables
    require('dotenv').config();
    
    // Test if server can be created (without starting)
    const express = require('express');
    const app = express();
    
    // Test security middleware loading
    const { securityHeaders, sanitizeInput } = require('./middleware/security');
    const { errorHandler } = require('./middleware/errorHandler');
    
    console.log('✅ Server can be instantiated');
    console.log('✅ Security middleware can be loaded');
    console.log('✅ Error handler can be loaded');
} catch (error) {
    console.log(`❌ Server instantiation failed: ${error.message}`);
    errors++;
}

// Summary
console.log('\n📊 Verification Summary:');
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}`);

if (errors === 0) {
    console.log('\n🎉 Deployment verification PASSED! Ready to deploy.');
    process.exit(0);
} else {
    console.log('\n💥 Deployment verification FAILED! Please fix the errors above.');
    process.exit(1);
}
