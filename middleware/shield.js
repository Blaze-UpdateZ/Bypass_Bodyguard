const path = require('path');
const Step1Completion = require('../models/Step1Completion');
const { themedError } = require('../utils/renderer');

const step2Shield = async (req, res, next) => {
    const referer = req.get('Referer') || '';
    const linkId = req.query.id;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    if (!referer) {
        return res.status(403).send(themedError('403 Forbidden', 'Direct access not allowed. You must complete the shortener.'));
    }

    if (!linkId) {
        return res.status(400).send(themedError('400 Bad Request', 'Missing link identifier.', 400));
    }

    try {
        let completion = await Step1Completion.findOne({
            ip: ip,
            linkId: linkId,
            userAgent: userAgent
        });

        if (!completion) {
            completion = await Step1Completion.findOne({ ip, linkId }).sort({ createdAt: -1 });
        }

        if (!completion) {
            return res.status(403).send(themedError('403 Forbidden', 'Access denied. You must complete Step 1 successfully.'));
        }

        next();
    } catch (error) {
        res.status(500).send(themedError('500 Server Error', 'Something went wrong on our end. Please try again later.', 500));
    }
};

module.exports = { step2Shield };
