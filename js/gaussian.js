'use strict';

const canvas = document.getElementById('gaussian-canvas');
const ctx = canvas.getContext('2d');
const intro = document.getElementById('intro');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const dropBtn = document.getElementById('dropBtn');
const slowBtn = document.getElementById('slowBtn');
const fastBtn = document.getElementById('fastBtn');
const resetBtn = document.getElementById('resetBtn');
const statsPanel = document.getElementById('stats-panel');
const message = document.getElementById('message');

const TAU = Math.PI * 2;
const COLORS = ['#ff5d8f', '#ffb703', '#70e000', '#00d4ff', '#9b5de5', '#f15bb5', '#fee440', '#00f5d4'];
const BUCKETS = 17;
const ROWS = BUCKETS - 1;
const BALL_RADIUS = 5.8;
const PEG_RADIUS = 5;
const GRAVITY = 560;
const DRAG = 0.992;

let width = 0;
let height = 0;
let dpr = 1;
let running = false;
let paused = false;
let lastTime = performance.now();
let spawnTimer = 0;
let spawnEvery = 0.18;
let totalDropped = 0;
let dropRate = 1;
let board = null;
let balls = [];
let pegs = [];
let buckets = [];
let bucketCounts = Array(BUCKETS).fill(0);
let stars = [];
let messageIndex = 0;

const messages = [
    'Each peg bounce is random, like a left-or-right coin flip.',
    'The middle bucket has many possible paths, so it grows tallest.',
    'The red bell curve is the Gaussian approximation to the bucket counts.',
    'Mean μ marks the center. Standard deviation σ measures the spread.',
    'More balls make the bucket bars look smoother and more bell-shaped.'
];

function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutBoard();
    makeStars();
}

function layoutBoard() {
    const maxBoardWidth = Math.min(width * 0.82, 920);
    const boardWidth = Math.max(320, maxBoardWidth);
    const top = Math.max(96, height * 0.13);
    const bucketTop = height - Math.max(185, height * 0.26);
    const centerX = width / 2;
    const rowGap = Math.max(24, Math.min(40, (bucketTop - top - 30) / ROWS));
    const colGap = boardWidth / (BUCKETS - 1);
    const startY = top + 32;

    board = {
        x: centerX - boardWidth / 2,
        y: top,
        width: boardWidth,
        bucketTop,
        bucketHeight: height - bucketTop - 44,
        centerX,
        colGap,
        rowGap,
        startY
    };

    pegs = [];
    for (let row = 0; row < ROWS; row++) {
        const count = row + 1;
        const y = startY + row * rowGap;
        const firstX = centerX - (count - 1) * colGap / 2;
        for (let col = 0; col < count; col++) {
            pegs.push({
                x: firstX + col * colGap,
                y,
                row,
                col,
                pulse: Math.random() * TAU
            });
        }
    }

    buckets = [];
    const bucketWidth = boardWidth / BUCKETS;
    for (let i = 0; i < BUCKETS; i++) {
        buckets.push({
            x: board.x + i * bucketWidth,
            y: bucketTop,
            width: bucketWidth,
            height: board.bucketHeight,
            color: colorForBucket(i)
        });
    }
}

function colorForBucket(index) {
    const hue = 210 + (index / (BUCKETS - 1)) * 160;
    return `hsl(${hue}, 88%, 62%)`;
}

function makeStars() {
    const count = Math.round(Math.min(260, Math.max(100, width * height / 7600)));
    stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 1.5,
        alpha: 0.18 + Math.random() * 0.7,
        twinkle: Math.random() * TAU
    }));
}

function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function spawnBall(x = board.centerX + (-9 + Math.random() * 18), y = board.y - 14) {
    balls.push({
        x,
        y,
        vx: -5 + Math.random() * 10,
        vy: 12 + Math.random() * 18,
        r: BALL_RADIUS,
        color: randomColor(),
        trail: [],
        settled: false,
        row: 0,
        pathIndex: 0,
        targetX: board.centerX,
        spin: Math.random() * TAU,
        angular: -2.6 + Math.random() * 5.2
    });
    totalDropped += 1;
}

function spawnBurst(count) {
    for (let i = 0; i < count; i++) {
        window.setTimeout(() => {
            if (running) spawnBall();
        }, i * 42);
    }
}

function resetLab() {
    balls = [];
    bucketCounts = Array(BUCKETS).fill(0);
    totalDropped = 0;
    spawnTimer = 0;
    dropRate = 1;
    spawnEvery = 0.18;
}

function drawBackground(time) {
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.25, 0, width * 0.5, height * 0.4, Math.max(width, height));
    gradient.addColorStop(0, '#1d3674');
    gradient.addColorStop(0.46, '#071429');
    gradient.addColorStop(1, '#01030a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
        ctx.globalAlpha = star.alpha * (0.62 + 0.38 * Math.sin(time * 0.002 + star.twinkle));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawBoard(time) {
    drawFunnel();
    drawPegs(time);
    drawBuckets();
    drawGaussianCurve();
    drawMeanSigma();
}

function drawFunnel() {
    ctx.save();
    ctx.strokeStyle = 'rgba(157, 238, 255, 0.44)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(board.centerX - 92, board.y - 36);
    ctx.lineTo(board.centerX - 18, board.y + 18);
    ctx.moveTo(board.centerX + 92, board.y - 36);
    ctx.lineTo(board.centerX + 18, board.y + 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(105, 232, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(board.centerX - 92, board.y - 36);
    ctx.lineTo(board.centerX + 92, board.y - 36);
    ctx.lineTo(board.centerX + 18, board.y + 18);
    ctx.lineTo(board.centerX - 18, board.y + 18);
    ctx.closePath();
    ctx.fill();
    drawText('ball dropper', board.centerX, board.y - 48, '#bdf7ff', 13, 'center');
    ctx.restore();
}

function drawPegs(time) {
    for (const peg of pegs) {
        const glow = 0.35 + 0.16 * Math.sin(time * 0.004 + peg.pulse);
        ctx.fillStyle = `rgba(123, 232, 255, ${glow})`;
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PEG_RADIUS + 5, 0, TAU);
        ctx.fill();

        const pegGradient = ctx.createRadialGradient(peg.x - 2, peg.y - 2, 1, peg.x, peg.y, PEG_RADIUS);
        pegGradient.addColorStop(0, '#ffffff');
        pegGradient.addColorStop(0.35, '#91f0ff');
        pegGradient.addColorStop(1, '#2870ff');
        ctx.fillStyle = pegGradient;
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, TAU);
        ctx.fill();
    }
}

function drawBuckets() {
    const maxCount = Math.max(8, ...bucketCounts);
    for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i];
        const count = bucketCounts[i];
        const fillHeight = Math.min(bucket.height - 20, (count / maxCount) * (bucket.height - 26));
        const x = bucket.x + 2;
        const y = bucket.y + bucket.height - fillHeight;
        const w = bucket.width - 4;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
        ctx.fillRect(x, bucket.y, w, bucket.height);
        ctx.strokeStyle = 'rgba(218, 246, 255, 0.22)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, bucket.y, w, bucket.height);

        const fill = ctx.createLinearGradient(0, y, 0, bucket.y + bucket.height);
        fill.addColorStop(0, bucket.color);
        fill.addColorStop(1, 'rgba(255, 255, 255, 0.18)');
        ctx.fillStyle = fill;
        ctx.fillRect(x + 2, y, w - 4, fillHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
        ctx.font = '800 11px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(count, bucket.x + bucket.width / 2, bucket.y + bucket.height + 16);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < buckets.length; i++) {
        const x = buckets[i].x;
        ctx.moveTo(x, buckets[i].y);
        ctx.lineTo(x, buckets[i].y + buckets[i].height + 6);
    }
    ctx.stroke();
}

function drawGaussianCurve() {
    const total = bucketCounts.reduce((sum, n) => sum + n, 0);
    if (total < 8) return;

    const mean = expectedMean();
    const sigma = Math.sqrt(ROWS * 0.25);
    const bucketWidth = board.width / BUCKETS;
    const maxCount = Math.max(8, ...bucketCounts);
    const scaleY = (board.bucketHeight - 26) / maxCount;
    const maxExpected = total * normalPdf(mean, mean, sigma);
    const boost = maxCount / Math.max(maxExpected, 1);

    ctx.save();
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(255, 77, 109, 0.55)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    for (let step = 0; step <= 220; step++) {
        const xIndex = (step / 220) * (BUCKETS - 1);
        const expected = total * normalPdf(xIndex, mean, sigma) * boost;
        const x = board.x + bucketWidth * (xIndex + 0.5);
        const y = board.bucketTop + board.bucketHeight - expected * scaleY;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    drawText('Gaussian bell curve', board.x + board.width - 110, board.bucketTop - 20, '#ff9aae', 13, 'center');
}

function drawMeanSigma() {
    const total = bucketCounts.reduce((sum, n) => sum + n, 0);
    if (!total) return;
    const mean = weightedMean();
    const sigma = weightedSigma(mean);
    const bucketWidth = board.width / BUCKETS;
    const meanX = board.x + bucketWidth * (mean + 0.5);

    ctx.strokeStyle = 'rgba(255, 239, 110, 0.86)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(meanX, board.bucketTop - 22);
    ctx.lineTo(meanX, board.bucketTop + board.bucketHeight + 20);
    ctx.stroke();
    ctx.setLineDash([]);
    drawText('μ', meanX, board.bucketTop - 32, '#ffef6e', 18, 'center');

    if (sigma > 0.2) {
        const left = board.x + bucketWidth * (mean - sigma + 0.5);
        const right = board.x + bucketWidth * (mean + sigma + 0.5);
        ctx.strokeStyle = 'rgba(151, 245, 255, 0.62)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left, board.bucketTop - 12);
        ctx.lineTo(right, board.bucketTop - 12);
        ctx.stroke();
        drawText('1σ spread', (left + right) / 2, board.bucketTop - 24, '#97f5ff', 12, 'center');
    }
}

function drawBalls() {
    for (const ball of balls) {
        ctx.save();
        for (let i = 0; i < ball.trail.length; i++) {
            const t = ball.trail[i];
            ctx.globalAlpha = (i + 1) / ball.trail.length * 0.18;
            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, ball.r * 0.78, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.spin);
        const gradient = ctx.createRadialGradient(-ball.r * 0.35, -ball.r * 0.35, 1, 0, 0, ball.r);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.22, ball.color);
        gradient.addColorStop(1, '#1c2550');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, ball.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, ball.r, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }
}

function drawText(text, x, y, color, size = 13, align = 'left') {
    ctx.save();
    ctx.font = `800 ${size}px Segoe UI, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}

function updateBalls(dt) {
    const subSteps = 4;
    const step = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
        for (const ball of balls) {
            steerBall(ball, step);
            ball.vy += GRAVITY * step;
            ball.vx *= DRAG;
            ball.vy *= DRAG;
            ball.x += ball.vx * step;
            ball.y += ball.vy * step;
            ball.spin += ball.angular * step;

            handlePegChoice(ball);
            settleIfInBucket(ball);
        }
    }

    balls = balls.filter(ball => !ball.settled && ball.y < height + 80);
}

function steerBall(ball, step) {
    const dx = ball.targetX - ball.x;
    ball.vx += dx * 9.5 * step;
    ball.vx = clamp(ball.vx, -230, 230);
    ball.vy = Math.min(ball.vy, 430);
}

function handlePegChoice(ball) {
    if (ball.row >= ROWS) return;
    const peg = pegs.find(item => item.row === ball.row && item.col === ball.pathIndex);
    if (!peg || ball.y < peg.y - ball.r * 0.25) return;

    ball.x = peg.x + (ball.x - peg.x) * 0.2;
    ball.y = peg.y + ball.r + 0.4;

    const goesRight = Math.random() < 0.5;
    ball.pathIndex += goesRight ? 1 : 0;
    ball.row += 1;

    const nextY = ball.row < ROWS ? pegs.find(item => item.row === ball.row && item.col === ball.pathIndex).y : board.bucketTop;
    const nextX = ball.row < ROWS ? pegXFor(ball.row, ball.pathIndex) : bucketCenterX(ball.pathIndex);
    const travelTime = Math.max(0.16, (nextY - ball.y) / Math.max(ball.vy, 180));
    ball.targetX = nextX;
    ball.vx = clamp((nextX - ball.x) / travelTime, -185, 185);
    ball.vy = Math.max(135, ball.vy * 0.48);
    ball.angular += (goesRight ? 1 : -1) * (1.8 + Math.random() * 1.8);
}

function pegXFor(row, col) {
    const count = row + 1;
    return board.centerX - (count - 1) * board.colGap / 2 + col * board.colGap;
}

function bucketCenterX(index) {
    return board.x + (index + 0.5) * (board.width / BUCKETS);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function settleIfInBucket(ball) {
    if (ball.row < ROWS || ball.y < board.bucketTop + 10) return;
    const bucketIndex = Math.max(0, Math.min(BUCKETS - 1, ball.pathIndex));
    const bucket = buckets[bucketIndex];
    const maxCount = Math.max(8, ...bucketCounts);
    const fillHeight = Math.min(bucket.height - 20, ((bucketCounts[bucketIndex] + 1) / maxCount) * (bucket.height - 26));
    const floorY = bucket.y + bucket.height - fillHeight - ball.r;
    if (ball.y >= floorY || ball.y > height - 54) {
        bucketCounts[bucketIndex] += 1;
        ball.settled = true;
    }
}

function updateTrails() {
    for (const ball of balls) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 8) ball.trail.shift();
    }
}

function expectedMean() {
    return (BUCKETS - 1) / 2;
}

function weightedMean() {
    const total = bucketCounts.reduce((sum, n) => sum + n, 0);
    if (!total) return expectedMean();
    return bucketCounts.reduce((sum, count, i) => sum + count * i, 0) / total;
}

function weightedSigma(mean) {
    const total = bucketCounts.reduce((sum, n) => sum + n, 0);
    if (!total) return 0;
    const variance = bucketCounts.reduce((sum, count, i) => sum + count * (i - mean) ** 2, 0) / total;
    return Math.sqrt(variance);
}

function normalPdf(x, mean, sigma) {
    return Math.exp(-0.5 * ((x - mean) / sigma) ** 2) / (sigma * Math.sqrt(TAU));
}

function updateStats() {
    const total = bucketCounts.reduce((sum, n) => sum + n, 0);
    const mean = weightedMean();
    const sigma = weightedSigma(mean);
    const centerCount = bucketCounts[Math.floor(BUCKETS / 2)];
    statsPanel.innerHTML = [
        `balls counted: ${total}`,
        `falling now: ${balls.length}`,
        `mean μ: ${mean.toFixed(2)} buckets`,
        `std dev σ: ${sigma.toFixed(2)} buckets`,
        `middle bucket: ${centerCount}`,
        `drop speed: ${dropRate.toFixed(1)}x`
    ].join('<br>');
}

function update(dt) {
    if (!running || paused) return;
    spawnTimer += dt * dropRate;
    while (spawnTimer >= spawnEvery) {
        spawnBall();
        spawnTimer -= spawnEvery;
    }
    updateBalls(dt);
    updateTrails();
}

function draw(time) {
    drawBackground(time);
    if (board) {
        drawBoard(time);
        drawBalls();
        updateStats();
    }
}

function loop(now) {
    const dt = Math.min(0.04, (now - lastTime) / 1000 || 0);
    lastTime = now;
    update(dt);
    draw(now);
    requestAnimationFrame(loop);
}

function cycleMessage() {
    if (!running) return;
    message.textContent = messages[messageIndex % messages.length];
    messageIndex += 1;
}

startBtn.addEventListener('click', () => {
    intro.classList.add('hidden');
    document.body.classList.add('running');
    running = true;
    spawnBurst(18);
    cycleMessage();
});

pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶ Play' : '⏸ Pause';
});

dropBtn.addEventListener('click', () => spawnBurst(48));

slowBtn.addEventListener('click', () => {
    dropRate = Math.max(0.25, dropRate / 1.5);
});

fastBtn.addEventListener('click', () => {
    dropRate = Math.min(8, dropRate * 1.5);
});

resetBtn.addEventListener('click', resetLab);

canvas.addEventListener('pointerdown', event => {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    spawnBurst(12);
    if (board && x > board.x && x < board.x + board.width) {
        spawnBall(x, board.y - 8);
    }
});

window.addEventListener('keydown', event => {
    if (event.key === ' ') {
        event.preventDefault();
        pauseBtn.click();
    } else if (event.key === '+' || event.key === '=') {
        fastBtn.click();
    } else if (event.key === '-' || event.key === '_') {
        slowBtn.click();
    } else if (event.key.toLowerCase() === 'r') {
        resetBtn.click();
    } else if (event.key.toLowerCase() === 'b') {
        dropBtn.click();
    }
});

window.addEventListener('resize', resize);
window.setInterval(cycleMessage, 6500);
resize();
requestAnimationFrame(loop);
