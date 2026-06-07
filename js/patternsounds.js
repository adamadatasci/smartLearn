'use strict';

const SHAPES = [
    { type: 'circle', name: 'circle', label: '●' },
    { type: 'square', name: 'square', label: '■' },
    { type: 'triangle', name: 'triangle', label: '▲' },
    { type: 'star', name: 'star', label: '★' }
];

const LETTERS = [
    { letter: 'A', sound: '/a/', word: 'APPLE', icon: '🍎' },
    { letter: 'B', sound: '/b/', word: 'BALL', icon: '🏀' },
    { letter: 'C', sound: '/c/', word: 'CAT', icon: '🐱' },
    { letter: 'D', sound: '/d/', word: 'DOG', icon: '🐶' },
    { letter: 'F', sound: '/f/', word: 'FISH', icon: '🐟' },
    { letter: 'H', sound: '/h/', word: 'HAT', icon: '🎩' },
    { letter: 'L', sound: '/l/', word: 'LION', icon: '🦁' },
    { letter: 'M', sound: '/m/', word: 'MOON', icon: '🌙' },
    { letter: 'P', sound: '/p/', word: 'PIZZA', icon: '🍕' },
    { letter: 'S', sound: '/s/', word: 'SUN', icon: '☀️' },
    { letter: 'T', sound: '/t/', word: 'TREE', icon: '🌳' },
    { letter: 'W', sound: '/w/', word: 'WHALE', icon: '🐳' }
];

const canvas = document.getElementById('party-canvas');
const ctx = canvas.getContext('2d');
const patternRowEl = document.getElementById('pattern-row');
const letterCardEl = document.getElementById('letter-card');
const targetLetterEl = document.getElementById('target-letter');
const letterSoundTextEl = document.getElementById('letter-sound-text');
const choicesEl = document.getElementById('choices');
const feedbackEl = document.getElementById('feedback');
const starsTextEl = document.getElementById('starsText');
const modeTextEl = document.getElementById('modeText');
const instructionEl = document.getElementById('instruction');
const patternModeBtn = document.getElementById('patternModeBtn');
const letterModeBtn = document.getElementById('letterModeBtn');
const hearBtn = document.getElementById('hearBtn');
const nextBtn = document.getElementById('nextBtn');

let mode = 'pattern';
let width = 0;
let height = 0;
let stars = 0;
let challenge = null;
let answered = false;
let particles = [];
let lastTime = performance.now();
let recentPatternAnswers = [];
let recentLetters = [];

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

function setFeedback(text, cls = '') {
    feedbackEl.textContent = text;
    feedbackEl.className = cls;
}

function updateScore() {
    starsTextEl.textContent = `Stars ${stars}`;
    modeTextEl.textContent = mode === 'pattern' ? 'Patterns' : 'Letters';
}

function shapeMarkup(type) {
    if (type === 'star') return '<span class="shape-star">★</span>';
    return `<span class="shape-icon shape-${type}"></span>`;
}

function makePatternChallenge() {
    const patterns = [
        ['circle', 'square'],
        ['triangle', 'circle'],
        ['square', 'star'],
        ['circle', 'triangle', 'square'],
        ['star', 'circle', 'square']
    ];
    let base = randomItem(patterns);
    let full = [];
    while (full.length < 6) full = full.concat(base);
    full = full.slice(0, 5);
    const answer = full[full.length - 1];
    const visible = full.slice(0, -1);

    if (recentPatternAnswers.includes(answer) && Math.random() < 0.45) {
        return makePatternChallenge();
    }
    recentPatternAnswers.push(answer);
    if (recentPatternAnswers.length > 4) recentPatternAnswers.shift();

    return { answer, visible };
}

function renderPatternRound() {
    challenge = makePatternChallenge();
    answered = false;
    patternRowEl.classList.remove('hidden');
    letterCardEl.classList.add('hidden');
    instructionEl.textContent = 'What comes next? Look at the pattern and choose the missing shape.';
    patternRowEl.innerHTML = '';
    choicesEl.innerHTML = '';

    for (const type of challenge.visible) {
        const slot = document.createElement('div');
        slot.className = 'pattern-slot';
        slot.innerHTML = shapeMarkup(type);
        patternRowEl.appendChild(slot);
    }

    const missing = document.createElement('div');
    missing.className = 'pattern-slot missing';
    missing.textContent = '?';
    patternRowEl.appendChild(missing);

    const choices = shuffle(SHAPES);
    for (const shape of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice-btn';
        button.innerHTML = shapeMarkup(shape.type);
        button.setAttribute('aria-label', shape.name);
        button.addEventListener('click', () => choosePattern(shape.type, button));
        choicesEl.appendChild(button);
    }

    setFeedback('Choose the next shape.');
    updateScore();
}

function choosePattern(type, button) {
    if (answered) return;
    if (type !== challenge.answer) {
        button.classList.add('wrong');
        setFeedback('Try again. Look: the pattern repeats.', 'try');
        window.setTimeout(() => button.classList.remove('wrong'), 480);
        return;
    }

    answered = true;
    button.classList.add('correct');
    revealMissingShape(type);
    completeCorrect(button, `${shapeName(type)} comes next!`);
}

function revealMissingShape(type) {
    const missing = patternRowEl.querySelector('.missing');
    if (!missing) return;
    missing.classList.remove('missing');
    missing.innerHTML = shapeMarkup(type);
}

function shapeName(type) {
    return SHAPES.find(shape => shape.type === type)?.name || type;
}

function makeLetterChallenge() {
    const pool = LETTERS.filter(item => !recentLetters.includes(item.letter));
    const target = randomItem(pool.length ? pool : LETTERS);
    recentLetters.push(target.letter);
    if (recentLetters.length > 6) recentLetters.shift();

    const distractors = shuffle(LETTERS.filter(item => item.letter !== target.letter)).slice(0, 3);
    return { target, choices: shuffle([target, ...distractors]) };
}

function renderLetterRound() {
    challenge = makeLetterChallenge();
    answered = false;
    patternRowEl.classList.add('hidden');
    letterCardEl.classList.remove('hidden');
    targetLetterEl.textContent = challenge.target.letter;
    letterSoundTextEl.textContent = `${challenge.target.letter} says ${challenge.target.sound}`;
    instructionEl.textContent = `Which picture starts with ${challenge.target.letter}?`;
    choicesEl.innerHTML = '';

    for (const item of challenge.choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice-btn';
        button.innerHTML = `<span class="choice-label"><span class="big-icon">${item.icon}</span><span>${item.word}</span></span>`;
        button.setAttribute('aria-label', item.word.toLowerCase());
        button.addEventListener('click', () => chooseLetter(item, button));
        choicesEl.appendChild(button);
    }

    setFeedback('Tap the picture with the same starting sound.');
    updateScore();
    speak(`${challenge.target.letter}. ${challenge.target.letter} says ${challenge.target.sound}`, false);
}

function chooseLetter(item, button) {
    if (answered) return;
    if (item.letter !== challenge.target.letter) {
        button.classList.add('wrong');
        setFeedback(`Try again. ${challenge.target.letter} starts ${challenge.target.word}.`, 'try');
        window.setTimeout(() => button.classList.remove('wrong'), 480);
        speak(challenge.target.letter, false);
        return;
    }

    answered = true;
    button.classList.add('correct');
    completeCorrect(button, `${challenge.target.letter} is for ${challenge.target.word}! ${challenge.target.icon}`);
    speak(`${challenge.target.letter} is for ${challenge.target.word}`, true);
}

function completeCorrect(button, message) {
    stars += 1;
    updateScore();
    setFeedback(message, 'good');
    burst(button);
    for (const other of choicesEl.querySelectorAll('.choice-btn')) other.disabled = true;
    window.setTimeout(nextRound, 1450);
}

function burst(button) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const colors = ['#fff08f', '#8dffb8', '#82e9ff', '#ff9dea', '#ffffff'];
    for (let i = 0; i < 42; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 300;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.55 + Math.random() * 0.72,
            size: 4 + Math.random() * 10,
            color: randomItem(colors),
            spin: -6 + Math.random() * 12
        });
    }
}

function speak(text, happy) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
    utterance.rate = happy ? 0.84 : 0.72;
    utterance.pitch = happy ? 1.22 : 1.05;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
}

function hearCurrent() {
    if (mode === 'letter' && challenge) {
        speak(`${challenge.target.letter}. ${challenge.target.letter} says ${challenge.target.sound}. ${challenge.target.letter} is for ${challenge.target.word}`, false);
        return;
    }
    speak('What comes next in the pattern?', false);
}

function setMode(nextMode) {
    mode = nextMode;
    patternModeBtn.classList.toggle('active', mode === 'pattern');
    letterModeBtn.classList.toggle('active', mode === 'letter');
    nextRound();
}

function nextRound() {
    if (mode === 'pattern') renderPatternRound();
    else renderLetterRound();
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
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14 * (1 - t);
        ctx.fillStyle = p.color;
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
    updateAndDrawParticles(dt);
    requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
patternModeBtn.addEventListener('click', () => setMode('pattern'));
letterModeBtn.addEventListener('click', () => setMode('letter'));
hearBtn.addEventListener('click', hearCurrent);
nextBtn.addEventListener('click', nextRound);
window.addEventListener('keydown', event => {
    if (event.key === 'Enter') nextRound();
    if (event.key === '1') setMode('pattern');
    if (event.key === '2') setMode('letter');
});

resize();
renderPatternRound();
requestAnimationFrame(loop);
