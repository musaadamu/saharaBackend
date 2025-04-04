const Journal = require('../models/Journal');
const { ObjectId } = require('mongoose').Types;

module.exports.validateJournalId = async (req, res, next) => {
    try {
        const journalId = req.params.id;
        
        // Validate ID format
        if (!ObjectId.isValid(journalId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid journal ID format' 
            });
        }

        // Check if journal exists
        const journal = await Journal.findById(journalId);
        if (!journal) {
            return res.status(404).json({ 
                success: false,
                message: 'Journal not found' 
            });
        }

        // Attach journal to request for downstream use
        req.journal = journal;
        next();
    } catch (error) {
        console.error('Journal validation error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error during journal validation' 
        });
    }
};
