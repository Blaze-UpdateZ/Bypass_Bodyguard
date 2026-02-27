const mongoose = require('mongoose');

const BasketballChallengeSchema = new mongoose.Schema({
    challengeId: { type: String, unique: true },
    hoopX: Number,
    hoopY: Number,
    targetId: Number,
    visualGravity: Number,
    realGravity: Number,
    visualPower: { type: Number, required: true },
    realPower: { type: Number, required: true },
    linkId: { type: String, ref: 'Link' },
    nonce: { type: String, unique: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 3600 },
    expireAt: { type: Date, default: Date.now, expires: 900 }
});

module.exports = mongoose.model('BasketballChallenge', BasketballChallengeSchema);
