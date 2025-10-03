const mongoose = require('mongoose');

const UsernameHistorySchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true, 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
}, { timestamps: true });

const UsernameHistory = mongoose.model('UsernameHistory', UsernameHistorySchema);
module.exports = UsernameHistory;