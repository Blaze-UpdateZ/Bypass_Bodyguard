/**
 * Validates the physics of a basketball shot attempt.
 * @param {number} hoopX - The x-coordinate of the hoop (normalized).
 * @param {number} hoopY - The y-coordinate of the hoop (normalized).
 * @param {number} angle - The angle of the shot in radians.
 * @param {number} power - The power of the shot (0-1).
 * @param {number} screenWidth - The width of the screen in pixels.
 * @param {number} screenHeight - The height of the screen in pixels.
 * @param {Object} sessionPhysics - Session specific physics overrides (gravity, powerScale).
 * @returns {boolean} True if the shot is a hit, false otherwise.
 */
const validateBasketballShot = (hoopX, hoopY, angle, power, screenWidth = 1920, screenHeight = 1080, sessionPhysics = {}) => {
    const GRAVITY = sessionPhysics.gravity || 0.25;
    const MAX_POWER = 22 * (sessionPhysics.powerScale || 1.0);
    const TOLERANCE = 55;

    const actualTargetX = screenWidth * (0.5 + hoopX * 0.35);
    const actualTargetY = screenHeight * (0.2 + hoopY * 0.4);

    const dartStartX = screenWidth * 0.5;
    const dartStartY = screenHeight - 80;

    const velocity = power * MAX_POWER;
    const vx = velocity * Math.cos(angle);
    const vy = -velocity * Math.sin(angle);

    let x = dartStartX;
    let y = dartStartY;
    let currVy = vy;

    for (let i = 0; i < 200; i++) {
        currVy += GRAVITY;
        x += vx;
        y += currVy;

        const dist = Math.sqrt((x - actualTargetX) ** 2 + (y - actualTargetY) ** 2);
        if (dist < TOLERANCE) {
            return true;
        }

        if (y > screenHeight + 200) break;
    }

    return false;
};

module.exports = { validateBasketballShot };
