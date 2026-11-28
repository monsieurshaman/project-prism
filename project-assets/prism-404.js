const errorGifs = [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJhMXVueDBuMDY5eHB6eWdpN3dsMTI4ZWtob3FzOGNkcHBzZWl4ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xElKq0jcERjsYRnKtD/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJhMXVueDBuMDY5eHB6eWdpN3dsMTI4ZWtob3FzOGNkcHBzZWl4ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lpNMOKpm4fwtkwjc07/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJhMXVueDBuMDY5eHB6eWdpN3dsMTI4ZWtob3FzOGNkcHBzZWl4ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/0rJksQ8yiiw2vTHzPb/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJhMXVueDBuMDY5eHB6eWdpN3dsMTI4ZWtob3FzOGNkcHBzZWl4ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ZCYFabe54Y2iDSKGW6/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJhMXVueDBuMDY5eHB6eWdpN3dsMTI4ZWtob3FzOGNkcHBzZWl4ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/gbqPm96y9PmIp2n3hi/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJhMXVueDBuMDY5eHB6eWdpN3dsMTI4ZWtob3FzOGNkcHBzZWl4ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ZCYFabe54Y2iDSKGW6/giphy.gif'
];

const img = document.getElementById('bina-img');
img.src = errorGifs[Math.floor(Math.random() * errorGifs.length)];

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