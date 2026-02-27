const mongoose = require('mongoose');

const LinkSchema = new mongoose.Schema({
    linkId: { type: String, unique: true },
    targetUrl: { type: String, required: true },
    shortLink: String,
    slug: { type: String, unique: true, index: true },
    minWaitTime: { type: Number, default: 10 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Link', LinkSchema);
