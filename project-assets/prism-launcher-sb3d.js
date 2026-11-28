let targetUrl = "";

document.addEventListener("DOMContentLoaded", () => {
    const versionText = document.getElementById('version-text');
    const platformLabel = document.getElementById('platform-label');

    const ua = navigator.userAgent;

    if (/Windows/i.test(ua)) {
        targetUrl = "SandBox3D_PC";
        versionText.textContent = "Sand Box 3D: PC Edition";
        platformLabel.textContent = "playable for you on pc";
    } else if (/Android/i.test(ua)) {
        targetUrl = "SandBox3D_Mobile";
        versionText.textContent = "Sand Box 3D";
        platformLabel.textContent = "playable for you on your phone";
    } else if (window.innerWidth < 900) {
        targetUrl = "SandBox3D_Mobile";
        versionText.textContent = "Sand Box 3D";
        platformLabel.textContent = "playable for you on your phone";
    } else {
        targetUrl = "SandBox3D_PC";
        versionText.textContent = "Sand Box 3D: PC Edition";
        platformLabel.textContent = "playable for you on pc";
    }
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
    const increment = 100 / (2500 / stepTime);

    const interval = setInterval(() => {
        progress += increment + (Math.random() * 2);
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            status.textContent = "generating world...";
            setTimeout(() => { window.location.href = targetUrl; }, 500);
        }
        bar.style.width = Math.min(progress, 100) + "%";
        if (progress < 30) status.textContent = "cranking up babylon...";
        else if (progress < 60) status.textContent = "initiating launch...";
        else if (progress < 90) status.textContent = "get ready!";
    }, stepTime);
}

function createRipple(e) {
    const btn = e.currentTarget;
    const existing = btn.querySelector('.ripple');
    if (existing) existing.remove();
    const circle = document.createElement('span');
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    const rect = btn.getBoundingClientRect();
    circle.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - rect.left - d/2}px;top:${e.clientY - rect.top - d/2}px`;
    circle.classList.add('ripple');
    btn.appendChild(circle);
}

const cvs = document.getElementById('physics-canvas');
const ctx = cvs.getContext('2d');
let cw, ch;
let boxes = [];
const colors = ['#4aa3df', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6'];

function resizeCvs() {
    cw = cvs.width = window.innerWidth;
    ch = cvs.height = window.innerHeight;
}

window.addEventListener('resize', resizeCvs);
resizeCvs();

function spawnBox() {
    boxes.push({
        x: Math.random() * cw,
        y: -50,
        vx: (Math.random() - 0.5) * 6,
        vy: 0,
        size: 20 + Math.random() * 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.2
    });
}

function physicsLoop() {
    if (document.body.classList.contains('no-anim')) {
        if (boxes.length > 0) {
            boxes = [];
            ctx.clearRect(0, 0, cw, ch);
        }
        requestAnimationFrame(physicsLoop);
        return;
    }

    ctx.clearRect(0, 0, cw, ch);

    if (Math.random() < 0.08 && boxes.length < 40) {
        spawnBox();
    }

    for (let i = boxes.length - 1; i >= 0; i--) {
        let b = boxes[i];
        b.vy += 0.4;
        b.x += b.vx;
        b.y += b.vy;
        b.angle += b.vAngle;

        if (b.y + b.size/2 > ch) {
            b.y = ch - b.size/2;
            b.vy *= -0.6; 
            b.vx *= 0.85; 
        }

        if (b.x - b.size/2 < 0 || b.x + b.size/2 > cw) {
            b.vx *= -0.8;
            b.x = b.x - b.size/2 < 0 ? b.size/2 : cw - b.size/2;
        }

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = b.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-b.size/2, -b.size/2, b.size, b.size);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        if (b.y > ch - b.size - 5 && Math.abs(b.vy) < 1.5 && Math.abs(b.vx) < 0.2) {
            b.life = (b.life || 0) + 1;
            if (b.life > 120) boxes.splice(i, 1);
        }
    }

    requestAnimationFrame(physicsLoop);
}

physicsLoop();