'use strict';

const WORD_BANK = [
    { word: 'BIRD', icon: '🐦', hint: 'A bird can fly.' },
    { word: 'BOOK', icon: '📘', hint: 'A book has pages.' },
    { word: 'CAKE', icon: '🎂', hint: 'Cake is a sweet treat.' },
    { word: 'DUCK', icon: '🦆', hint: 'A duck says quack.' },
    { word: 'FISH', icon: '🐟', hint: 'A fish swims.' },
    { word: 'FROG', icon: '🐸', hint: 'A frog jumps.' },
    { word: 'LION', icon: '🦁', hint: 'A lion roars.' },
    { word: 'MOON', icon: '🌙', hint: 'The moon shines at night.' },
    { word: 'STAR', icon: '⭐', hint: 'A star twinkles.' },
    { word: 'TREE', icon: '🌳', hint: 'A tree has leaves.' },
    { word: 'BEAR', icon: '🐻', hint: 'A bear is big and furry.' },
    { word: 'MILK', icon: '🥛', hint: 'Milk is in a cup.' },
    { word: 'SHIP', icon: '🚢', hint: 'A ship sails on water.' },
    { word: 'TRAIN', icon: '🚂', hint: 'A train runs on tracks.' },
    { word: 'APPLE', icon: '🍎', hint: 'An apple is a crunchy fruit.' },
    { word: 'HOUSE', icon: '🏠', hint: 'A house is a home.' },
    { word: 'CHAIR', icon: '🪑', hint: 'A chair is for sitting.' },
    { word: 'CLOUD', icon: '☁️', hint: 'A cloud floats in the sky.' },
    { word: 'HORSE', icon: '🐴', hint: 'A horse can gallop.' },
    { word: 'PIZZA', icon: '🍕', hint: 'Pizza has slices.' },
    { word: 'ROBOT', icon: '🤖', hint: 'A robot says beep.' },
    { word: 'SNAKE', icon: '🐍', hint: 'A snake slithers.' },
    { word: 'TIGER', icon: '🐯', hint: 'A tiger has stripes.' },
    { word: 'WHALE', icon: '🐳', hint: 'A whale swims in the ocean.' }
];

const PRAISE = [
    'Great reading!',
    'You found it!',
    'Super eyes!',
    'Wonderful word!',
    'You matched the picture!'
];

const canvas = document.getElementById('celebration-canvas');
const ctx = canvas.getContext('2d');
const targetIconEl = document.getElementById('target-icon');
const optionsEl = document.getElementById('word-options');
const feedbackEl = document.getElementById('feedback');
const scoreTextEl = document.getElementById('scoreText');
const roundTextEl = document.getElementById('roundText');
const hearBtn = document.getElementById('hearBtn');
const nextBtn = document.getElementById('nextBtn');

let width = 0;
let height = 0;
let score = 0;
let round = 1;
let current = null;
let choices = [];
let answered = false;
let particles = [];
let floatingIcons = [];
let lastTime = performance.now();
let recentWords = [];

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

function pickRoundWord() {
    const pool = WORD_BANK.filter(item => !recentWords.includes(item.word));
    const item = randomItem(pool.length ? pool : WORD_BANK);
    recentWords.push(item.word);
    if (recentWords.length > 8) recentWords.shift();
    return item;
}

function makeChoices(answer) {
    const sameLength = WORD_BANK.filter(item => item.word !== answer.word && item.word.length === answer.word.length);
    const mixed = WORD_BANK.filter(item => item.word !== answer.word && item.word.length >= 4 && item.word.length <= 5);
    const distractors = [];

    for (const item of shuffle(sameLength)) {
        if (distractors.length < 2) distractors.push(item.word);
    }
    for (const item of shuffle(mixed)) {
        if (distractors.length >= 3) break;
        if (!distractors.includes(item.word)) distractors.push(item.word);
    }

    return shuffle([answer.word, ...distractors]).slice(0, 4);
}

function setFeedback(message, cls = '') {
    feedbackEl.textContent = message;
    feedbackEl.className = cls;
}

function updateProgress() {
    scoreTextEl.textContent = `Stars: ${score}`;
    roundTextEl.textContent = `Round ${round}`;
}

function renderRound() {
    current = pickRoundWord();
    choices = makeChoices(current);
    answered = false;
    targetIconEl.textContent = current.icon;
    targetIconEl.setAttribute('aria-label', current.word.toLowerCase());
    optionsEl.innerHTML = '';

    for (const word of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'word-choice';
        button.textContent = word;
        button.setAttribute('aria-label', word.toLowerCase().split('').join(' '));
        button.addEventListener('click', () => chooseWord(word, button));
        optionsEl.appendChild(button);
    }

    setFeedback('Which word matches the picture?');
    updateProgress();
    speak(current.word, false);
}

function chooseWord(word, button) {
    if (answered) return;

    if (word === current.word) {
        answered = true;
        score += 1;
        button.classList.add('correct');
        for (const other of optionsEl.querySelectorAll('.word-choice')) {
            if (other !== button) other.classList.add('dimmed');
            other.disabled = true;
        }
        setFeedback(`${randomItem(PRAISE)} ${current.icon} is ${current.word}.`, 'good');
        updateProgress();
        speak(current.word, true);
        burst(button);
        iconParty();
        window.setTimeout(nextRound, 1350);
        return;
    }

    button.classList.add('wrong');
    button.disabled = true;
    setFeedback(`Try again. ${current.hint}`, 'try');
    window.setTimeout(() => button.classList.remove('wrong'), 500);
}

function nextRound() {
    round += 1;
    renderRound();
}

function speak(text, happy) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
    utterance.rate = happy ? 0.82 : 0.72;
    utterance.pitch = happy ? 1.25 : 1.05;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
}

function burst(button) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const colors = ['#ffef7d', '#7dffab', '#79e8ff', '#f7a5ff', '#ff9fb8'];

    for (let i = 0; i < 56; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 340;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.7 + Math.random() * 0.65,
            size: 5 + Math.random() * 12,
            color: randomItem(colors),
            spin: -4 + Math.random() * 8
        });
    }
}

function iconParty() {
    for (let i = 0; i < 22; i++) {
        floatingIcons.push({
            icon: current.icon,
            x: width / 2 + (-120 + Math.random() * 240),
            y: height / 2 + (-80 + Math.random() * 80),
            vx: -60 + Math.random() * 120,
            vy: -180 - Math.random() * 180,
            age: 0,
            life: 1.4 + Math.random() * 1.2,
            size: 32 + Math.random() * 38,
            rotate: -0.4 + Math.random() * 0.8
        });
    }
}

function updateAndDrawParticles(dt) {
    ctx.clearRect(0, 0, width, height);

    particles = particles.filter(p => {
        p.age += dt;
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = Math.min(1, p.age / p.life);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * p.age);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        return p.age < p.life;
    });

    floatingIcons = floatingIcons.filter(icon => {
        icon.age += dt;
        icon.vy += 160 * dt;
        icon.x += icon.vx * dt;
        icon.y += icon.vy * dt;
        const t = Math.min(1, icon.age / icon.life);
        ctx.save();
        ctx.translate(icon.x, icon.y);
        ctx.rotate(icon.rotate * Math.sin(icon.age * 4));
        ctx.globalAlpha = 1 - t;
        ctx.font = `${icon.size}px Segoe UI Emoji, Apple Color Emoji, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon.icon, 0, 0);
        ctx.restore();
        return icon.age < icon.life;
    });
}

function loop(now) {
    const dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;
    updateAndDrawParticles(dt);
    requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
hearBtn.addEventListener('click', () => speak(current.word, false));
nextBtn.addEventListener('click', nextRound);
window.addEventListener('keydown', event => {
    const index = Number(event.key) - 1;
    if (index >= 0 && index < choices.length) {
        const button = optionsEl.querySelectorAll('.word-choice')[index];
        if (button) chooseWord(choices[index], button);
    }
    if (event.key === 'Enter') nextRound();
});

resize();
renderRound();
requestAnimationFrame(loop);
