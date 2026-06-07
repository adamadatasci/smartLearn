'use strict';

const OBJECTS = ['🍎', '⭐', '🐠', '🚗', '🧸', '🌼', '🦋', '🍪', '⚽', '🐥'];

const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
const targetNumberEl = document.getElementById('targetNumber');
const groupsEl = document.getElementById('groups');
const feedbackEl = document.getElementById('feedback');
const starsTextEl = document.getElementById('starsText');
const roundTextEl = document.getElementById('roundText');
const hearBtn = document.getElementById('hearBtn');
const nextBtn = document.getElementById('nextBtn');
const easyBtn = document.getElementById('easyBtn');
const biggerBtn = document.getElementById('biggerBtn');

let width = 0;
let height = 0;
let stars = 0;
let round = 1;
let maxNumber = 5;
let target = 3;
let answered = false;
let particles = [];
let lastTime = performance.now();
let recentTargets = [];

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function pickTarget() {
    const candidates = [];
    for (let n = 1; n <= maxNumber; n++) {
        if (!recentTargets.includes(n)) candidates.push(n);
    }
    const pool = candidates.length ? candidates : Array.from({ length: maxNumber }, (_, i) => i + 1);
    const number = randomItem(pool);
    recentTargets.push(number);
    if (recentTargets.length > Math.min(4, maxNumber)) recentTargets.shift();
    return number;
}

function makeCounts() {
    const counts = new Set([target]);
    const near = shuffle([target - 1, target + 1, target - 2, target + 2]).filter(n => n >= 1 && n <= maxNumber);
    for (const n of near) {
        if (counts.size >= 4) break;
        counts.add(n);
    }
    while (counts.size < 4) counts.add(randomInt(1, maxNumber));
    return shuffle([...counts]);
}

function renderRound(announce = false) {
    target = pickTarget();
    answered = false;
    targetNumberEl.textContent = target;
    groupsEl.innerHTML = '';
    setFeedback('Which group has the same amount?');
    updateScore();

    const icon = randomItem(OBJECTS);
    for (const count of makeCounts()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'group-btn';
        button.setAttribute('aria-label', `${count} objects`);
        button.dataset.count = String(count);

        const grid = document.createElement('div');
        grid.className = 'object-grid';
        for (let i = 0; i < count; i++) {
            const object = document.createElement('span');
            object.className = 'count-object';
            object.textContent = icon;
            object.style.animationDelay = `${i * 0.08}s`;
            grid.appendChild(object);
        }
        button.appendChild(grid);
        button.addEventListener('click', () => chooseGroup(count, button));
        groupsEl.appendChild(button);
    }

    if (announce) speakPrompt();
}

function chooseGroup(count, button) {
    if (answered) return;

    if (count !== target) {
        button.classList.add('wrong');
        setFeedback(`Try again. Count slowly to ${target}.`, 'try');
        speak(`Try again. Find ${target}.`, false);
        window.setTimeout(() => button.classList.remove('wrong'), 500);
        return;
    }

    answered = true;
    stars += 1;
    button.classList.add('correct');
    for (const groupButton of groupsEl.querySelectorAll('.group-btn')) groupButton.disabled = true;
    setFeedback(`Yes! That group has ${target}.`, 'good');
    updateScore();
    burst(button);
    speak(`Yes! ${target}. Great counting!`, true);
    window.setTimeout(() => {
        round += 1;
        renderRound(false);
    }, 1550);
}

function setFeedback(text, cls = '') {
    feedbackEl.textContent = text;
    feedbackEl.className = cls;
}

function updateScore() {
    starsTextEl.textContent = `Stars ${stars}`;
    roundTextEl.textContent = `Round ${round}`;
}

function numberWords(n) {
    return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] || String(n);
}

function speakPrompt() {
    const countText = Array.from({ length: target }, (_, i) => numberWords(i + 1)).join(', ');
    speak(`Find ${numberWords(target)}. Count with me. ${countText}.`, false);
}

function speak(text, happy) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = happy ? 0.86 : 0.74;
    utterance.pitch = happy ? 1.18 : 1.04;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
}

function setLevel(nextMax) {
    maxNumber = nextMax;
    easyBtn.classList.toggle('active', maxNumber === 5);
    biggerBtn.classList.toggle('active', maxNumber === 9);
    recentTargets = [];
    round = 1;
    renderRound(true);
}

function burst(button) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const colors = ['#fff08f', '#8dffb8', '#82e9ff', '#ff9dea', '#ffffff', '#ffb34d'];
    for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 330;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.58 + Math.random() * 0.76,
            size: 4 + Math.random() * 10,
            color: randomItem(colors),
            spin: -5 + Math.random() * 10
        });
    }
}

function drawParticles(dt) {
    ctx.clearRect(0, 0, width, height);
    particles = particles.filter(p => {
        p.age += dt;
        p.vy += 360 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = Math.min(1, p.age / p.life);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * p.age);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 15 * (1 - t);
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return p.age < p.life;
    });
}

function loop(now) {
    const dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;
    drawParticles(dt);
    requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
hearBtn.addEventListener('click', speakPrompt);
nextBtn.addEventListener('click', () => {
    round += 1;
    renderRound(true);
});
easyBtn.addEventListener('click', () => setLevel(5));
biggerBtn.addEventListener('click', () => setLevel(9));
window.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        round += 1;
        renderRound(true);
    }
    if (event.key === '1') setLevel(5);
    if (event.key === '2') setLevel(9);
});

resize();
renderRound(false);
requestAnimationFrame(loop);
