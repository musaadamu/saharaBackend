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

// Function to verify file existence
function verifyFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ File exists: ${filePath}`);
      console.log(`   Size: ${stats.size} bytes`);
      return true;
    } else {
      console.log(`❌ File does not exist: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error verifying file ${filePath}:`, error.message);
    return false;
  }
}

// Function to verify all journal files
async function verifyJournalFiles() {
  try {
    console.log('Verifying journal files...');
    
    // Get all journals
    const journals = await Journal.find({});
    console.log(`Found ${journals.length} journals in the database`);
    
    // Define possible base directories
    const baseDirs = [
      path.join(__dirname, '..', 'uploads', 'journals'),
      path.join(__dirname, 'uploads', 'journals')
    ];
    
    // Verify files for each journal
    for (const journal of journals) {
      console.log(`\nVerifying files for journal: ${journal.title}`);
      
      // Verify PDF file
      if (journal.pdfFilePath) {
        const pdfFileName = path.basename(journal.pdfFilePath);
        console.log(`PDF file name: ${pdfFileName}`);
        console.log(`PDF file path in DB: ${journal.pdfFilePath}`);
        
        let pdfFound = false;
        for (const baseDir of baseDirs) {
          const pdfFilePath = path.join(baseDir, pdfFileName);
          if (verifyFile(pdfFilePath)) {
            pdfFound = true;
            break;
          }
        }
        
        if (!pdfFound) {
          console.log(`❌ PDF file not found in any location: ${pdfFileName}`);
        }
      } else {
        console.log('❌ No PDF file path in database');
      }
      
      // Verify DOCX file
      if (journal.docxFilePath) {
        const docxFileName = path.basename(journal.docxFilePath);
        console.log(`DOCX file name: ${docxFileName}`);
        console.log(`DOCX file path in DB: ${journal.docxFilePath}`);
        
        let docxFound = false;
        for (const baseDir of baseDirs) {
          const docxFilePath = path.join(baseDir, docxFileName);
          if (verifyFile(docxFilePath)) {
            docxFound = true;
            break;
          }
        }
        
        if (!docxFound) {
          console.log(`❌ DOCX file not found in any location: ${docxFileName}`);
        }
      } else {
        console.log('❌ No DOCX file path in database');
      }
    }
    
    console.log('\nFile verification complete!');
  } catch (error) {
    console.error('Error verifying journal files:', error.message);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the verification function
verifyJournalFiles().catch(err => {
  console.error('Error in verification function:', err);
  mongoose.connection.close();
});
