'use strict';

const CONFIG = {
    symbols: [
        '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
        '-', '+', '=', ';', ':', "'", '"', '?', '/', '\\', '|', '~',
        '<', '>', '.', ',', '[', '←', '→'
    ],
    copiesPerSymbol: 3,
    minSize: 26,
    maxSize: 45,
    speedMin: 10,
    speedMax: 24,
    glowRadius: 13,
    ballRadius: 14,
    attractRadius: 360,
    attractStrength: 145,
    wrongRepelStrength: 48,
    maxChaseSpeed: 155,
    particleCount: 34
};

const canvas = document.getElementById('math-canvas');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const targetEl = document.getElementById('targetSymbol');
const remainingEl = document.getElementById('remaining');
const progressEl = document.getElementById('progress');
const restartBtn = document.getElementById('restartBtn');

let width = 0;
let height = 0;
let entities = [];
let targetQueue = [];
let targetIndex = 0;
let gameDone = false;
let pointerX = window.innerWidth * 0.5;
let pointerY = window.innerHeight * 0.58;
let pointerActive = false;
let ball = {
    x: pointerX,
    y: pointerY,
    vx: 0,
    vy: 0,
    radius: CONFIG.ballRadius,
    spin: 0,
    bounce: 0
};
let particles = [];

const palette = [
    '#ff5577', '#45dba8', '#73a7ff', '#ffbc52', '#d77aff', '#44dbd1',
    '#f47f68', '#b4f15e', '#d5a0ff', '#ff83cc', '#88f3ff', '#ffe57b'
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

function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function setStatus(msg, cls = '') {
    statusEl.textContent = msg;
    statusEl.className = cls;
}

function symbolMetrics(symbol, size) {
    return {
        width: Math.max(18, size * 0.58 * symbol.length),
        height: size * 0.95
    };
}

function createEntity(symbol, i) {
    const size = rand(CONFIG.minSize, CONFIG.maxSize);
    const metrics = symbolMetrics(symbol, size);
    const speed = rand(CONFIG.speedMin, CONFIG.speedMax);
    const angle = rand(0, Math.PI * 2);

    return {
        id: `${symbol}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        symbol,
        x: rand(metrics.width, width - metrics.width),
        y: rand(metrics.height, height - metrics.height),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        width: metrics.width,
        height: metrics.height,
        color: palette[Math.floor(rand(0, palette.length))],
        alive: true,
        angle: rand(0, Math.PI * 2),
        spin: rand(-0.9, 0.9)
    };
}

function initGame() {
    gameDone = false;
    entities = [];

    const symbols = [...CONFIG.symbols];
    targetQueue = shuffle(symbols);
    targetIndex = 0;

    for (const sym of symbols) {
        for (let i = 0; i < CONFIG.copiesPerSymbol; i++) {
            entities.push(createEntity(sym, i));
        }
    }

    updateTargetHUD();
    setStatus('Move the tiny ball. Matching symbols chase it, collide, explode, and disappear.');
}

function currentTarget() {
    return targetQueue[targetIndex] || null;
}

function aliveBySymbol(symbol) {
    return entities.filter(e => e.alive && e.symbol === symbol);
}

function updateTargetHUD() {
    const target = currentTarget();
    if (!target) {
        targetEl.textContent = '✓';
        remainingEl.textContent = 'remaining: 0';
        progressEl.textContent = `${targetQueue.length} / ${targetQueue.length} symbols completed`;
        return;
    }

    const rem = aliveBySymbol(target).length;
    targetEl.textContent = target;
    remainingEl.textContent = `remaining: ${rem}`;
    progressEl.textContent = `${targetIndex} / ${targetQueue.length} symbols completed`;
}

function advanceTargetIfCleared() {
    while (targetIndex < targetQueue.length) {
        const target = targetQueue[targetIndex];
        if (aliveBySymbol(target).length > 0) {
            break;
        }
        targetIndex += 1;
    }

    if (targetIndex >= targetQueue.length) {
        gameDone = true;
        targetEl.textContent = '✓';
        remainingEl.textContent = 'remaining: 0';
        progressEl.textContent = `${targetQueue.length} / ${targetQueue.length} symbols completed`;
        setStatus('Excellent! You finished all scientific-calculator symbols.', 'success');
    } else {
        const next = currentTarget();
        setStatus(`Great. New target: ${next}`);
    }
    updateTargetHUD();
}

function hitTest(x, y) {
    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        if (!e.alive) continue;
        const left = e.x - e.width * 0.5;
        const right = e.x + e.width * 0.5;
        const top = e.y - e.height * 0.75;
        const bottom = e.y + e.height * 0.25;
        if (x >= left && x <= right && y >= top && y <= bottom) {
            return e;
        }
    }
    return null;
}

function createExplosion(entity, good = true) {
    const baseColor = good ? entity.color : '#ffc57a';
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(90, 360);
        particles.push({
            x: entity.x,
            y: entity.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: rand(0.45, 1.05),
            size: rand(3, 11),
            color: i % 4 === 0 ? '#ffffff' : baseColor,
            symbol: i % 7 === 0 ? entity.symbol : null,
            spin: rand(-7, 7)
        });
    }
}

function processSelection(entity, explode = true) {
    if (!entity || gameDone) return;

    const target = currentTarget();
    if (!target) return;

    if (entity.symbol !== target) {
        if (explode) createExplosion(entity, false);
        setStatus(`Wrong symbol. Target is ${target}.`, 'warn');
        return;
    }

    entity.alive = false;
    if (explode) createExplosion(entity, true);
    const rem = aliveBySymbol(target).length;

    if (rem === 0) {
        advanceTargetIfCleared();
        return;
    }

    remainingEl.textContent = `remaining: ${rem}`;
    setStatus(`Good! Keep selecting ${target}.`);
}

function onCanvasClick(e) {
    const ent = hitTest(e.clientX, e.clientY);
    processSelection(ent);
}

function update(dt) {
    updateBall(dt);
    updateParticles(dt);
    if (gameDone) return;

    const target = currentTarget();

    for (const e of entities) {
        if (!e.alive) continue;

        const dx = ball.x - e.x;
        const dy = ball.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        const isTarget = target && e.symbol === target;

        if (isTarget && dist < CONFIG.attractRadius) {
            const pull = (1 - dist / CONFIG.attractRadius) * CONFIG.attractStrength;
            e.vx += (dx / dist) * pull * dt;
            e.vy += (dy / dist) * pull * dt;
        } else if (!isTarget && dist < CONFIG.attractRadius * 0.42) {
            const push = (1 - dist / (CONFIG.attractRadius * 0.42)) * CONFIG.wrongRepelStrength;
            e.vx -= (dx / dist) * push * dt;
            e.vy -= (dy / dist) * push * dt;
        }

        const speed = Math.hypot(e.vx, e.vy);
        const maxSpeed = isTarget ? CONFIG.maxChaseSpeed : CONFIG.speedMax * 2.2;
        if (speed > maxSpeed) {
            e.vx = (e.vx / speed) * maxSpeed;
            e.vy = (e.vy / speed) * maxSpeed;
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle += e.spin * dt;

        if (e.x - e.width * 0.5 <= 0) {
            e.x = e.width * 0.5;
            e.vx = Math.abs(e.vx);
        } else if (e.x + e.width * 0.5 >= width) {
            e.x = width - e.width * 0.5;
            e.vx = -Math.abs(e.vx);
        }

        if (e.y - e.height * 0.75 <= 0) {
            e.y = e.height * 0.75;
            e.vy = Math.abs(e.vy);
        } else if (e.y + e.height * 0.25 >= height) {
            e.y = height - e.height * 0.25;
            e.vy = -Math.abs(e.vy);
        }

        const hitRadius = Math.max(e.width, e.height) * 0.42 + ball.radius;
        if (isTarget && dist <= hitRadius) {
            processSelection(e, true);
        }
    }
}

function updateBall(dt) {
    const dx = pointerX - ball.x;
    const dy = pointerY - ball.y;
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

function updateParticles(dt) {
    particles = particles.filter(p => {
        p.age += dt;
        p.vy += 150 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return p.age < p.life;
    });
}

function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#11182f');
    g.addColorStop(1, '#070b16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
}

function draw() {
    drawBackground();

    const target = currentTarget();

    for (const e of entities) {
        if (!e.alive) continue;

        const matching = target && e.symbol === target;

        if (matching) {
            const dx = ball.x - e.x;
            const dy = ball.y - e.y;
            const dist = Math.hypot(dx, dy);
            const alpha = Math.max(0, 1 - dist / CONFIG.attractRadius);
            if (alpha > 0.04) {
                ctx.save();
                ctx.globalAlpha = alpha * 0.35;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 12]);
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(ball.x, ball.y);
                ctx.stroke();
                ctx.restore();
            }

            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.ellipse(e.x, e.y - e.height * 0.2, e.width * 0.66, e.height * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle * 0.08);
        ctx.font = `700 ${e.size}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = e.color;
        ctx.shadowColor = matching ? '#ffffff' : e.color;
        ctx.shadowBlur = matching ? CONFIG.glowRadius : 8;
        ctx.fillText(e.symbol, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawParticles();
    drawBall();
}

function drawParticles() {
    for (const p of particles) {
        const t = Math.min(1, p.age / p.life);
        const alpha = 1 - t;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * p.age);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16 * alpha;
        ctx.fillStyle = p.color;
        if (p.symbol) {
            ctx.font = `900 ${Math.max(12, p.size * 2.2)}px Segoe UI, Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.symbol, 0, 0);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * (1 + t * 0.7), 0, Math.PI * 2);
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
    gradient.addColorStop(0.32, '#9df4ff');
    gradient.addColorStop(1, '#1979ff');

    ctx.shadowColor = '#83e7ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#83e7ff';
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y + ball.radius * 0.88, ball.radius * 0.9, ball.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function loop(now) {
    if (!loop.last) loop.last = now;
    const dt = Math.min((now - loop.last) / 1000, 0.05);
    loop.last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
canvas.addEventListener('click', onCanvasClick);
canvas.addEventListener('mousemove', e => { pointerX = e.clientX; pointerY = e.clientY; pointerActive = true; });
canvas.addEventListener('pointermove', e => { pointerX = e.clientX; pointerY = e.clientY; pointerActive = true; });
canvas.addEventListener('pointerdown', e => { pointerX = e.clientX; pointerY = e.clientY; pointerActive = true; });
canvas.addEventListener('mouseleave', () => { pointerActive = false; });
restartBtn.addEventListener('click', initGame);

resize();
initGame();
requestAnimationFrame(loop);
