'use strict';

const canvas = document.getElementById('orbit-canvas');
const ctx = canvas.getContext('2d');
const moonScreen = document.getElementById('moon-screen');
const moonCtx = moonScreen.getContext('2d');
const earthScreen = document.getElementById('earth-screen');
const earthCtx = earthScreen.getContext('2d');

const intro = document.getElementById('intro');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const slowerBtn = document.getElementById('slowerBtn');
const fasterBtn = document.getElementById('fasterBtn');
const labelsBtn = document.getElementById('labelsBtn');
const resetBtn = document.getElementById('resetBtn');
const statsPanel = document.getElementById('stats-panel');
const message = document.getElementById('message');
const seasonIcon = document.getElementById('seasonIcon');
const seasonName = document.getElementById('seasonName');
const seasonReason = document.getElementById('seasonReason');
const moonName = document.getElementById('moonName');
const moonPercent = document.getElementById('moonPercent');
const dayNightLabel = document.getElementById('dayNightLabel');

const TAU = Math.PI * 2;
const EARTH_YEAR_DAYS = 365.256363004;
const EARTH_ECCENTRICITY = 0.0167086;
const MOON_SIDEREAL_DAYS = 27.321661;
const MOON_SYNODIC_DAYS = 29.530588;
const MOON_ECCENTRICITY = 0.0549;
const MOON_INCLINATION = 5.145 * Math.PI / 180;
const EARTH_TILT = 23.439281 * Math.PI / 180;
const PERIHELION_DAY = 3;
const VERNAL_EQUINOX_DAY = 79;

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = performance.now();
let simDay = 172;
let speed = 4;
let running = false;
let paused = false;
let showLabels = true;
let stars = [];
let seasonalParticles = [];
let messageIndex = 0;

const messages = [
    'Earth follows a real ellipse with eccentricity 0.0167; it is closest to the Sun in early January.',
    'The Moon path uses eccentricity 0.0549 and a 5.145° tilt, drawn enlarged for visibility.',
    'Day and night come from Earth spinning while only the half facing the Sun is lit.',
    'Moon phases depend on the Sun-Earth-Moon angle: new, crescent, quarter, gibbous, and full.',
    'Seasons come from the 23.44° tilted Earth axis, not from being closer or farther from the Sun.'
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

    setupSmallCanvas(moonScreen, moonCtx);
    setupSmallCanvas(earthScreen, earthCtx);
    makeStars();
}

function setupSmallCanvas(el, context) {
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.max(1, Math.floor(rect.width * ratio));
    el.height = Math.max(1, Math.floor(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function makeStars() {
    const count = Math.round(Math.min(340, Math.max(130, width * height / 6200)));
    stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.45 + Math.random() * 1.7,
        twinkle: Math.random() * TAU,
        alpha: 0.25 + Math.random() * 0.75
    }));
}

function solveKepler(meanAnomaly, eccentricity) {
    let eccentricAnomaly = meanAnomaly;
    for (let i = 0; i < 7; i++) {
        eccentricAnomaly -= (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) /
            (1 - eccentricity * Math.cos(eccentricAnomaly));
    }
    return eccentricAnomaly;
}

function ellipticalOrbit(day, period, eccentricity, semiMajorAxis, periapsisOffset = -Math.PI / 2) {
    const meanAnomaly = ((day / period) % 1 + 1) % 1 * TAU;
    const eccentricAnomaly = solveKepler(meanAnomaly, eccentricity);
    const x = semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);
    const y = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
    const cos = Math.cos(periapsisOffset);
    const sin = Math.sin(periapsisOffset);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos,
        radius: semiMajorAxis * (1 - eccentricity * Math.cos(eccentricAnomaly)),
        trueAnomaly: Math.atan2(Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly), Math.cos(eccentricAnomaly) - eccentricity) + periapsisOffset,
        meanAnomaly
    };
}

function getOrbitState() {
    const dayOfYear = ((simDay % EARTH_YEAR_DAYS) + EARTH_YEAR_DAYS) % EARTH_YEAR_DAYS;
    const orbitScale = Math.min(width * 0.34, height * 0.36, 360);
    const center = {
        x: Math.min(width * 0.48, width - 380),
        y: height * 0.53
    };
    if (width < 980) {
        center.x = width * 0.5;
        center.y = height * 0.38;
    }

    const earth = ellipticalOrbit(dayOfYear - PERIHELION_DAY, EARTH_YEAR_DAYS, EARTH_ECCENTRICITY, orbitScale, -Math.PI / 2);
    const earthPos = { x: center.x + earth.x, y: center.y + earth.y };
    const sunPos = { ...center };

    const moonScale = Math.max(34, Math.min(70, orbitScale * 0.16));
    const moon = ellipticalOrbit(simDay + 6, MOON_SIDEREAL_DAYS, MOON_ECCENTRICITY, moonScale, Math.PI * 0.08);
    const inclinedY = moon.y * Math.cos(MOON_INCLINATION);
    const moonPos = { x: earthPos.x + moon.x, y: earthPos.y + inclinedY };

    return { dayOfYear, orbitScale, center, sunPos, earth, earthPos, moon, moonPos, moonScale };
}

function drawStars(time) {
    ctx.fillStyle = '#020512';
    ctx.fillRect(0, 0, width, height);
    for (const star of stars) {
        const alpha = star.alpha * (0.62 + 0.38 * Math.sin(time * 0.0018 + star.twinkle));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawEllipse(focus, a, eccentricity, rotation, color, label) {
    const b = a * Math.sqrt(1 - eccentricity * eccentricity);
    const center = {
        x: focus.x - a * eccentricity * Math.cos(rotation),
        y: focus.y - a * eccentricity * Math.sin(rotation)
    };
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.ellipse(0, 0, a, b, 0, 0, TAU);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (showLabels && label) {
        ctx.fillStyle = color;
        ctx.font = '700 13px Segoe UI, sans-serif';
        ctx.fillText(label, center.x - a + 18, center.y - b - 12);
    }
}

function drawSun(pos, time) {
    const pulse = 1 + Math.sin(time * 0.002) * 0.035;
    const glow = ctx.createRadialGradient(pos.x, pos.y, 8, pos.x, pos.y, 92 * pulse);
    glow.addColorStop(0, 'rgba(255, 255, 214, 0.95)');
    glow.addColorStop(0.22, 'rgba(255, 190, 43, 0.75)');
    glow.addColorStop(0.56, 'rgba(255, 112, 31, 0.22)');
    glow.addColorStop(1, 'rgba(255, 112, 31, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 92 * pulse, 0, TAU);
    ctx.fill();

    const sunGradient = ctx.createRadialGradient(pos.x - 10, pos.y - 12, 3, pos.x, pos.y, 31);
    sunGradient.addColorStop(0, '#fffad1');
    sunGradient.addColorStop(0.46, '#ffd84f');
    sunGradient.addColorStop(1, '#ff8c1e');
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 30 * pulse, 0, TAU);
    ctx.fill();

    if (showLabels) drawLabel('Sun', pos.x, pos.y + 52, '#ffe88a');
}

function drawEarth(pos, sunPos, dayOfYear) {
    const radius = width < 680 ? 15 : 19;
    const sunAngle = Math.atan2(sunPos.y - pos.y, sunPos.x - pos.x);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(sunAngle);

    const dayGradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, 2, 0, 0, radius);
    dayGradient.addColorStop(0, '#dffbff');
    dayGradient.addColorStop(0.22, '#4edbff');
    dayGradient.addColorStop(0.58, '#1972ff');
    dayGradient.addColorStop(1, '#061b74');
    ctx.fillStyle = dayGradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, radius);
    ctx.closePath();
    ctx.clip();
    const nightGradient = ctx.createLinearGradient(-radius, 0, radius, 0);
    nightGradient.addColorStop(0, 'rgba(1, 3, 16, 0.12)');
    nightGradient.addColorStop(0.48, 'rgba(1, 8, 32, 0.36)');
    nightGradient.addColorStop(1, 'rgba(0, 0, 9, 0.88)');
    ctx.fillStyle = nightGradient;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.rotate((simDay % 1) * TAU);
    ctx.fillStyle = 'rgba(70, 225, 118, 0.78)';
    ctx.beginPath();
    ctx.ellipse(-5, -4, 5, 9, 0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, 5, 7, 4, -0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();

    drawTiltAxis(pos, radius, dayOfYear);
    if (showLabels) drawLabel('Earth', pos.x, pos.y - 30, '#98ddff');
}

function drawTiltAxis(pos, radius, dayOfYear) {
    const solsticeAngle = ((dayOfYear - VERNAL_EQUINOX_DAY) / EARTH_YEAR_DAYS) * TAU;
    const lean = Math.sin(solsticeAngle) * EARTH_TILT;
    const screenAngle = -Math.PI / 2 + lean;
    const len = radius * 1.75;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x - Math.cos(screenAngle) * len, pos.y - Math.sin(screenAngle) * len);
    ctx.lineTo(pos.x + Math.cos(screenAngle) * len, pos.y + Math.sin(screenAngle) * len);
    ctx.stroke();
}

function drawMoon(pos, earthPos, sunPos) {
    const radius = width < 680 ? 6 : 8;
    const sunAngle = Math.atan2(sunPos.y - pos.y, sunPos.x - pos.x);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(sunAngle);
    ctx.fillStyle = '#d9dce3';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 10, 0.62)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, radius);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(170, 198, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(earthPos.x, earthPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (showLabels) drawLabel('Moon', pos.x + 12, pos.y - 10, '#dfe6ff');
}

function drawLabel(text, x, y, color) {
    ctx.save();
    ctx.font = '800 13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawSunRays(sunPos, earthPos, moonPos) {
    ctx.strokeStyle = 'rgba(255, 219, 103, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 8]);
    for (const target of [earthPos, moonPos]) {
        ctx.beginPath();
        ctx.moveTo(sunPos.x, sunPos.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

function getSeason(dayOfYear) {
    if (dayOfYear >= 355 || dayOfYear < 80) {
        return { name: 'Northern Winter', icon: '❄️', reason: 'North Pole leans away: short days, low Sun, snow.' };
    }
    if (dayOfYear < 172) {
        return { name: 'Northern Spring', icon: '🌷', reason: 'Sunlight grows stronger; flowers and new leaves appear.' };
    }
    if (dayOfYear < 266) {
        return { name: 'Northern Summer', icon: '☀️', reason: 'North Pole leans toward the Sun: long warm days.' };
    }
    return { name: 'Northern Fall', icon: '🍂', reason: 'Sunlight fades; leaves turn orange and fall.' };
}

function drawSeasonParticles(dt, season) {
    const maxParticles = width < 680 ? 34 : 58;
    if (seasonalParticles.length < maxParticles && Math.random() < 0.45) {
        seasonalParticles.push(makeSeasonParticle(season));
    }

    seasonalParticles = seasonalParticles.filter(p => {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.spin += p.spinSpeed * dt;
        const alive = p.age < p.life && p.y < height + 40;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.font = `${p.size}px Segoe UI Emoji, Apple Color Emoji, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.icon, 0, 0);
        ctx.restore();
        return alive;
    });
    ctx.globalAlpha = 1;
}

function makeSeasonParticle(season) {
    const icons = {
        'Northern Winter': ['❄️', '❅', '❆'],
        'Northern Spring': ['🌸', '🌷', '🌱'],
        'Northern Summer': ['☀️', '✨', '🌻'],
        'Northern Fall': ['🍁', '🍂', '🟠']
    }[season.name];
    return {
        icon: icons[Math.floor(Math.random() * icons.length)],
        x: Math.random() * width,
        y: -20,
        vx: -36 + Math.random() * 72,
        vy: 95 + Math.random() * 135,
        size: 16 + Math.random() * 18,
        spin: Math.random() * TAU,
        spinSpeed: -3.8 + Math.random() * 7.6,
        age: 0,
        life: 4.5 + Math.random() * 3
    };
}

function getMoonPhase(state) {
    const sunFromEarth = Math.atan2(state.sunPos.y - state.earthPos.y, state.sunPos.x - state.earthPos.x);
    const moonFromEarth = Math.atan2(state.moonPos.y - state.earthPos.y, state.moonPos.x - state.earthPos.x);
    const elongation = ((moonFromEarth - sunFromEarth) % TAU + TAU) % TAU;
    const lit = (1 - Math.cos(elongation)) / 2;
    const waxing = elongation < Math.PI;
    const age = elongation / TAU * MOON_SYNODIC_DAYS;
    const names = [
        { limit: 1.2, name: 'New Moon' },
        { limit: 6.4, name: 'Waxing Crescent' },
        { limit: 8.9, name: 'First Quarter' },
        { limit: 13.6, name: 'Waxing Gibbous' },
        { limit: 16.2, name: 'Full Moon' },
        { limit: 21.4, name: 'Waning Gibbous' },
        { limit: 23.9, name: 'Last Quarter' },
        { limit: 28.4, name: 'Waning Crescent' },
        { limit: 30, name: 'New Moon' }
    ];
    return { elongation, lit, waxing, age, name: names.find(item => age < item.limit).name };
}

function drawMoonScreen(phase) {
    const rect = moonScreen.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    moonCtx.clearRect(0, 0, w, h);

    const bg = moonCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#071331');
    bg.addColorStop(1, '#01030a');
    moonCtx.fillStyle = bg;
    moonCtx.fillRect(0, 0, w, h);

    for (let i = 0; i < 22; i++) {
        moonCtx.globalAlpha = 0.25 + (i % 5) * 0.12;
        moonCtx.fillStyle = '#fff';
        moonCtx.fillRect((i * 47) % w, (i * 31) % h, 1.2, 1.2);
    }
    moonCtx.globalAlpha = 1;

    const r = Math.min(w, h) * 0.34;
    const cx = w * 0.5;
    const cy = h * 0.48;
    renderPhaseDisk(moonCtx, cx, cy, r, phase.elongation);

    moonCtx.fillStyle = '#99e9ff';
    moonCtx.font = '700 11px Segoe UI, sans-serif';
    moonCtx.textAlign = 'left';
    moonCtx.fillText('Sunlight →', 12, 20);
}

function renderPhaseDisk(context, cx, cy, r, elongation) {
    context.save();
    context.beginPath();
    context.arc(cx, cy, r, 0, TAU);
    context.clip();
    context.fillStyle = '#0a0c12';
    context.fillRect(cx - r, cy - r, r * 2, r * 2);

    const k = -Math.cos(elongation);
    for (let i = -r; i <= r; i += 1) {
        const y = i;
        const half = Math.sqrt(Math.max(0, r * r - y * y));
        const xTerminator = k * half;
        const litStart = elongation < Math.PI ? xTerminator : -half;
        const litEnd = elongation < Math.PI ? half : xTerminator;
        const shade = 0.78 + 0.22 * (1 - Math.abs(y) / r);
        context.fillStyle = `rgba(${Math.round(218 * shade)}, ${Math.round(222 * shade)}, ${Math.round(230 * shade)}, 1)`;
        context.fillRect(cx + litStart, cy + y, Math.max(0, litEnd - litStart), 1.5);
    }

    context.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, r, 0, TAU);
    context.stroke();
    context.restore();
}

function drawEarthScreen(state) {
    const rect = earthScreen.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    earthCtx.clearRect(0, 0, w, h);
    const bg = earthCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#09204a');
    bg.addColorStop(1, '#01030a');
    earthCtx.fillStyle = bg;
    earthCtx.fillRect(0, 0, w, h);

    const cx = w * 0.48;
    const cy = h * 0.52;
    const r = Math.min(w, h) * 0.35;
    const spin = (simDay % 1) * TAU;

    earthCtx.save();
    earthCtx.translate(cx, cy);
    earthCtx.rotate(EARTH_TILT * 0.65);
    const ocean = earthCtx.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r);
    ocean.addColorStop(0, '#bff9ff');
    ocean.addColorStop(0.25, '#36c7ff');
    ocean.addColorStop(0.62, '#1455d2');
    ocean.addColorStop(1, '#041449');
    earthCtx.fillStyle = ocean;
    earthCtx.beginPath();
    earthCtx.arc(0, 0, r, 0, TAU);
    earthCtx.fill();

    earthCtx.save();
    earthCtx.beginPath();
    earthCtx.arc(0, 0, r, 0, TAU);
    earthCtx.clip();
    earthCtx.rotate(spin);
    earthCtx.fillStyle = '#4dd268';
    for (let i = 0; i < 6; i++) {
        const angle = i * 1.21;
        earthCtx.beginPath();
        earthCtx.ellipse(Math.cos(angle) * r * 0.36, Math.sin(angle * 1.4) * r * 0.42, r * 0.15, r * 0.27, angle, 0, TAU);
        earthCtx.fill();
    }
    earthCtx.restore();

    const night = earthCtx.createLinearGradient(-r, 0, r, 0);
    night.addColorStop(0, 'rgba(0, 0, 5, 0.04)');
    night.addColorStop(0.48, 'rgba(0, 0, 15, 0.22)');
    night.addColorStop(1, 'rgba(0, 0, 8, 0.88)');
    earthCtx.fillStyle = night;
    earthCtx.beginPath();
    earthCtx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    earthCtx.lineTo(0, r);
    earthCtx.closePath();
    earthCtx.fill();

    earthCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    earthCtx.lineWidth = 2;
    earthCtx.beginPath();
    earthCtx.arc(0, 0, r, 0, TAU);
    earthCtx.stroke();

    earthCtx.strokeStyle = '#ffffff';
    earthCtx.lineWidth = 2;
    earthCtx.beginPath();
    earthCtx.moveTo(0, -r * 1.25);
    earthCtx.lineTo(0, r * 1.25);
    earthCtx.stroke();
    earthCtx.restore();

    earthCtx.fillStyle = '#ffe78c';
    earthCtx.font = '800 12px Segoe UI, sans-serif';
    earthCtx.textAlign = 'center';
    earthCtx.fillText('SUNLIGHT', w * 0.5, 18);
    earthCtx.fillText('☀ →', w * 0.18, h * 0.55);
    earthCtx.fillStyle = '#b9d8ff';
    earthCtx.fillText('night', w * 0.77, h * 0.56);

    const daylight = Math.round(12 + 4.4 * Math.sin(((state.dayOfYear - VERNAL_EQUINOX_DAY) / EARTH_YEAR_DAYS) * TAU));
    dayNightLabel.textContent = `About ${daylight} h daylight north`;
}

function updatePanels(state, season, phase) {
    seasonIcon.textContent = season.icon;
    seasonName.textContent = season.name;
    seasonReason.textContent = season.reason;
    moonName.textContent = phase.name;
    moonPercent.textContent = `${Math.round(phase.lit * 100)}% lit • day ${phase.age.toFixed(1)} of 29.5`;

    const distanceAu = state.earth.radius / state.orbitScale;
    const km = distanceAu * 149_597_870.7;
    statsPanel.innerHTML = [
        `day of year: ${Math.floor(state.dayOfYear) + 1}`,
        `Earth-Sun: ${distanceAu.toFixed(4)} AU (${Math.round(km / 1_000_000)} million km)`,
        `Earth orbit e = ${EARTH_ECCENTRICITY}`,
        `Moon orbit e = ${MOON_ECCENTRICITY}, tilt = 5.145°`,
        `speed: ${speed.toFixed(1)} simulated days / sec`
    ].join('<br>');
}

function draw(time) {
    const state = getOrbitState();
    const season = getSeason(state.dayOfYear);
    const phase = getMoonPhase(state);

    drawStars(time);
    drawSeasonParticles(0, season);
    drawEllipse(state.center, state.orbitScale, EARTH_ECCENTRICITY, -Math.PI / 2, 'rgba(114, 213, 255, 0.42)', 'Earth orbit: ellipse, Sun at focus');
    drawEllipse(state.earthPos, state.moonScale, MOON_ECCENTRICITY, Math.PI * 0.08, 'rgba(205, 218, 255, 0.28)', 'Moon orbit: tilted ellipse');
    drawSunRays(state.sunPos, state.earthPos, state.moonPos);
    drawSun(state.sunPos, time);
    drawEarth(state.earthPos, state.sunPos, state.dayOfYear);
    drawMoon(state.moonPos, state.earthPos, state.sunPos);
    drawOrbitAnnotations(state);
    drawMoonScreen(phase);
    drawEarthScreen(state);
    updatePanels(state, season, phase);
}

function drawOrbitAnnotations(state) {
    if (!showLabels) return;
    ctx.fillStyle = 'rgba(222, 246, 255, 0.72)';
    ctx.font = '700 12px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    const x = state.center.x - state.orbitScale + 22;
    const y = state.center.y + state.orbitScale * 0.72;
    ctx.fillText('Perihelion ≈ Jan 3: 0.983 AU', x, y);
    ctx.fillText('Aphelion ≈ Jul 4: 1.017 AU', x, y + 18);
    ctx.fillText('23.44° tilted axis makes seasons', x, y + 36);
}

function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
    lastTime = now;
    if (running && !paused) {
        simDay += dt * speed;
        const state = getOrbitState();
        const season = getSeason(state.dayOfYear);
        drawStars(now);
        drawSeasonParticles(dt, season);
    }
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
    lastTime = performance.now();
    cycleMessage();
});

pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶ Play' : '⏸ Pause';
});

slowerBtn.addEventListener('click', () => {
    speed = Math.max(1, speed / 1.6);
});

fasterBtn.addEventListener('click', () => {
    speed = Math.min(180, speed * 1.6);
});

labelsBtn.addEventListener('click', () => {
    showLabels = !showLabels;
    labelsBtn.textContent = showLabels ? '🏷 Labels' : '🏷 Hidden';
});

resetBtn.addEventListener('click', () => {
    simDay = 172;
    speed = 4;
    paused = false;
    pauseBtn.textContent = '⏸ Pause';
    seasonalParticles = [];
});

window.addEventListener('keydown', event => {
    if (event.key === ' ') {
        event.preventDefault();
        pauseBtn.click();
    } else if (event.key === '+' || event.key === '=') {
        fasterBtn.click();
    } else if (event.key === '-' || event.key === '_') {
        slowerBtn.click();
    } else if (event.key.toLowerCase() === 'r') {
        resetBtn.click();
    } else if (event.key.toLowerCase() === 'l') {
        labelsBtn.click();
    }
});

window.addEventListener('resize', resize);
window.setInterval(cycleMessage, 7000);
resize();
requestAnimationFrame(loop);
