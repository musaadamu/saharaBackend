const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Set up Google Drive API client
const setupGoogleDriveClient = () => {
  console.log('Setting up Google Drive API client...');
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set');
  console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set');
  console.log('Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN ? 'Set' : 'Not set');

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error('ERROR: Google Drive credentials are incomplete');
    throw new Error('Google Drive credentials are incomplete');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });

  console.log('Google Drive API client setup complete');

  return google.drive({
    version: 'v3',
    auth: oauth2Client,
  });
};

const drive = setupGoogleDriveClient();

// Upload a file to Google Drive folder
async function uploadFile(filePath, fileName, folderId, journalId = null) {
  console.log('🔴🔴🔴 GOOGLE DRIVE UPLOAD STARTED - MODIFIED VERSION 🔴🔴🔴');
  console.log('Uploading file to Google Drive:', { filePath, fileName, folderId, journalId });
  console.log('Current working directory:', process.cwd());
  console.log('Environment variables loaded from:', require('path').resolve(process.cwd(), '.env'));

  // Validate folder ID
  if (!folderId) {
    console.error('ERROR: Google Drive folder ID is missing');
    throw new Error('Google Drive folder ID is missing or invalid');
  }

  // Check if file exists
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    console.log('File exists and is accessible:', filePath);

    // Get file stats
    const stats = await fs.promises.stat(filePath);
    console.log('File size:', stats.size, 'bytes');
    if (stats.size === 0) {
      console.error('ERROR: File is empty (0 bytes):', filePath);
      throw new Error('File is empty (0 bytes)');
    }
  } catch (error) {
    console.error('ERROR: File does not exist or cannot be accessed:', filePath, error);
    throw error;
  }

  // Verify Google Drive credentials
  try {
    console.log('Verifying Google Drive credentials...');
    console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set');
    console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set');
    console.log('Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN ? 'Set' : 'Not set');

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      throw new Error('Google Drive credentials are incomplete');
    }
  } catch (error) {
    console.error('ERROR: Google Drive credentials verification failed:', error);
    throw error;
  }

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
    description: `Uploaded by Sahara Journal System - ${new Date().toISOString()}`,
    properties: {
      fileType: path.extname(fileName).substring(1)
    }
  };

  // Add journalId to properties if provided
  if (journalId) {
    fileMetadata.properties.journalId = journalId.toString();
  }

  console.log('File metadata prepared:', fileMetadata);

  const media = {
    mimeType: getMimeType(fileName),
    body: fs.createReadStream(filePath),
  };
  console.log('Media type:', media.mimeType);

  try {
    console.log('Sending file to Google Drive API...');
    console.log('Using folder ID:', folderId);

    // First, verify the folder exists
    try {
      console.log('Verifying folder exists...');
      await drive.files.get({ fileId: folderId });
      console.log('Folder verification successful');
    } catch (folderError) {
      console.error('ERROR: Failed to verify folder:', folderError);
      throw new Error(`Google Drive folder verification failed: ${folderError.message}`);
    }

    // Now upload the file
    let response;
    try {
      console.log('Creating file in Google Drive...');
      response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
      });
      console.log('Google Drive API response:', response.data);
    } catch (uploadError) {
      console.error('ERROR: Failed to create file in Google Drive:', uploadError);
      console.error('Upload error details:', JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError)));
      throw new Error(`Failed to create file in Google Drive: ${uploadError.message}`);
    }

    // Make the file public
    try {
      console.log('Making file public...');
      await makeFilePublic(response.data.id);
    } catch (permissionError) {
      console.error('ERROR: Failed to make file public:', permissionError);
      console.error('Permission error details:', JSON.stringify(permissionError, Object.getOwnPropertyNames(permissionError)));
      // Don't throw here, just log the error and continue
      console.log('File was uploaded but could not be made public');
    }

    console.log('=== GOOGLE DRIVE UPLOAD COMPLETED SUCCESSFULLY ===');
    return response.data;
  } catch (error) {
    console.error('=== GOOGLE DRIVE UPLOAD FAILED ===');
    console.error('Error uploading file to Google Drive:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}

// Download a file from Google Drive by file ID and save to local path
async function downloadFile(fileId, destPath) {
  console.log('\n\n🔴🔴🔴 GOOGLE DRIVE DOWNLOAD STARTED 🔴🔴🔴');
  console.log('Downloading file from Google Drive:', { fileId, destPath });

  try {
    // First, verify the file exists and get its metadata
    console.log('Verifying file exists...');
    try {
      const fileMetadata = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size'
      });
      console.log('File metadata:', fileMetadata.data);
    } catch (metadataError) {
      console.error('ERROR: Failed to get file metadata:', metadataError);
      throw new Error(`Google Drive file not found or not accessible: ${metadataError.message}`);
    }

    // Create the destination directory if it doesn't exist
    const destDir = path.dirname(destPath);
    await fs.promises.mkdir(destDir, { recursive: true });

    // Create a write stream to the destination path
    const dest = fs.createWriteStream(destPath);
    console.log('Created write stream to:', destPath);

    // Download the file
    console.log('Downloading file content...');
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Pipe the response to the destination file
    await new Promise((resolve, reject) => {
      let progress = 0;

      response.data
        .on('data', (chunk) => {
          progress += chunk.length;
          if (progress % (1024 * 1024) < chunk.length) { // Log every ~1MB
            console.log(`Download progress: ${Math.round(progress / 1024)} KB`);
          }
        })
        .on('end', () => {
          console.log(`Download complete: ${Math.round(progress / 1024)} KB total`);
          resolve();
        })
        .on('error', (err) => {
          console.error('Error downloading file from Google Drive:', err);
          reject(err);
        })
        .pipe(dest);

      // Handle errors on the destination stream
      dest.on('error', (err) => {
        console.error('Error writing to destination file:', err);
        reject(err);
      });
    });

    // Verify the downloaded file
    const stats = await fs.promises.stat(destPath);
    console.log('Downloaded file size:', stats.size, 'bytes');

    if (stats.size === 0) {
      throw new Error('Downloaded file is empty (0 bytes)');
    }

    console.log('=== GOOGLE DRIVE DOWNLOAD COMPLETED SUCCESSFULLY ===');
    return destPath;
  } catch (error) {
    console.error('=== GOOGLE DRIVE DOWNLOAD FAILED ===');
    console.error('Error downloading file from Google Drive:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    // Clean up the destination file if it exists
    try {
      if (await fs.promises.access(destPath, fs.constants.F_OK).then(() => true).catch(() => false)) {
        await fs.promises.unlink(destPath);
        console.log('Cleaned up incomplete download file:', destPath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up incomplete download:', cleanupError);
    }

    throw error;
  }
}

// Helper to get mime type based on file extension
function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

// Verify Google Drive folder exists and is accessible
async function verifyDriveFolder(folderId) {
  try {
    console.log('Verifying Google Drive folder:', folderId);
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType'
    });

    const folder = response.data;
    if (folder.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error('The provided ID is not a folder');
    }

    console.log('Google Drive folder verified:', folder.name);
    return folder;
  } catch (error) {
    console.error('Error verifying Google Drive folder:', error.message);
    throw error;
  }
}

// List files in a Google Drive folder
async function listFolderContents(folderId) {
  try {
    console.log('Listing files in folder:', folderId);
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime, size)'
    });

    return response.data.files;
  } catch (error) {
    console.error('Error listing folder contents:', error.message);
    throw error;
  }
}

// Make a file publicly accessible via link
async function makeFilePublic(fileId) {
  console.log('=== MAKING FILE PUBLIC ===');
  console.log('File ID:', fileId);

  try {
    console.log('Creating public permission...');
    const permissionResponse = await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    console.log('Permission created:', permissionResponse.data);

    // Get the web view link after making it public
    console.log('Getting web view link...');
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink,name,mimeType'
    });

    console.log('File details:', file.data);
    console.log('Public link:', file.data.webViewLink);
    console.log('=== FILE MADE PUBLIC SUCCESSFULLY ===');

    return file.data.webViewLink;
  } catch (error) {
    console.error('=== FAILED TO MAKE FILE PUBLIC ===');
    console.error('Error making file public:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}

// Delete a file from Google Drive
async function deleteFile(fileId) {
  try {
    await drive.files.delete({ fileId: fileId });
    console.log('File deleted from Google Drive:', fileId);
    return true;
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    throw error;
  }
}

module.exports = {
  uploadFile,
  downloadFile,
  verifyDriveFolder,
  listFolderContents,
  makeFilePublic,
  deleteFile
};
