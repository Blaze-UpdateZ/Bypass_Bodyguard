const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const connectDB = require('../config/db');

const Link = require('../models/Link');
const Session = require('../models/AccessSession');
const BasketballChallenge = require('../models/BasketballChallenge');
const Step1Completion = require('../models/Step1Completion');

const { validateBasketballShot } = require('../utils/physics');
const { validateDragPath, unpack } = require('../utils/security');
const { shortenUrl, shortenDynamic } = require('../utils/shortener');
const { themedError } = require('../utils/renderer');
const { step2Shield } = require('../middleware/shield');

const HTML_CACHE = { index: null, final: null };

function getCachedHtml(filename) {
    if (HTML_CACHE[filename]) return HTML_CACHE[filename];
    try {
        const content = fs.readFileSync(path.join(__dirname, '../public', filename + '.html'), 'utf8');
        HTML_CACHE[filename] = content;
        return content;
    } catch (e) {
        return null;
    }
}

async function renderWithSecurity(res, filename, injections) {
    try {
        let html = getCachedHtml(filename);
        if (!html) throw new Error("Template Load Error");

        let injectionScript = '<script>';
        for (const [key, value] of Object.entries(injections)) {
            injectionScript += `window.${key}=${JSON.stringify(value)};\n`;
        }
        injectionScript += '</script>';

        if (html.includes('</head>')) {
            html = html.replace('</head>', `${injectionScript}\n</head>`);
        } else {
            html = injectionScript + html;
        }
        res.send(html);
    } catch (e) {
        res.status(500).send(themedError('500 Server Error', 'Security handshake failed. Please refresh.'));
    }
}

router.get('/', async (req, res) => {
    const slug = req.query.s || req.query.v;
    const sessionToken = Math.random().toString(36).substring(2, 15);
    const challengeId = Math.random().toString(36).substring(2, 10);
    const nonce = crypto.randomBytes(16).toString('hex');

    const targetId = Math.floor(Math.random() * 10);
    const hoopX = Math.random();
    const hoopY = Math.random();
    const visualGravity = 0.24 + (Math.random() * 0.02);
    const visualPower = 0.98 + (Math.random() * 0.04);

    const secret = process.env.VOID_SECRET || "blaze_void_shield_2048";
    const hmac = crypto.createHmac('sha256', secret).update(challengeId).digest('hex');
    const salt1 = parseInt(hmac.substring(0, 4), 16) / 65535;
    const salt2 = parseInt(hmac.substring(4, 8), 16) / 65535;
    const realGravity = visualGravity + ((salt1 < 0.5 ? -1 : 1) * (0.015 + salt1 * 0.01));
    const realPower = visualPower + ((salt2 < 0.5 ? -1 : 1) * (0.02 + salt2 * 0.02));

    try {
        await connectDB();
        let activeLinkId = null;
        if (slug) {
            const linkDoc = await Link.findOne({ slug });
            if (linkDoc) activeLinkId = linkDoc.linkId;
        }

        const session = new Session({ ip: req.ip, token: sessionToken, activeLinkId });
        const challenge = new BasketballChallenge({
            challengeId, hoopX, hoopY, targetId, visualGravity, realGravity,
            visualPower, realPower, linkId: activeLinkId, nonce, isUsed: false
        });

        await Promise.all([session.save(), challenge.save()]);

        const initData = Buffer.from(JSON.stringify({
            cid: challengeId, hx: hoopX, hy: hoopY, tid: targetId, g: visualGravity, p: visualPower, n: nonce
        })).toString('base64');

        await renderWithSecurity(res, 'index', { SESSION_TOKEN: sessionToken, G_DATA: initData });
    } catch (e) {
        res.status(500).send(themedError('500 Server Error', 'Initialization failed.'));
    }
});

router.get('/final.html', step2Shield, async (req, res) => {
    const linkId = req.query.id;
    const challengeId = Math.random().toString(36).substring(2, 10);
    const nonce = crypto.randomBytes(16).toString('hex');
    const hoopX = Math.random();
    const hoopY = Math.random();
    const targetId = Math.floor(Math.random() * 10);
    const visualGravity = 0.24 + (Math.random() * 0.02);
    const visualPower = 0.98 + (Math.random() * 0.04);

    const secret = process.env.VOID_SECRET || "blaze_void_shield_2048";
    const hmac = crypto.createHmac('sha256', secret).update(challengeId).digest('hex');
    const salt1 = parseInt(hmac.substring(0, 4), 16) / 65535;
    const salt2 = parseInt(hmac.substring(4, 8), 16) / 65535;
    const realGravity = visualGravity + ((salt1 < 0.5 ? -1 : 1) * (0.015 + salt1 * 0.01));
    const realPower = visualPower + ((salt2 < 0.5 ? -1 : 1) * (0.02 + salt2 * 0.02));

    try {
        await connectDB();
        const challenge = new BasketballChallenge({
            challengeId, hoopX, hoopY, targetId, visualGravity, realGravity,
            visualPower, realPower, nonce, isUsed: false
        });
        await challenge.save();

        const initData = Buffer.from(JSON.stringify({
            cid: challengeId, hx: hoopX, hy: hoopY, tid: targetId, g: visualGravity, p: visualPower, n: nonce
        })).toString('base64');

        await renderWithSecurity(res, 'final', { G_DATA: initData });
    } catch (e) {
        res.status(500).send(themedError('500 Server Error', 'Final stage failed.'));
    }
});

router.post('/api/basketball/init', async (req, res) => {
    try {
        await connectDB();
        const { sessionToken, slug: providedSlug, linkId: providedLinkId } = req.body;

        let linkId = providedLinkId;
        if (!linkId) {
            let slug = providedSlug;
            if (!slug) {
                const referer = req.get('Referer') || '';
                const match = referer.match(/[?&](s|v)=([^&]+)/);
                if (match) slug = match[2];
            }
            if (slug) {
                const linkDoc = await Link.findOne({ slug });
                if (linkDoc) linkId = linkDoc.linkId;
            }
        }

        const challengeId = Math.random().toString(36).substring(2, 10);
        const nonce = crypto.randomBytes(16).toString('hex');
        const hoopX = Math.random();
        const hoopY = Math.random();
        const visualGravity = 0.24 + (Math.random() * 0.02);
        const visualPower = 0.98 + (Math.random() * 0.04);

        const secret = process.env.VOID_SECRET || "blaze_void_shield_2048";
        const hmac = crypto.createHmac('sha256', secret).update(challengeId).digest('hex');
        const salt1 = parseInt(hmac.substring(0, 4), 16) / 65535;
        const salt2 = parseInt(hmac.substring(4, 8), 16) / 65535;
        const realGravity = visualGravity + ((salt1 < 0.5 ? -1 : 1) * (0.015 + salt1 * 0.01));
        const realPower = visualPower + ((salt2 < 0.5 ? -1 : 1) * (0.02 + salt2 * 0.02));

        const challenge = new BasketballChallenge({
            challengeId, hoopX, hoopY, visualGravity, realGravity,
            visualPower, realPower, linkId, nonce, isUsed: false
        });
        await challenge.save();

        res.json({ success: true, cid: challengeId, hx: hoopX, hy: hoopY, g: visualGravity, p: visualPower, n: nonce });
    } catch (error) {
        res.status(500).json({ error: 'Init failed' });
    }
});

router.post('/api/basketball/validate', async (req, res) => {
    try {
        await connectDB();
        const { challengeId, sessionToken, v } = req.body;
        const challenge = await BasketballChallenge.findOneAndUpdate(
            { challengeId, isUsed: false }, { $set: { isUsed: true } }, { new: true }
        );

        if (!challenge) return res.status(403).json({ error: 'Request expired' });

        const decrypted = unpack(v, sessionToken, challenge.nonce);
        if (!decrypted) return res.status(403).json({ error: 'Handshake failed' });

        const { a: angle, p: power, d: dragDuration, dp: dragPath, sw: screenWidth, sh: screenHeight } = decrypted;

        if (!validateDragPath(dragPath, dragDuration)) {
            return res.status(403).json({ error: 'Abnormal behavior' });
        }

        const physics = { gravity: challenge.realGravity, powerScale: challenge.realPower };
        if (!validateBasketballShot(challenge.hoopX, challenge.hoopY, angle, power, screenWidth, screenHeight, physics)) {
            return res.json({ success: false, error: 'miss' });
        }

        let linkId = challenge.linkId;
        if (sessionToken && !linkId) {
            const session = await Session.findOne({ token: sessionToken, ip: req.ip });
            if (session) linkId = session.activeLinkId;
        }

        let redirect = "https://telegram.me/Blaze_Updatez";
        if (linkId) {
            const linkDoc = await Link.findOne({ linkId });
            if (linkDoc && linkDoc.shortLink) redirect = linkDoc.shortLink;
        }

        await Step1Completion.deleteMany({ ip: req.ip, linkId });
        await new Step1Completion({ ip: req.ip, linkId, userAgent: req.get('User-Agent') }).save();

        res.json({ success: true, redirect });
    } catch (error) {
        res.status(500).json({ error: 'Validation failed' });
    }
});

router.post('/api/step2/validate', async (req, res) => {
    try {
        const { challengeId, linkId, v } = req.body;
        await connectDB();
        const challenge = await BasketballChallenge.findOneAndUpdate(
            { challengeId, isUsed: false }, { $set: { isUsed: true } }, { new: true }
        );

        if (!challenge) return res.status(403).json({ error: 'Request expired' });

        const decrypted = unpack(v, linkId, challenge.nonce);
        if (!decrypted) return res.status(403).json({ error: 'Handshake failed' });

        const { a: angle, p: power, d: dragDuration, dp: dragPath, sw: screenWidth, sh: screenHeight } = decrypted;

        const session = await Session.findOne({ ip: req.ip, activeLinkId: linkId }).sort({ createdAt: -1 });
        if (!session) return res.status(404).json({ error: 'Session expired' });

        const completion = await Step1Completion.findOne({ ip: req.ip, linkId });
        if (!completion) return res.status(403).json({ error: 'Step 1 required' });


        const linkDoc = await Link.findOne({ linkId });
        if (!linkDoc) return res.status(404).json({ error: 'Link not found' });

        if ((new Date() - session.createdAt) / 1000 < (linkDoc.minWaitTime || 10)) return res.status(403).json({ error: 'Abnormal behavior' });
        if (!validateDragPath(dragPath, dragDuration)) {
            return res.status(403).json({ error: 'Abnormal behavior' });
        }

        const physics = { gravity: challenge.realGravity, powerScale: challenge.realPower };
        if (!validateBasketballShot(challenge.hoopX, challenge.hoopY, angle, power, screenWidth, screenHeight, physics)) {
            return res.status(403).json({ error: 'Verification failed' });
        }

        await Step1Completion.deleteOne({ ip: req.ip, linkId });
        session.status = 'COMPLETED';
        await session.save();

        res.json({ destination: linkDoc.targetUrl });
    } catch (error) {
        res.status(500).json({ error: 'Final verification failed' });
    }
});

const rateLimit = require('express-rate-limit');
const genLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: true,
    statusCode: 429,
    message: { error: 'Too many requests, please try again later.' }
});

/**
 * Generation endpoint for creating standard bypass links.
 * Creates a linked document in the database and returns the required URL paths.
 * Rate limited to 50 requests per 10 minutes.
 */
router.all('/api/generate', genLimiter, async (req, res) => {
    try {
        await connectDB();
        const targetUrl = req.query.url || (req.body && req.body.targetUrl);
        const waitTime = parseInt(req.query.wait || (req.body && req.body.wait) || 10);

        if (!targetUrl) return res.status(400).json({ error: 'Missing targetUrl' });

        const linkId = Math.random().toString(36).substring(2, 8);
        const protocol = (req.protocol === 'http' && req.get('host').includes('.vercel.app')) ? 'https' : req.protocol;
        const baseUrl = `${protocol}://${req.get('host')}`;

        const step2Url = `${baseUrl}/final.html?id=${linkId}`;
        const shortLink = await shortenUrl(step2Url);
        const slug = Math.random().toString(36).substring(2, 14);

        await new Link({ linkId, targetUrl, shortLink, slug, minWaitTime: waitTime }).save();
        res.json({
            success: true,
            data: {
                linkId,
                mainLink: `${baseUrl}/?s=${slug}`,
                step2Link: step2Url,
                shortenedLink: shortLink,
                targetUrl,
                minWaitTime: waitTime
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Gen failed' });
    }
});

/**
 * Generation endpoint for creating dynamic bypass links with custom shorteners.
 * Requires an API token and a site URL.
 * Rate limited to 50 requests per 10 minutes.
 */
router.all('/api/getlink', genLimiter, async (req, res) => {
    try {
        await connectDB();
        const { api, site, url: targetUrl } = { ...req.query, ...req.body };
        const waitTime = parseInt(req.query.wait || (req.body && req.body.wait) || 10);

        if (!api || !site || !targetUrl) return res.status(400).json({ error: 'Missing params' });

        const linkId = Math.random().toString(36).substring(2, 8);
        const protocol = (req.protocol === 'http' && req.get('host').includes('.vercel.app')) ? 'https' : req.protocol;
        const baseUrl = `${protocol}://${req.get('host')}`;

        const step2Url = `${baseUrl}/final.html?id=${linkId}`;
        const shortLink = await shortenDynamic(step2Url, api, site);
        const slug = Math.random().toString(36).substring(2, 14);

        await new Link({ linkId, targetUrl, shortLink, slug, minWaitTime: waitTime }).save();
        res.json({
            success: true,
            data: {
                linkId,
                mainLink: `${baseUrl}/?s=${slug}`,
                step2Link: step2Url,
                shortenedLink: shortLink,
                targetUrl,
                minWaitTime: waitTime
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'GetLink failed' });
    }
});

module.exports = router;
