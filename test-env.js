require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('=== ENVIRONMENT VARIABLES TEST ===');
console.log('Current working directory:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
console.log('.env file exists:', fs.existsSync(envPath));
console.log('.env file path:', envPath);

// Log Google Drive credentials
console.log('Google Drive credentials:');
console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'Not set');
console.log('- Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + '...' : 'Not set');
console.log('- Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN ? process.env.GOOGLE_REFRESH_TOKEN.substring(0, 10) + '...' : 'Not set');
console.log('- Access Token:', process.env.GOOGLE_ACCESS_TOKEN ? process.env.GOOGLE_ACCESS_TOKEN.substring(0, 10) + '...' : 'Not set');
console.log('- Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID || 'Not set');

// Log MongoDB URI
console.log('MongoDB URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'Not set');

// Log document storage path
console.log('Document storage path:', process.env.DOCUMENT_STORAGE_PATH || 'Not set');
console.log('Document storage URL:', process.env.DOCUMENT_STORAGE_URL || 'Not set');

// Log all environment variables
console.log('All environment variables:');
Object.keys(process.env).forEach(key => {
  if (key.startsWith('GOOGLE') || key === 'MONGODB_URI' || key === 'JWT_SECRET' || key === 'PORT' || key === 'NODE_ENV' || key.includes('DOCUMENT')) {
    const value = process.env[key];
    console.log(`${key}: ${value ? (value.length > 20 ? value.substring(0, 20) + '...' : value) : 'Not set'}`);
  }
});
