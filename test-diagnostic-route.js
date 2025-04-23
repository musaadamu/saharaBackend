require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Create a test file
const testFilePath = path.join(__dirname, 'test-file.docx');
fs.writeFileSync(testFilePath, 'This is a test file for the diagnostic route.');

// Create form data
const form = new FormData();
form.append('file', fs.createReadStream(testFilePath), {
  filename: 'test-file.docx',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
});

// Send the request
console.log('Sending request to diagnostic route...');
axios.post('http://localhost:5000/api/diagnostic/test-drive-upload', form, {
  headers: {
    ...form.getHeaders()
  }
})
  .then(response => {
    console.log('Response:', response.data);
  })
  .catch(error => {
    console.error('Error:', error.response ? error.response.data : error.message);
  })
  .finally(() => {
    // Clean up
    fs.unlinkSync(testFilePath);
    console.log('Test file deleted');
  });
