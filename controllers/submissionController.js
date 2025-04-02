const Submission = require('../models/Submission');
const fs = require('fs').promises;

// Validation function for submission input
const validateSubmissionInput = (req) => {
    const { title, abstract, keywords, author, wordFileUrl } = req.body;
    const errors = [];

    if (!title || (typeof title === 'string' && title.trim() === '')) {
        errors.push('Title is required');
    }

    if (!abstract || (typeof abstract === 'string' && abstract.trim() === '')) {
        errors.push('Abstract is required');
    }

    if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
        errors.push('Keywords are required');
    }

    if (!author || (typeof author === 'string' && author.trim() === '')) {
        errors.push('Author is required');
    }

    if (!wordFileUrl || (typeof wordFileUrl === 'string' && wordFileUrl.trim() === '')) {
        errors.push('Word file URL is required');
    }

    return errors;
};

// Create a new submission
exports.createSubmission = async (req, res) => {
    try {
        const validationErrors = validateSubmissionInput(req);
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                message: "Validation Failed", 
                errors: validationErrors 
            });
        }

        const { title, abstract, keywords, author, wordFileUrl } = req.body;

        const newSubmission = new Submission({
            title: title.trim(),
            abstract: abstract.trim(),
            keywords: Array.isArray(keywords) ? keywords : keywords.split(',').map(kw => kw.trim()),
            author: author.trim(),
            wordFileUrl: wordFileUrl.trim(),
        });

        await newSubmission.save();

        res.status(201).json({ 
            message: "Submission created successfully", 
            submission: newSubmission 
        });
    } catch (error) {
        console.error('Error creating submission:', error);
        res.status(500).json({ 
            message: "Failed to create submission", 
            error: error.message 
        });
    }
};

// Get all submissions
exports.getSubmissions = async (req, res) => {
    try {
        const submissions = await Submission.find();
        res.json(submissions);
    } catch (error) {
        console.error('Error retrieving submissions:', error);
        res.status(500).json({ 
            message: "Failed to retrieve submissions", 
            error: error.message 
        });
    }
};

// Get a single submission by ID
exports.getSubmissionById = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        res.json(submission);
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to retrieve submission", 
            error: error.message 
        });
    }
};

// Update submission status
exports.updateSubmissionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'converted', 'under review', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: "Invalid status", 
                validStatuses 
            });
        }

        const submission = await Submission.findByIdAndUpdate(
            id, 
            { status }, 
            { new: true, runValidators: true }
        );

        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        res.json({
            message: "Submission status updated successfully",
            submission
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to update submission status", 
            error: error.message 
        });
    }
};

// Delete a submission
exports.deleteSubmission = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        await submission.deleteOne();
        res.json({ 
            message: "Submission deleted successfully", 
            deletedSubmission: submission 
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to delete submission", 
            error: error.message 
        });
    }
};
