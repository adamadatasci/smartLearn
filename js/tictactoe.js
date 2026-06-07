'use strict';

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const scoreXEl = document.getElementById('scoreX');
const scoreOEl = document.getElementById('scoreO');
const scoreDEl = document.getElementById('scoreD');
const newRoundBtn = document.getElementById('newRoundBtn');
const resetScoreBtn = document.getElementById('resetScoreBtn');

const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

let cells = Array(9).fill('');
let current = 'X';
let roundOver = false;
let score = { X: 0, O: 0, D: 0 };
let buttons = [];

function setStatus(msg) {
    statusEl.textContent = msg;
}

function renderScore() {
    scoreXEl.textContent = score.X;
    scoreOEl.textContent = score.O;
    scoreDEl.textContent = score.D;
}

function buildBoard() {
    boardEl.innerHTML = '';
    buttons = [];

    for (let i = 0; i < 9; i++) {
        const btn = document.createElement('button');
        btn.className = 'cell';
        btn.type = 'button';
        btn.dataset.idx = String(i);
        btn.setAttribute('aria-label', `Cell ${i + 1}`);
        btn.addEventListener('click', () => playAt(i));
        boardEl.appendChild(btn);
        buttons.push(btn);
    }
}

function renderBoard() {
    for (let i = 0; i < 9; i++) {
        buttons[i].textContent = cells[i];
        buttons[i].classList.remove('win');
    }
}

function winnerInfo() {
    for (const line of WIN_LINES) {
        const [a, b, c] = line;
        if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
            return { winner: cells[a], line };
        }
    }
    return null;
}

function highlightWin(line) {
    for (const idx of line) buttons[idx].classList.add('win');
}

function playAt(index) {
    if (roundOver || cells[index]) return;

    cells[index] = current;
    renderBoard();

    const win = winnerInfo();
    if (win) {
        roundOver = true;
        score[win.winner] += 1;
        renderScore();
        highlightWin(win.line);
        setStatus(`Player ${win.winner} wins! Press New Round.`);
        return;
    }

    if (cells.every(Boolean)) {
        roundOver = true;
        score.D += 1;
        renderScore();
        setStatus('Draw! Press New Round.');
        return;
    }

    current = current === 'X' ? 'O' : 'X';
    setStatus(`Player ${current} turn — click a cell or press keys 1-9.`);
}

function newRound() {
    cells = Array(9).fill('');
    current = 'X';
    roundOver = false;
    renderBoard();
    setStatus('Player X turn — click a cell or press keys 1-9.');
}

function resetScore() {
    score = { X: 0, O: 0, D: 0 };
    renderScore();
    newRound();
}

function onKeyDown(e) {
    if (!/^[1-9]$/.test(e.key)) return;
    const idx = Number(e.key) - 1;
    playAt(idx);
}

newRoundBtn.addEventListener('click', newRound);
resetScoreBtn.addEventListener('click', resetScore);
window.addEventListener('keydown', onKeyDown);

buildBoard();
renderBoard();
renderScore();
setStatus('Player X turn — click a cell or press keys 1-9.');
