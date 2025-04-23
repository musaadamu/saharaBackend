const fs = require('fs');
const path = require('path');

console.log('=== CHECKING JOURNAL CONTROLLER ===');

// Read the journal controller file
const controllerPath = path.join(__dirname, 'controllers', 'journalController.js');
console.log('Controller path:', controllerPath);
console.log('Controller exists:', fs.existsSync(controllerPath));

if (fs.existsSync(controllerPath)) {
  const content = fs.readFileSync(controllerPath, 'utf8');
  
  // Check for our distinctive log messages
  const hasRedLog = content.includes('🔴🔴🔴 UPLOAD JOURNAL PROCESS STARTED - MODIFIED VERSION 🔴🔴🔴');
  console.log('Has distinctive log message:', hasRedLog);
  
  // Check for our error handling changes
  const hasErrorHandling = content.includes('WARNING: Google Drive upload failed, but continuing with local file paths only');
  console.log('Has error handling changes:', hasErrorHandling);
  
  // Check for our response changes
  const hasResponseChanges = content.includes('googleDriveUploadFailed: !!docxUploadError');
  console.log('Has response changes:', hasResponseChanges);
}
