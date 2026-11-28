(function () {
    let overlay = document.getElementById('portrait-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'portrait-overlay';
        overlay.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0,0,0,0.85);
                z-index: 99999;
                pointer-events: auto;
                font-family: 'Segoe UI', sans-serif;
            ">
                <button id="btn-force-landscape"
                    style="
                        background: #27ae60;
                        border: 2px solid #2ecc71;
                        color: white;
                        font-size: 18px;
                        font-weight: bold;
                        padding: 14px 30px;
                        border-radius: 12px;
                        cursor: pointer;
                        letter-spacing: 1px;
                        box-shadow: 0 0 20px rgba(39,174,96,0.4);
                    ">
                    🔄 GO LANDSCAPE
                </button>
                <p style="color:#aaa; margin-top:16px; font-size:12px;">
                    Sand Box 3D is optimized for landscape orientations
                </p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const landscapeBtn = document.getElementById('btn-force-landscape');
    const overlayContainer = document.getElementById('portrait-overlay');

    function updateOverlay() {
        const isPortrait = window.matchMedia('(orientation: portrait)').matches ||
            window.innerHeight > window.innerWidth;
        const isFullscreen = !!(document.fullscreenElement ||
            document.webkitFullscreenElement);

        overlayContainer.style.display = (isPortrait && !isFullscreen) ? 'block' : 'none';
    }

    landscapeBtn.addEventListener('click', function () {
        if (typeof enterGame === 'function') {
            enterGame();
        } else {
            const de = document.documentElement;
            if (de.requestFullscreen) de.requestFullscreen();
            else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen();
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => { });
            }
        }
    });

    window.addEventListener('resize', updateOverlay);
    window.addEventListener('orientationchange', updateOverlay);
    document.addEventListener('fullscreenchange', updateOverlay);
    document.addEventListener('webkitfullscreenchange', updateOverlay);

    updateOverlay();
})();