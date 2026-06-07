'use strict';

// ============================================================================
//  CONFIGURATION
// ============================================================================
const CONFIG = {
    physics: {
        gravity:       95,      // px/s² (positive = downward in canvas coords)
        restitution:   0.42,
        airResistance: 0.9992,
        friction:      0.88,
        maxSpeed:      310
    },
    shapes: {
        maxCount:      18,
        spawnInterval: 2.15,
        minSize:       14,
        maxSize:       38,
        burstCount:    5,
        types:          ['circle', 'square', 'triangle', 'hexagon'],
        colors: [
            '#ff3366', '#33ff99', '#3399ff',
            '#ff9933', '#cc33ff', '#33ffff',
            '#ff6644', '#66ff33', '#8833ff',
            '#ff33cc', '#33ccff', '#ffcc33'
        ]
    },
    player: {
        baseSize: 55,     // legacy selector fallback
        barWidth: 210,
        barHeight: 18
    },
    buckets: {
        height: 118,
        padding: 18,
        matchPoints: 10,
        wrongPoints: -3
    }
};

// ============================================================================
//  SHAPE GEOMETRY HELPERS
// ============================================================================
/**
 * Return an array of {x, y} vertices for the given primitive.
 * hw / hh = half-width / half-height so the shape morphs with the body.
 */
function getShapeVertices(type, cx, cy, hw, hh, rotation) {
    rotation = rotation || 0;
    let verts = [];

    switch (type) {
        case 'circle': {
            // Use uniform radius so the circle never becomes an ellipse
            const r = (hw + hh) / 2;
            const N = 28;
            for (let i = 0; i < N; i++) {
                const a = (i / N) * Math.PI * 2;
                verts.push({ x: cx + Math.cos(a) * r,
                             y: cy + Math.sin(a) * r });
            }
            break;
        }
        case 'square':
            verts = [
                { x: cx - hw, y: cy - hh },
                { x: cx + hw, y: cy - hh },
                { x: cx + hw, y: cy + hh },
                { x: cx - hw, y: cy + hh }
            ];
            break;
        case 'triangle':
            verts = [
                { x: cx,      y: cy - hh },
                { x: cx + hw, y: cy + hh },
                { x: cx - hw, y: cy + hh }
            ];
            break;
        case 'hexagon':
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
                verts.push({ x: cx + Math.cos(a) * hw,
                             y: cy + Math.sin(a) * hh });
            }
            break;
    }

    // Apply rotation around centre
    if (rotation !== 0) {
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        for (const v of verts) {
            const dx = v.x - cx, dy = v.y - cy;
            v.x = cx + dx * cos - dy * sin;
            v.y = cy + dx * sin + dy * cos;
        }
    }
    return verts;
}

/** Stroke + fill a shape on a 2-D context. */
function drawShapePath(ctx, type, cx, cy, hw, hh, rotation) {
    ctx.beginPath();
    if (type === 'circle') {
        // Use uniform radius (average) so circle stays a circle, not an ellipse
        const r = (hw + hh) / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation || 0);
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.restore();
    } else {
        const verts = getShapeVertices(type, cx, cy, hw, hh, rotation);
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();
    }
}

// ============================================================================
//  COLLISION MATH
// ============================================================================
function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.0001) return { x: ax, y: ay };
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return { x: ax + t * dx, y: ay + t * dy };
}

function pointInPolygon(px, py, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y;
        const xj = verts[j].x, yj = verts[j].y;
        if ((yi > py) !== (yj > py) &&
            px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

// ============================================================================
//  FALLING SHAPE
// ============================================================================
class FallingShape {
    constructor(x, y, size, type, color) {
        this.x  = x;
        this.y  = y;
        this.vx = (Math.random() - 0.5) * 18;
        this.vy = Math.random() * 5;
        this.size = size;               // half-extent
        this.type = type;
        this.color = color;
        this.rotation   = Math.random() * Math.PI * 2;
        this.angularVel = (Math.random() - 0.5) * 0.75;
        this.scored = false;
        this.bucketCooldown = 0;
    }

    get radius() { return this.size; }  // bounding-circle approximation

    step(dt) {
        this.vy += CONFIG.physics.gravity * dt;
        this.vx *= CONFIG.physics.airResistance;
        this.vy *= CONFIG.physics.airResistance;
        this.x  += this.vx * dt;
        this.y  += this.vy * dt;
        this.rotation += this.angularVel * dt;
    }
}

// ============================================================================
//  MOUSE CONTROLLER — drives the player primitive via mouse movement
// ============================================================================
class MouseController {
    constructor(canvas) {
        this.cx = 0;          // current position
        this.cy = 0;
        this.prevCx = 0;
        this.prevCy = 0;
        this.vx = 0;          // velocity (px/s)
        this.vy = 0;
        this.size = CONFIG.player.baseSize;   // uniform half-extent
        this.barWidth = CONFIG.player.barWidth;
        this.active = false;  // has the mouse entered the canvas?

        canvas.addEventListener('mousemove', e => {
            this.cx = e.clientX;
            this.cy = e.clientY;
            this.active = true;
        });

        canvas.addEventListener('pointermove', e => {
            this.cx = e.clientX;
            this.cy = e.clientY;
            this.active = true;
        });

        canvas.addEventListener('mouseleave', () => {
            this.active = false;
        });

        // Scroll wheel resizes the player shape
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            this.barWidth = Math.max(90, Math.min(360, this.barWidth - e.deltaY * 0.25));
        }, { passive: false });
    }

    /** Call once per frame to update velocity from position delta. */
    update(dt) {
        if (dt > 0) {
            this.vx = (this.cx - this.prevCx) / dt;
            this.vy = (this.cy - this.prevCy) / dt;
            // Clamp velocity
            const spd = Math.hypot(this.vx, this.vy);
            if (spd > 4000) { this.vx = this.vx / spd * 4000; this.vy = this.vy / spd * 4000; }
        }
        this.prevCx = this.cx;
        this.prevCy = this.cy;
    }
}

// ============================================================================
//  GAME
// ============================================================================
class Game {
    constructor() {
        this.canvas     = document.getElementById('game-canvas');
        this.ctx        = this.canvas.getContext('2d');
        this.overlay    = document.getElementById('overlay');
        this.startBtn   = document.getElementById('startBtn');
        this.loadingText = document.getElementById('loading-text');
        this.statsPanel  = document.getElementById('stats-panel');

        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width  = this.w;
        this.canvas.height = this.h;

        this.playerShapeType  = 'circle';   // shape the player controls with mouse
        this.fallingShapeType = 'circle';   // shape that falls from the sky
        this.mouse      = new MouseController(this.canvas);
        this.shapes     = [];
        this.bucketEffects = [];
        this.barEffects = [];
        this.score = 0;
        this.streak = 0;
        this.sorted = 0;
        this.missed = 0;
        this.spawnTimer = 0;

        this.running = false;
        this.lastT   = 0;
        this.frames  = 0;
        this.fpsAcc  = 0;
        this.fps     = 0;
        this.time    = 0;

        // ── UI bindings ──
        this.startBtn.addEventListener('click', () => this.start());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('burstBtn').addEventListener('click', () => this.burst());

        window.addEventListener('keydown', e => {
            if (e.key === 'r' || e.key === 'R') this.reset();
            if (e.key === 'b' || e.key === 'B') this.burst();
        });

        window.addEventListener('resize', () => {
            this.w = window.innerWidth;
            this.h = window.innerHeight;
            this.canvas.width  = this.w;
            this.canvas.height = this.h;
        });
    }

    // ── Start ──────────────────────────────────────────────────────────────
    start() {
        this.overlay.classList.add('hidden');
        document.body.classList.add('running');
        this.running = true;
        this.lastT = performance.now();
        requestAnimationFrame(t => this.loop(t));
    }

    // ── Main loop ──────────────────────────────────────────────────────────
    loop(time) {
        if (!this.running) return;
        requestAnimationFrame(t => this.loop(t));

        const dt = Math.min((time - this.lastT) / 1000, 0.05);
        this.lastT = time;
        this.time += dt;

        this.update(dt);
        this.render();

        // FPS
        this.frames++;
        this.fpsAcc += dt;
        if (this.fpsAcc >= 1) {
            this.fps = Math.round(this.frames / this.fpsAcc);
            this.frames = 0;
            this.fpsAcc = 0;
        }
        this.statsPanel.textContent =
            `SCORE ${this.score}  |  STREAK ${this.streak}  |  SORTED ${this.sorted}  |  SHAPES ${this.shapes.length}  |  BAR ${Math.round(this.mouse.barWidth)}px`;
    }

    // ── Physics update ─────────────────────────────────────────────────────
    update(dt) {
        this.mouse.update(dt);

        // Spawn
        this.spawnTimer += dt;
        if (this.spawnTimer >= CONFIG.shapes.spawnInterval &&
            this.shapes.length < CONFIG.shapes.maxCount) {
            this.spawn();
            this.spawnTimer -= CONFIG.shapes.spawnInterval;
        }

        this.updateEffects(dt);

        // Step + collisions
        const bodyVerts = this._bodyVerts();
        const bodyBox   = this._bodyScreen();
        const bucketTop = this.bucketTop();

        for (const s of this.shapes) {
            s.bucketCooldown = Math.max(0, s.bucketCooldown - dt);
            s.step(dt);

            if (s.y + s.size >= bucketTop && s.bucketCooldown <= 0) {
                this.handleBucketContact(s);
                continue;
            }

            // Body collision + ejection (no shape should remain inside)
            if (bodyVerts && bodyBox) {
                if (this._barCollision(s, bodyBox)) {
                    this.explodeOnBar(s);
                    continue;
                }
            }
        }

        // Inter-shape (O(n²) fine for ≤80)
        for (let i = 0; i < this.shapes.length; i++) {
            for (let j = i + 1; j < this.shapes.length; j++) {
                this._pairCollision(this.shapes[i], this.shapes[j]);
            }
        }

        // Cull
        this.shapes = this.shapes.filter(s =>
            !s.scored && !s.exploded && s.y < this.h + 200 && s.x > -300 && s.x < this.w + 300);
    }

    // ── Spawn / burst / reset ──────────────────────────────────────────────
    spawn() {
        const sz = CONFIG.shapes.minSize +
                   Math.random() * (CONFIG.shapes.maxSize - CONFIG.shapes.minSize);
        const x  = sz + Math.random() * (this.w - 2 * sz);
        const y  = -sz - Math.random() * 60;
        const col = CONFIG.shapes.colors[
            Math.floor(Math.random() * CONFIG.shapes.colors.length)];
        this.shapes.push(new FallingShape(x, y, sz, this.randomShapeType(), col));
    }

    burst() {
        const cx = this.w / 2, cy = 60;
        for (let i = 0; i < CONFIG.shapes.burstCount; i++) {
            if (this.shapes.length >= CONFIG.shapes.maxCount) break;
            const sz  = CONFIG.shapes.minSize +
                        Math.random() * (CONFIG.shapes.maxSize - CONFIG.shapes.minSize);
            const col = CONFIG.shapes.colors[
                Math.floor(Math.random() * CONFIG.shapes.colors.length)];
            const s = new FallingShape(
                cx + (Math.random() - 0.5) * 350,
                cy + Math.random() * 80,
                sz, this.randomShapeType(), col);
            s.vx = (Math.random() - 0.5) * 120;
            s.vy = Math.random() * 25;
            this.shapes.push(s);
        }
    }

    reset() {
        this.shapes = [];
        this.bucketEffects = [];
        this.barEffects = [];
        this.spawnTimer = 0;
        this.score = 0;
        this.streak = 0;
        this.sorted = 0;
        this.missed = 0;
    }

    randomShapeType() {
        return CONFIG.shapes.types[Math.floor(Math.random() * CONFIG.shapes.types.length)];
    }

    bucketTop() {
        return this.h - CONFIG.buckets.height;
    }

    bucketForX(x) {
        const buckets = this.bucketRects();
        return buckets.find(bucket => x >= bucket.x && x <= bucket.x + bucket.w) || null;
    }

    bucketRects() {
        const pad = CONFIG.buckets.padding;
        const count = CONFIG.shapes.types.length;
        const totalW = this.w - pad * 2;
        const w = totalW / count;
        return CONFIG.shapes.types.map((type, index) => ({
            type,
            x: pad + index * w,
            y: this.bucketTop(),
            w: w - 8,
            h: CONFIG.buckets.height - pad
        }));
    }

    handleBucketContact(shape) {
        const bucket = this.bucketForX(shape.x);
        if (bucket && bucket.type === shape.type) {
            this.scoreShape(shape, bucket);
        } else {
            this.bounceWrongBucket(shape, bucket);
        }
    }

    scoreShape(shape, bucket) {
        if (shape.scored) return;
        shape.scored = true;
        this.score += CONFIG.buckets.matchPoints;
        this.streak += 1;
        this.sorted += 1;
        this.createBucketEffect(shape, bucket, true);
    }

    bounceWrongBucket(shape, bucket) {
        this.score = Math.max(0, this.score + CONFIG.buckets.wrongPoints);
        this.streak = 0;
        this.missed += 1;

        const top = this.bucketTop();
        const bucketCenter = bucket ? bucket.x + bucket.w / 2 : this.w / 2;
        const away = shape.x < bucketCenter ? -1 : 1;
        shape.y = top - shape.size - 3;
        shape.vy = -Math.max(135, Math.abs(shape.vy) * 0.55 + 95);
        shape.vx += away * (55 + Math.random() * 75);
        shape.angularVel += away * (1.6 + Math.random() * 1.4);
        shape.bucketCooldown = 0.85;

        this.createBucketEffect(shape, bucket, false);
    }

    createBucketEffect(shape, bucket, match) {
        const colors = match ? ['#78ffb1', '#ffffff', shape.color] : ['#ff7b93', '#ffd27a', '#ffffff'];
        const cx = bucket ? bucket.x + bucket.w / 2 : shape.x;
        const cy = bucket ? bucket.y + 22 : this.bucketTop();
        for (let i = 0; i < 28; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 70 + Math.random() * 240;
            this.bucketEffects.push({
                x: cx,
                y: cy,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 120,
                age: 0,
                life: 0.55 + Math.random() * 0.75,
                size: 4 + Math.random() * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                text: i % 9 === 0 ? (match ? '+10' : '-3') : ''
            });
        }
    }

    explodeOnBar(shape) {
        if (shape.exploded || shape.scored) return;
        shape.exploded = true;
        this.streak = 0;
        const colors = [shape.color, '#ffffff', '#ffb56b', '#ffe4a3'];
        for (let i = 0; i < 36; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 75 + Math.random() * 260;
            this.barEffects.push({
                x: shape.x,
                y: shape.y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                age: 0,
                life: 0.45 + Math.random() * 0.65,
                size: 4 + Math.random() * 9,
                color: colors[Math.floor(Math.random() * colors.length)],
                type: i % 10 === 0 ? shape.type : null,
                rotation: Math.random() * Math.PI * 2,
                spin: -5 + Math.random() * 10
            });
        }
    }

    updateEffects(dt) {
        this.bucketEffects = this.bucketEffects.filter(p => {
            p.age += dt;
            p.vy += 280 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            return p.age < p.life;
        });
        this.barEffects = this.barEffects.filter(p => {
            p.age += dt;
            p.vy += 210 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rotation += p.spin * dt;
            return p.age < p.life;
        });
    }

    // ── Player-shape helpers ────────────────────────────────────────────────
    _bodyScreen() {
        if (!this.mouse.active) return null;
        const hw = this.mouse.barWidth / 2;
        const hh = CONFIG.player.barHeight / 2;
        const y = Math.max(110, Math.min(this.bucketTop() - 44, this.mouse.cy));
        return { cx: this.mouse.cx, cy: y, hw, hh };
    }

    _bodyVerts() {
        const b = this._bodyScreen();
        return b ? getShapeVertices('square', b.cx, b.cy, b.hw, b.hh) : null;
    }

    _barCollision(shape, box) {
        const left = box.cx - box.hw - shape.size;
        const right = box.cx + box.hw + shape.size;
        const top = box.cy - box.hh - shape.size;
        const bottom = box.cy + box.hh + shape.size;
        return shape.x >= left && shape.x <= right && shape.y >= top && shape.y <= bottom;
    }

    // ── Body ↔ falling-shape collision ─────────────────────────────────────
    _bodyCollision(shape, verts, box) {
        if (!verts || verts.length < 3) return;

        // Broad phase
        const dx = shape.x - box.cx, dy = shape.y - box.cy;
        const mr = Math.max(box.hw, box.hh) + shape.size + 10;
        if (dx * dx + dy * dy > mr * mr) return;

        // Find closest edge
        let minDist = Infinity, bestNx = 0, bestNy = 0;

        for (let i = 0; i < verts.length; i++) {
            const j = (i + 1) % verts.length;
            const cp = closestPointOnSegment(
                shape.x, shape.y,
                verts[i].x, verts[i].y,
                verts[j].x, verts[j].y);
            const cdx = shape.x - cp.x, cdy = shape.y - cp.y;
            const dist = Math.sqrt(cdx * cdx + cdy * cdy);
            if (dist < minDist) {
                minDist = dist;
                if (dist > 0.001) {
                    bestNx = cdx / dist;
                    bestNy = cdy / dist;
                } else {
                    const edx = verts[j].x - verts[i].x;
                    const edy = verts[j].y - verts[i].y;
                    const el  = Math.sqrt(edx * edx + edy * edy) || 1;
                    bestNx = -edy / el;
                    bestNy =  edx / el;
                }
            }
        }

        const inside = pointInPolygon(shape.x, shape.y, verts);

        if (inside || minDist < shape.size) {
            const overlap = inside ? shape.size + minDist : shape.size - minDist;
            shape.x += bestNx * overlap * 1.05;
            shape.y += bestNy * overlap * 1.05;

            // Mouse velocity influence
            const bvx = this.mouse.vx;
            const bvy = this.mouse.vy;

            const rvx = shape.vx - bvx * 0.3;
            const rvy = shape.vy - bvy * 0.3;
            const dot = rvx * bestNx + rvy * bestNy;

            if (dot < 0) {
                const imp = -(1 + CONFIG.physics.restitution) * dot;
                shape.vx += imp * bestNx + bvx * 0.45;
                shape.vy += imp * bestNy + bvy * 0.45;
            }

            // Clamp speed
            const spd = Math.hypot(shape.vx, shape.vy);
            if (spd > CONFIG.physics.maxSpeed) {
                shape.vx = shape.vx / spd * CONFIG.physics.maxSpeed;
                shape.vy = shape.vy / spd * CONFIG.physics.maxSpeed;
            }

            // Spin from impulse
            shape.angularVel += (shape.vx * bestNy - shape.vy * bestNx) * 0.002;
        }
    }

    // ── Falling-shape ↔ falling-shape collision ────────────────────────────
    _pairCollision(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const minD = a.size + b.size;
        if (d2 >= minD * minD || d2 < 0.01) return;

        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = minD - d;

        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (dvn <= 0) return;

        const imp = (1 + CONFIG.physics.restitution) * dvn * 0.5;
        a.vx -= imp * nx;  a.vy -= imp * ny;
        b.vx += imp * nx;  b.vy += imp * ny;
    }

    // ── Rendering ──────────────────────────────────────────────────────────
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);

        this.drawBackground(ctx);
        this.drawBuckets(ctx);

        // Bucket top line
        const grdY = this.bucketTop();
        const grd = ctx.createLinearGradient(0, grdY, this.w, grdY);
        grd.addColorStop(0,   'rgba(255,140,50,0)');
        grd.addColorStop(0.3, 'rgba(255,140,50,0.35)');
        grd.addColorStop(0.7, 'rgba(255,140,50,0.35)');
        grd.addColorStop(1,   'rgba(255,140,50,0)');
        ctx.strokeStyle = grd;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, grdY);
        ctx.lineTo(this.w, grdY);
        ctx.stroke();

        // ── Mouse bar ──
        {
            const box = this._bodyScreen();
            if (box) {
                ctx.save();

                // Outer glow
                ctx.shadowColor = '#f84';
                ctx.shadowBlur  = 35;
                this.roundRect(ctx, box.cx - box.hw, box.cy - box.hh, box.hw * 2, box.hh * 2, box.hh);
                ctx.fillStyle   = 'rgba(255, 140, 50, 0.22)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 140, 50, 0.65)';
                ctx.lineWidth   = 3;
                ctx.stroke();

                // Inner border
                ctx.shadowBlur = 12;
                this.roundRect(ctx, box.cx - box.hw * 0.94, box.cy - box.hh * 0.52, box.hw * 1.88, box.hh * 1.04, box.hh * 0.52);
                ctx.strokeStyle = 'rgba(255, 200, 130, 0.25)';
                ctx.lineWidth   = 1.5;
                ctx.stroke();

                ctx.fillStyle = '#ffe2bd';
                ctx.shadowBlur = 0;
                ctx.font = '900 12px Segoe UI, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('MOVE ME', box.cx, box.cy - 1);

                ctx.restore();
            }
        }

        // ── Falling shapes ──
        for (const s of this.shapes) {
            ctx.save();
            ctx.globalAlpha = 0.88;
            ctx.shadowColor = s.color;
            ctx.shadowBlur  = 10;

            drawShapePath(ctx, s.type, s.x, s.y, s.size, s.size, s.rotation);
            ctx.fillStyle   = s.color;
            ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth   = 1.2;
            ctx.stroke();

            ctx.restore();
        }

        this.drawBucketEffects(ctx);
    this.drawBarEffects(ctx);
        this.drawInstructions(ctx);
    }

    drawBackground(ctx) {
        const g = ctx.createRadialGradient(this.w * 0.5, this.h * 0.22, 40, this.w * 0.5, this.h * 0.55, Math.max(this.w, this.h));
        g.addColorStop(0, '#25315f');
        g.addColorStop(0.45, '#10162c');
        g.addColorStop(1, '#05070f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.w, this.h);
    }

    drawBuckets(ctx) {
        const buckets = this.bucketRects();
        for (const bucket of buckets) {
            const color = this.bucketColor(bucket.type);
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 18;
            ctx.fillStyle = 'rgba(0,0,0,0.42)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            this.roundRect(ctx, bucket.x, bucket.y + 10, bucket.w, bucket.h, 18);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.88;
            drawShapePath(ctx, bucket.type, bucket.x + bucket.w / 2, bucket.y + 46, 24, 24, 0);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#eaffff';
            ctx.font = '900 13px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(bucket.type.toUpperCase(), bucket.x + bucket.w / 2, bucket.y + 88);
            ctx.restore();
        }
    }

    bucketColor(type) {
        return {
            circle: '#33ff99',
            square: '#3399ff',
            triangle: '#ffcc33',
            hexagon: '#cc66ff'
        }[type] || '#ffffff';
    }

    drawBucketEffects(ctx) {
        for (const p of this.bucketEffects) {
            const t = Math.min(1, p.age / p.life);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = 1 - t;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 16 * (1 - t);
            ctx.fillStyle = p.color;
            if (p.text) {
                ctx.font = `900 ${18 + 10 * (1 - t)}px Segoe UI, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.text, 0, 0);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawBarEffects(ctx) {
        for (const p of this.barEffects) {
            const t = Math.min(1, p.age / p.life);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = 1 - t;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 18 * (1 - t);
            ctx.fillStyle = p.color;
            if (p.type) {
                drawShapePath(ctx, p.type, 0, 0, p.size * 1.5, p.size * 1.5, 0);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawInstructions(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = '#eaffff';
        ctx.font = '800 15px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Guide shapes into matching buckets. If a shape touches the bar, it pops away!', this.w / 2, 34);
        ctx.restore();
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

// ── Boot ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
