// const { google } = require('googleapis');
// const readline = require('readline');

// // Replace these with your OAuth2 credentials
// const CLIENT_ID = '38551269334-krfornjs786u7qv2qv3rfv82q294i9h0.apps.googleusercontent.com';
// const CLIENT_SECRET = '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';
// // Use OAuth2 Playground redirect URI for desktop app
// const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

// const oauth2Client = new google.auth.OAuth2(
//   CLIENT_ID,
//   CLIENT_SECRET,
//   REDIRECT_URI
// );

// // Generate the url that will be used for authorization
// const SCOPES = ['https://www.googleapis.com/auth/drive'];

// const authUrl = oauth2Client.generateAuthUrl({
//   access_type: 'offline',
//   scope: SCOPES,
//   prompt: 'consent'
// });

// console.log('Authorize this app by visiting this url:', authUrl);

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// rl.question('Enter the code from that page here: ', (code) => {
//   rl.close();
//   oauth2Client.getToken(code, (err, token) => {
//     if (err) {
//       return console.error('Error retrieving access token', err);
//     }
//     console.log('Access Token:', token.access_token);
//     console.log('Refresh Token:', token.refresh_token);
//     console.log('Token Expiry Date:', token.expiry_date);
//     // Save the token for later use securely
//   });
// });


const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');

// Replace these with your OAuth2 credentials
const CLIENT_ID = '38551269334-krfornjs786u7qv2qv3rfv82q294i9h0.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
// Use OAuth2 Playground redirect URI for desktop app
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Enhanced scopes for better Drive access
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.appdata'
];

// Generate the url that will be used for authorization
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',  // This ensures you always get a refresh token
  include_granted_scopes: true  // Include previously granted scopes
});

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', async (code) => {
  rl.close();
  
  try {
    // Get token using a Promise instead of callback
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('Token Expiry Date:', tokens.expiry_date);
    
    // Save tokens to a file for later use
    fs.writeFileSync('google-credentials.json', JSON.stringify(tokens, null, 2));
    console.log('Tokens saved to google-credentials.json');
    
    // Set the credentials and verify access to the folder
    oauth2Client.setCredentials(tokens);
    
    // Test if we can access the drive and folder
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Test folder ID - replace with your folder ID
    const folderId = '1zsFE8u3niAJWDXyKlq6p4tv3do7ns7f6';
    
    try {
      const folderResponse = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType'
      });
      
      console.log('Successfully connected to folder:', folderResponse.data);
    } catch (folderError) {
      console.error('Error accessing folder:', folderError.message);
      console.log('\nTry listing your available folders and files:');
      
      // List files the user has access to
      const fileList = await drive.files.list({
        pageSize: 10,
        fields: 'files(id, name, mimeType)'
      });
      
      console.log('\nAccessible files/folders:');
      console.log(fileList.data.files);
    }
    
  } catch (error) {
    console.error('Error retrieving access token:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
  }
});