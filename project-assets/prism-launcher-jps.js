const targetUrl = "JiggleSim";

document.addEventListener("DOMContentLoaded", () => {
    const platformLabel = document.getElementById('platform-label');
    const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    platformLabel.textContent = touch
        ? "runs on your phone, squish it with your fingers"
        : "runs on pc, squish it with your mouse";
});

function initiateLaunch(event) {
    createRipple(event);

    const page = document.getElementById('page-wrapper');
    const loader = document.getElementById('loader-overlay');
    const bar = document.getElementById('progress-fill');
    const status = document.getElementById('loader-status');

    page.classList.add('fade-out');
    loader.classList.add('active');

    let progress = 0;
    const stepTime = 50;
    const increment = 100 / (2200 / stepTime);

    const interval = setInterval(() => {
        progress += increment + (Math.random() * 2);
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            status.textContent = "wobbling in...";
            setTimeout(() => { window.location.href = targetUrl; }, 400);
        }
        bar.style.width = Math.min(progress, 100) + "%";
        if (progress < 35) status.textContent = "inflating jelly...";
        else if (progress < 70) status.textContent = "tightening springs...";
        else if (progress < 100) status.textContent = "get ready to squish!";
    }, stepTime);
}

function createRipple(e) {
    const btn = e.currentTarget;
    const existing = btn.querySelector('.ripple');
    if (existing) existing.remove();
    const circle = document.createElement('span');
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    const rect = btn.getBoundingClientRect();
    circle.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - rect.left - d / 2}px;top:${e.clientY - rect.top - d / 2}px`;
    circle.classList.add('ripple');
    btn.appendChild(circle);
}

(() => {
    const cvs = document.getElementById('physics-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d', { alpha: true });
    if (!ctx) return;

    const palette = ['#ff5fa2', '#a78bfa', '#7c9ef7', '#34d399', '#fbbf24'];
    const SEG = 26, STEP = 1 / 60, MAX_FRAME = 0.05, MAX_BLOBS = 22;
    let cw = 0, ch = 0, tick = 0, blobs = [];
    let rafId = 0, running = false, lastTime = 0, accumulator = 0, spawnAccumulator = 0;

    function resizeCvs() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cw = window.innerWidth;
        ch = window.innerHeight;
        cvs.width = Math.round(cw * dpr);
        cvs.height = Math.round(ch * dpr);
        cvs.style.width = `${cw}px`;
        cvs.style.height = `${ch}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnBlob() {
        const r = 22 + Math.random() * 30;
        blobs.push({
            x: r + Math.random() * Math.max(1, cw - r * 2), y: -r * 2,
            vx: (Math.random() - 0.5) * 3, vy: 0, r,
            color: palette[Math.floor(Math.random() * palette.length)],
            sq: 0, sqv: 0, phase: Math.random() * Math.PI * 2, rest: 0, sleeping: false
        });
    }

    function drawBlob(b) {
        const rx = b.r * (1 + b.sq * 0.6), ry = b.r * (1 - b.sq);
        const wob = 0.035 + Math.abs(b.sq) * 0.12;
        ctx.beginPath();
        for (let i = 0; i <= SEG; i++) {
            const a = (i / SEG) * Math.PI * 2;
            const k = 1 + wob * Math.sin(a * 3 + b.phase + tick * 0.12);
            const px = b.x + Math.cos(a) * rx * k, py = b.y + Math.sin(a) * ry * k;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.75; ctx.fillStyle = b.color; ctx.fill(); ctx.globalAlpha = 1;
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(b.x - rx * 0.35, b.y - ry * 0.4, rx * 0.22, ry * 0.12, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    }

    function simulateStep() {
        tick++;
        spawnAccumulator += STEP;
        if (spawnAccumulator >= 0.85 && blobs.length < MAX_BLOBS) {
            spawnAccumulator = 0;
            spawnBlob();
        }

        for (const b of blobs) {
            if (b.sleeping) continue;
            b.vy += 0.35; b.x += b.vx; b.y += b.vy;
            b.sqv = (b.sqv - b.sq * 0.18) * 0.88;
            b.sq = Math.max(-0.35, Math.min(0.35, b.sq + b.sqv));
            const ry = b.r * (1 - b.sq);
            if (b.y + ry > ch) {
                b.y = ch - ry;
                if (b.vy > 2) b.sqv += Math.min(b.vy * 0.035, 0.35);
                b.vy *= -0.55; b.vx *= 0.9;
            }
            const rx = b.r * (1 + b.sq * 0.6);
            if (b.x - rx < 0) { b.x = rx; b.vx = Math.abs(b.vx) * 0.8; }
            else if (b.x + rx > cw) { b.x = cw - rx; b.vx = -Math.abs(b.vx) * 0.8; }
            b.x = Math.max(b.r, Math.min(cw - b.r, b.x));
        }

        for (let i = 0; i < blobs.length; i++) {
            const a = blobs[i];
            for (let j = i + 1; j < blobs.length; j++) {
                const b = blobs[j], dx = b.x - a.x, dy = b.y - a.y;
                const minDist = (a.r + b.r) * 0.9, d2 = dx * dx + dy * dy;
                if (d2 >= minDist * minDist) continue;
                const d = Math.sqrt(d2), nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0;
                const overlap = (minDist - d) * 0.5;
                a.x -= nx * overlap; a.y -= ny * overlap;
                b.x += nx * overlap; b.y += ny * overlap;
                const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (rv < 0) {
                    a.vx += nx * rv * 0.6; a.vy += ny * rv * 0.6;
                    b.vx -= nx * rv * 0.6; b.vy -= ny * rv * 0.6;
                    const hit = Math.min(-rv * 0.03, 0.25);
                    a.sqv += hit; b.sqv += hit;
                }
                a.sleeping = b.sleeping = false;
                a.rest = b.rest = 0;
            }
        }

        for (const b of blobs) {
            const atFloor = b.y + b.r * (1 - b.sq) >= ch - 1;
            if (atFloor && Math.abs(b.vy) < 0.45 && Math.abs(b.vx) < 0.12 &&
                Math.abs(b.sq) < 0.025 && Math.abs(b.sqv) < 0.02) {
                if (++b.rest > 45) {
                    b.sleeping = true;
                    b.vx = b.vy = b.sqv = b.sq = 0;
                }
            } else { b.rest = 0; b.sleeping = false; }
        }
        blobs = blobs.filter(b => b.rest < 900 && b.y < ch + b.r * 4 &&
            b.x > -b.r * 3 && b.x < cw + b.r * 3);
    }

    function render() {
        ctx.clearRect(0, 0, cw, ch);
        for (const b of blobs) drawBlob(b);
    }
    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0; running = false; lastTime = 0; accumulator = 0;
    }
    function frame(now) {
        rafId = 0;
        if (document.hidden || document.body.classList.contains('no-anim')) {
            stopLoop();
            if (document.body.classList.contains('no-anim')) { blobs = []; render(); }
            return;
        }
        if (!lastTime) lastTime = now;
        accumulator += Math.min((now - lastTime) / 1000, MAX_FRAME);
        lastTime = now;
        while (accumulator >= STEP) { simulateStep(); accumulator -= STEP; }
        render();
        rafId = requestAnimationFrame(frame);
    }
    function startLoop() {
        if (running || document.hidden || document.body.classList.contains('no-anim')) return;
        running = true; lastTime = 0; rafId = requestAnimationFrame(frame);
    }

    resizeCvs();
    window.addEventListener('resize', resizeCvs, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopLoop(); else startLoop();
    });
    new MutationObserver(() => {
        if (document.body.classList.contains('no-anim')) {
            stopLoop(); blobs = []; render();
        } else startLoop();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    startLoop();
})();