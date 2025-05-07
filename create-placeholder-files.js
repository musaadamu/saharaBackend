const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
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

// Function to create a placeholder PDF file
function createPlaceholderPDF(filePath, title) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create a simple PDF-like file (not a real PDF, just for testing)
    const content = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 68 >>
stream
BT
/F1 24 Tf
100 700 Td
(${title}) Tj
ET
stream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000216 00000 n
0000000283 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
401
%%EOF`;
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created placeholder PDF at: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error creating placeholder PDF at ${filePath}:`, error.message);
    return false;
  }
}

// Function to create a placeholder DOCX file
function createPlaceholderDOCX(filePath, title) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create a simple DOCX-like file (not a real DOCX, just for testing)
    const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${title}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>This is a placeholder document for testing purposes.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created placeholder DOCX at: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error creating placeholder DOCX at ${filePath}:`, error.message);
    return false;
  }
}

// Main function to create placeholder files for all journals
async function createPlaceholderFiles() {
  try {
    console.log('Creating placeholder files for all journals...');
    
    // Get all journals
    const journals = await Journal.find({});
    console.log(`Found ${journals.length} journals in the database`);
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'journals');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create placeholder files for each journal
    for (const journal of journals) {
      console.log(`\nProcessing journal: ${journal.title}`);
      
      // Create placeholder PDF if needed
      if (journal.pdfFilePath) {
        const pdfFileName = path.basename(journal.pdfFilePath);
        const pdfFilePath = path.join(uploadsDir, pdfFileName);
        
        createPlaceholderPDF(pdfFilePath, journal.title);
      }
      
      // Create placeholder DOCX if needed
      if (journal.docxFilePath) {
        const docxFileName = path.basename(journal.docxFilePath);
        const docxFilePath = path.join(uploadsDir, docxFileName);
        
        createPlaceholderDOCX(docxFilePath, journal.title);
      }
    }
    
    console.log('\nAll placeholder files created successfully!');
  } catch (error) {
    console.error('Error creating placeholder files:', error.message);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the main function
createPlaceholderFiles().catch(err => {
  console.error('Error in main function:', err);
  mongoose.connection.close();
});
