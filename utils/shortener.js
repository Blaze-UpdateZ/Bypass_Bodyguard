const axios = require('axios');

/**
 * Shortens a given URL using the configured AD link shortener (e.g., adrinolinks).
 * @param {string} longUrl - The original URL to shorten.
 * @returns {Promise<string>} The shortened URL, or the original if shortening fails.
 */
const shortenUrl = async (longUrl) => {
    if (longUrl.includes('localhost') || longUrl.includes('127.0.0.1')) {
        return longUrl;
    }

    try {
        const apiToken = process.env.SHORTENER_API_TOKEN || "f373d19dce6364ee63c8d6b684e523c9d3e7db82";
        const apiUrl = `https://adrinolinks.in/api?api=${apiToken}&url=${encodeURIComponent(longUrl)}`;

        const response = await axios.get(apiUrl);
        const data = response.data;

        if (data.status === 'success' || data.shortenedUrl) {
            return data.shortenedUrl;
        } else {
            return longUrl;
        }
    } catch (error) {
        return longUrl;
    }
};

/**
 * Shortens a URL using a dynamic API token and site URL.
 * @param {string} longUrl - The original URL.
 * @param {string} apiToken - The dynamic API token.
 * @param {string} siteUrl - The custom site URL for the shortening service.
 * @returns {Promise<string>} The shortened URL.
 * @throws {Error} If shortening fails.
 */
const shortenDynamic = async (longUrl, apiToken, siteUrl) => {
    if (!apiToken || !siteUrl) return longUrl;
    if (longUrl.includes('localhost') || longUrl.includes('127.0.0.1')) return longUrl;

    try {
        const apiUrl = `https://${siteUrl}/api?api=${apiToken}&url=${encodeURIComponent(longUrl)}`;
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (data.status === 'success' || data.shortenedUrl) {
            return data.shortenedUrl;
        } else {
            throw new Error(data.message || 'Shortening failed');
        }
    } catch (error) {
        throw error;
    }
};

module.exports = { shortenUrl, shortenDynamic };
