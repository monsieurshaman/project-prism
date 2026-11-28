let targetUrl = "RiftRunners2D";

document.addEventListener("DOMContentLoaded", () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 900;
    const platformLabel = document.getElementById('platform-label');
    const launchBtn = document.getElementById('btn-launch');

    if (isMobile) {
        platformLabel.textContent = "your phone/tablet can't play this";
        launchBtn.style.opacity = "0.3";
        launchBtn.style.cursor = "not-allowed";
        launchBtn.classList.add('disabled');
    } else {
        platformLabel.textContent = "your pc can play this";
    }
    syncGlobalSettings();
});

function initiateLaunch(event) {
    if (event.currentTarget.classList.contains('disabled')) return;
    
    createRipple(event);

    const page = document.getElementById('page-wrapper');
    const loader = document.getElementById('loader-overlay');
    const bar = document.getElementById('progress-fill');
    const status = document.getElementById('loader-status');

    page.classList.add('fade-out');
    loader.classList.add('active');

    let progress = 0;
    const stepTime = 50;
    const increment = 100 / (2000 / stepTime);

    const interval = setInterval(() => {
        progress += increment + (Math.random() * 3);
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            status.textContent = "generating world...";
            setTimeout(() => { window.location.href = targetUrl; }, 400);
        }
        bar.style.width = Math.min(progress, 100) + "%";
        if (progress < 40) status.textContent = "rift running...";
        else if (progress < 80) status.textContent = "echoes stabilized...";
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

const cvs = document.getElementById('chase-canvas');
const ctx = cvs.getContext('2d');
let cw, ch;
let px, py, tx, ty;
let shapes = [];
let bullets = [];

function resizeCvs() {
    cw = cvs.width = window.innerWidth;
    ch = cvs.height = window.innerHeight;
    px = cw / 2; py = ch / 2;
    tx = px; ty = py;
}

window.addEventListener('resize', resizeCvs);
resizeCvs();

function chaseLoop() {
    if (document.body.classList.contains('no-anim')) {
        requestAnimationFrame(chaseLoop);
        return;
    }

    ctx.clearRect(0, 0, cw, ch);

    if (Math.random() < 0.03) {
        tx = Math.random() * cw;
        ty = Math.random() * ch;
    }

    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;

    if (Math.random() < 0.04 && shapes.length < 20) {
        shapes.push({
            x: Math.random() > 0.5 ? 0 : cw,
            y: Math.random() * ch,
            speed: 1.5 + Math.random() * 2,
            size: 8 + Math.random() * 8
        });
    }

    if (Math.random() < 0.08 && shapes.length > 0) {
        let target = shapes[Math.floor(Math.random() * shapes.length)];
        let angle = Math.atan2(target.y - py, target.x - px);
        bullets.push({ x: px, y: py, vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10 });
    }

    ctx.fillStyle = '#ff4060';
    for (let i = shapes.length - 1; i >= 0; i--) {
        let s = shapes[i];
        let dx = px - s.x;
        let dy = py - s.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        s.x += (dx / dist) * s.speed;
        s.y += (dy / dist) * s.speed;

        ctx.beginPath();
        ctx.rect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
        ctx.fill();

        if (dist < 15) {
            shapes.splice(i, 1);
        }
    }

    ctx.fillStyle = '#ffee60';
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();

        let hit = false;
        for (let j = shapes.length - 1; j >= 0; j--) {
            let s = shapes[j];
            let bx = b.x - s.x;
            let by = b.y - s.y;
            if (Math.sqrt(bx * bx + by * by) < s.size) {
                shapes.splice(j, 1);
                hit = true;
                break;
            }
        }

        if (hit || b.x < 0 || b.x > cw || b.y < 0 || b.y > ch) {
            bullets.splice(i, 1);
        }
    }

    ctx.fillStyle = '#a080ff';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#c8b8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 20, 0, Math.PI * 2);
    ctx.stroke();

    requestAnimationFrame(chaseLoop);
}

chaseLoop();