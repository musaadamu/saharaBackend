require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Set up Google Drive API client
console.log('Setting up Google Drive API client...');
console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'Not set');
console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + '...' : 'Not set');
console.log('Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN ? process.env.GOOGLE_REFRESH_TOKEN.substring(0, 10) + '...' : 'Not set');
console.log('Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
console.log('All environment variables:', Object.keys(process.env).filter(key => key.startsWith('GOOGLE')));

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

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

// Create a test file
const createTestFile = async () => {
  try {
    console.log('Creating test file...');
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for Google Drive API.');
    console.log('Test file created at:', testFilePath);

    // Upload the file to Google Drive
    console.log('Uploading test file to Google Drive...');
    const fileMetadata = {
      name: 'test-file.txt',
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      description: 'Test file for Google Drive API'
    };

    const media = {
      mimeType: 'text/plain',
      body: fs.createReadStream(testFilePath)
    };

    // Verify folder exists
    console.log('Verifying folder exists...');
    try {
      const folderResponse = await drive.files.get({
        fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
        fields: 'id, name, mimeType'
      });
      console.log('Folder verified:', folderResponse.data);
    } catch (folderError) {
      console.error('ERROR: Failed to verify folder:', folderError);
      throw new Error(`Google Drive folder verification failed: ${folderError.message}`);
    }

    // Upload file
    console.log('Creating file in Google Drive...');
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink'
    });

    console.log('File uploaded successfully:');
    console.log('File ID:', response.data.id);
    console.log('File Name:', response.data.name);
    console.log('Web View Link:', response.data.webViewLink);

    // Make the file public
    console.log('Making file public...');
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    console.log('File made public successfully');

    // Clean up
    console.log('Cleaning up test file...');
    fs.unlinkSync(testFilePath);
    console.log('Test file deleted');

    return response.data;
  } catch (error) {
    console.error('ERROR:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
};

// Run the test
createTestFile()
  .then(result => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
