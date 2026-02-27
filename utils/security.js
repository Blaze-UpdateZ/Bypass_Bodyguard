/**
 * Encodes a string to Base64.
 * @param {string} str - The string to encode.
 * @returns {string} The Base64 encoded string.
 */
const encodeDest = (str) => Buffer.from(str).toString('base64');

/**
 * Decodes a Base64 string to utf-8.
 * @param {string} str - The Base64 compressed string.
 * @returns {string} The decoded string.
 */
const decodeDest = (str) => Buffer.from(str, 'base64').toString('utf-8');

/**
 * Validates the human-like movement of a drag path based on velocities and jerks.
 * @param {Array<{x: number, y: number, t: number}>} dragPath - Array of coordinate/time points.
 * @param {number} dragDuration - The total duration of the drag in ms.
 * @returns {boolean} True if the path appears human, false if it appears bot-like.
 */
const validateDragPath = (dragPath, dragDuration) => {
    if (!dragPath || !Array.isArray(dragPath)) return false;
    if (dragDuration < 150 || dragPath.length < 8) return false;

    let velocities = [];
    let jerks = [];
    let angles = [];

    for (let i = 2; i < dragPath.length; i++) {
        const p1 = dragPath[i - 2];
        const p2 = dragPath[i - 1];
        const p3 = dragPath[i];

        const dt1 = p2.t - p1.t || 1;
        const dt2 = p3.t - p2.t || 1;

        const v1 = Math.hypot(p2.x - p1.x, p2.y - p1.y) / dt1;
        const v2 = Math.hypot(p3.x - p2.x, p3.y - p2.y) / dt2;
        velocities.push(v1);
        jerks.push(Math.abs(v2 - v1) / dt2);

        const v1x = p2.x - p1.x, v1y = p2.y - p1.y;
        const v2x = p3.x - p2.x, v2y = p3.y - p2.y;
        const dot = v1x * v2x + v1y * v2y;
        const mag1 = Math.hypot(v1x, v1y), mag2 = Math.hypot(v2x, v2y);
        if (mag1 > 0 && mag2 > 0) {
            angles.push(Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))));
        }
    }

    if (velocities.length > 5) {
        const vMean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
        const vVar = velocities.reduce((a, b) => a + Math.pow(b - vMean, 2), 0) / velocities.length;
        const jMean = jerks.reduce((a, b) => a + b, 0) / jerks.length;

        if (vVar < 0.000005 && vMean > 0.1) return false;
        if (jMean < 0.0004) return false;
    }

    if (angles.length > 10) {
        const aMean = angles.reduce((a, b) => a + b, 0) / angles.length;
        const aVar = angles.reduce((a, b) => a + Math.pow(b - aMean, 2), 0) / angles.length;
        if (aVar < 0.0000001) return false;
    }

    return true;
};

const unpack = (blob, key, nonce) => {
    try {
        if (!blob) return null;
        let decoded = [];
        for (let i = 0; i < blob.length; i += 2) {
            decoded.push(parseInt(blob.substr(i, 2), 16));
        }

        let r = "";
        const k = (key || "void") + "TheVoidSalt" + (nonce || "");

        for (let i = 0; i < decoded.length; i++) {
            const hashTerm = (i * 13) & 0xFF;
            const bX = decoded[i] ^ hashTerm;
            const charCode = bX ^ k.charCodeAt(i % k.length);
            r += String.fromCharCode(charCode);
        }

        const data = JSON.parse(r);

        if (data.v !== "10.0-RED") {
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
};

module.exports = { encodeDest, decodeDest, validateDragPath, unpack };
