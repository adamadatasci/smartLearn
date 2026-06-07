'use strict';

const SETTINGS = {
    maxDots: 26,
    spawnEveryMs: 700,
    minRadius: 26,
    maxRadius: 42,
    speedMin: 30,
    speedMax: 72,
    pulseSpeedMin: 0.8,
    pulseSpeedMax: 1.8,
    pulseAmplMin: 0.08,
    pulseAmplMax: 0.22,
    roundEveryMs: 2400,
    preFloatMs: 1600,
    formDurationMs: 850,
    postWordPauseMs: 900,
    particleLifeMin: 0.45,
    particleLifeMax: 0.95,
    burstCount: 28,
    iconSwarmCount: 14,
    iconScreenBurstCount: 42,
    iconLifeMin: 1.4,
    iconLifeMax: 2.8
};

const WORDS = [
    'CAT', 'DOG', 'SUN', 'CAR', 'HAT', 'PEN', 'MAP', 'BOX',
    'FISH', 'MOON', 'STAR', 'BOOK', 'BIRD', 'LION', 'TREE', 'DUCK',
    'CAKE', 'MILK', 'FROG', 'BEAR', 'WIND', 'SNOW', 'FIRE', 'SHIP'
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const canvas = document.getElementById('dots-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const wordTargetEl = document.getElementById('wordTarget');
const resetBtn = document.getElementById('resetBtn');

let width = 0;
let height = 0;
let dots = [];
let typedBursts = [];
let particles = [];
let iconSwarms = [];

let spawnTimer = null;
let animationFrame = null;
let running = true;
let freezeForTyping = false;
let freezeUntil = 0;

let activeWord = null;
let activeWordDots = [];
let typedIndex = 0;
let activeThemeIcon = '✨';
let finishingWord = false;

let roundState = 'idle';
let roundStartedAt = 0;
let formStartedAt = 0;
let nextRoundAt = 0;

const palette = [
    '#ff6f91', '#ffc75f', '#f9f871', '#84ff9f', '#71e5ff', '#b39dff', '#ff9de2',
    '#ff9671', '#c7f464', '#7afcff', '#dab6fc', '#ffe156'
];

const WORD_ICONS = {
    FISH: ['🐟', '🐠', '🐡'],
    SHIP: ['🚢', '⛵'],
    BIRD: ['🐦', '🪶'],
    DUCK: ['🦆'],
    FROG: ['🐸'],
    LION: ['🦁'],
    BEAR: ['🐻'],
    TREE: ['🌳', '🌲', '🌱'],
    SUN: ['☀️'],
    MOON: ['🌙'],
    STAR: ['⭐', '🌟'],
    SNOW: ['❄️', '☃️'],
    FIRE: ['🔥'],
    WIND: ['💨'],
    CAT: ['🐱', '🐾'],
    DOG: ['🐶', '🦴'],
    CAR: ['🚗', '🛞'],
    BOOK: ['📘', '📖'],
    CAKE: ['🎂', '🧁'],
    MILK: ['🥛', '🐄'],
    HAT: ['🎩'],
    PEN: ['✏️', '🖍️'],
    MAP: ['🗺️', '🧭'],
    BOX: ['📦', '🎁']
};

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function choice(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

function setStatus(message, cls = '') {
    statusEl.textContent = message;
    statusEl.className = cls;
}

function setWordTarget(text, active = false) {
    wordTargetEl.textContent = text;
    wordTargetEl.className = active ? 'active' : '';
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#10162c');
    gradient.addColorStop(1, '#05070f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function createDot(letter = null) {
    const baseRadius = rand(SETTINGS.minRadius, SETTINGS.maxRadius);
    const speed = rand(SETTINGS.speedMin, SETTINGS.speedMax);
    const angle = rand(0, Math.PI * 2);

    return {
        letter: letter || LETTERS[Math.floor(Math.random() * LETTERS.length)],
        x: rand(baseRadius, width - baseRadius),
        y: rand(baseRadius, height - baseRadius),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        baseRadius,
        radius: baseRadius,
        pulsePhase: rand(0, Math.PI * 2),
        pulseSpeed: rand(SETTINGS.pulseSpeedMin, SETTINGS.pulseSpeedMax),
        pulseAmpl: rand(SETTINGS.pulseAmplMin, SETTINGS.pulseAmplMax),
        color: choice(palette),
        highlighted: false,
        typed: false,
        reserved: false,
        targetX: null,
        targetY: null
    };
}

function spawnDot() {
    if (!running || freezeForTyping || dots.length >= SETTINGS.maxDots) return;
    dots.push(createDot());
}

function updateDotPulse(dot, dt) {
    dot.pulsePhase += dot.pulseSpeed * dt;
    dot.radius = dot.baseRadius * (1 + dot.pulseAmpl * Math.sin(dot.pulsePhase));
}

function moveDotBounce(dot, dt) {
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
}

function updateDots(dt) {
    if (freezeForTyping) return;

    for (const dot of dots) {
        updateDotPulse(dot, dt);

        const isFormingDot = roundState === 'forming' && activeWordDots.includes(dot);
        if (isFormingDot && dot.targetX !== null && dot.targetY !== null) {
            const lerp = Math.min(1, dt * 5.2);
            dot.x += (dot.targetX - dot.x) * lerp;
            dot.y += (dot.targetY - dot.y) * lerp;
            dot.vx *= 0.9;
            dot.vy *= 0.9;
        } else {
            moveDotBounce(dot, dt);
        }
    }
}

function drawDots() {
    for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);

        if (dot.typed) {
            ctx.fillStyle = '#ff4568';
        } else if (dot.highlighted) {
            ctx.fillStyle = '#2ee57b';
        } else {
            ctx.fillStyle = dot.color;
        }

        ctx.fill();

        ctx.lineWidth = dot.highlighted || dot.typed ? 5 : 2;
        ctx.strokeStyle = dot.typed
            ? 'rgba(255, 188, 202, 0.95)'
            : dot.highlighted
            ? 'rgba(182, 255, 198, 0.95)'
            : 'rgba(255,255,255,0.5)';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(18, dot.radius * 0.88)}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dot.letter, dot.x, dot.y + 0.5);

        if (dot.typed) {
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dot.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(173, 255, 223, 0.95)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
}

function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createLetterBurst(letter) {
    const baseX = width * 0.5;
    const baseY = height * 0.58;

    typedBursts.push({
        letter,
        x: baseX,
        y: baseY,
        age: 0,
        life: 0.7,
        startSize: 48,
        endSize: 150,
        rotation: rand(-0.6, 0.6)
    });

    for (let i = 0; i < SETTINGS.burstCount; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(120, 320);
        particles.push({
            x: baseX,
            y: baseY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: rand(SETTINGS.particleLifeMin, SETTINGS.particleLifeMax),
            size: rand(3, 10),
            color: choice(palette)
        });
    }
}

function getWordIcons(word) {
    return WORD_ICONS[word] || ['🎈'];
}

function pickThemeIcon(word) {
    return choice(getWordIcons(word));
}

function createIconSwarm(word, letter) {
    const icons = getWordIcons(word);
    const centerX = width * 0.5 + rand(-40, 40);
    const centerY = height * 0.45 + rand(-30, 30);

    for (let i = 0; i < SETTINGS.iconSwarmCount; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(36, 180);

        iconSwarms.push({
            icon: choice(icons),
            letter,
            x: centerX + rand(-24, 24),
            y: centerY + rand(-24, 24),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            wobble: rand(1.8, 4.4),
            wobblePhase: rand(0, Math.PI * 2),
            age: 0,
            life: rand(SETTINGS.iconLifeMin, SETTINGS.iconLifeMax),
            size: rand(26, 52),
            spin: rand(-1.4, 1.4)
        });
    }
}

function createScreenIconBurst(word) {
    const icons = getWordIcons(word);

    for (let i = 0; i < SETTINGS.iconScreenBurstCount; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(10, 90);

        iconSwarms.push({
            icon: choice(icons),
            x: rand(0, width),
            y: rand(0, height),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            wobble: rand(1.2, 3.8),
            wobblePhase: rand(0, Math.PI * 2),
            age: 0,
            life: rand(SETTINGS.iconLifeMin, SETTINGS.iconLifeMax),
            size: rand(22, 48),
            spin: rand(-0.8, 0.8),
            pinnedToTyping: true
        });
    }
}

function updateAndDrawBursts(dt) {
    typedBursts = typedBursts.filter(burst => {
        burst.age += dt;
        const t = Math.min(1, burst.age / burst.life);
        const alpha = 1 - t;
        const size = burst.startSize + (burst.endSize - burst.startSize) * t;

        ctx.save();
        ctx.translate(burst.x, burst.y);
        ctx.rotate(burst.rotation * t);
        ctx.shadowColor = 'rgba(158, 255, 207, 0.95)';
        ctx.shadowBlur = 36;
        ctx.fillStyle = `rgba(222,255,242,${alpha})`;
        ctx.font = `900 ${size}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(burst.letter, 0, 0);
        ctx.restore();

        return burst.age < burst.life;
    });

    particles = particles.filter(particle => {
        particle.age += dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 80 * dt;

        const alpha = Math.max(0, 1 - particle.age / particle.life);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(particle.color, alpha);
        ctx.fill();

        return particle.age < particle.life;
    });
}

function updateAndDrawIconSwarms(dt) {
    iconSwarms = iconSwarms.filter(iconFx => {
        iconFx.age += dt;
        iconFx.wobblePhase += dt * iconFx.wobble;
        iconFx.x += iconFx.vx * dt;
        iconFx.y += iconFx.vy * dt;
        iconFx.vy += 10 * dt;
        iconFx.vx *= 0.992;

        const pinActive = iconFx.pinnedToTyping && freezeForTyping && roundState === 'typing';
        const lifeRatio = pinActive ? 0 : Math.min(1, iconFx.age / iconFx.life);
        const alpha = pinActive ? 0.96 : Math.max(0, 1 - lifeRatio);
        const rise = Math.sin(iconFx.wobblePhase) * 9;
        const scale = pinActive ? 1.0 : 0.78 + (1 - lifeRatio) * 0.35;

        ctx.save();
        ctx.translate(iconFx.x, iconFx.y + rise);
        ctx.rotate(iconFx.spin * lifeRatio);
        ctx.scale(scale, scale);
        ctx.font = `${iconFx.size}px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = `rgba(255,255,255,${alpha * 0.85})`;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = alpha;
        ctx.fillText(iconFx.icon, 0, 0);
        ctx.restore();

        return pinActive || iconFx.age < iconFx.life;
    });
}

function allocateDotsForWord(word) {
    const selected = [];

    for (const letter of word) {
        const available = dots.find(dot => !dot.reserved && !dot.highlighted && dot.letter === letter);
        if (available) {
            available.reserved = true;
            selected.push(available);
            continue;
        }

        const created = createDot(letter);
        created.reserved = true;
        dots.push(created);
        selected.push(created);
    }

    return selected;
}

function getFormationTargets(wordLength) {
    const gap = wordLength === 4 ? 110 : 130;
    const total = (wordLength - 1) * gap;
    const startX = width * 0.5 - total * 0.5;
    const y = height * 0.42;

    const targets = [];
    for (let i = 0; i < wordLength; i++) {
        targets.push({ x: startX + i * gap, y });
    }
    return targets;
}

function startWordRound(now) {
    if (freezeForTyping || roundState !== 'idle') return;

    activeWord = choice(WORDS);
    activeWordDots = allocateDotsForWord(activeWord);
    typedIndex = 0;
    activeThemeIcon = pickThemeIcon(activeWord);

    roundState = 'prefloat';
    roundStartedAt = now;

    setStatus('Letters are floating... watch a word build!', '');
    setWordTarget('Get ready...', false);
}

function beginFormation(now) {
    const targets = getFormationTargets(activeWord.length);

    for (let i = 0; i < activeWordDots.length; i++) {
        activeWordDots[i].targetX = targets[i].x;
        activeWordDots[i].targetY = targets[i].y;
    }

    roundState = 'forming';
    formStartedAt = now;
    setStatus('Cool! The word is forming...', '');
}

function finalizeFormedWord() {
    for (const dot of activeWordDots) {
        dot.highlighted = true;
        dot.typed = false;
        dot.reserved = false;
        dot.vx = 0;
        dot.vy = 0;
    }

    freezeForTyping = true;
    roundState = 'typing';

    setStatus('Word found! Type the same letters on keyboard.', 'success');
    setWordTarget(activeWord.split('').join('  '), true);
}

function finishWordRound(now) {
    const removeSet = new Set(activeWordDots);
    dots = dots.filter(dot => !removeSet.has(dot));

    activeWord = null;
    activeWordDots = [];
    typedIndex = 0;
    activeThemeIcon = '✨';
        finishingWord = false;
    activeThemeIcon = '✨';
    freezeForTyping = false;
    freezeUntil = now + SETTINGS.postWordPauseMs;
    iconSwarms = [];

    roundState = 'idle';
    nextRoundAt = now + SETTINGS.roundEveryMs;

    setStatus('Great reading! New word coming soon...', 'success');
    setWordTarget('Get ready...', false);
}

function updateRoundFlow(now) {
    if (freezeForTyping) return;

    if (roundState === 'idle' && now >= nextRoundAt) {
        startWordRound(now);
    }

    if (roundState === 'prefloat' && now - roundStartedAt >= SETTINGS.preFloatMs) {
        beginFormation(now);
    }

    if (roundState === 'forming' && now - formStartedAt >= SETTINGS.formDurationMs) {
        finalizeFormedWord();
    }
}

function onKeyDown(event) {
    if (!freezeForTyping || !activeWord || roundState !== 'typing' || finishingWord) return;

    const key = event.key.toUpperCase();
    if (!/^[A-Z]$/.test(key)) return;

    const expected = activeWord[typedIndex];
    if (key !== expected) {
        setStatus(`Try again: next letter is "${expected}".`, 'warn');
        return;
    }

    const targetDot = activeWordDots[typedIndex];
    if (targetDot) {
        targetDot.typed = true;
    }

    createLetterBurst(key);
    createIconSwarm(activeWord, key);
    createScreenIconBurst(activeWord);
    typedIndex += 1;

    setWordTarget(activeWord.split('').join(' '), true);

    if (typedIndex >= activeWord.length) {
        finishingWord = true;
        setStatus('Amazing! Watch the final burst!', 'success');
        setTimeout(() => {
            if (finishingWord && activeWord) {
                finishWordRound(performance.now());
            }
        }, 1100);
        finishingWord = false;
    }
}

function loop(now) {
    if (!running) return;
    if (!loop.last) loop.last = now;

    const dt = Math.min((now - loop.last) / 1000, 0.05);
    loop.last = now;

    drawBackground();

    if (!freezeForTyping && (freezeUntil === 0 || now >= freezeUntil)) {
        updateRoundFlow(now);
        updateDots(dt);
    }

    drawDots();
    updateAndDrawIconSwarms(dt);
    updateAndDrawBursts(dt);

    animationFrame = requestAnimationFrame(loop);
}

function startGame() {
    running = true;
    dots = [];
    typedBursts = [];
    particles = [];
    iconSwarms = [];

    activeWord = null;
    activeWordDots = [];
    typedIndex = 0;

    roundState = 'idle';
    roundStartedAt = 0;
    formStartedAt = 0;
    freezeForTyping = false;
    freezeUntil = 0;
    nextRoundAt = performance.now() + 500;
    loop.last = 0;

    setStatus('Watch floating letters. Words form faster now.');
    setWordTarget('Get ready...');

    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnDot, SETTINGS.spawnEveryMs);

    for (let i = 0; i < 12; i++) {
        spawnDot();
    }

    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', onKeyDown);
resetBtn.addEventListener('click', startGame);

resize();
startGame();
