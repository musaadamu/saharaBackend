// const mongoose = require("mongoose");

// const JournalSchema = new mongoose.Schema({
//     title: { type: String, required: true, trim: true },
//     abstract: { type: String, required: true },
//     authors: [{ type: String }], // Changed from ObjectId to String
//     docxFilePath: { type: String, required: true }, // Store Word file path
//     pdfFilePath: { type: String }, // Store generated PDF path
//     keywords: [{ type: String }],
//     publishedDate: { type: Date, default: Date.now },
//     status: { 
//         type: String, 
//         enum: ["submitted", "reviewed", "accepted", "published"], 
//         default: "submitted" 
//     },
// });

// module.exports = mongoose.model("Journal", JournalSchema);

// const mongoose = require('mongoose');

// const JournalSchema = new mongoose.Schema({
//     title: { type: String, required: true, trim: true },
//     abstract: { type: String, required: true },
//     authors: [{ type: String }], // Changed from ObjectId to String
//     pdfUrl: { type: String, required: true, validate: {
//         validator: function(v) {
//             return /^(ftp|http|https):\/\/[^ "]+$/.test(v);
//         },
//         message: props => `${props.value} is not a valid URL!`
//     }},
//     keywords: [{ type: String }],
//     publishedDate: { type: Date, default: Date.now },
//     status: { type: String, enum: ['submitted', 'reviewed', 'accepted', 'published'], default: 'submitted' }
// });

// module.exports = mongoose.model('Journal', JournalSchema);


const mongoose = require("mongoose");

const JournalSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    abstract: { type: String, required: true },
    authors: [{ type: String }],

    docxFilePath: { type: String, required: true }, // Store Word file path
    pdfFilePath: { type: String }, // Store generated PDF path
    keywords: [{ type: String }],
    publishedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["submitted", "reviewed", "accepted", "published"], default: "published" },
});

module.exports = mongoose.model("Journal", JournalSchema);
