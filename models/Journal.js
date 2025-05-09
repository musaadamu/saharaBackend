const mongoose = require("mongoose");

const JournalSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    abstract: { type: String, required: true },
    authors: [{ type: String }],

    // Local file paths (for backward compatibility)
    docxFilePath: { type: String },
    pdfFilePath: { type: String },

    // Google Drive file IDs
    docxFileId: { type: String },
    pdfFileId: { type: String },

    // Google Drive public links
    docxWebViewLink: { type: String },
    pdfWebViewLink: { type: String },

    // Cloudinary URLs for files
    docxCloudinaryUrl: { type: String },
    pdfCloudinaryUrl: { type: String },

    keywords: [{ type: String }],
    publishedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["submitted", "reviewed", "accepted", "published"], default: "published" },
});

module.exports = mongoose.model("Journal", JournalSchema);
