const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Import Journal model
const Journal = require('./models/Journal');

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

// Function to update file paths in the database
async function updateFilePaths() {
  try {
    console.log('Updating file paths in the database...');
    
    // Get all journals
    const journals = await Journal.find({});
    console.log(`Found ${journals.length} journals in the database`);
    
    for (const journal of journals) {
      console.log(`\nProcessing journal: ${journal.title}`);
      
      // Check if PDF file path exists
      if (journal.pdfFilePath) {
        const pdfFileName = path.basename(journal.pdfFilePath);
        const correctPdfPath = `uploads/journals/${pdfFileName}`;
        
        console.log(`Updating PDF path from ${journal.pdfFilePath} to ${correctPdfPath}`);
        journal.pdfFilePath = correctPdfPath;
      }
      
      // Check if DOCX file path exists
      if (journal.docxFilePath) {
        const docxFileName = path.basename(journal.docxFilePath);
        const correctDocxPath = `uploads/journals/${docxFileName}`;
        
        console.log(`Updating DOCX path from ${journal.docxFilePath} to ${correctDocxPath}`);
        journal.docxFilePath = correctDocxPath;
      }
      
      // Save the journal
      await journal.save();
      console.log(`✅ Updated journal: ${journal.title}`);
    }
    
    console.log('\nAll journal file paths updated successfully!');
  } catch (error) {
    console.error('Error updating file paths:', error.message);
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
  try {
    console.log('=== UPDATING FILE PATHS ===');
    await updateFilePaths();
    
    console.log('\n=== RESTORING FILES FROM GOOGLE DRIVE ===');
    await restoreFilesFromDrive();
    
    console.log('\nAll operations completed successfully!');
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the main function
main().catch(err => {
  console.error('Error in main function:', err);
  mongoose.connection.close();
});
