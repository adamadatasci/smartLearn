'use strict';

const GRID_SIZE = 6;
const DIRECTIONS = [
    { key: 'up', symbol: '↑', dx: 0, dy: -1, name: 'up' },
    { key: 'right', symbol: '→', dx: 1, dy: 0, name: 'right' },
    { key: 'down', symbol: '↓', dx: 0, dy: 1, name: 'down' },
    { key: 'left', symbol: '←', dx: -1, dy: 0, name: 'left' }
];

const canvas = document.getElementById('fx-canvas');
const ctx = canvas.getContext('2d');
const gridEl = document.getElementById('grid');
const arrowStripEl = document.getElementById('arrow-strip');
const feedbackEl = document.getElementById('feedback');
const levelTextEl = document.getElementById('levelText');
const starsTextEl = document.getElementById('starsText');
const newBtn = document.getElementById('newBtn');
const showBtn = document.getElementById('showBtn');

let width = 0;
let height = 0;
let level = 1;
let stars = 0;
let start = { x: 0, y: 0 };
let answer = { x: 0, y: 0 };
let path = [];
let sequence = [];
let cells = [];
let solved = false;
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

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function choice(items) {
    return items[randomInt(items.length)];
}

function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
}

function inBounds(point) {
    return point.x >= 0 && point.x < GRID_SIZE && point.y >= 0 && point.y < GRID_SIZE;
}

function buildGrid() {
    gridEl.style.setProperty('--grid-size', GRID_SIZE);
    gridEl.innerHTML = '';
    cells = [];

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cell';
            cell.setAttribute('aria-label', `row ${y + 1}, column ${x + 1}`);
            cell.addEventListener('click', () => handleCellClick(x, y, cell));
            gridEl.appendChild(cell);
            cells.push(cell);
        }
    }
}

function cellAt(point) {
    return cells[point.y * GRID_SIZE + point.x];
}

function sequenceLength() {
    return Math.min(4 + Math.floor(level / 2), 11);
}

function makeRound() {
    solved = false;
    const length = sequenceLength();
    let attempts = 0;

    do {
        attempts += 1;
        start = { x: randomInt(GRID_SIZE), y: randomInt(GRID_SIZE) };
        let current = { ...start };
        path = [{ ...current }];
        sequence = [];

        for (let i = 0; i < length; i++) {
            const legal = DIRECTIONS.filter(dir => inBounds({ x: current.x + dir.dx, y: current.y + dir.dy }));
            const dir = choice(legal);
            sequence.push(dir);
            current = { x: current.x + dir.dx, y: current.y + dir.dy };
            path.push({ ...current });
        }

        answer = current;
    } while (sameCell(start, answer) && attempts < 20);

    renderRound();
}

function renderRound() {
    clearCellMarks();
    cellAt(start).classList.add('start');
    arrowStripEl.innerHTML = '';

    sequence.forEach((dir, index) => {
        const token = document.createElement('div');
        token.className = 'arrow-token';
        token.textContent = dir.symbol;
        token.setAttribute('aria-label', `step ${index + 1}: ${dir.name}`);
        arrowStripEl.appendChild(token);
    });

    levelTextEl.textContent = `Level ${level}`;
    starsTextEl.textContent = `Stars ${stars}`;
    setFeedback('Follow the arrows in your head. Tap the ending square!');
}

function clearCellMarks() {
    cells.forEach(cell => {
        cell.classList.remove('start', 'guess', 'answer', 'path', 'wrong');
    });
}

function setFeedback(text, type = '') {
    feedbackEl.textContent = text;
    feedbackEl.className = type;
}

function handleCellClick(x, y, cell) {
    if (solved) return;

    cells.forEach(item => item.classList.remove('guess', 'wrong'));
    cell.classList.add('guess');

    if (x === answer.x && y === answer.y) {
        solved = true;
        stars += 1;
        setFeedback('You got it! The arrows landed there. ⭐', 'good');
        starsTextEl.textContent = `Stars ${stars}`;
        revealPath(true);
        celebrate(cell);
        window.setTimeout(() => {
            level += 1;
            makeRound();
        }, 1500);
        return;
    }

    cell.classList.add('wrong');
    setFeedback('Almost! Try following the arrows again from the beating dot.', 'try');
}

function revealPath(animated = false) {
    clearCellMarks();
    cellAt(start).classList.add('start');
    cellAt(answer).classList.add('answer');

    const tokens = Array.from(arrowStripEl.children);
    tokens.forEach(token => token.classList.remove('current'));

    path.forEach((point, index) => {
        const delay = animated ? index * 150 : 0;
        window.setTimeout(() => {
            cellAt(point).classList.add('path');
            if (index > 0 && tokens[index - 1]) {
                tokens.forEach(token => token.classList.remove('current'));
                tokens[index - 1].classList.add('current');
            }
        }, delay);
    });
}

function celebrate(cell) {
    const rect = cell.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const colors = ['#8dffb8', '#83e7ff', '#ffe766', '#ff9dea', '#ffffff'];

    for (let i = 0; i < 64; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 360;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.75 + Math.random() * 0.75,
            size: 5 + Math.random() * 11,
            color: choice(colors),
            spin: -6 + Math.random() * 12
        });
    }
}

function updateAndDrawParticles(dt) {
    ctx.clearRect(0, 0, width, height);

    particles = particles.filter(p => {
        p.age += dt;
        p.vy += 440 * dt;
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
}

function loop(now) {
    const dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;
    updateAndDrawParticles(dt);
    requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
newBtn.addEventListener('click', makeRound);
showBtn.addEventListener('click', () => {
    setFeedback(`Path shown. The answer is row ${answer.y + 1}, column ${answer.x + 1}.`, 'try');
    revealPath(true);
});
window.addEventListener('keydown', event => {
    if (event.key === 'n' || event.key === 'N') makeRound();
    if (event.key === 's' || event.key === 'S') revealPath(true);
});

resize();
buildGrid();
makeRound();
requestAnimationFrame(loop);
