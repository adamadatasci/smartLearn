'use strict';

const CONFIG = {
    minNumber: 0,
    maxAnswer: 9,
    floatingNumbers: 10,
    numberMinSize: 38,
    numberMaxSize: 72,
    speedMin: 28,
    speedMax: 78,
    nextRoundDelayMs: 1700,
    celebrationCount: 150
};

const THEMES = [
    { name: 'eggs', icon: '🥚' },
    { name: 'oranges', icon: '🍊' },
    { name: 'carrots', icon: '🥕' },
    { name: 'apples', icon: '🍎' },
    { name: 'bananas', icon: '🍌' },
    { name: 'strawberries', icon: '🍓' },
    { name: 'cookies', icon: '🍪' },
    { name: 'stars', icon: '⭐' },
    { name: 'ducks', icon: '🦆' },
    { name: 'fish', icon: '🐟' }
];

const canvas = document.getElementById('eggmath-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const objectEquationEl = document.getElementById('objectEquation');
const numberEquationEl = document.getElementById('numberEquation');
const celebrationEl = document.getElementById('celebration');
const celebrationTextEl = document.getElementById('celebrationText');
const restartBtn = document.getElementById('restartBtn');

let width = 0;
let height = 0;
let numbers = [];
let confetti = [];
let animationFrame = null;
let currentProblem = null;
let acceptingInput = true;

const bubbleColors = [
    '#ff6f91', '#ffc75f', '#f9f871', '#7dffb2', '#71e5ff', '#b39dff',
    '#ff9de2', '#ff9671', '#c7f464', '#7afcff'
];

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

function makeObjectGroup(icon, count) {
    const group = document.createElement('div');
    group.className = 'object-group';

    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'object-icon';
        span.textContent = icon;
        span.style.animationDelay = `${i * 0.12}s`;
        group.appendChild(span);
    }

    return group;
}

function makeOperator(text, className) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
}

function buildProblem() {
    const theme = choice(THEMES);
    const operation = Math.random() < 0.55 ? '+' : '-';
    let left;
    let right;
    let result;
    let missingSlot;
    let answer;

    if (operation === '+') {
        result = Math.floor(rand(3, CONFIG.maxAnswer + 1));
        left = Math.floor(rand(1, result));
        right = result - left;
        missingSlot = choice(['left', 'right', 'result']);
    } else {
        left = Math.floor(rand(3, CONFIG.maxAnswer + 1));
        right = Math.floor(rand(1, left));
        result = left - right;
        missingSlot = choice(['left', 'right', 'result']);
    }

    if (missingSlot === 'left') answer = left;
    if (missingSlot === 'right') answer = right;
    if (missingSlot === 'result') answer = result;

    return { theme, operation, left, right, result, missingSlot, answer };
}

function renderObjectEquation(problem) {
    objectEquationEl.replaceChildren();

    objectEquationEl.appendChild(makeObjectGroup(problem.theme.icon, problem.left));
    objectEquationEl.appendChild(makeOperator(problem.operation, 'operator'));
    objectEquationEl.appendChild(makeObjectGroup(problem.theme.icon, problem.right));
    objectEquationEl.appendChild(makeOperator('=', 'equals'));
    objectEquationEl.appendChild(makeObjectGroup(problem.theme.icon, problem.result));
}

function numberPart(value, slot) {
    if (currentProblem.missingSlot === slot) {
        const span = document.createElement('span');
        span.className = 'missing';
        span.textContent = '?';
        return span;
    }

    return document.createTextNode(String(value));
}

function renderNumberEquation(problem) {
    numberEquationEl.replaceChildren();
    numberEquationEl.appendChild(numberPart(problem.left, 'left'));
    numberEquationEl.appendChild(document.createTextNode(` ${problem.operation} `));
    numberEquationEl.appendChild(numberPart(problem.right, 'right'));
    numberEquationEl.appendChild(document.createTextNode(' = '));
    numberEquationEl.appendChild(numberPart(problem.result, 'result'));
}

function createFloatingNumber(value) {
    const radius = rand(CONFIG.numberMinSize, CONFIG.numberMaxSize) * 0.5;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(CONFIG.speedMin, CONFIG.speedMax);

    return {
        value,
        x: rand(radius, width - radius),
        y: rand(radius, height - radius),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        color: choice(bubbleColors),
        pulse: rand(0, Math.PI * 2)
    };
}

function setupFloatingNumbers(answer) {
    const values = new Set([answer]);
    while (values.size < CONFIG.floatingNumbers) {
        values.add(Math.floor(rand(CONFIG.minNumber, CONFIG.maxAnswer + 1)));
    }

    numbers = [...values]
        .sort(() => Math.random() - 0.5)
        .map(createFloatingNumber);
}

function startRound() {
    currentProblem = buildProblem();
    acceptingInput = true;
    confetti = [];
    celebrationEl.classList.add('hidden');

    renderObjectEquation(currentProblem);
    renderNumberEquation(currentProblem);
    setupFloatingNumbers(currentProblem.answer);

    setStatus(`How many ${currentProblem.theme.name}? Press the missing number.`);
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#131b3d');
    gradient.addColorStop(1, '#050711');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function updateFloatingNumbers(dt) {
    for (const number of numbers) {
        number.pulse += dt * 2.2;
        number.x += number.vx * dt;
        number.y += number.vy * dt;

        if (number.x - number.radius <= 0) {
            number.x = number.radius;
            number.vx = Math.abs(number.vx);
        } else if (number.x + number.radius >= width) {
            number.x = width - number.radius;
            number.vx = -Math.abs(number.vx);
        }

        if (number.y - number.radius <= 0) {
            number.y = number.radius;
            number.vy = Math.abs(number.vy);
        } else if (number.y + number.radius >= height) {
            number.y = height - number.radius;
            number.vy = -Math.abs(number.vy);
        }
    }
}

function drawFloatingNumbers() {
    for (const number of numbers) {
        const pulseRadius = number.radius * (1 + Math.sin(number.pulse) * 0.07);

        ctx.save();
        ctx.beginPath();
        ctx.arc(number.x, number.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = number.color;
        ctx.shadowColor = number.color;
        ctx.shadowBlur = 22;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.76)';
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${pulseRadius * 1.1}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(number.value), number.x, number.y + 1);
        ctx.restore();
    }
}

function createConfettiPiece(icon = null) {
    const side = Math.floor(rand(0, 4));
    let x;
    let y;

    if (side === 0) { x = rand(0, width); y = -30; }
    else if (side === 1) { x = width + 30; y = rand(0, height); }
    else if (side === 2) { x = rand(0, width); y = height + 30; }
    else { x = -30; y = rand(0, height); }

    const targetX = rand(width * 0.1, width * 0.9);
    const targetY = rand(height * 0.1, height * 0.9);
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = rand(260, 760);

    return {
        icon,
        x,
        y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        age: 0,
        life: rand(1.2, 2.6),
        size: rand(18, 48),
        color: choice(bubbleColors),
        spin: rand(-4, 4),
        angle: rand(0, Math.PI * 2)
    };
}

function startCelebration() {
    celebrationTextEl.textContent = '🎉 Great job! 🎉';
    celebrationEl.classList.remove('hidden');
    confetti = [];

    for (let i = 0; i < CONFIG.celebrationCount; i++) {
        const icon = Math.random() < 0.45 ? currentProblem.theme.icon : null;
        confetti.push(createConfettiPiece(icon));
    }
}

function updateAndDrawConfetti(dt) {
    confetti = confetti.filter(piece => {
        piece.age += dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.vy += 140 * dt;
        piece.angle += piece.spin * dt;

        const alpha = Math.max(0, 1 - piece.age / piece.life);
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.angle);
        ctx.globalAlpha = alpha;

        if (piece.icon) {
            ctx.font = `${piece.size}px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(piece.icon, 0, 0);
        } else {
            ctx.fillStyle = piece.color;
            ctx.fillRect(-piece.size * 0.4, -piece.size * 0.4, piece.size * 0.8, piece.size * 0.8);
        }

        ctx.restore();
        return piece.age < piece.life;
    });
}

function handleNumberInput(value) {
    if (!acceptingInput || !currentProblem) return;

    if (value !== currentProblem.answer) {
        setStatus(`Try again. ${value} is not the missing number.`, 'warn');
        return;
    }

    acceptingInput = false;
    setStatus('Correct! Celebration time!', 'success');
    startCelebration();

    setTimeout(startRound, CONFIG.nextRoundDelayMs);
}

function onKeyDown(event) {
    if (!/^\d$/.test(event.key)) return;
    handleNumberInput(Number(event.key));
}

function numberAtPoint(x, y) {
    for (let i = numbers.length - 1; i >= 0; i--) {
        const number = numbers[i];
        if (Math.hypot(x - number.x, y - number.y) <= number.radius) {
            return number;
        }
    }
    return null;
}

function onCanvasClick(event) {
    const number = numberAtPoint(event.clientX, event.clientY);
    if (number) {
        handleNumberInput(number.value);
    }
}

function loop(now) {
    if (!loop.last) loop.last = now;
    const dt = Math.min((now - loop.last) / 1000, 0.05);
    loop.last = now;

    drawBackground();
    updateFloatingNumbers(dt);
    drawFloatingNumbers();
    updateAndDrawConfetti(dt);

    animationFrame = requestAnimationFrame(loop);
}

restartBtn.addEventListener('click', startRound);
window.addEventListener('resize', resize);
window.addEventListener('keydown', onKeyDown);
canvas.addEventListener('click', onCanvasClick);

resize();
startRound();
animationFrame = requestAnimationFrame(loop);
