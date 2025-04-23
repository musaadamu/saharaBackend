const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

async function testGoogleDriveAccess() {
  try {
    // Load credentials from environment variables
    const credentials = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob'
    };
    
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );
    
    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    
    // Create drive client
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Get folder ID from environment variable
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    console.log(`Attempting to access folder ID: ${folderId}`);
    
    try {
      // Try to get the folder details
      const folderResponse = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType, capabilities'
      });
      
      console.log('Successfully accessed folder:');
      console.log(folderResponse.data);
      
      // Check folder permissions
      if (folderResponse.data.capabilities) {
        console.log('Your permissions on this folder:');
        console.log(folderResponse.data.capabilities);
      }
    } catch (folderError) {
      console.error('Error accessing specified folder:', folderError.message);
      
      // List available folders and files instead
      console.log('\nListing your accessible files and folders:');
      const fileList = await drive.files.list({
        pageSize: 20,
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name, mimeType)'
      });
      
      console.log('\nAccessible folders:');
      if (fileList.data.files.length) {
        fileList.data.files.forEach(file => {
          console.log(`${file.name} (${file.id})`);
        });
      } else {
        console.log('No folders found.');
      }
      
      // List regular files too
      const regularFiles = await drive.files.list({
        pageSize: 20,
        q: "mimeType!='application/vnd.google-apps.folder'",
        fields: 'files(id, name, mimeType)'
      });
      
      console.log('\nAccessible files:');
      if (regularFiles.data.files.length) {
        regularFiles.data.files.forEach(file => {
          console.log(`${file.name} (${file.id})`);
        });
      } else {
        console.log('No files found.');
      }
    }
    
  } catch (error) {
    console.error('Error with Google Drive authentication:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
  }
}

testGoogleDriveAccess();