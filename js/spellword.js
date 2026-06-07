'use strict';

const WORDS = [
    { word: 'CAT', icon: '🐱', hint: 'Cat starts with C.' },
    { word: 'DOG', icon: '🐶', hint: 'Dog starts with D.' },
    { word: 'SUN', icon: '☀️', hint: 'Sun starts with S.' },
    { word: 'CAR', icon: '🚗', hint: 'Car starts with C.' },
    { word: 'HAT', icon: '🎩', hint: 'Hat starts with H.' },
    { word: 'FISH', icon: '🐟', hint: 'Fish starts with F.' },
    { word: 'BIRD', icon: '🐦', hint: 'Bird starts with B.' },
    { word: 'BOOK', icon: '📘', hint: 'Book starts with B.' },
    { word: 'CAKE', icon: '🎂', hint: 'Cake starts with C.' },
    { word: 'DUCK', icon: '🦆', hint: 'Duck starts with D.' },
    { word: 'FROG', icon: '🐸', hint: 'Frog starts with F.' },
    { word: 'LION', icon: '🦁', hint: 'Lion starts with L.' },
    { word: 'MOON', icon: '🌙', hint: 'Moon starts with M.' },
    { word: 'STAR', icon: '⭐', hint: 'Star starts with S.' },
    { word: 'TREE', icon: '🌳', hint: 'Tree starts with T.' },
    { word: 'BEAR', icon: '🐻', hint: 'Bear starts with B.' },
    { word: 'MILK', icon: '🥛', hint: 'Milk starts with M.' },
    { word: 'SHIP', icon: '🚢', hint: 'Ship starts with S.' },
    { word: 'TRAIN', icon: '🚂', hint: 'Train starts with T.' },
    { word: 'APPLE', icon: '🍎', hint: 'Apple starts with A.' },
    { word: 'HOUSE', icon: '🏠', hint: 'House starts with H.' },
    { word: 'CHAIR', icon: '🪑', hint: 'Chair starts with C.' },
    { word: 'CLOUD', icon: '☁️', hint: 'Cloud starts with C.' },
    { word: 'HORSE', icon: '🐴', hint: 'Horse starts with H.' },
    { word: 'PIZZA', icon: '🍕', hint: 'Pizza starts with P.' },
    { word: 'ROBOT', icon: '🤖', hint: 'Robot starts with R.' },
    { word: 'SNAKE', icon: '🐍', hint: 'Snake starts with S.' },
    { word: 'TIGER', icon: '🐯', hint: 'Tiger starts with T.' },
    { word: 'WHALE', icon: '🐳', hint: 'Whale starts with W.' }
];

const PRAISE = ['Great spelling!', 'You built it!', 'Super letters!', 'Wonderful word!', 'You did it!'];
const MAX_WORD_LENGTH = 5;

const canvas = document.getElementById('party-canvas');
const ctx = canvas.getContext('2d');
const answerRowEl = document.getElementById('answer-row');
const letterBankEl = document.getElementById('letter-bank');
const iconStageEl = document.getElementById('icon-stage');
const wordIconEl = document.getElementById('word-icon');
const feedbackEl = document.getElementById('feedback');
const roundTextEl = document.getElementById('roundText');
const starsTextEl = document.getElementById('starsText');
const soundBtn = document.getElementById('soundBtn');
const clearBtn = document.getElementById('clearBtn');
const nextBtn = document.getElementById('nextBtn');

let width = 0;
let height = 0;
let current = null;
let round = 1;
let stars = 0;
let index = 0;
let selectedTiles = [];
let recentWords = [];
let particles = [];
let floatingIcons = [];
let lastTime = performance.now();

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

function pickWord() {
    const toddlerWords = WORDS.filter(item => item.word.length <= MAX_WORD_LENGTH);
    const pool = toddlerWords.filter(item => !recentWords.includes(item.word));
    const item = randomItem(pool.length ? pool : toddlerWords);
    recentWords.push(item.word);
    if (recentWords.length > 8) recentWords.shift();
    return item;
}

function setFeedback(text, cls = '') {
    feedbackEl.textContent = text;
    feedbackEl.className = cls;
}

function updateProgress() {
    roundTextEl.textContent = `Round ${round}`;
    starsTextEl.textContent = `Stars ${stars}`;
}

function renderRound() {
    current = pickWord();
    index = 0;
    selectedTiles = [];
    answerRowEl.innerHTML = '';
    letterBankEl.innerHTML = '';
    iconStageEl.classList.remove('show');
    wordIconEl.textContent = current.icon;
    iconStageEl.setAttribute('aria-hidden', 'false');

    for (let i = 0; i < current.word.length; i++) {
        const cell = document.createElement('div');
        cell.className = i === 0 ? 'answer-cell next' : 'answer-cell';
        cell.setAttribute('aria-label', `letter box ${i + 1}`);
        answerRowEl.appendChild(cell);
    }

    const letters = shuffle(current.word.split('').map((letter, letterIndex) => ({ letter, letterIndex })));
    letters.forEach((item, tileIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'letter-tile';
        button.textContent = item.letter;
        button.dataset.letter = item.letter;
        button.dataset.tileIndex = String(tileIndex);
        button.setAttribute('aria-label', `letter ${item.letter}`);
        button.addEventListener('click', () => chooseLetter(button));
        letterBankEl.appendChild(button);
    });

    setFeedback(`The picture is ${current.icon}. Start with the first sound.`);
    updateProgress();
}

function chooseLetter(button) {
    if (!current || index >= current.word.length || button.classList.contains('used')) return;

    const chosen = button.dataset.letter;
    const expected = current.word[index];

    if (chosen !== expected) {
        button.classList.add('wrong');
        setFeedback(`${current.hint} Try the letter ${expected}.`, 'try');
        window.setTimeout(() => button.classList.remove('wrong'), 470);
        speak(expected, false);
        return;
    }

    const cells = answerRowEl.querySelectorAll('.answer-cell');
    cells[index].textContent = chosen;
    cells[index].classList.add('filled');
    cells[index].classList.remove('next');
    button.classList.add('used');
    selectedTiles.push(button);
    popAtCell(cells[index], chosen);
    index += 1;

    if (index < current.word.length) {
        cells[index].classList.add('next');
        setFeedback(`Good. Now tap ${current.word[index]}.`);
        return;
    }

    completeWord();
}

function completeWord() {
    stars += 1;
    updateProgress();
    wordIconEl.textContent = current.icon;
    iconStageEl.classList.add('show');
    setFeedback(`${randomItem(PRAISE)} ${current.word} ${current.icon}`, 'good');
    speak(current.word, true);
    iconParty();
    window.setTimeout(() => {
        round += 1;
        renderRound();
    }, 1850);
}

function undoLetter() {
    if (index <= 0) return;
    const cells = answerRowEl.querySelectorAll('.answer-cell');
    if (index < cells.length) cells[index].classList.remove('next');
    index -= 1;
    cells[index].textContent = '';
    cells[index].classList.remove('filled');
    cells[index].classList.add('next');
    const tile = selectedTiles.pop();
    if (tile) tile.classList.remove('used');
    setFeedback(`Try ${current.word[index]} again.`);
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

function popAtCell(cell, letter) {
    const rect = cell.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const colors = ['#fff08f', '#8dffb8', '#82e9ff', '#ff9dea', '#ffffff'];

    for (let i = 0; i < 24; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 210;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.45 + Math.random() * 0.55,
            size: 4 + Math.random() * 9,
            color: randomItem(colors),
            text: i % 9 === 0 ? letter : '',
            spin: -6 + Math.random() * 12
        });
    }
}

function iconParty() {
    for (let i = 0; i < 34; i++) {
        floatingIcons.push({
            icon: current.icon,
            x: width / 2 + (-130 + Math.random() * 260),
            y: height / 2 + (-70 + Math.random() * 90),
            vx: -70 + Math.random() * 140,
            vy: -210 - Math.random() * 190,
            age: 0,
            life: 1.35 + Math.random() * 1.25,
            size: 28 + Math.random() * 42,
            rotate: -0.5 + Math.random() * 1
        });
    }
}

function updateAndDrawParticles(dt) {
    ctx.clearRect(0, 0, width, height);

    particles = particles.filter(p => {
        p.age += dt;
        p.vy += 340 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = Math.min(1, p.age / p.life);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * p.age);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14 * (1 - t);
        if (p.text) {
            ctx.font = `900 ${Math.max(12, p.size * 2.4)}px Segoe UI, Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text, 0, 0);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        return p.age < p.life;
    });

    floatingIcons = floatingIcons.filter(icon => {
        icon.age += dt;
        icon.vy += 150 * dt;
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
soundBtn.addEventListener('click', () => speak(current.word, false));
clearBtn.addEventListener('click', undoLetter);
nextBtn.addEventListener('click', nextRound);
window.addEventListener('keydown', event => {
    if (!current) return;
    if (event.key === 'Backspace') undoLetter();
    if (event.key === 'Enter') nextRound();
    const letter = event.key.toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return;
    const tile = Array.from(letterBankEl.querySelectorAll('.letter-tile'))
        .find(button => !button.classList.contains('used') && button.dataset.letter === letter);
    if (tile) chooseLetter(tile);
});

resize();
renderRound();
requestAnimationFrame(loop);
