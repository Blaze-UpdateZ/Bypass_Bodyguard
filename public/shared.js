const SHARED_CONFIG = {
    GRAVITY: 0.25,
    MAX_POWER: 22,
    MAX_DRAG: 130,
    DART_SIZE: 30,
    TARGET_RADIUS: 100,
    BULLSEYE_RADIUS: 40,
    TOLERANCE: 100
};

function loadGData() {
    try {
        if (!window.G_DATA) return;
        const decoded = JSON.parse(atob(window.G_DATA));
        window.CHALLENGE_CONTEXT = decoded;

        if (decoded.g) SHARED_CONFIG.GRAVITY = decoded.g;
        if (decoded.p) SHARED_CONFIG.MAX_POWER = 22 * decoded.p;
        if (decoded.cid) challengeId = decoded.cid;
        if (decoded.hx !== undefined) target = { xRatio: decoded.hx, yRatio: decoded.hy, tid: decoded.tid };

        if (window._CORE_ENGINE) {
            window._CORE_ENGINE.sync(SHARED_CONFIG.MAX_POWER / 22, SHARED_CONFIG.GRAVITY);
        }
    } catch (e) {
    }
}

let canvas, ctx;
let dart, target;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragCurrent = { x: 0, y: 0 };
let dragPath = [];
let dragStartTime = 0;
let isAnimating = false;
let challengeId = null;
let hasScored = false;
let hitDetected = false;
let minDistToTarget = Infinity;
let minDistPos = { x: 0, y: 0 };
let wasInTarget = false;
let dartRotation = -Math.PI / 2;
let dartTrail = [];
let bgOffset = 0;
let targetPulse = 0;
let isVerified = false;
window.isGameReady = false;

function initEngine(onResizeExtra) {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    initDart();

    if (target) updateTargetPosition();

    window.addEventListener('resize', () => resizeCanvas(onResizeExtra));
    setupInputHandlers();
    requestAnimationFrame(gameLoop);
}

function initDart() {
    dart = {
        x: canvas.width * 0.5,
        y: canvas.height - 80,
        vx: 0,
        vy: 0,
        size: SHARED_CONFIG.DART_SIZE
    };
}

function resizeCanvas(extra) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initDart();
    if (extra) extra();
    if (target) updateTargetPosition();
}

function updateTargetPosition() {
    if (!target) return;
    target.x = canvas.width * (0.5 + target.xRatio * 0.35);
    target.y = canvas.height * (0.2 + target.yRatio * 0.4);
}

function setupInputHandlers() {
    const start = e => { if (isAnimating) return; const rect = canvas.getBoundingClientRect(); onDragStart(e.clientX - rect.left, e.clientY - rect.top); };
    const move = e => { if (!isDragging) return; const rect = canvas.getBoundingClientRect(); onDragMove(e.clientX - rect.left, e.clientY - rect.top); };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', onDragEnd);
    canvas.addEventListener('mouseleave', onDragEnd);

    canvas.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; start(t); }, { passive: false });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; move(t); }, { passive: false });
    canvas.addEventListener('touchend', onDragEnd);
}

function onDragStart(x, y) {
    if (!window.isGameReady) {
        showMessage('Securing...', '#ffd93d', 1000);
        return;
    }
    const dist = Math.hypot(x - dart.x, y - dart.y);
    if (dist < dart.size * 2.5) {
        isDragging = true;
        dragStart = { x: dart.x, y: dart.y };
        dragCurrent = { x, y };
        dragPath = [{ x, y, t: Date.now() }];
        dragStartTime = Date.now();
        const inst = document.getElementById('instructions');
        if (inst) inst.style.opacity = '0';
    }
}

function onDragMove(x, y) {
    dragCurrent = { x, y };
    dragPath.push({ x, y, t: Date.now() });
    if (dragPath.length > 100) dragPath.shift();
    const dx = dragStart.x - x;
    const dy = dragStart.y - y;
    dartRotation = Math.atan2(dy, dx) + Math.PI;
    const dragDist = Math.hypot(dragStart.x - x, dragStart.y - y);
    const power = Math.min(dragDist / SHARED_CONFIG.MAX_DRAG, 1);
    const fill = document.getElementById('powerFill');
    if (fill) fill.style.height = (power * 100) + '%';
}

function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    const dragDist = Math.hypot(dragStart.x - dragCurrent.x, dragStart.y - dragCurrent.y);
    if (dragDist < 20) {
        const fill = document.getElementById('powerFill');
        if (fill) fill.style.height = '0%';
        return;
    }
    const angle = Math.atan2(dragStart.y - dragCurrent.y, dragCurrent.x - dragStart.x);
    const power = Math.min(dragDist / SHARED_CONFIG.MAX_DRAG, 1);
    throwDart(angle, power, Date.now() - dragStartTime);
}

function throwDart(angle, power, duration) {
    isAnimating = true;
    dartTrail = [];
    const vel = power * SHARED_CONFIG.MAX_POWER;
    dart.vx = vel * Math.cos(angle);
    dart.vy = -vel * Math.sin(angle);
    dartRotation = angle;
    anime({ targets: '#powerFill', height: '0%', duration: 300, easing: 'easeOutQuad' });
    if (window.validateShot) window.validateShot(angle, power, duration);
}

function gameLoop() {
    updatePhysics();
    renderFrame();
    requestAnimationFrame(gameLoop);
}

function updatePhysics() {
    if (!isAnimating) return;
    const tailOffset = SHARED_CONFIG.DART_SIZE * 2.2;
    const tailX = dart.x + Math.cos(dartRotation) * -tailOffset;
    const tailY = dart.y + Math.sin(dartRotation) * -tailOffset;
    dartTrail.push({ x: tailX, y: tailY });
    if (dartTrail.length > 20) dartTrail.shift();
    dart.x += dart.vx;
    dart.y += dart.vy;

    if (window._CORE_ENGINE) {
        dartRotation = window._CORE_ENGINE.step(dart);
    } else {
        dart.vy += SHARED_CONFIG.GRAVITY;
        dartRotation = Math.atan2(dart.vy, dart.vx);
    }

    if (target && !hitDetected) {
        const dist = Math.hypot(dart.x - target.x, dart.y - target.y);
        if (dist < minDistToTarget) { minDistToTarget = dist; minDistPos = { x: dart.x, y: dart.y }; }
        if (dist < SHARED_CONFIG.TARGET_RADIUS) wasInTarget = true;
        if (wasInTarget && dist > minDistToTarget) {
            if (minDistToTarget < SHARED_CONFIG.BULLSEYE_RADIUS || dist > SHARED_CONFIG.TARGET_RADIUS) evaluateHit();
        }
    }
    if (dart.y > canvas.height + 100 || Math.abs(dart.x) > canvas.width + 100) {
        if (!hitDetected && isAnimating) wasInTarget ? evaluateHit() : handleMiss();
    }
}

function evaluateHit() {
    if (hitDetected) return;
    hitDetected = true;
    isAnimating = false;
    if (minDistToTarget < SHARED_CONFIG.BULLSEYE_RADIUS) {
        const isBull = minDistToTarget < 15;
        showMessage(isBull ? '🎯 BULLSEYE!' : '⭐ PERFECT!', isBull ? '#ff0000' : '#ffd93d', 3000);

        setTimeout(() => {
            if (hasScored && !window.isVerified && window.showVerifying) window.showVerifying();
        }, 1000);

        createParticles(minDistPos.x, minDistPos.y, isBull ? 50 : 35);
        const off = SHARED_CONFIG.DART_SIZE + 15;
        dart.x = minDistPos.x - Math.cos(dartRotation) * off;
        dart.y = minDistPos.y - Math.sin(dartRotation) * off;
    } else {
        handleMiss('😬 Just Miss!');
    }
}

function handleMiss(txt = '😅 Really? Too far!') {
    hitDetected = true;
    showMessage(txt, '#ff6b6b', 2500);
    isAnimating = false;
    setTimeout(window.resetDart, 2500);
}

function showMessage(text, color, duration = 1500) {
    const msg = document.getElementById('message');
    if (!msg) return;
    msg.textContent = text; msg.style.color = color;
    anime({ targets: msg, scale: [0, 1.3, 1], opacity: [0, 1], duration: 600, easing: 'easeOutElastic(1, .5)' });
    setTimeout(() => { anime({ targets: msg, scale: 0, opacity: 0, duration: 400, easing: 'easeInQuad' }); }, duration);
}

function createParticles(x, y, count) {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle'; p.style.left = x + 'px'; p.style.top = y + 'px';
        p.style.background = ['#ff6b6b', '#ffd93d', '#6bff6b', '#6bb3ff'][Math.floor(Math.random() * 4)];
        container.appendChild(p);
        anime({ targets: p, translateX: (Math.random() - 0.5) * 300, translateY: (Math.random() - 0.5) * 300, scale: [1, 0], opacity: [1, 0], duration: 1000 + Math.random() * 500, easing: 'easeOutExpo', complete: () => p.remove() });
    }
}

function renderFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCyberGrid();
    if (!target) { drawStatus('Loading Security Challenge...'); return; }
    updateAnimations();
    drawTarget();
    drawTrajectory();
    drawTrail();
    drawDartModel();
    drawAimLine();
}

function drawCyberGrid() {
    const space = 60;
    bgOffset = (bgOffset + 0.5) % space;
    ctx.strokeStyle = 'rgba(107, 107, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let x = -bgOffset; x < canvas.width; x += space) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = -bgOffset; y < canvas.height; y += space) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function updateAnimations() {
    targetPulse += 0.05;
}

function drawStatus(t) { ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.fillText(t, canvas.width / 2, canvas.height / 2); }

function drawTarget() {
    const pulse = Math.sin(targetPulse) * 5;
    const rings = [
        { r: SHARED_CONFIG.TARGET_RADIUS + pulse, c: '#ff4444' },
        { r: (SHARED_CONFIG.TARGET_RADIUS * 0.75) + (pulse * 0.7), c: '#ffffff' },
        { r: (SHARED_CONFIG.TARGET_RADIUS * 0.5) + (pulse * 0.5), c: '#ff4444' },
        { r: SHARED_CONFIG.BULLSEYE_RADIUS + (pulse * 0.3), c: '#ffd93d' }
    ];
    ctx.save();
    ctx.shadowColor = 'rgba(255, 107, 107, 0.6)';
    ctx.shadowBlur = 40 + pulse * 2;
    rings.forEach(ring => {
        ctx.beginPath();
        ctx.arc(target.x, target.y, ring.r, 0, Math.PI * 2);
        ctx.fillStyle = ring.c;
        ctx.fill();
    });
    ctx.restore();
    ctx.beginPath(); ctx.arc(target.x, target.y, 8, 0, Math.PI * 2); ctx.fillStyle = '#ff0000'; ctx.fill();
}

function drawDartModel() {
    ctx.save();
    ctx.translate(dart.x, dart.y);
    ctx.rotate(dartRotation - 0.785);

    const scale = SHARED_CONFIG.DART_SIZE / 180;
    ctx.scale(scale, scale);

    ctx.translate(-420, -420);

    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 107, 107, 0.6)';

    ctx.fillStyle = "#FF6464";
    ctx.beginPath();
    ctx.moveTo(176.559, 176.557);
    ctx.lineTo(84.509, 176.569);
    ctx.bezierCurveTo(75.817, 176.570, 67.678, 172.306, 62.731, 165.160);
    ctx.lineTo(1.746, 77.059);
    ctx.bezierCurveTo(-2.718, 70.609, 1.897, 61.801, 9.741, 61.801);
    ctx.lineTo(61.803, 61.801);
    ctx.lineTo(61.803, 9.742);
    ctx.bezierCurveTo(61.803, 1.898, 70.614, -2.718, 77.062, 1.748);
    ctx.lineTo(165.152, 62.744);
    ctx.bezierCurveTo(172.296, 67.691, 176.558, 75.827, 176.558, 84.516);
    ctx.lineTo(176.558, 176.557);
    ctx.fill();

    ctx.fillStyle = "#AFB9D2";
    ctx.beginPath();
    ctx.moveTo(510.083, 510.081);
    ctx.bezierCurveTo(507.612, 512.552, 503.637, 512.646, 501.050, 510.296);
    ctx.lineTo(408.567, 426.220);
    ctx.lineTo(426.222, 408.565);
    ctx.lineTo(510.298, 501.048);
    ctx.bezierCurveTo(512.649, 503.635, 512.554, 507.611, 510.083, 510.081);
    ctx.fill();

    ctx.fillStyle = "#C7CFE2";
    ctx.beginPath();
    ctx.moveTo(388.416, 432.552);
    ctx.lineTo(432.553, 388.415);
    ctx.lineTo(452.144, 414.538);
    ctx.bezierCurveTo(456.098, 419.809, 455.573, 427.187, 450.914, 431.845);
    ctx.lineTo(431.845, 450.913);
    ctx.bezierCurveTo(427.185, 455.573, 419.809, 456.097, 414.538, 452.143);
    ctx.lineTo(388.416, 432.552);
    ctx.fill();

    ctx.fillStyle = "#FFD782";
    ctx.beginPath();
    ctx.moveTo(169.111, 192.847);
    ctx.lineTo(388.416, 432.552);
    ctx.lineTo(432.553, 388.415);
    ctx.lineTo(192.848, 169.110);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#AFB9D2";
    ctx.beginPath();
    ctx.moveTo(432.553, 388.415);
    ctx.lineTo(388.416, 432.552);
    ctx.lineTo(398.514, 440.125);
    ctx.lineTo(440.126, 398.512);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#D2555A";
    ctx.beginPath();
    ctx.moveTo(165.182, 143.812);
    ctx.lineTo(22.270, 13.065);
    ctx.bezierCurveTo(19.695, 10.709, 15.719, 10.797, 13.251, 13.266);
    ctx.bezierCurveTo(10.783, 15.735, 10.694, 19.710, 13.050, 22.285);
    ctx.lineTo(143.798, 165.196);
    ctx.lineTo(169.103, 192.854);
    ctx.lineTo(192.840, 169.117);
    ctx.lineTo(165.182, 143.812);
    ctx.fill();

    ctx.fillStyle = "#FFC36E";
    ctx.beginPath();
    ctx.moveTo(178.986, 203.641);
    ctx.bezierCurveTo(186.273, 195.904, 194.708, 186.982, 203.015, 178.412);
    ctx.lineTo(192.848, 169.110);
    ctx.lineTo(169.111, 192.848);
    ctx.lineTo(178.986, 203.641);
    ctx.fill();

    ctx.restore();
}

function drawTrail() {
    if (dartTrail.length < 2) return;
    ctx.beginPath(); ctx.moveTo(dartTrail[0].x, dartTrail[0].y);
    dartTrail.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
}

function drawAimLine() {
    if (!isDragging) return;
    ctx.beginPath(); ctx.moveTo(dart.x, dart.y); ctx.lineTo(dragCurrent.x, dragCurrent.y); ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(dragCurrent.x, dragCurrent.y, 12, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 107, 107, 0.8)'; ctx.fill();
}

function drawTrajectory() {
    if (!isDragging) return;
    const dist = Math.hypot(dragStart.x - dragCurrent.x, dragStart.y - dragCurrent.y);
    if (dist < 20) return;
    const angle = Math.atan2(dragStart.y - dragCurrent.y, dragCurrent.x - dragStart.x);
    const vel = Math.min(dist / SHARED_CONFIG.MAX_DRAG, 1) * SHARED_CONFIG.MAX_POWER;
    const vx = vel * Math.cos(angle); let vy = -vel * Math.sin(angle);
    ctx.beginPath(); ctx.setLineDash([5, 10]); ctx.strokeStyle = 'rgba(255, 217, 61, 0.3)'; ctx.lineWidth = 2;
    let tx = dart.x, ty = dart.y; ctx.moveTo(tx, ty);

    for (let t = 0; t < 40; t++) {
        if (window._CORE_ENGINE) {
            const mockDart = { x: tx, y: ty, vx, vy };
            window._CORE_ENGINE.step(mockDart);
            tx = mockDart.x; ty = mockDart.y; vy = mockDart.vy;
        } else {
            vy += SHARED_CONFIG.GRAVITY; tx += vx; ty += vy;
        }
        if (ty > canvas.height) break;
        ctx.lineTo(tx, ty);
    }
    ctx.stroke(); ctx.setLineDash([]);
}
