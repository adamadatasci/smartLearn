'use strict';

const SETTINGS = {
    totalDots: 12,
    spawnEveryMs: 700,
    minRadius: 22,
    maxRadius: 32,
    speedMin: 48,
    speedMax: 96,
    lineWidth: 5,
    fireStrokeCount: 240,
    fireDurationMs: 2200,
    ballRadius: 14,
    attractRadius: 330,
    attractStrength: 175,
    wrongRepelStrength: 58,
    maxChaseSpeed: 190,
    dotBurstCount: 38,
    // pulsing
    pulseSpeedMin: 0.8,   // radians/s
    pulseSpeedMax: 2.2,
    pulseAmplMin: 0.12,   // fraction of baseRadius
    pulseAmplMax: 0.30
};

const canvas = document.getElementById('dots-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

let width = 0;
let height = 0;
let dots = [];
let connectedDotIds = [];
let nextDotId = 1;
let nextRequiredId = 1;
let spawnTimer = null;
let animationFrame = null;
let running = true;
let gameWon = false;
let fireStrokes = [];
let dotParticles = [];
let fireStartedAt = 0;
let mouseX = window.innerWidth * 0.5;
let mouseY = window.innerHeight * 0.58;
let pointerActive = false;
let ball = {
    x: mouseX,
    y: mouseY,
    vx: 0,
    vy: 0,
    radius: SETTINGS.ballRadius,
    spin: 0,
    bounce: 0
};
let numericInputBuffer = '';
let numericInputTimer = null;

const palette = [
    '#ff4568', '#3be28f', '#4ea6ff', '#ffb347',
    '#d968ff', '#31ded1', '#ffe35a', '#7fd7ff',
    '#ff7f7f', '#b2ff66', '#ff93d9', '#7d8dff'
];

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function randomDotColor(index) {
    return palette[index % palette.length];
}

function spawnDot() {
    if (!running || gameWon || nextDotId > SETTINGS.totalDots) {
        return;
    }

    const baseRadius = rand(SETTINGS.minRadius, SETTINGS.maxRadius);
    const speed = rand(SETTINGS.speedMin, SETTINGS.speedMax);
    const angle = rand(0, Math.PI * 2);

    dots.push({
        id: nextDotId,
        x: rand(baseRadius, width - baseRadius),
        y: rand(baseRadius, height - baseRadius),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        baseRadius,
        radius: baseRadius,           // animated each frame
        pulsePhase: rand(0, Math.PI * 2),
        pulseSpeed: rand(SETTINGS.pulseSpeedMin, SETTINGS.pulseSpeedMax),
        pulseAmpl:  rand(SETTINGS.pulseAmplMin, SETTINGS.pulseAmplMax),
        color: randomDotColor(nextDotId - 1),
        connected: false
    });

    nextDotId += 1;

    if (nextDotId > SETTINGS.totalDots) {
        clearInterval(spawnTimer);
        spawnTimer = null;
    }
}

function updateDots(dt) {
    updateBall(dt);
    updateDotParticles(dt);

    for (const dot of dots) {
        if (dot.connected) continue;

        // Pulse: smoothly grow and shrink
        dot.pulsePhase += dot.pulseSpeed * dt;
        dot.radius = dot.baseRadius * (1 + dot.pulseAmpl * Math.sin(dot.pulsePhase));

        const dx = ball.x - dot.x;
        const dy = ball.y - dot.y;
        const dist = Math.hypot(dx, dy) || 1;
        const isNext = dot.id === nextRequiredId && !gameWon;

        if (isNext && dist < SETTINGS.attractRadius) {
            const pull = (1 - dist / SETTINGS.attractRadius) * SETTINGS.attractStrength;
            dot.vx += (dx / dist) * pull * dt;
            dot.vy += (dy / dist) * pull * dt;
        } else if (!isNext && dist < SETTINGS.attractRadius * 0.44) {
            const push = (1 - dist / (SETTINGS.attractRadius * 0.44)) * SETTINGS.wrongRepelStrength;
            dot.vx -= (dx / dist) * push * dt;
            dot.vy -= (dy / dist) * push * dt;
        }

        const speed = Math.hypot(dot.vx, dot.vy);
        const maxSpeed = isNext ? SETTINGS.maxChaseSpeed : SETTINGS.speedMax * 1.7;
        if (speed > maxSpeed) {
            dot.vx = (dot.vx / speed) * maxSpeed;
            dot.vy = (dot.vy / speed) * maxSpeed;
        }

        dot.x += dot.vx * dt;
        dot.y += dot.vy * dt;

        if (dot.x - dot.radius <= 0) {
            dot.x = dot.radius;
            dot.vx = Math.abs(dot.vx);
        } else if (dot.x + dot.radius >= width) {
            dot.x = width - dot.radius;
            dot.vx = -Math.abs(dot.vx);
        }

        if (dot.y - dot.radius <= 0) {
            dot.y = dot.radius;
            dot.vy = Math.abs(dot.vy);
        } else if (dot.y + dot.radius >= height) {
            dot.y = height - dot.radius;
            dot.vy = -Math.abs(dot.vy);
        }

        if (isNext && dist <= dot.radius + ball.radius * 0.86) {
            processDotSelection(dot, true);
        }
    }
}

function updateBall(dt) {
    const dx = mouseX - ball.x;
    const dy = mouseY - ball.y;
    ball.vx += dx * 22 * dt;
    ball.vy += dy * 22 * dt;
    ball.vx *= Math.pow(0.0008, dt);
    ball.vy *= Math.pow(0.0008, dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.spin += ball.vx * dt * 0.04;
    ball.bounce += dt * 9;
    ball.x = Math.max(ball.radius, Math.min(width - ball.radius, ball.x));
    ball.y = Math.max(ball.radius, Math.min(height - ball.radius, ball.y));
}

function updateDotParticles(dt) {
    dotParticles = dotParticles.filter(p => {
        p.age += dt;
        p.vy += 165 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return p.age < p.life;
    });
}

function drawConnectionTrace() {
    if (connectedDotIds.length < 2) {
        return;
    }

    ctx.lineWidth = SETTINGS.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < connectedDotIds.length; i++) {
        const from = dots.find(dot => dot.id === connectedDotIds[i - 1]);
        const to = dots.find(dot => dot.id === connectedDotIds[i]);
        if (!from || !to) {
            continue;
        }

        const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
        gradient.addColorStop(0, from.color);
        gradient.addColorStop(1, to.color);

        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }
}

function drawDots() {
    for (const dot of dots) {
        if (dot.connected) {
            drawConnectedSpark(dot);
            continue;
        }

        const hovered = !dot.connected && !gameWon &&
            Math.hypot(ball.x - dot.x, ball.y - dot.y) <= dot.radius + ball.radius;
        const isNext = dot.id === nextRequiredId && !gameWon;

        // Outer glow on hover
        if (hovered || isNext) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dot.radius + (isNext ? 18 : 10), 0, Math.PI * 2);
            const glow = ctx.createRadialGradient(
                dot.x, dot.y, dot.radius * 0.6,
                dot.x, dot.y, dot.radius + (isNext ? 18 : 10)
            );
            glow.addColorStop(0, hexToRgba(dot.color, isNext ? 0.68 : 0.45));
            glow.addColorStop(1, hexToRgba(dot.color, 0));
            ctx.fillStyle = glow;
            ctx.fill();
            ctx.restore();
        }

        if (isNext) {
            const dist = Math.hypot(ball.x - dot.x, ball.y - dot.y);
            const alpha = Math.max(0, 1 - dist / SETTINGS.attractRadius);
            if (alpha > 0.04) {
                ctx.save();
                ctx.globalAlpha = alpha * 0.34;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 12]);
                ctx.beginPath();
                ctx.moveTo(dot.x, dot.y);
                ctx.lineTo(ball.x, ball.y);
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.beginPath();
        ctx.fillStyle = dot.color;
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fill();

        if (dot.connected) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        } else if (hovered) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(14, dot.radius * 0.85)}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(dot.id), dot.x, dot.y + 0.5);
    }
}

function drawConnectedSpark(dot) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = dot.color;
    ctx.shadowColor = dot.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function createDotExplosion(dot) {
    for (let i = 0; i < SETTINGS.dotBurstCount; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(95, 350);
        dotParticles.push({
            x: dot.x,
            y: dot.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: rand(0.45, 1.08),
            size: rand(3, 11),
            color: i % 5 === 0 ? '#ffffff' : dot.color,
            text: i % 8 === 0 ? String(dot.id) : '',
            spin: rand(-7, 7)
        });
    }
}

function drawDotParticles() {
    for (const p of dotParticles) {
        const t = Math.min(1, p.age / p.life);
        const alpha = 1 - t;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * p.age);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16 * alpha;
        ctx.fillStyle = p.color;
        if (p.text) {
            ctx.font = `900 ${Math.max(12, p.size * 2.3)}px Segoe UI, Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text, 0, 0);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * (1 + t * 0.65), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

function drawBall() {
    const squash = 1 + Math.sin(ball.bounce) * 0.08;
    const bob = Math.abs(Math.sin(ball.bounce)) * 5;

    ctx.save();
    ctx.translate(ball.x, ball.y - bob);
    ctx.rotate(ball.spin);
    ctx.scale(1 / squash, squash);

    const gradient = ctx.createRadialGradient(-ball.radius * 0.35, -ball.radius * 0.45, 2, 0, 0, ball.radius * 1.25);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.32, '#b4fff1');
    gradient.addColorStop(1, '#2edb8f');

    ctx.shadowColor = '#7affc9';
    ctx.shadowBlur = 24;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#7affc9';
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y + ball.radius * 0.88, ball.radius * 0.9, ball.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function makeFireStroke() {
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    if (side === 0) {
        x = rand(0, width);
        y = -20;
    } else if (side === 1) {
        x = width + 20;
        y = rand(0, height);
    } else if (side === 2) {
        x = rand(0, width);
        y = height + 20;
    } else {
        x = -20;
        y = rand(0, height);
    }

    const targetX = width / 2 + rand(-140, 140);
    const targetY = height / 2 + rand(-140, 140);
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;

    return {
        x,
        y,
        vx: (dx / dist) * rand(400, 940),
        vy: (dy / dist) * rand(400, 940),
        life: rand(0.65, 1.2),
        age: 0,
        width: rand(2, 6),
        color: ['#ffef9a', '#ffc34e', '#ff7a00', '#ff3f00'][Math.floor(Math.random() * 4)]
    };
}

function startExplosion() {
    fireStrokes = Array.from({ length: SETTINGS.fireStrokeCount }, () => makeFireStroke());
    fireStartedAt = performance.now();
}

function updateAndDrawExplosion(dt) {
    const elapsed = performance.now() - fireStartedAt;

    for (const f of fireStrokes) {
        const oldX = f.x;
        const oldY = f.y;
        f.age += dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;

        const alpha = Math.max(0, 1 - f.age / f.life);

        ctx.strokeStyle = hexToRgba(f.color, alpha);
        ctx.lineWidth = f.width * (0.45 + alpha);
        ctx.beginPath();
        ctx.moveTo(oldX, oldY);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
    }

    fireStrokes = fireStrokes.filter(f => f.age < f.life);

    if (elapsed > SETTINGS.fireDurationMs) {
        fireStrokes = [];
    }
}

function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#10162c');
    g.addColorStop(1, '#05070f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
}

function loop(now) {
    if (!running) {
        return;
    }

    if (!loop.last) {
        loop.last = now;
    }

    const dt = Math.min((now - loop.last) / 1000, 0.05);
    loop.last = now;

    updateDots(dt);
    drawBackground();
    drawConnectionTrace();
    drawDots();
    drawDotParticles();
    drawBall();

    if (gameWon && fireStrokes.length > 0) {
        updateAndDrawExplosion(dt);
    }

    animationFrame = requestAnimationFrame(loop);
}

function setStatus(message, className = '') {
    statusEl.textContent = message;
    statusEl.className = className;
}

function getDotAtPoint(x, y) {
    // Uses current animated radius — click anywhere the dot visually occupies
    for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        if (!d.connected && Math.hypot(x - d.x, y - d.y) <= d.radius) {
            return d;
        }
    }
    return null;
}

function getDotById(id) {
    return dots.find(d => d.id === id && !d.connected) || null;
}

function processDotSelection(dot, explode = true) {
    if (gameWon || !dot) {
        return;
    }

    if (dot.id !== nextRequiredId) {
        setStatus(
            `Wrong order. Next should be ${nextRequiredId}. Tip: press the smallest missing number.`,
            'warn'
        );
        return;
    }

    dot.connected = true;
    dot.vx = 0;
    dot.vy = 0;
    if (explode) createDotExplosion(dot);
    connectedDotIds.push(dot.id);
    nextRequiredId += 1;

    if (nextRequiredId > SETTINGS.totalDots) {
        gameWon = true;
        setStatus('Perfect! Every dot exploded in order. Fire stroke finale activated!', 'success');
        startExplosion();
        return;
    }

    setStatus(`Great. Now guide the ball to ${nextRequiredId}.`);
}

function onCanvasClick(event) {
    const dot = getDotAtPoint(event.clientX, event.clientY);
    processDotSelection(dot);
}

function onKeyDown(event) {
    if (!/^\d$/.test(event.key) || gameWon) {
        return;
    }

    numericInputBuffer += event.key;
    if (numericInputBuffer.length > 2) {
        numericInputBuffer = numericInputBuffer.slice(-2);
    }

    const value = parseInt(numericInputBuffer, 10);
    if (value >= 1 && value <= SETTINGS.totalDots) {
        const dot = getDotById(value);
        if (!dot) {
            setStatus(`Dot ${value} is not available yet. Try ${nextRequiredId}.`, 'warn');
        } else {
            processDotSelection(dot);
        }
        numericInputBuffer = '';
    }

    if (numericInputTimer) {
        clearTimeout(numericInputTimer);
    }
    numericInputTimer = setTimeout(() => {
        numericInputBuffer = '';
    }, 700);
}

function startGame() {
    running = true;
    gameWon = false;
    dots = [];
    connectedDotIds = [];
    fireStrokes = [];
    dotParticles = [];
    nextDotId = 1;
    nextRequiredId = 1;
    loop.last = 0;
    numericInputBuffer = '';

    if (numericInputTimer) {
        clearTimeout(numericInputTimer);
        numericInputTimer = null;
    }

    setStatus('Move the tiny ball. Dot 1 chases it, collides, explodes, then dot 2 starts chasing!');

    if (spawnTimer) {
        clearInterval(spawnTimer);
    }
    spawnTimer = setInterval(spawnDot, SETTINGS.spawnEveryMs);
    spawnDot();

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    animationFrame = requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; pointerActive = true; });
canvas.addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; pointerActive = true; });
canvas.addEventListener('pointerdown', e => { mouseX = e.clientX; mouseY = e.clientY; pointerActive = true; });
canvas.addEventListener('mouseleave', () => { pointerActive = false; });
canvas.addEventListener('click', onCanvasClick);
window.addEventListener('keydown', onKeyDown);
resetBtn.addEventListener('click', startGame);

resize();
startGame();
