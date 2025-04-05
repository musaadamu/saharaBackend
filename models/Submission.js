const mongoose = require('mongoose');

// models/Submission.js
const SubmissionSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    abstract: { type: String, required: true },
    authors: [{ type: String }],
    docxFilePath: { type: String, required: true },
    pdfFilePath: { type: String },
    keywords: [{ type: String }],
    status: { 
        type: String,
        enum: ['submitted', 'under-review', 'accepted', 'rejected'],
        default: 'submitted'
    },
    submittedAt: { type: Date, default: Date.now }

});

module.exports = mongoose.model('Submission', SubmissionSchema);
