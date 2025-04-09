const fs = require('fs');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');

async function testConversion() {
    try {
        console.log('Starting PDF conversion test...');
        
        const docxPath = 'Tagans2.docx';
        const pdfPath = 'test_output.pdf';
        
        // Read DOCX as buffer
        console.log('Reading DOCX file...');
        const docxBuffer = fs.readFileSync(docxPath);
        
        // Convert to PDF
        console.log('Converting DOCX to PDF...');
        const result = await mammoth.extractRawText({ buffer: docxBuffer });
        
        await new Promise((resolve, reject) => {
            const pdfDoc = new PDFDocument();
            const stream = fs.createWriteStream(pdfPath);
            pdfDoc.pipe(stream);
            pdfDoc.text(result.value);
            pdfDoc.end();
            
            stream.on('finish', () => {
                console.log('PDF created successfully');
                console.log(`PDF saved to: ${pdfPath}`);
                resolve();
            });
            stream.on('error', reject);
        });
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testConversion();
