const fs = require('fs');
const path = require('path');

console.log('=== CHECKING GOOGLE DRIVE UTILITY ===');

// Read the Google Drive utility file
const utilPath = path.join(__dirname, 'utils', 'googleDrive.js');
console.log('Utility path:', utilPath);
console.log('Utility exists:', fs.existsSync(utilPath));

if (fs.existsSync(utilPath)) {
  const content = fs.readFileSync(utilPath, 'utf8');
  
  // Check for our distinctive log messages
  const hasRedLog = content.includes('🔴🔴🔴 GOOGLE DRIVE UPLOAD STARTED - MODIFIED VERSION 🔴🔴🔴');
  console.log('Has distinctive log message:', hasRedLog);
  
  // Check for our setup function
  const hasSetupFunction = content.includes('const setupGoogleDriveClient = () => {');
  console.log('Has setup function:', hasSetupFunction);
  
  // Check for our error handling changes
  const hasErrorHandling = content.includes('ERROR: Failed to create file in Google Drive');
  console.log('Has error handling changes:', hasErrorHandling);
}
