const mongoose = require('mongoose');

const Step1CompletionSchema = new mongoose.Schema({
    ip: String,
    linkId: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now, expires: 900 }
});

module.exports = mongoose.model('Step1Completion', Step1CompletionSchema);
