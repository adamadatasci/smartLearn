'use strict';

const canvas = document.getElementById('orbit-canvas');
const ctx = canvas.getContext('2d');
const moonScreen = document.getElementById('moon-screen');
const moonCtx = moonScreen.getContext('2d');
const earthScreen = document.getElementById('earth-screen');
const earthCtx = earthScreen.getContext('2d');
const skyScreen = document.getElementById('sky-screen');
const skyCtx = skyScreen.getContext('2d');

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
const skyLabel = document.getElementById('skyLabel');
const skyDetail = document.getElementById('skyDetail');

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
const OBSERVER_LATITUDE = 40 * Math.PI / 180;
const DEFAULT_SPEED = 1 / 24; // 1 real second = 1 simulated hour.

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = performance.now();
let simDay = 172;
let speed = DEFAULT_SPEED;
let running = false;
let paused = false;
let showLabels = true;
let stars = [];
let seasonalParticles = [];
let messageIndex = 0;

const messages = [
    'In this reference frame, Earth stays fixed and the Sun appears to circle Earth once every 24 hours.',
    'The red home dot is fixed on Earth; day happens when the apparent Sun faces it.',
    'The sky screen shows what that home dot sees: Sun by day, Moon when it is above the horizon.',
    'The Moon still travels around Earth once each month on a slightly oval, tilted path.',
    'Day and night are shown by the Sun turning around the fixed Earth.',
    'Moon phases still depend on the angle between Sun, Earth, and Moon.',
    'Seasons still come from Earth’s 23.44° tilt relative to the Sun.'
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
    setupSmallCanvas(skyScreen, skyCtx);
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
        meanAnomaly
    };
}

function getOrbitState() {
    const dayOfYear = ((simDay % EARTH_YEAR_DAYS) + EARTH_YEAR_DAYS) % EARTH_YEAR_DAYS;
    const sunScale = Math.min(width * 0.31, height * 0.34, 345);
    const earthPos = {
        x: Math.min(width * 0.47, width - 390),
        y: height * 0.53
    };
    if (width < 980) {
        earthPos.x = width * 0.5;
        earthPos.y = height * 0.38;
    }

    const apparentSun = ellipticalOrbit(dayOfYear - PERIHELION_DAY, EARTH_YEAR_DAYS, EARTH_ECCENTRICITY, sunScale, Math.PI / 2);
    const phaseSunPos = { x: earthPos.x + apparentSun.x, y: earthPos.y + apparentSun.y };
    const localTime = localTimeHours();
    const dailySunAngle = ((localTime - 12) / 24) * TAU - Math.PI / 2;
    const sunDistance = apparentSun.radius;
    const sunPos = {
        x: earthPos.x + Math.cos(dailySunAngle) * sunDistance,
        y: earthPos.y + Math.sin(dailySunAngle) * sunDistance
    };
    const moonScale = Math.max(105, Math.min(145, sunScale * 0.34));
    const moon = ellipticalOrbit(simDay + 6, MOON_SIDEREAL_DAYS, MOON_ECCENTRICITY, moonScale, Math.PI * 0.08);
    const moonPos = { x: earthPos.x + moon.x, y: earthPos.y + moon.y * Math.cos(MOON_INCLINATION) };

    return { dayOfYear, sunScale, earthPos, sunPos, phaseSunPos, apparentSun, dailySunAngle, sunDistance, moonScale, moon, moonPos };
}

function drawStars(time, state) {
    const sunAltitude = state ? currentSunAltitude(state.dayOfYear) : -0.4;
    const dayAmount = Math.max(0, Math.min(1, (sunAltitude + 0.1) / 0.55));
    const bg = ctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.5, Math.max(width, height));
    bg.addColorStop(0, mixColor('#06102c', '#8edcff', dayAmount));
    bg.addColorStop(0.5, mixColor('#020512', '#2a75c9', dayAmount));
    bg.addColorStop(1, mixColor('#00020a', '#071f56', dayAmount));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (dayAmount > 0.02) {
        const glowAlpha = 0.18 + dayAmount * 0.3;
        ctx.fillStyle = `rgba(255, 238, 140, ${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.5, Math.max(width, height) * (0.22 + dayAmount * 0.18), 0, TAU);
        ctx.fill();
    }

    const starFade = 1 - dayAmount;
    for (const star of stars) {
        const alpha = star.alpha * starFade * (0.62 + 0.38 * Math.sin(time * 0.0018 + star.twinkle));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function currentSunAltitude(dayOfYear) {
    const declination = solarDeclination(dayOfYear);
    const sunHourAngle = ((localTimeHours() - 12) / 24) * TAU;
    return altitudeFor(OBSERVER_LATITUDE, declination, sunHourAngle);
}

function mixColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const blue = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r}, ${g}, ${blue})`;
}

function hexToRgb(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
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
    const radius = width < 680 ? 34 : 52;
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
    ctx.arc(0, 0, radius, Math.PI / 2, Math.PI * 1.5);
    ctx.lineTo(0, -radius);
    ctx.closePath();
    ctx.clip();
    const nightGradient = ctx.createLinearGradient(radius, 0, -radius, 0);
    nightGradient.addColorStop(0, 'rgba(1, 3, 16, 0.08)');
    nightGradient.addColorStop(0.42, 'rgba(1, 8, 32, 0.48)');
    nightGradient.addColorStop(1, 'rgba(0, 0, 9, 0.94)');
    ctx.fillStyle = nightGradient;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(70, 225, 118, 0.78)';
    ctx.beginPath();
    ctx.ellipse(-13, -10, 11, 20, 0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(13, 11, 17, 9, -0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
    drawTiltAxis(pos, radius, dayOfYear);
    drawObserverMarker(pos, radius, sunAngle);
    if (showLabels) drawLabel('Earth fixed center', pos.x, pos.y - radius - 20, '#98ddff');
}

function drawObserverMarker(pos, radius, sunAngle) {
    const rotation = -Math.PI / 2;
    const x = pos.x + Math.cos(rotation) * radius * 0.72;
    const y = pos.y + Math.sin(rotation) * radius * 0.72;
    ctx.save();
    ctx.fillStyle = '#ff4d6d';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (showLabels) drawLabel('home', x + 24, y - 10, '#ffb3c1');
    ctx.restore();
}

function drawTiltAxis(pos, radius, dayOfYear) {
    const solsticeAngle = ((dayOfYear - VERNAL_EQUINOX_DAY) / EARTH_YEAR_DAYS) * TAU;
    const lean = Math.sin(solsticeAngle) * EARTH_TILT;
    const screenAngle = -Math.PI / 2 + lean;
    const len = radius * 1.6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x - Math.cos(screenAngle) * len, pos.y - Math.sin(screenAngle) * len);
    ctx.lineTo(pos.x + Math.cos(screenAngle) * len, pos.y + Math.sin(screenAngle) * len);
    ctx.stroke();
}

function drawMoon(pos, earthPos, sunPos) {
    const radius = width < 680 ? 7 : 9;
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
    if (showLabels) drawLabel('Moon', pos.x + 14, pos.y - 12, '#dfe6ff');
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

function getSeason(dayOfYear) {
    if (dayOfYear >= 355 || dayOfYear < 80) return { name: 'Northern Winter', icon: '❄️', reason: 'North Pole leans away: short days, low Sun, snow.' };
    if (dayOfYear < 172) return { name: 'Northern Spring', icon: '🌷', reason: 'Sunlight grows stronger; flowers and new leaves appear.' };
    if (dayOfYear < 266) return { name: 'Northern Summer', icon: '☀️', reason: 'North Pole leans toward the Sun: long warm days.' };
    return { name: 'Northern Fall', icon: '🍂', reason: 'Sunlight fades; leaves turn orange and fall.' };
}

function solarDeclination(dayOfYear) {
    return EARTH_TILT * Math.sin(((dayOfYear - VERNAL_EQUINOX_DAY) / EARTH_YEAR_DAYS) * TAU);
}

function altitudeFor(latitude, declination, hourAngle) {
    return Math.asin(
        Math.sin(latitude) * Math.sin(declination) +
        Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)
    );
}

function daylightHours(dayOfYear) {
    const declination = solarDeclination(dayOfYear);
    const cosH0 = -Math.tan(OBSERVER_LATITUDE) * Math.tan(declination);
    if (cosH0 <= -1) return 24;
    if (cosH0 >= 1) return 0;
    return 24 * Math.acos(cosH0) / Math.PI;
}

function localTimeHours() {
    return (((simDay % 1) + 1) % 1) * 24;
}

function formatHour(hours) {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours - Math.floor(hours)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawSeasonParticles(dt, season) {
    const maxParticles = width < 680 ? 34 : 58;
    if (seasonalParticles.length < maxParticles && Math.random() < 0.45) seasonalParticles.push(makeSeasonParticle(season));
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
    const sunFromEarth = Math.atan2(state.phaseSunPos.y - state.earthPos.y, state.phaseSunPos.x - state.earthPos.x);
    const moonFromEarth = Math.atan2(state.moonPos.y - state.earthPos.y, state.moonPos.x - state.earthPos.x);
    const elongation = ((moonFromEarth - sunFromEarth) % TAU + TAU) % TAU;
    const lit = (1 - Math.cos(elongation)) / 2;
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
    return { elongation, lit, age, name: names.find(item => age < item.limit).name };
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
    renderPhaseDisk(moonCtx, w * 0.5, h * 0.48, Math.min(w, h) * 0.34, phase.elongation);
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
        const half = Math.sqrt(Math.max(0, r * r - i * i));
        const xTerminator = k * half;
        const litStart = elongation < Math.PI ? xTerminator : -half;
        const litEnd = elongation < Math.PI ? half : xTerminator;
        const shade = 0.78 + 0.22 * (1 - Math.abs(i) / r);
        context.fillStyle = `rgba(${Math.round(218 * shade)}, ${Math.round(222 * shade)}, ${Math.round(230 * shade)}, 1)`;
        context.fillRect(cx + litStart, cy + i, Math.max(0, litEnd - litStart), 1.5);
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
    const daylight = daylightHours(state.dayOfYear);
    const time = localTimeHours();
    dayNightLabel.textContent = `${formatHour(time)} • ${daylight.toFixed(1)} h daylight`;
}

function drawSkyScreen(state, phase) {
    const rect = skyScreen.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    skyCtx.clearRect(0, 0, w, h);

    const declination = solarDeclination(state.dayOfYear);
    const localTime = localTimeHours();
    const sunHourAngle = ((localTime - 12) / 24) * TAU;
    const sunAltitude = altitudeFor(OBSERVER_LATITUDE, declination, sunHourAngle);
    const moonDeclination = declination + Math.sin(phase.elongation) * MOON_INCLINATION;
    const moonHourAngle = sunHourAngle - phase.elongation;
    const moonAltitude = altitudeFor(OBSERVER_LATITUDE, moonDeclination, moonHourAngle);

    const daylight = daylightHours(state.dayOfYear);
    const skyTop = sunAltitude > 0 ? '#2f8dff' : '#07112d';
    const skyMid = sunAltitude > 0 ? '#74c8ff' : '#111942';
    const ground = getSeason(state.dayOfYear).name === 'Northern Winter' ? '#dff8ff' : '#203819';
    const bg = skyCtx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, skyTop);
    bg.addColorStop(0.62, skyMid);
    bg.addColorStop(0.63, ground);
    bg.addColorStop(1, '#07101d');
    skyCtx.fillStyle = bg;
    skyCtx.fillRect(0, 0, w, h);

    for (let i = 0; i < 28; i++) {
        skyCtx.globalAlpha = sunAltitude > 0 ? 0.08 : 0.42;
        skyCtx.fillStyle = '#fff';
        skyCtx.fillRect((i * 43) % w, (i * 29) % (h * 0.55), 1.2, 1.2);
    }
    skyCtx.globalAlpha = 1;

    const horizon = h * 0.63;
    skyCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    skyCtx.lineWidth = 1.5;
    skyCtx.beginPath();
    skyCtx.moveTo(0, horizon);
    skyCtx.lineTo(w, horizon);
    skyCtx.stroke();

    drawSkyArc(skyCtx, w, h, daylight);
    const sunPoint = skyPoint(w, h, sunHourAngle, sunAltitude);
    const moonPoint = skyPoint(w, h, moonHourAngle, moonAltitude);

    if (sunAltitude > -0.12) drawSkySun(sunPoint.x, sunPoint.y, Math.max(0.25, Math.min(1, (sunAltitude + 0.12) / 0.55)));
    if (moonAltitude > -0.1) drawSkyMoon(moonPoint.x, moonPoint.y, Math.max(0.28, Math.min(1, (moonAltitude + 0.1) / 0.45)), phase.elongation);

    skyCtx.fillStyle = '#eafaff';
    skyCtx.font = '800 11px Segoe UI, sans-serif';
    skyCtx.textAlign = 'left';
    skyCtx.fillText(`time ${formatHour(localTime)}`, 10, 18);
    skyCtx.fillText(`${daylight.toFixed(1)} h daylight`, 10, 34);

    const moonVisible = moonAltitude > 0;
    skyLabel.textContent = sunAltitude > 0 ? 'Day sky' : 'Night sky';
    skyDetail.textContent = moonVisible
        ? `Moon above horizon • ${phase.name}`
        : `Moon below horizon • ${phase.name}`;
}

function skyPoint(w, h, hourAngle, altitude) {
    const horizon = h * 0.63;
    const x = w * (0.5 + Math.sin(hourAngle) * 0.42);
    const y = horizon - Math.sin(Math.max(-0.15, altitude)) * h * 0.72;
    return { x, y };
}

function drawSkyArc(context, w, h, daylight) {
    const horizon = h * 0.63;
    const heightBoost = Math.max(0.24, Math.min(0.72, daylight / 18));
    context.strokeStyle = 'rgba(255, 240, 155, 0.42)';
    context.lineWidth = 2;
    context.setLineDash([5, 7]);
    context.beginPath();
    context.moveTo(w * 0.08, horizon);
    context.quadraticCurveTo(w * 0.5, horizon - h * heightBoost, w * 0.92, horizon);
    context.stroke();
    context.setLineDash([]);
}

function drawSkySun(x, y, alpha) {
    skyCtx.save();
    skyCtx.globalAlpha = alpha;
    const glow = skyCtx.createRadialGradient(x, y, 3, x, y, 24);
    glow.addColorStop(0, '#fffbd0');
    glow.addColorStop(0.35, '#ffd94d');
    glow.addColorStop(1, 'rgba(255, 150, 0, 0)');
    skyCtx.fillStyle = glow;
    skyCtx.beginPath();
    skyCtx.arc(x, y, 24, 0, TAU);
    skyCtx.fill();
    skyCtx.fillStyle = '#ffd84f';
    skyCtx.beginPath();
    skyCtx.arc(x, y, 8, 0, TAU);
    skyCtx.fill();
    skyCtx.restore();
}

function drawSkyMoon(x, y, alpha, elongation) {
    skyCtx.save();
    skyCtx.globalAlpha = alpha;
    renderPhaseDisk(skyCtx, x, y, 8, elongation);
    skyCtx.restore();
}

function updatePanels(state, season, phase) {
    seasonIcon.textContent = season.icon;
    seasonName.textContent = season.name;
    seasonReason.textContent = season.reason;
    moonName.textContent = phase.name;
    moonPercent.textContent = `${Math.round(phase.lit * 100)}% lit • day ${phase.age.toFixed(1)} of 29.5`;
    const distanceAu = state.apparentSun.radius / state.sunScale;
    const km = distanceAu * 149_597_870.7;
    statsPanel.innerHTML = [
        `day of year: ${Math.floor(state.dayOfYear) + 1}`,
        `local 24h time: ${formatHour(localTimeHours())}`,
        `daylight at 40°N: ${daylightHours(state.dayOfYear).toFixed(1)} hours`,
        `Sun apparent distance: ${distanceAu.toFixed(4)} AU (${Math.round(km / 1_000_000)} million km)`,
        `Earth-centered frame: Earth fixed at origin`,
        `Sun apparent day: 24 hours around fixed Earth`,
        `Seasonal year controls Sun height and daylight`,
        `Moon orbit e = ${MOON_ECCENTRICITY}, tilt = 5.145°`,
        `speed: ${(speed * 24).toFixed(2)} simulated hours / sec`
    ].join('<br>');
}

function drawOrbitAnnotations(state) {
    if (!showLabels) return;
    ctx.fillStyle = 'rgba(222, 246, 255, 0.72)';
    ctx.font = '700 12px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    const x = state.earthPos.x - state.sunScale + 22;
    const y = state.earthPos.y + state.sunScale * 0.72;
    ctx.fillText('Geocentric reference frame: Earth fixed', x, y);
    ctx.fillText('Sun appears to turn once every 24 hours', x, y + 18);
    ctx.fillText('Fixed home dot sees day when the Sun faces it', x, y + 36);
}

function draw(time) {
    const state = getOrbitState();
    const season = getSeason(state.dayOfYear);
    const phase = getMoonPhase(state);
    drawStars(time, state);
    drawSeasonParticles(0, season);
    drawEllipse(state.earthPos, state.sunDistance, 0, 0, 'rgba(255, 225, 111, 0.38)', 'Sun apparent 24-hour path');
    drawEllipse(state.earthPos, state.moonScale, MOON_ECCENTRICITY, Math.PI * 0.08, 'rgba(205, 218, 255, 0.28)', 'Moon monthly path');
    drawSunRays(state.sunPos, state.earthPos, state.moonPos);
    drawSun(state.sunPos, time);
    drawMoon(state.moonPos, state.earthPos, state.sunPos);
    drawEarth(state.earthPos, state.sunPos, state.dayOfYear);
    drawOrbitAnnotations(state);
    drawMoonScreen(phase);
    drawEarthScreen(state);
    drawSkyScreen(state, phase);
    updatePanels(state, season, phase);
}

function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
    lastTime = now;
    if (running && !paused) {
        simDay += dt * speed;
        const state = getOrbitState();
        drawSeasonParticles(dt, getSeason(state.dayOfYear));
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
    speed = Math.max(1 / 240, speed / 1.6);
});

fasterBtn.addEventListener('click', () => {
    speed = Math.min(4, speed * 1.6);
});

labelsBtn.addEventListener('click', () => {
    showLabels = !showLabels;
    labelsBtn.textContent = showLabels ? '🏷 Labels' : '🏷 Hidden';
});

resetBtn.addEventListener('click', () => {
    simDay = 172;
    speed = DEFAULT_SPEED;
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
