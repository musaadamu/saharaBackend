const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

// Set up Google Drive API client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Function to list files in Google Drive
async function listFilesInDrive() {
  try {
    console.log('Listing files in Google Drive folder:', process.env.GOOGLE_DRIVE_FOLDER_ID);
    
    const response = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
      fields: 'files(id, name, mimeType, createdTime, size)',
    });
    
    console.log('Files in Google Drive:');
    console.log(JSON.stringify(response.data.files, null, 2));
    
    return response.data.files;
  } catch (error) {
    console.error('Error listing files in Google Drive:', error.message);
    return [];
  }
}

// Function to download a file from Google Drive
async function downloadFileFromDrive(fileId, localPath) {
  try {
    console.log(`Downloading file ${fileId} to ${localPath}`);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Download the file
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    const dest = fs.createWriteStream(localPath);
    
    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          console.log(`Downloaded file to ${localPath}`);
          resolve(localPath);
        })
        .on('error', (err) => {
          console.error('Error downloading file:', err);
          reject(err);
        })
        .pipe(dest);
    });
  } catch (error) {
    console.error(`Error downloading file ${fileId}:`, error.message);
    throw error;
  }
}

// Function to check local files
function checkLocalFiles() {
  const filesToCheck = [
    {
      name: '1746546274753-Nura Journal 1.pdf',
      paths: [
        path.join(__dirname, 'uploads', 'journals', '1746546274753-Nura Journal 1.pdf'),
        path.join(__dirname, '..', 'uploads', 'journals', '1746546274753-Nura Journal 1.pdf')
      ]
    },
    {
      name: '1746546274753-Nura Journal 1.docx',
      paths: [
        path.join(__dirname, 'uploads', 'journals', '1746546274753-Nura Journal 1.docx'),
        path.join(__dirname, '..', 'uploads', 'journals', '1746546274753-Nura Journal 1.docx')
      ]
    },
    {
      name: '1746546435577-Nura Journal 2.pdf',
      paths: [
        path.join(__dirname, 'uploads', 'journals', '1746546435577-Nura Journal 2.pdf'),
        path.join(__dirname, '..', 'uploads', 'journals', '1746546435577-Nura Journal 2.pdf')
      ]
    },
    {
      name: '1746546435577-Nura Journal 2.docx',
      paths: [
        path.join(__dirname, 'uploads', 'journals', '1746546435577-Nura Journal 2.docx'),
        path.join(__dirname, '..', 'uploads', 'journals', '1746546435577-Nura Journal 2.docx')
      ]
    }
  ];
  
  console.log('Checking local files...');
  
  for (const file of filesToCheck) {
    console.log(`\nChecking file: ${file.name}`);
    let found = false;
    
    for (const filePath of file.paths) {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`✅ Found at: ${filePath}`);
          console.log(`   Size: ${stats.size} bytes`);
          found = true;
        }
      } catch (err) {
        console.error(`Error checking ${filePath}:`, err.message);
      }
    }
    
    if (!found) {
      console.log(`❌ Not found in any location`);
    }
  }
}

// Function to restore files from Google Drive
async function restoreFilesFromDrive() {
  try {
    console.log('Restoring files from Google Drive...');
    
    // Get files from Google Drive
    const driveFiles = await listFilesInDrive();
    
    // Create target directory if it doesn't exist
    const targetDir = path.join(__dirname, '..', 'uploads', 'journals');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    console.log(`Target directory: ${targetDir}`);
    
    // Download each file
    for (const file of driveFiles) {
      const targetPath = path.join(targetDir, file.name);
      
      try {
        await downloadFileFromDrive(file.id, targetPath);
        console.log(`✅ Successfully downloaded ${file.name}`);
      } catch (err) {
        console.error(`❌ Failed to download ${file.name}:`, err.message);
      }
    }
    
    console.log('Restoration complete!');
  } catch (error) {
    console.error('Error restoring files:', error.message);
  }
}

// Main function
async function main() {
  console.log('=== FILE SYSTEM CHECK ===');
  checkLocalFiles();
  
  console.log('\n=== GOOGLE DRIVE FILES ===');
  await listFilesInDrive();
  
  console.log('\n=== RESTORING FILES ===');
  await restoreFilesFromDrive();
  
  console.log('\n=== FINAL CHECK ===');
  checkLocalFiles();
}

// Run the main function
main().catch(err => {
  console.error('Error in main function:', err);
});
