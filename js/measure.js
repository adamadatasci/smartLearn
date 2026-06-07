'use strict';

const CONFIG = {
    unit: 32,
    lessonModes: {
        surface: {
            label: 'Surface can be made two ways: scan one side across the other side.',
            short: 'Surface / Area'
        },
        perimeter: {
            label: 'Perimeter means a walk around the outside edge.',
            short: 'Perimeter'
        },
        parameters: {
            label: 'Drag the bright dots to change width, height, side, base, or radius.',
            short: 'Needed sizes'
        }
    },
    shapes: [
        {
            kind: 'rectangle',
            name: 'Rectangle',
            color: '#38d8ff',
            dims: { width: 8, height: 4 },
            formula: 'Area = width × height',
            perimeterFormula: 'Perimeter = 2 × (width + height)',
            lesson: 'Multiplication makes equal rows faster than repeated addition.'
        },
        {
            kind: 'square',
            name: 'Square',
            color: '#69ff9c',
            dims: { side: 5 },
            formula: 'Area = side × side',
            perimeterFormula: 'Perimeter = 4 × side',
            lesson: 'A square is a rectangle with four equal sides.'
        },
        {
            kind: 'triangle',
            name: 'Triangle',
            color: '#ffce55',
            dims: { base: 8, height: 5, sides: [6, 6, 8] },
            formula: 'Area = (base × height) ÷ 2',
            perimeterFormula: 'Perimeter = side + side + base',
            lesson: 'Two matching triangles can make one rectangle.'
        },
        {
            kind: 'parallelogram',
            name: 'Parallelogram',
            color: '#b46cff',
            dims: { base: 7, height: 4, side: 5 },
            formula: 'Area = base × height',
            perimeterFormula: 'Perimeter = 2 × (base + side)',
            lesson: 'Slide the slanted part and it becomes a rectangle.'
        },
        {
            kind: 'trapezoid',
            name: 'Trapezoid',
            color: '#ff7aa8',
            dims: { top: 4, bottom: 8, height: 4, sides: [5, 5] },
            formula: 'Area = ((top + bottom) × height) ÷ 2',
            perimeterFormula: 'Perimeter = top + bottom + side + side',
            lesson: 'Add the two parallel sides, then average them across the height.'
        },
        {
            kind: 'circle',
            name: 'Circle',
            color: '#48f2d3',
            dims: { radius: 3 },
            formula: 'Area ≈ π × radius²',
            perimeterFormula: 'Circumference ≈ 2 × π × radius',
            lesson: 'A circle surface grows by radius squared.'
        }
    ]
};

const TAU = Math.PI * 2;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function colorWithAlpha(hex, alpha) {
    const value = hex.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

class ShapeLab2D {
    constructor() {
        this.canvas = document.getElementById('measure-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('overlay');
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.message = document.getElementById('message');
        this.stats = document.getElementById('stats-panel');
        this.modeButtons = Array.from(document.querySelectorAll('.lesson-mode'));
        this.shapeIndex = 0;
        this.lessonMode = 'surface';
        this.cards = [];
        this.stars = [];
        this.running = false;
        this.pulse = 0;
        this.animationStart = 0;
        this.dragHandle = null;
        this.defaultDims = CONFIG.shapes.map(shape => JSON.parse(JSON.stringify(shape.dims)));

        this.resize();
        this.makeStars();
        this.bind();
        this.setShape(0, true);
        requestAnimationFrame(t => this.loop(t));
    }

    bind() {
        window.addEventListener('resize', () => this.resize());
        this.startBtn.addEventListener('click', () => this.start());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.modeButtons.forEach(button => {
            button.addEventListener('click', () => this.setLessonMode(button.dataset.mode));
        });
        this.canvas.addEventListener('pointerdown', e => this.handlePointer(e));
        this.canvas.addEventListener('pointermove', e => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerup', () => this.stopDrag());
        this.canvas.addEventListener('pointercancel', () => this.stopDrag());
        window.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight' || e.key === ' ') this.nextShape();
            if (e.key === 'ArrowLeft') this.prevShape();
            if (e.key === 'r' || e.key === 'R') this.reset();
            if (e.key === '1') this.setLessonMode('surface');
            if (e.key === '2') this.setLessonMode('perimeter');
            if (e.key === '3') this.setLessonMode('parameters');
        });
    }

    resize() {
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.floor(this.w * dpr);
        this.canvas.height = Math.floor(this.h * dpr);
        this.canvas.style.width = `${this.w}px`;
        this.canvas.style.height = `${this.h}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.unit = clamp(Math.min(this.w, this.h) / 24, 18, CONFIG.unit);
        this.layoutCards();
    }

    makeStars() {
        this.stars = Array.from({ length: 95 }, () => ({
            x: Math.random() * this.w,
            y: Math.random() * this.h,
            r: 0.7 + Math.random() * 1.8,
            a: 0.12 + Math.random() * 0.42,
            s: 4 + Math.random() * 18
        }));
    }

    start() {
        this.running = true;
        document.body.classList.add('running');
        this.overlay.classList.add('hidden');
        this.setMessage('Tap Surface, Perimeter, or Sizes. Tap the big shape to change the lesson.', 'good');
    }

    reset() {
        CONFIG.shapes.forEach((shape, index) => {
            shape.dims = JSON.parse(JSON.stringify(this.defaultDims[index]));
        });
        this.setShape(0);
        this.setMessage('Reset complete. Start with the rectangle: rows × columns.', 'good');
    }

    layoutCards() {
        const cardW = clamp(this.w / 7.4, 92, 138);
        const cardH = 58;
        const gap = 10;
        const totalW = CONFIG.shapes.length * cardW + (CONFIG.shapes.length - 1) * gap;
        const startX = Math.max(12, (this.w - totalW) / 2);
        const y = this.h - cardH - 20;
        this.cards = CONFIG.shapes.map((shape, i) => ({
            shape,
            x: startX + i * (cardW + gap),
            y,
            w: cardW,
            h: cardH
        }));
    }

    handlePointer(e) {
        if (!this.running) return;
        const cardIndex = this.cards.findIndex(card =>
            e.clientX >= card.x && e.clientX <= card.x + card.w &&
            e.clientY >= card.y && e.clientY <= card.y + card.h
        );
        if (cardIndex >= 0) {
            this.setShape(cardIndex);
            return;
        }

        const shape = CONFIG.shapes[this.shapeIndex];
        if (this.lessonMode === 'parameters') {
            const handle = this.hitParameterHandle(e.clientX, e.clientY, shape);
            if (handle) {
                this.dragHandle = handle;
                this.canvas.setPointerCapture?.(e.pointerId);
                this.setMessage(`Drag ${handle.label} to change it.`, 'good');
                this.updateDraggedParameter(e.clientX, e.clientY);
                return;
            }
        }

        this.cycleLessonMode();
        this.setMessage(`${shape.name}: ${CONFIG.lessonModes[this.lessonMode].label}`, 'good');
    }

    handlePointerMove(e) {
        if (!this.dragHandle) return;
        this.updateDraggedParameter(e.clientX, e.clientY);
    }

    stopDrag() {
        if (!this.dragHandle) return;
        this.dragHandle = null;
        this.animationStart = this.pulse;
    }

    cycleLessonMode() {
        const modes = Object.keys(CONFIG.lessonModes);
        const next = modes[(modes.indexOf(this.lessonMode) + 1) % modes.length];
        this.setLessonMode(next);
    }

    setLessonMode(mode) {
        if (!CONFIG.lessonModes[mode]) return;
        this.lessonMode = mode;
        this.animationStart = this.pulse;
        this.modeButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.mode === mode);
        });
        this.setMessage(CONFIG.lessonModes[mode].label, 'good');
        this.updateStats();
    }

    nextShape() {
        this.setShape((this.shapeIndex + 1) % CONFIG.shapes.length);
    }

    prevShape() {
        this.setShape((this.shapeIndex - 1 + CONFIG.shapes.length) % CONFIG.shapes.length);
    }

    setShape(index, silent) {
        this.shapeIndex = index;
        const shape = CONFIG.shapes[index];
        this.animationStart = this.pulse;
        if (!silent) this.setMessage(`${shape.name}: ${CONFIG.lessonModes[this.lessonMode].label} ${shape.lesson}`, 'good');
        this.updateStats();
    }

    setMessage(text, state) {
        this.message.textContent = text;
        this.message.classList.remove('good', 'warn');
        if (state) this.message.classList.add(state);
    }

    loop(t) {
        this.pulse = t * 0.001;
        this.update(1 / 60);
        this.draw();
        requestAnimationFrame(next => this.loop(next));
    }

    update(dt) {
        for (const star of this.stars) {
            star.y += star.s * dt;
            if (star.y > this.h + 8) {
                star.y = -8;
                star.x = Math.random() * this.w;
            }
        }
        this.updateStats();
    }

    metrics(shape) {
        const d = shape.dims;
        switch (shape.kind) {
            case 'rectangle':
                return {
                    area: d.width * d.height,
                    perimeter: 2 * (d.width + d.height),
                    addition: Array.from({ length: d.height }, () => d.width).join(' + '),
                    multiplication: `${d.height} × ${d.width}`
                };
            case 'square':
                return {
                    area: d.side * d.side,
                    perimeter: 4 * d.side,
                    addition: Array.from({ length: d.side }, () => d.side).join(' + '),
                    multiplication: `${d.side} × ${d.side}`
                };
            case 'triangle':
                return {
                    area: d.base * d.height / 2,
                    perimeter: d.sides.reduce((sum, side) => sum + side, 0),
                    addition: `${d.base} × ${d.height} = ${d.base * d.height}, then half`,
                    multiplication: `(${d.base} × ${d.height}) ÷ 2`
                };
            case 'parallelogram':
                return {
                    area: d.base * d.height,
                    perimeter: 2 * (d.base + d.side),
                    addition: Array.from({ length: d.height }, () => d.base).join(' + '),
                    multiplication: `${d.base} × ${d.height}`
                };
            case 'trapezoid':
                return {
                    area: (d.top + d.bottom) * d.height / 2,
                    perimeter: d.top + d.bottom + d.sides[0] + d.sides[1],
                    addition: `${d.top} + ${d.bottom} = ${d.top + d.bottom}, average × ${d.height}`,
                    multiplication: `((${d.top} + ${d.bottom}) × ${d.height}) ÷ 2`
                };
            case 'circle': {
                const area = Math.PI * d.radius * d.radius;
                const perimeter = TAU * d.radius;
                return {
                    area,
                    perimeter,
                    addition: `π groups of ${d.radius}²`,
                    multiplication: `π × ${d.radius} × ${d.radius}`
                };
            }
            default:
                return { area: 0, perimeter: 0, addition: '', multiplication: '' };
        }
    }

    updateStats() {
        if (!this.stats) return;
        const shape = CONFIG.shapes[this.shapeIndex];
        const m = this.metrics(shape);
        this.stats.innerHTML = [
            `SHAPE: ${shape.name}`,
            `LESSON: ${CONFIG.lessonModes[this.lessonMode].short}`,
            `SURFACE / AREA: ${round(m.area, 2)} square units`,
            `PERIMETER: ${round(m.perimeter, 2)} units`,
            `MULTIPLICATION: ${m.multiplication}`,
            `ADDITION: ${m.addition}`
        ].join('<br>');
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
        this.drawBackground(ctx);
        this.drawLessonPanel(ctx);
        this.drawMainShape(ctx, CONFIG.shapes[this.shapeIndex]);
        this.drawCards(ctx);
        this.drawForeground(ctx);
    }

    drawBackground(ctx) {
        const g = ctx.createRadialGradient(this.w * 0.5, this.h * 0.38, 20, this.w * 0.5, this.h * 0.46, Math.max(this.w, this.h) * 0.78);
        g.addColorStop(0, '#153f5f');
        g.addColorStop(0.5, '#071829');
        g.addColorStop(1, '#02050d');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.w, this.h);

        for (const star of this.stars) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(145, 230, 255, ${star.a})`;
            ctx.arc(star.x, star.y, star.r, 0, TAU);
            ctx.fill();
        }

        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#58dfff';
        ctx.lineWidth = 1;
        const grid = this.unit;
        for (let x = (this.w % grid) - grid; x < this.w + grid; x += grid) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + this.h * 0.16, this.h);
            ctx.stroke();
        }
        for (let y = 0; y < this.h; y += grid) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.w, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawLessonPanel(ctx) {
        const shape = CONFIG.shapes[this.shapeIndex];
        const m = this.metrics(shape);
        const x = 24;
        const y = 86;
        const w = Math.min(380, this.w - 48);
        const h = 210;

        ctx.save();
        ctx.fillStyle = 'rgba(2, 12, 26, 0.68)';
        ctx.strokeStyle = colorWithAlpha(shape.color, 0.55);
        ctx.lineWidth = 1.5;
        this.roundRect(ctx, x, y, w, h, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#eaffff';
        ctx.font = '800 22px Segoe UI, sans-serif';
        ctx.fillText(shape.name, x + 20, y + 34);

        ctx.font = '600 14px Segoe UI, sans-serif';
        ctx.fillStyle = '#9df2ff';
        ctx.fillText(`Surface / Area: ${round(m.area, 2)} square units`, x + 20, y + 70);
        ctx.fillText(`Perimeter: ${round(m.perimeter, 2)} units`, x + 20, y + 96);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 13px Segoe UI, sans-serif';
        ctx.fillText(shape.formula, x + 20, y + 132);
        ctx.fillText(shape.perimeterFormula, x + 20, y + 156);

        ctx.fillStyle = '#b9eaff';
        ctx.font = '600 12px Segoe UI, sans-serif';
        this.wrapText(ctx, shape.lesson, x + 20, y + 184, w - 40, 17);
        ctx.restore();
    }

    drawMainShape(ctx, shape) {
        const { x: cx, y: cy } = this.shapeCenter();
        const u = this.unit;
        const d = shape.dims;
        const glow = 0.65 + Math.sin(this.pulse * 3) * 0.12;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.shadowBlur = 24;
        ctx.shadowColor = shape.color;
        ctx.lineWidth = 3;
        ctx.strokeStyle = shape.color;
        ctx.fillStyle = colorWithAlpha(shape.color, 0.25);

        switch (shape.kind) {
            case 'rectangle':
                this.drawGridRectangle(ctx, -d.width * u / 2, -d.height * u / 2, d.width, d.height, u, shape.color);
                break;
            case 'square':
                this.drawGridRectangle(ctx, -d.side * u / 2, -d.side * u / 2, d.side, d.side, u, shape.color);
                break;
            case 'triangle':
                this.drawTriangle(ctx, d.base, d.height, u, shape.color);
                break;
            case 'parallelogram':
                this.drawParallelogram(ctx, d.base, d.height, u, shape.color);
                break;
            case 'trapezoid':
                this.drawTrapezoid(ctx, d.top, d.bottom, d.height, u, shape.color);
                break;
            case 'circle':
                this.drawCircle(ctx, d.radius, u, shape.color);
                break;
        }

        ctx.globalAlpha = glow;
        ctx.strokeStyle = '#eaffff';
        ctx.lineWidth = 1.5;
        this.drawDimensionGuides(ctx, shape, u);
        this.drawTeachingAnimation(ctx, shape, u);
        ctx.restore();
    }

    drawTeachingAnimation(ctx, shape, u) {
        if (!this.running) return;
        const time = Math.max(0, this.pulse - this.animationStart);
        if (this.lessonMode === 'surface') {
            this.drawSurfaceAnimation(ctx, shape, u, time);
        } else if (this.lessonMode === 'perimeter') {
            this.drawPerimeterAnimation(ctx, shape, u, time);
        } else if (this.lessonMode === 'parameters') {
            this.drawParameterAnimation(ctx, shape, u, time);
        }
    }

    drawSurfaceAnimation(ctx, shape, u, time) {
        const m = this.metrics(shape);
        const progress = (time * 0.34) % 1;
        const bounce = Math.sin(this.pulse * 6) * 3;

        if (shape.kind === 'circle') {
            this.drawCircleSurfaceScan(ctx, shape, u, progress);
        } else {
            this.drawDualSurfaceScan(ctx, shape, u, progress);
        }

        const label = shape.kind === 'circle'
            ? `radius turns = ${round(m.area, 1)} squares`
            : `two scans make ${round(m.area, 1)} squares`;
        this.drawToddlerBadge(ctx, 0, -this.shapeHeight(shape, u) / 2 - 50 + bounce, label, shape.color);
    }

    drawDualSurfaceScan(ctx, shape, u, progress) {
        const d = shape.dims;
        const firstActive = progress < 0.5;
        const firstProgress = firstActive ? progress * 2 : 1;
        const secondProgress = firstActive ? 0 : (progress - 0.5) * 2;
        this.drawSideSurfaceScan(ctx, shape, u, firstProgress, 'vertical', '#ffffff', 0.42);
        if (!firstActive || secondProgress > 0.02) {
            this.drawSideSurfaceScan(ctx, shape, u, secondProgress, 'horizontal', '#ffe86f', 0.28);
        }

        if (shape.kind === 'rectangle') {
            const longSide = Math.max(d.width, d.height);
            const shortSide = Math.min(d.width, d.height);
            this.drawMiniLabel(ctx, 0, d.height * u / 2 + 78, `${longSide} scans ${shortSide}`, '#ffffff');
            this.drawMiniLabel(ctx, 0, -d.height * u / 2 - 78, `${shortSide} scans ${longSide}`, '#ffe86f');
        } else if (shape.kind === 'square') {
            this.drawMiniLabel(ctx, 0, d.side * u / 2 + 78, 'side scans side', '#ffffff');
            this.drawMiniLabel(ctx, 0, -d.side * u / 2 - 78, 'same both ways', '#ffe86f');
        } else if (shape.kind === 'triangle') {
            this.drawMiniLabel(ctx, 0, d.height * u / 2 + 78, 'base scans height, then half', '#ffffff');
            this.drawMiniLabel(ctx, 0, -d.height * u / 2 - 78, 'height scans base, then half', '#ffe86f');
        } else if (shape.kind === 'parallelogram') {
            this.drawMiniLabel(ctx, 0, d.height * u / 2 + 78, 'base scans height', '#ffffff');
            this.drawMiniLabel(ctx, 0, -d.height * u / 2 - 78, 'height scans base', '#ffe86f');
        } else if (shape.kind === 'trapezoid') {
            this.drawMiniLabel(ctx, 0, d.height * u / 2 + 78, 'average side scans height', '#ffffff');
            this.drawMiniLabel(ctx, 0, -d.height * u / 2 - 78, 'height scans average side', '#ffe86f');
        }
    }

    drawSideSurfaceScan(ctx, shape, u, progress, direction, scanColor = '#ffffff', fillAlpha = 0.5) {
        const bounds = this.shapeBounds(shape, u);
        const eased = 0.5 - Math.cos(progress * Math.PI) * 0.5;

        ctx.save();
        ctx.globalAlpha = 1;
        this.clipShape(ctx, shape, u);
        ctx.fillStyle = scanColor === '#ffffff' ? colorWithAlpha(shape.color, fillAlpha) : colorWithAlpha('#ffce55', fillAlpha);
        if (direction === 'vertical') {
            ctx.fillRect(bounds.x, bounds.y, bounds.w * eased, bounds.h);
        } else {
            const filledHeight = bounds.h * eased;
            ctx.fillRect(bounds.x, bounds.y + bounds.h - filledHeight, bounds.w, filledHeight);
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 1;
        this.clipShape(ctx, shape, u);
        ctx.shadowBlur = 18;
        ctx.shadowColor = scanColor;
        ctx.strokeStyle = scanColor;
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        if (direction === 'vertical') {
            const x = bounds.x + bounds.w * eased;
            ctx.moveTo(x, bounds.y - 12);
            ctx.lineTo(x, bounds.y + bounds.h + 12);
        } else {
            const y = bounds.y + bounds.h * (1 - eased);
            ctx.moveTo(bounds.x - 14, y);
            ctx.lineTo(bounds.x + bounds.w + 14, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawCircleSurfaceScan(ctx, shape, u, progress) {
        const r = shape.dims.radius * u;
        const angle = -Math.PI / 2 + TAU * progress;

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, -Math.PI / 2, angle);
        ctx.closePath();
        ctx.fillStyle = colorWithAlpha(shape.color, 0.52);
        ctx.fill();

        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r, Math.max(6, u * 0.18), 0, TAU);
        ctx.fill();
        ctx.restore();

        this.drawMiniLabel(ctx, 0, r + 62, 'one radius turns around', '#ffffff');
    }

    drawPerimeterAnimation(ctx, shape, u, time) {
        const m = this.metrics(shape);
        const progress = (time * 0.24) % 1;
        const radius = Math.max(7, u * 0.22);

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#fff6a5';
        ctx.lineWidth = 9;
        ctx.globalAlpha = 0.34;
        this.strokeShapeOutline(ctx, shape, u, 1);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffe86f';
        ctx.lineWidth = 7;
        this.strokeShapeOutline(ctx, shape, u, progress);

        const p = this.pointOnPerimeter(shape, u, progress);
        ctx.fillStyle = '#ffe86f';
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#3a2600';
        ctx.font = `900 ${Math.max(11, radius)}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐜', p.x, p.y + 1);
        ctx.restore();

        this.drawToddlerBadge(ctx, 0, this.shapeHeight(shape, u) / 2 + 58, `walk outside = ${round(m.perimeter, 1)} units`, '#ffe86f');
    }

    drawParameterAnimation(ctx, shape, u, time) {
        const d = shape.dims;
        const bob = Math.sin(this.pulse * 4) * 4;
        const labels = this.parameterLabels(shape, u);

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 16px Segoe UI, sans-serif';

        labels.forEach((label, index) => {
            const alpha = 0.55 + Math.sin(time * 5 + index) * 0.25;
            ctx.globalAlpha = alpha;
            this.drawArrow(ctx, label.x1, label.y1, label.x2, label.y2, label.color);
            ctx.globalAlpha = 1;
            this.drawMiniLabel(ctx, label.tx, label.ty + bob, label.text, label.color);
        });
        this.drawParameterHandles(ctx, shape, u);
        ctx.restore();

        const names = Object.keys(d).filter(key => key !== 'sides').join(' + ');
        this.drawToddlerBadge(ctx, 0, -this.shapeHeight(shape, u) / 2 - 78, `drag dots: ${names}`, shape.color);
    }

    drawGridRectangle(ctx, x, y, cols, rows, u, color) {
        ctx.save();
        ctx.fillStyle = colorWithAlpha(color, 0.22);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        this.roundRect(ctx, x, y, cols * u, rows * u, 8);
        ctx.fill();
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.strokeStyle = colorWithAlpha('#ffffff', 0.36);
        for (let c = 1; c < cols; c++) {
            ctx.beginPath();
            ctx.moveTo(x + c * u, y);
            ctx.lineTo(x + c * u, y + rows * u);
            ctx.stroke();
        }
        for (let r = 1; r < rows; r++) {
            ctx.beginPath();
            ctx.moveTo(x, y + r * u);
            ctx.lineTo(x + cols * u, y + r * u);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawTriangle(ctx, base, height, u, color) {
        const w = base * u;
        const h = height * u;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-w / 2, h / 2);
        ctx.lineTo(0, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.closePath();
        ctx.fillStyle = colorWithAlpha(color, 0.24);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();
        ctx.clip();
        this.drawLocalGrid(ctx, -w / 2, -h / 2, w, h, u, color);
        ctx.restore();
    }

    drawParallelogram(ctx, base, height, u, color) {
        const w = base * u;
        const h = height * u;
        const skew = 1.4 * u;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-w / 2 + skew, -h / 2);
        ctx.lineTo(w / 2 + skew, -h / 2);
        ctx.lineTo(w / 2 - skew, h / 2);
        ctx.lineTo(-w / 2 - skew, h / 2);
        ctx.closePath();
        ctx.fillStyle = colorWithAlpha(color, 0.24);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();
        ctx.clip();
        this.drawLocalGrid(ctx, -w / 2 - skew, -h / 2, w + skew * 2, h, u, color);
        ctx.restore();
    }

    drawTrapezoid(ctx, top, bottom, height, u, color) {
        const tw = top * u;
        const bw = bottom * u;
        const h = height * u;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-tw / 2, -h / 2);
        ctx.lineTo(tw / 2, -h / 2);
        ctx.lineTo(bw / 2, h / 2);
        ctx.lineTo(-bw / 2, h / 2);
        ctx.closePath();
        ctx.fillStyle = colorWithAlpha(color, 0.24);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();
        ctx.clip();
        this.drawLocalGrid(ctx, -bw / 2, -h / 2, bw, h, u, color);
        ctx.restore();
    }

    drawCircle(ctx, radius, u, color) {
        const r = radius * u;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fillStyle = colorWithAlpha(color, 0.24);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();
        ctx.clip();
        this.drawLocalGrid(ctx, -r, -r, r * 2, r * 2, u, color);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r, 0);
        ctx.stroke();
        ctx.fillStyle = '#eaffff';
        ctx.font = '700 13px Segoe UI, sans-serif';
        ctx.fillText('r', r / 2 - 4, -8);
        ctx.restore();
    }

    drawLocalGrid(ctx, x, y, w, h, u, color) {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = colorWithAlpha('#ffffff', 0.26);
        for (let gx = x; gx <= x + w + 0.1; gx += u) {
            ctx.beginPath();
            ctx.moveTo(gx, y);
            ctx.lineTo(gx, y + h);
            ctx.stroke();
        }
        for (let gy = y; gy <= y + h + 0.1; gy += u) {
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + w, gy);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawDimensionGuides(ctx, shape, u) {
        const d = shape.dims;
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#eaffff';
        ctx.font = '800 15px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        if (shape.kind === 'rectangle') {
            ctx.fillText(`${d.width}`, 0, d.height * u / 2 + 30);
            ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText(`${d.height}`, 0, d.width * u / 2 + 38); ctx.restore();
        } else if (shape.kind === 'square') {
            ctx.fillText(`${d.side}`, 0, d.side * u / 2 + 30);
            ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText(`${d.side}`, 0, d.side * u / 2 + 38); ctx.restore();
        } else if (shape.kind === 'triangle') {
            ctx.fillText(`base ${d.base}`, 0, d.height * u / 2 + 30);
            ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText(`height ${d.height}`, 0, 20); ctx.restore();
        } else if (shape.kind === 'parallelogram') {
            ctx.fillText(`base ${d.base}`, 0, d.height * u / 2 + 30);
            ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText(`height ${d.height}`, 0, 20); ctx.restore();
        } else if (shape.kind === 'trapezoid') {
            ctx.fillText(`top ${d.top}`, 0, -d.height * u / 2 - 12);
            ctx.fillText(`bottom ${d.bottom}`, 0, d.height * u / 2 + 30);
        }
        ctx.restore();
    }

    getSurfaceCells(shape, u) {
        const bounds = this.shapeBounds(shape, u);
        const cells = [];
        for (let y = bounds.y; y < bounds.y + bounds.h - 0.1; y += u) {
            for (let x = bounds.x; x < bounds.x + bounds.w - 0.1; x += u) {
                const cx = x + u / 2;
                const cy = y + u / 2;
                if (this.pointInsideShape(shape, u, cx, cy)) {
                    cells.push({ x, y, w: u, h: u });
                }
            }
        }
        return cells;
    }

    shapeBounds(shape, u) {
        const d = shape.dims;
        if (shape.kind === 'rectangle') return { x: -d.width * u / 2, y: -d.height * u / 2, w: d.width * u, h: d.height * u };
        if (shape.kind === 'square') return { x: -d.side * u / 2, y: -d.side * u / 2, w: d.side * u, h: d.side * u };
        if (shape.kind === 'triangle') return { x: -d.base * u / 2, y: -d.height * u / 2, w: d.base * u, h: d.height * u };
        if (shape.kind === 'parallelogram') {
            const skew = 1.4 * u;
            return { x: -d.base * u / 2 - skew, y: -d.height * u / 2, w: d.base * u + skew * 2, h: d.height * u };
        }
        if (shape.kind === 'trapezoid') return { x: -d.bottom * u / 2, y: -d.height * u / 2, w: d.bottom * u, h: d.height * u };
        const r = d.radius * u;
        return { x: -r, y: -r, w: r * 2, h: r * 2 };
    }

    shapeHeight(shape, u) {
        return this.shapeBounds(shape, u).h;
    }

    pointInsideShape(shape, u, x, y) {
        if (shape.kind === 'circle') {
            const r = shape.dims.radius * u;
            return x * x + y * y <= r * r;
        }
        return this.pointInPolygon({ x, y }, this.outlinePoints(shape, u));
    }

    pointInPolygon(point, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const pi = points[i];
            const pj = points[j];
            const hit = (pi.y > point.y) !== (pj.y > point.y) &&
                point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x;
            if (hit) inside = !inside;
        }
        return inside;
    }

    outlinePoints(shape, u) {
        const d = shape.dims;
        if (shape.kind === 'rectangle') {
            const w = d.width * u;
            const h = d.height * u;
            return [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
        }
        if (shape.kind === 'square') {
            const s = d.side * u;
            return [{ x: -s / 2, y: -s / 2 }, { x: s / 2, y: -s / 2 }, { x: s / 2, y: s / 2 }, { x: -s / 2, y: s / 2 }];
        }
        if (shape.kind === 'triangle') {
            const w = d.base * u;
            const h = d.height * u;
            return [{ x: -w / 2, y: h / 2 }, { x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 }];
        }
        if (shape.kind === 'parallelogram') {
            const w = d.base * u;
            const h = d.height * u;
            const skew = 1.4 * u;
            return [{ x: -w / 2 + skew, y: -h / 2 }, { x: w / 2 + skew, y: -h / 2 }, { x: w / 2 - skew, y: h / 2 }, { x: -w / 2 - skew, y: h / 2 }];
        }
        if (shape.kind === 'trapezoid') {
            const tw = d.top * u;
            const bw = d.bottom * u;
            const h = d.height * u;
            return [{ x: -tw / 2, y: -h / 2 }, { x: tw / 2, y: -h / 2 }, { x: bw / 2, y: h / 2 }, { x: -bw / 2, y: h / 2 }];
        }
        return [];
    }

    clipShape(ctx, shape, u) {
        if (shape.kind === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, shape.dims.radius * u, 0, TAU);
            ctx.clip();
            return;
        }
        const points = this.outlinePoints(shape, u);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.clip();
    }

    strokeShapeOutline(ctx, shape, u, progress) {
        if (shape.kind === 'circle') {
            const r = shape.dims.radius * u;
            ctx.beginPath();
            ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
            ctx.stroke();
            return;
        }
        const points = this.outlinePoints(shape, u);
        const segments = this.polySegments(points);
        const target = segments.total * progress;
        let travelled = 0;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (const segment of segments.parts) {
            const next = travelled + segment.length;
            if (target >= next) {
                ctx.lineTo(segment.b.x, segment.b.y);
            } else {
                const local = clamp((target - travelled) / segment.length, 0, 1);
                ctx.lineTo(segment.a.x + (segment.b.x - segment.a.x) * local, segment.a.y + (segment.b.y - segment.a.y) * local);
                break;
            }
            travelled = next;
        }
        ctx.stroke();
    }

    pointOnPerimeter(shape, u, progress) {
        if (shape.kind === 'circle') {
            const angle = -Math.PI / 2 + TAU * progress;
            const r = shape.dims.radius * u;
            return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
        }
        const segments = this.polySegments(this.outlinePoints(shape, u));
        const target = segments.total * progress;
        let travelled = 0;
        for (const segment of segments.parts) {
            const next = travelled + segment.length;
            if (target <= next) {
                const local = clamp((target - travelled) / segment.length, 0, 1);
                return {
                    x: segment.a.x + (segment.b.x - segment.a.x) * local,
                    y: segment.a.y + (segment.b.y - segment.a.y) * local
                };
            }
            travelled = next;
        }
        return segments.parts[0].a;
    }

    polySegments(points) {
        const parts = [];
        let total = 0;
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            parts.push({ a, b, length });
            total += length;
        }
        return { parts, total };
    }

    parameterLabels(shape, u) {
        const d = shape.dims;
        const color = shape.color;
        if (shape.kind === 'rectangle') {
            const w = d.width * u;
            const h = d.height * u;
            return [
                { x1: -w / 2, y1: h / 2 + 24, x2: w / 2, y2: h / 2 + 24, tx: 0, ty: h / 2 + 48, text: `width ${d.width}`, color },
                { x1: -w / 2 - 24, y1: -h / 2, x2: -w / 2 - 24, y2: h / 2, tx: -w / 2 - 68, ty: 0, text: `height ${d.height}`, color }
            ];
        }
        if (shape.kind === 'square') {
            const s = d.side * u;
            return [
                { x1: -s / 2, y1: s / 2 + 24, x2: s / 2, y2: s / 2 + 24, tx: 0, ty: s / 2 + 48, text: `side ${d.side}`, color },
                { x1: s / 2 + 24, y1: -s / 2, x2: s / 2 + 24, y2: s / 2, tx: s / 2 + 66, ty: 0, text: `side ${d.side}`, color }
            ];
        }
        if (shape.kind === 'triangle') {
            const w = d.base * u;
            const h = d.height * u;
            return [
                { x1: -w / 2, y1: h / 2 + 24, x2: w / 2, y2: h / 2 + 24, tx: 0, ty: h / 2 + 48, text: `base ${d.base}`, color },
                { x1: 0, y1: -h / 2, x2: 0, y2: h / 2, tx: 54, ty: 0, text: `height ${d.height}`, color }
            ];
        }
        if (shape.kind === 'parallelogram') {
            const w = d.base * u;
            const h = d.height * u;
            return [
                { x1: -w / 2, y1: h / 2 + 24, x2: w / 2, y2: h / 2 + 24, tx: 0, ty: h / 2 + 48, text: `base ${d.base}`, color },
                { x1: 0, y1: -h / 2, x2: 0, y2: h / 2, tx: 58, ty: 0, text: `height ${d.height}`, color },
                { x1: -w / 2 - 36, y1: -h / 2, x2: -w / 2 - 36, y2: h / 2, tx: -w / 2 - 82, ty: 0, text: `side ${d.side}`, color }
            ];
        }
        if (shape.kind === 'trapezoid') {
            const tw = d.top * u;
            const bw = d.bottom * u;
            const h = d.height * u;
            return [
                { x1: -tw / 2, y1: -h / 2 - 24, x2: tw / 2, y2: -h / 2 - 24, tx: 0, ty: -h / 2 - 48, text: `top ${d.top}`, color },
                { x1: -bw / 2, y1: h / 2 + 24, x2: bw / 2, y2: h / 2 + 24, tx: 0, ty: h / 2 + 48, text: `bottom ${d.bottom}`, color },
                { x1: 0, y1: -h / 2, x2: 0, y2: h / 2, tx: 58, ty: 0, text: `height ${d.height}`, color }
            ];
        }
        const r = d.radius * u;
        return [{ x1: 0, y1: 0, x2: r, y2: 0, tx: r / 2, ty: -30, text: `radius ${d.radius}`, color }];
    }

    shapeCenter() {
        return { x: this.w * 0.61, y: this.h * 0.43 };
    }

    toLocalPoint(clientX, clientY) {
        const center = this.shapeCenter();
        return { x: clientX - center.x, y: clientY - center.y };
    }

    parameterHandles(shape, u) {
        const d = shape.dims;
        const color = shape.color;
        if (shape.kind === 'rectangle') {
            return [
                { key: 'width', label: 'width', x: d.width * u / 2, y: 0, color },
                { key: 'height', label: 'height', x: -d.width * u / 2 - 24, y: -d.height * u / 2, color }
            ];
        }
        if (shape.kind === 'square') {
            return [{ key: 'side', label: 'side', x: d.side * u / 2, y: d.side * u / 2, color }];
        }
        if (shape.kind === 'triangle') {
            return [
                { key: 'base', label: 'base', x: d.base * u / 2, y: d.height * u / 2 + 24, color },
                { key: 'height', label: 'height', x: 0, y: -d.height * u / 2, color }
            ];
        }
        if (shape.kind === 'parallelogram') {
            return [
                { key: 'base', label: 'base', x: d.base * u / 2, y: d.height * u / 2 + 24, color },
                { key: 'height', label: 'height', x: 0, y: -d.height * u / 2, color }
            ];
        }
        if (shape.kind === 'trapezoid') {
            return [
                { key: 'top', label: 'top', x: d.top * u / 2, y: -d.height * u / 2 - 24, color },
                { key: 'bottom', label: 'bottom', x: d.bottom * u / 2, y: d.height * u / 2 + 24, color },
                { key: 'height', label: 'height', x: 0, y: -d.height * u / 2, color }
            ];
        }
        const r = d.radius * u;
        return [{ key: 'radius', label: 'radius', x: r, y: 0, color }];
    }

    hitParameterHandle(clientX, clientY, shape) {
        const local = this.toLocalPoint(clientX, clientY);
        const handles = this.parameterHandles(shape, this.unit);
        const hitRadius = Math.max(20, this.unit * 0.58);
        for (const handle of handles) {
            if (Math.hypot(local.x - handle.x, local.y - handle.y) <= hitRadius) {
                return { ...handle, shapeKind: shape.kind };
            }
        }
        return null;
    }

    updateDraggedParameter(clientX, clientY) {
        if (!this.dragHandle) return;
        const shape = CONFIG.shapes[this.shapeIndex];
        const d = shape.dims;
        const local = this.toLocalPoint(clientX, clientY);
        const u = this.unit;
        const key = this.dragHandle.key;

        if (shape.kind === 'rectangle') {
            if (key === 'width') d.width = clamp(Math.round(Math.abs(local.x) * 2 / u), 2, 11);
            if (key === 'height') d.height = clamp(Math.round(Math.abs(local.y) * 2 / u), 2, 8);
        } else if (shape.kind === 'square') {
            d.side = clamp(Math.round(Math.max(Math.abs(local.x), Math.abs(local.y)) * 2 / u), 2, 8);
        } else if (shape.kind === 'triangle') {
            if (key === 'base') d.base = clamp(Math.round(Math.abs(local.x) * 2 / u), 3, 11);
            if (key === 'height') d.height = clamp(Math.round(Math.abs(local.y) * 2 / u), 2, 8);
            this.updateDerivedSides(shape);
        } else if (shape.kind === 'parallelogram') {
            if (key === 'base') d.base = clamp(Math.round(Math.abs(local.x) * 2 / u), 3, 10);
            if (key === 'height') d.height = clamp(Math.round(Math.abs(local.y) * 2 / u), 2, 8);
            this.updateDerivedSides(shape);
        } else if (shape.kind === 'trapezoid') {
            if (key === 'top') d.top = clamp(Math.round(Math.abs(local.x) * 2 / u), 2, Math.max(2, d.bottom - 1));
            if (key === 'bottom') d.bottom = clamp(Math.round(Math.abs(local.x) * 2 / u), Math.max(3, d.top + 1), 11);
            if (key === 'height') d.height = clamp(Math.round(Math.abs(local.y) * 2 / u), 2, 8);
            this.updateDerivedSides(shape);
        } else if (shape.kind === 'circle') {
            d.radius = clamp(Math.round(Math.hypot(local.x, local.y) / u), 1, 5);
        }

        this.setMessage(`${shape.name}: ${this.dragHandle.label} = ${shape.dims[key]}`, 'good');
        this.updateStats();
    }

    updateDerivedSides(shape) {
        const d = shape.dims;
        if (shape.kind === 'triangle') {
            const side = round(Math.hypot(d.height, d.base / 2), 1);
            d.sides = [side, side, d.base];
        } else if (shape.kind === 'parallelogram') {
            d.side = round(Math.hypot(d.height, 2.8), 1);
        } else if (shape.kind === 'trapezoid') {
            const side = round(Math.hypot(d.height, Math.abs(d.bottom - d.top) / 2), 1);
            d.sides = [side, side];
        }
    }

    drawParameterHandles(ctx, shape, u) {
        const handles = this.parameterHandles(shape, u);
        handles.forEach(handle => {
            const active = this.dragHandle && this.dragHandle.key === handle.key;
            ctx.save();
            ctx.shadowBlur = active ? 26 : 16;
            ctx.shadowColor = '#ffffff';
            ctx.fillStyle = active ? '#ffffff' : handle.color;
            ctx.strokeStyle = '#06101c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, active ? 12 : 10, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = active ? '#06101c' : '#ffffff';
            ctx.font = '900 12px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('↔', handle.x, handle.y + 0.5);
            ctx.restore();
        });
    }

    drawArrow(ctx, x1, y1, x2, y2, color) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = 10;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        for (const end of [{ x: x1, y: y1, a: angle + Math.PI }, { x: x2, y: y2, a: angle }]) {
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x - Math.cos(end.a - 0.45) * head, end.y - Math.sin(end.a - 0.45) * head);
            ctx.lineTo(end.x - Math.cos(end.a + 0.45) * head, end.y - Math.sin(end.a + 0.45) * head);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawMiniLabel(ctx, x, y, text, color) {
        ctx.save();
        ctx.font = '900 15px Segoe UI, sans-serif';
        const width = ctx.measureText(text).width + 22;
        this.roundRect(ctx, x - width / 2, y - 16, width, 32, 16);
        ctx.fillStyle = colorWithAlpha(color, 0.82);
        ctx.fill();
        ctx.fillStyle = '#06101c';
        ctx.fillText(text, x, y + 1);
        ctx.restore();
    }

    drawToddlerBadge(ctx, x, y, text, color) {
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
        ctx.font = '900 18px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const width = Math.min(ctx.measureText(text).width + 36, this.w * 0.72);
        this.roundRect(ctx, x - width / 2, y - 22, width, 44, 22);
        ctx.fillStyle = colorWithAlpha(color, 0.9);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#04101d';
        ctx.fillText(text, x, y + 1);
        ctx.restore();
    }

    drawCards(ctx) {
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const active = i === this.shapeIndex;
            ctx.save();
            ctx.fillStyle = active ? colorWithAlpha(card.shape.color, 0.24) : 'rgba(2, 12, 26, 0.74)';
            ctx.strokeStyle = active ? '#ffffff' : colorWithAlpha(card.shape.color, 0.48);
            ctx.lineWidth = active ? 2 : 1;
            this.roundRect(ctx, card.x, card.y, card.w, card.h, 16);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#eaffff';
            ctx.font = '800 12px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(card.shape.name, card.x + card.w / 2, card.y + card.h / 2);
            ctx.restore();
        }
    }

    drawForeground(ctx) {
        if (!this.running) return;
        ctx.save();
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = '#b7f7ff';
        ctx.font = '700 14px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('2D Shapes: surface means area. Perimeter means the outside edge. Multiplication counts equal groups.', this.w / 2, 30);
        ctx.font = '800 12px Segoe UI, sans-serif';
        ctx.fillText('Keys: 1 Surface  •  2 Perimeter  •  3 Sizes  •  tap shape to switch', this.w / 2, 52);
        ctx.restore();
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        for (const word of words) {
            const testLine = line ? `${line} ${word}` : word;
            if (ctx.measureText(testLine).width > maxWidth && line) {
                ctx.fillText(line, x, y);
                line = word;
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        if (line) ctx.fillText(line, x, y);
    }

    roundRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new ShapeLab2D();
});
