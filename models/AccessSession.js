const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    ip: String,
    token: { type: String, index: true },
    activeLinkId: String,
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['STARTED', 'COMPLETED'], default: 'STARTED' },
    expireAt: { type: Date, default: Date.now, expires: 600 }
});

module.exports = mongoose.model('AccessSession', SessionSchema);
