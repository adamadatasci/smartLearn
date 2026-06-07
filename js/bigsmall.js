'use strict';

const ITEMS = ['🐶', '🐱', '🚗', '🦆', '⭐', '🍎', '🧸', '⚽', '🐠', '🌼', '🚀', '🍪'];
const SIZE_SETS = {
    3: [82, 124, 168],
    4: [72, 106, 140, 176]
};

const canvas = document.getElementById('party-canvas');
const ctx = canvas.getContext('2d');
const objectRowEl = document.getElementById('object-row');
const cellRowEl = document.getElementById('cell-row');
const feedbackEl = document.getElementById('feedback');
const starsTextEl = document.getElementById('starsText');
const roundTextEl = document.getElementById('roundText');
const hearBtn = document.getElementById('hearBtn');
const nextBtn = document.getElementById('nextBtn');

let width = 0;
let height = 0;
let stars = 0;
let round = 1;
let currentItem = '🐶';
let objects = [];
let nextIndex = 0;
let particles = [];
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

function updateScore() {
    starsTextEl.textContent = `Stars ${stars}`;
    roundTextEl.textContent = `Round ${round}`;
}

function setFeedback(text, cls = '') {
    feedbackEl.textContent = text;
    feedbackEl.className = cls;
}

function renderRound(announce = false) {
    const count = Math.random() < 0.58 ? 3 : 4;
    const sizes = SIZE_SETS[count];
    currentItem = randomItem(ITEMS);
    nextIndex = 0;
    objects = shuffle(sizes.map((size, order) => ({ id: `${Date.now()}-${order}`, size, order })));

    objectRowEl.innerHTML = '';
    cellRowEl.innerHTML = '';

    for (const object of objects) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sort-object';
        button.textContent = currentItem;
        button.style.setProperty('--object-size', `${object.size}px`);
        button.dataset.order = String(object.order);
        button.setAttribute('aria-label', `${sizeWord(object.order, count)} ${currentItem}`);
        button.addEventListener('click', () => chooseObject(object.order, button));
        objectRowEl.appendChild(button);
    }

    sizes.forEach((size, index) => {
        const cell = document.createElement('div');
        cell.className = `size-cell${index === 0 ? ' next' : ''}`;
        cell.style.setProperty('--cell-size', `${size}px`);
        cell.textContent = '?';
        cell.setAttribute('aria-label', `cell ${index + 1}, ${sizeWord(index, count)}`);
        cellRowEl.appendChild(cell);
    });

    setFeedback('Click the smallest object first.');
    updateScore();
    if (announce) speakPrompt();
}

function chooseObject(order, button) {
    if (button.classList.contains('used')) return;

    if (order !== nextIndex) {
        button.classList.add('wrong');
        setFeedback('Try again. Start with the smallest one.', 'try');
        speak('Try again. Pick the smallest next.', false);
        window.setTimeout(() => button.classList.remove('wrong'), 520);
        return;
    }

    const cells = [...cellRowEl.querySelectorAll('.size-cell')];
    const cell = cells[nextIndex];
    cell.textContent = currentItem;
    cell.classList.remove('next');
    cell.classList.add('filled');
    button.classList.add('used');
    burst(cell);
    nextIndex += 1;

    if (nextIndex < cells.length) {
        cells[nextIndex].classList.add('next');
        setFeedback(nextIndex === 1 ? 'Good. Now pick the next bigger one.' : 'Great. Keep going bigger!', 'good');
        speak(nextIndex === 1 ? 'Good. Now the next bigger one.' : 'Keep going bigger.', true);
        return;
    }

    stars += 1;
    updateScore();
    setFeedback('You did it! Small to big!', 'good');
    speak('You did it! Small to big!', true);
    burst(cellRowEl);
    window.setTimeout(() => {
        round += 1;
        renderRound(false);
    }, 1600);
}

function sizeWord(index, count) {
    if (index === 0) return 'smallest';
    if (index === count - 1) return 'biggest';
    return index === 1 ? 'bigger' : 'even bigger';
}

function speakPrompt() {
    speak('Click from smallest to biggest. Small, bigger, biggest.', false);
}

function speak(text, happy) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = happy ? 0.88 : 0.74;
    utterance.pitch = happy ? 1.2 : 1.04;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
}

function burst(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const colors = ['#fff08f', '#8dffb8', '#82e9ff', '#ff9dea', '#ffffff', '#ffb34d'];
    for (let i = 0; i < 34; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 300;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.55 + Math.random() * 0.72,
            size: 4 + Math.random() * 9,
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

hearBtn.addEventListener('click', speakPrompt);
nextBtn.addEventListener('click', () => {
    round += 1;
    renderRound(true);
});
window.addEventListener('resize', resize);
window.addEventListener('keydown', event => {
    const number = Number(event.key);
    if (number >= 1 && number <= objects.length) {
        const button = objectRowEl.querySelectorAll('.sort-object')[number - 1];
        if (button) button.click();
    }
    if (event.key === 'Enter') {
        round += 1;
        renderRound(true);
    }
});

resize();
renderRound(false);
requestAnimationFrame(loop);
