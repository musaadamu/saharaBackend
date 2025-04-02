const mongoose = require('mongoose');

// models/Submission.js
const SubmissionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    abstract: { type: String, required: true },
    keywords: { type: [String], required: true },
    author: { type: String, required: true },
    wordFileUrl: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'converted', 'under review', 'approved', 'rejected'], 
        default: 'pending' 
    },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Submission', SubmissionSchema);