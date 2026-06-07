'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const CFG = {
    letterCount:  26,
    ballCount:    6,
    maxBallCount: 14,
    spawnEveryMs: 1500,
    letterRadius: 42,          // circular hit/cover area per letter
    ballRadius:   11,
    letterSpeed:  { min: 32, max: 62 },
    ballSpeed:    { min: 70, max: 140 },
    letterColor:  '#e8c87a',   // all letters same warm-gold colour
    letterFont:   'bold 46px Segoe UI, Arial, sans-serif',
    ballPalette: ['#ff4d4d', '#36d977'],
    // pulse on letters
    pulseSpeedMin: 0.6,
    pulseSpeedMax: 1.8,
    pulseAmplMin:  0.04,
    pulseAmplMax:  0.14,
    boundedLetterChance: 0.65,
    unboundedWrapMargin: 130,
    hiddenMinMs:   2000,
    hiddenMaxMs:   7000,
    exitBoostMin:  70,
    exitBoostMax:  150,
    freezeMinGreens: 2,
    freezeTargetGreens: 4,
    freezeDurationMs: 5000,
    freezeBaseChancePerSecond: 0.03,
    freezePeakChancePerSecond: 0.34,
    freezeSpread: 1.35,
    bigFaceDurationMs: 900,
    // flash durations (ms)
    flashCorrectMs: 420,
    flashWrongMs:   320,
    revealMs:       600,       // how long hidden balls are briefly shown after correct click
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ── DOM ──────────────────────────────────────────────────────────────────────
const canvas    = document.getElementById('dots-canvas');
const ctx       = canvas.getContext('2d');
const statusEl  = document.getElementById('status');
const resetBtn  = document.getElementById('resetBtn');
const scoreEl   = document.getElementById('scoreVal');
const streakEl  = document.getElementById('streakVal');
const missEl    = document.getElementById('missVal');
const faceEl    = document.getElementById('face');

let W = 0, H = 0;
let letters = [];
let balls    = [];
let score    = 0;
let streak   = 0;
let misses   = 0;
let mouseX   = -9999;
let mouseY   = -9999;
let raf      = null;
let spawnAccumulator = 0;
let freezeUntil = 0;
let bigFaceEffect = null;

function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
}

function rand(a, b)  { return a + Math.random() * (b - a); }
function randInt(n)  { return Math.floor(Math.random() * n); }
function hexRgba(hex, a) {
    const h = hex.replace('#','');
    return `rgba(${parseInt(h,16)>>16&255},${parseInt(h,16)>>8&255},${parseInt(h,16)&255},${a})`;
}

// ── Letter entity ────────────────────────────────────────────────────────────
function makeLetter(char) {
    const r     = CFG.letterRadius;
    const speed = rand(CFG.letterSpeed.min, CFG.letterSpeed.max);
    const angle = rand(0, Math.PI * 2);
    return {
        char,
        x: rand(r, W - r),
        y: rand(r, H - r),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        bounded: Math.random() < CFG.boundedLetterChance,
        baseR: r,
        r,
        pulsePhase: rand(0, Math.PI * 2),
        pulseSpeed: rand(CFG.pulseSpeedMin, CFG.pulseSpeedMax),
        pulseAmpl:  rand(CFG.pulseAmplMin,  CFG.pulseAmplMax),
        flash:      null,   // { color, until }
        revealUntil: 0      // timestamp until hidden balls are briefly shown
    };
}

// ── Ball entity ──────────────────────────────────────────────────────────────
function makeBall(index) {
    const speed = rand(CFG.ballSpeed.min, CFG.ballSpeed.max);
    const angle = rand(0, Math.PI * 2);
    return {
        x:  rand(CFG.ballRadius, W - CFG.ballRadius),
        y:  rand(CFG.ballRadius, H - CFG.ballRadius),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r:  CFG.ballRadius,
        color: CFG.ballPalette[randInt(CFG.ballPalette.length)],
        hiddenBy: null,
        hiddenUntil: 0,
        justReleasedUntil: 0,
        offsetAngle: rand(0, Math.PI * 2),
        offsetRadius: rand(0, CFG.ballRadius * 0.8)
    };
}

// ── Pick a shuffled subset of letters ────────────────────────────────────────
function pickLetters(n) {
    const pool = ALPHABET.split('');
    for (let i = pool.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n).map(makeLetter);
}

// ── Physics step ─────────────────────────────────────────────────────────────
function stepEntity(e, dt) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    const r = e.r;
    if (e.x - r <  0) { e.x =  r;    e.vx =  Math.abs(e.vx); }
    if (e.x + r > W)  { e.x = W - r; e.vx = -Math.abs(e.vx); }
    if (e.y - r <  0) { e.y =  r;    e.vy =  Math.abs(e.vy); }
    if (e.y + r > H)  { e.y = H - r; e.vy = -Math.abs(e.vy); }
}

function stepLetter(letter, dt) {
    letter.x += letter.vx * dt;
    letter.y += letter.vy * dt;

    if (letter.bounded) {
        const r = letter.r;
        if (letter.x - r <  0) { letter.x =  r;    letter.vx =  Math.abs(letter.vx); }
        if (letter.x + r > W)  { letter.x = W - r; letter.vx = -Math.abs(letter.vx); }
        if (letter.y - r <  0) { letter.y =  r;    letter.vy =  Math.abs(letter.vy); }
        if (letter.y + r > H)  { letter.y = H - r; letter.vy = -Math.abs(letter.vy); }
        return;
    }

    const m = CFG.unboundedWrapMargin;
    if (letter.x < -m)      { letter.x = W + m; letter.y = rand(letter.r, H - letter.r); }
    else if (letter.x > W + m) { letter.x = -m;   letter.y = rand(letter.r, H - letter.r); }

    if (letter.y < -m)      { letter.y = H + m; letter.x = rand(letter.r, W - letter.r); }
    else if (letter.y > H + m) { letter.y = -m;   letter.x = rand(letter.r, W - letter.r); }
}

function ballIsInsideLetter(ball, letter) {
    return Math.hypot(ball.x - letter.x, ball.y - letter.y) <= letter.r;
}

function hideBallInLetter(ball, letter, now) {
    ball.hiddenBy = letter;
    ball.hiddenUntil = now + rand(CFG.hiddenMinMs, CFG.hiddenMaxMs);
    ball.offsetAngle = rand(0, Math.PI * 2);
    ball.offsetRadius = rand(0, Math.max(2, Math.min(letter.r - ball.r - 4, CFG.ballRadius * 1.2)));
    ball.x = letter.x + Math.cos(ball.offsetAngle) * ball.offsetRadius;
    ball.y = letter.y + Math.sin(ball.offsetAngle) * ball.offsetRadius;
    ball.vx = 0;
    ball.vy = 0;
}

function releaseBall(ball) {
    const angle = rand(0, Math.PI * 2);
    const boost = rand(CFG.exitBoostMin, CFG.exitBoostMax);
    ball.hiddenBy = null;
    ball.hiddenUntil = 0;
    ball.justReleasedUntil = performance.now() + 500;
    ball.x += Math.cos(angle) * (ball.r + 3);
    ball.y += Math.sin(angle) * (ball.r + 3);
    ball.vx = Math.cos(angle) * boost;
    ball.vy = Math.sin(angle) * boost;
}

function spawnBall() {
    if (balls.length >= CFG.maxBallCount) {
        return;
    }
    balls.push(makeBall(balls.length));
}

function freezeChanceForGreenCount(count) {
    if (count < CFG.freezeMinGreens) {
        return 0;
    }

    const delta = count - CFG.freezeTargetGreens;
    const gaussian = Math.exp(-(delta * delta) / (2 * CFG.freezeSpread * CFG.freezeSpread));
    return CFG.freezeBaseChancePerSecond + CFG.freezePeakChancePerSecond * gaussian;
}

function update(dt, now) {
    // Update letters
    for (const l of letters) {
        l.pulsePhase += l.pulseSpeed * dt;
        l.r = l.baseR * (1 + l.pulseAmpl * Math.sin(l.pulsePhase));
        stepLetter(l, dt);
    }
    // Update balls
    for (const b of balls) {
        if (b.hiddenBy && now < b.hiddenUntil) {
            b.x = b.hiddenBy.x + Math.cos(b.offsetAngle) * b.offsetRadius;
            b.y = b.hiddenBy.y + Math.sin(b.offsetAngle) * b.offsetRadius;
            continue;
        }

        if (b.hiddenBy && now >= b.hiddenUntil) {
            releaseBall(b);
        }

        stepEntity(b, dt);

        const host = now < b.justReleasedUntil
            ? null
            : letters.find(l => ballIsInsideLetter(b, l));
        if (host) {
            hideBallInLetter(b, host, now);
        }
    }

    spawnAccumulator += dt * 1000;
    while (spawnAccumulator >= CFG.spawnEveryMs) {
        spawnAccumulator -= CFG.spawnEveryMs;
        spawnBall();
    }

    const hiddenGreenCount = balls.filter(
        b => b.hiddenBy && now < b.hiddenUntil && b.color === '#36d977'
    ).length;

    const freezeChance = freezeChanceForGreenCount(hiddenGreenCount);

    if (
        now >= freezeUntil &&
        Math.random() < freezeChance * dt
    ) {
        freezeUntil = now + CFG.freezeDurationMs;
        for (const b of balls) {
            if (b.hiddenBy && now < b.hiddenUntil && b.color === '#36d977') {
                b.hiddenUntil = Math.max(b.hiddenUntil, freezeUntil + rand(2500, 6500));
            }
        }
        setStatus('⏸ Random freeze triggered. You have 20 seconds to find hidden greens.', 'warn');
    }
}

// ── Which letters currently hide at least one ball ───────────────────────────
function hidingLetters() {
    return letters.filter(l =>
        balls.some(b => b.hiddenBy === l && performance.now() < b.hiddenUntil));
}

function hiddenBallsForLetter(letter, now) {
    return balls.filter(b => b.hiddenBy === letter && now < b.hiddenUntil);
}

// ── Background ────────────────────────────────────────────────────────────────
function drawBg() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0e1428');
    g.addColorStop(1, '#04060e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

function drawBigFace(now) {
    if (!bigFaceEffect) {
        return;
    }

    const elapsed = now - bigFaceEffect.startedAt;
    if (elapsed >= CFG.bigFaceDurationMs) {
        bigFaceEffect = null;
        return;
    }

    const p = elapsed / CFG.bigFaceDurationMs;
    const alpha = 1 - p;
    const size = Math.round(130 + p * 26);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif`;
    ctx.shadowColor = bigFaceEffect.color;
    ctx.shadowBlur = 28;
    ctx.fillStyle = bigFaceEffect.color;
    ctx.fillText(bigFaceEffect.face, W / 2, H / 2);
    ctx.restore();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(now) {
    drawBg();

    // 1. Draw visible balls (those NOT inside any letter, or in a reveal window)
    for (const b of balls) {
        const hiddenBy = b.hiddenBy && now < b.hiddenUntil ? b.hiddenBy : null;
        const hidden = hiddenBy && hiddenBy.revealUntil < now;
        if (hidden) continue;   // truly hidden — skip drawing

        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur  = 12;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 2. Draw letters on top (covering hidden balls)
    for (const l of letters) {
        const hovered  = Math.hypot(mouseX - l.x, mouseY - l.y) <= l.r;
        const flashing = l.flash && now < l.flash.until;

        // Fixed fill so hidden balls do not visually highlight a letter
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        ctx.fillStyle = hovered
            ? `rgba(255,255,255,0.14)`
            : `rgba(255,255,255,0.08)`;
        ctx.fill();

        // Flash ring (correct = white, wrong = red)
        if (flashing) {
            ctx.beginPath();
            ctx.arc(l.x, l.y, l.r + 8, 0, Math.PI * 2);
            const progress = (l.flash.until - now) / l.flash.duration;
            ctx.strokeStyle = hexRgba(l.flash.color, progress * 0.9);
            ctx.lineWidth   = 5 * progress;
            ctx.stroke();
        }

        // Hover ring
        if (hovered && !flashing) {
            ctx.beginPath();
            ctx.arc(l.x, l.y, l.r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth   = 2;
            ctx.stroke();
        }

        // The letter text
        ctx.font         = `bold ${Math.round(l.r * 1.13)}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = flashing
            ? hexRgba(l.flash.color, 0.55 + 0.45 * ((l.flash.until - now) / l.flash.duration))
            : CFG.letterColor;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur  = hovered ? 18 : 8;
        ctx.fillText(l.char, l.x, l.y + 1);
        ctx.shadowBlur = 0;
    }
}

// ── HUD update ────────────────────────────────────────────────────────────────
function updateHUD() {
    scoreEl.textContent  = score;
    streakEl.textContent = streak;
    missEl.textContent   = misses;
}

function setFace(face, color) {
    faceEl.textContent = face;
    faceEl.style.color = color;
    bigFaceEffect = {
        face,
        color,
        startedAt: performance.now()
    };
}

function setStatus(msg, cls = '') {
    statusEl.textContent = msg;
    statusEl.className   = cls;
}

function findClickedLetterAt(x, y) {
    for (let i = letters.length - 1; i >= 0; i--) {
        if (Math.hypot(x - letters[i].x, y - letters[i].y) <= letters[i].r) {
            return letters[i];
        }
    }
    return null;
}

function findVisibleLetterByKey(letterKey) {
    for (const letter of letters) {
        if (letter.char !== letterKey) continue;
        const visible = letter.x + letter.r >= 0 && letter.x - letter.r <= W &&
            letter.y + letter.r >= 0 && letter.y - letter.r <= H;
        if (visible) return letter;
    }
    return null;
}

function handleLetterSelection(clicked, now) {
    if (!clicked) return;

    const hiddenBalls = hiddenBallsForLetter(clicked, now);
    const greenBall = hiddenBalls.find(b => b.color === '#36d977');
    const redBall = hiddenBalls.find(b => b.color === '#ff4d4d');
    const cancelled = greenBall && redBall;

    if (cancelled) {
        misses++;
        streak = 0;
        clicked.revealUntil = now + CFG.revealMs;
        clicked.flash = { color: '#ff4d4d', until: now + CFG.flashWrongMs, duration: CFG.flashWrongMs };
        setFace('☹️', '#ff4d4d');
        setStatus(`✗ Upset face! "${clicked.char}" has both red and green, so they cancel.`, 'warn');
    } else if (greenBall) {
        score++;
        streak++;
        clicked.revealUntil = now + CFG.revealMs;
        clicked.flash = { color: '#36d977', until: now + CFG.flashCorrectMs, duration: CFG.flashCorrectMs };
        releaseBall(greenBall);
        spawnBall();
        setFace('😊', '#36d977');
        setStatus(`✓ Happy face! "${clicked.char}" released a green ball.`, 'success');
    } else if (redBall) {
        misses++;
        streak = 0;
        clicked.revealUntil = now + CFG.revealMs;
        clicked.flash = { color: '#ff4d4d', until: now + CFG.flashWrongMs, duration: CFG.flashWrongMs };
        setFace('☹️', '#ff4d4d');
        setStatus(`✗ Upset face! "${clicked.char}" is hiding a red ball.`, 'warn');
    } else {
        misses++;
        streak = 0;
        clicked.flash = { color: '#ff3355', until: now + CFG.flashWrongMs, duration: CFG.flashWrongMs };
        setFace('☹️', '#ff4d4d');
        const hiding = hidingLetters();
        const hint = hiding.length
            ? `Upset face! No ball here. Try a letter that is currently hiding one.`
            : `No balls are hidden right now — wait for one to drift in.`;
        setStatus(hint, 'warn');
    }
    updateHUD();
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function loop(now) {
    if (!loop.last) loop.last = now;
    const dt = Math.min((now - loop.last) / 1000, 0.05);
    loop.last = now;

    if (now >= freezeUntil) {
        update(dt, now);
    }
    render(now);
    drawBigFace(now);

    raf = requestAnimationFrame(loop);
}

// ── Click handler ─────────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
    const now = performance.now();
    const clicked = findClickedLetterAt(e.clientX, e.clientY);
    handleLetterSelection(clicked, now);
});

window.addEventListener('keydown', e => {
    const key = e.key.toUpperCase();
    if (!/^[A-Z]$/.test(key)) {
        return;
    }

    const now = performance.now();
    const letter = findVisibleLetterByKey(key);
    if (!letter) {
        setStatus(`"${key}" is off-screen or unavailable right now.`, 'warn');
        setFace('☹️', '#ff4d4d');
        return;
    }

    handleLetterSelection(letter, now);
});

// ── Canvas cursor ─────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    // Change cursor when over a letter
    const over = letters.some(l => Math.hypot(e.clientX - l.x, e.clientY - l.y) <= l.r);
    canvas.style.cursor = over ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

// ── Start / reset ─────────────────────────────────────────────────────────────
function startGame() {
    if (raf) cancelAnimationFrame(raf);
    score   = 0;
    streak  = 0;
    misses  = 0;
    loop.last = 0;
    spawnAccumulator = 0;
    freezeUntil = 0;

    letters = pickLetters(CFG.letterCount);
    balls   = Array.from({ length: CFG.ballCount }, (_, i) => makeBall(i));

    updateHUD();
    setFace('🙂', '#ffe7b0');
    setStatus('A ball is hiding inside a letter — press that letter key (A-Z)!');
    raf = requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
resetBtn.addEventListener('click', startGame);

resize();
startGame();
