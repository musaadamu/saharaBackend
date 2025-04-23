require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('Current working directory:', process.cwd());

// Check if .env file exists in current directory
const envPath = path.join(process.cwd(), '.env');
console.log('.env file exists in current directory:', fs.existsSync(envPath));

// Check if .env file exists in saharaBackend directory
const backendEnvPath = path.join(process.cwd(), 'saharaBackend', '.env');
console.log('.env file exists in saharaBackend directory:', fs.existsSync(backendEnvPath));

// Log all environment variables starting with GOOGLE
console.log('Google environment variables:');
Object.keys(process.env)
  .filter(key => key.startsWith('GOOGLE'))
  .forEach(key => {
    const value = process.env[key];
    console.log(`${key}: ${value ? (value.length > 10 ? value.substring(0, 10) + '...' : value) : 'Not set'}`);
  });

// Check MongoDB connection string
console.log('MongoDB URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'Not set');

// Check document storage path
console.log('Document storage path:', process.env.DOCUMENT_STORAGE_PATH || 'Not set');
