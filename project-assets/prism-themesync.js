(function syncGlobalSettings() {
    document.body.classList.toggle('reduce-blur', localStorage.getItem('reduce-blur') === 'true');
    document.body.classList.toggle('no-anim', localStorage.getItem('no-anim') === 'true');

    const savedTheme = localStorage.getItem('prism-theme');
    if (savedTheme) {
        const root = document.documentElement;
        const themes = {
            blurple: { primary: '#7c9ef7', secondary: '#a78bfa' },
            amber: { primary: '#fbbf24', secondary: '#fb923c' },
            emerald: { primary: '#34d399', secondary: '#2dd4bf' },
            ruby: { primary: '#fb7185', secondary: '#f472b6' },
            mono: { primary: '#ffffff', secondary: '#a3a3a3' }
        };
        const selected = themes[savedTheme] || themes.blurple;
        const primaryRgb = hexToRgb(selected.primary);
        const secondaryRgb = hexToRgb(selected.secondary);
        root.style.setProperty('--accent', selected.primary);
        root.style.setProperty('--accent-rgb', primaryRgb);
        root.style.setProperty('--accent-2', selected.secondary);
        root.style.setProperty('--accent-2-rgb', secondaryRgb);
        root.style.setProperty('--accent-glow', `rgba(${primaryRgb}, 0.4)`);
        root.style.setProperty('--accent-2-glow', `rgba(${secondaryRgb}, 0.3)`);
    }

    if (localStorage.getItem('bg-gif-enabled') === 'false') {
        document.body.classList.add('no-gif');
    } else {
        if (navigator.onLine) document.body.classList.remove('no-gif');
    }
    
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '124, 158, 247';
    }
})();
(function initGifConnectivity() {
    function applyGifState(enabled) {
        if (!enabled || !navigator.onLine) {
            document.body.classList.add('no-gif');
        } else {
            if (localStorage.getItem('bg-gif-enabled') !== 'false') {
                document.body.classList.remove('no-gif');
            }
        }
    }

    applyGifState(localStorage.getItem('bg-gif-enabled') !== 'false');

    window.addEventListener('offline', () => applyGifState(false));
    window.addEventListener('online', () => applyGifState(true));
})();

(function () {
    const GIF_PRESETS = {
        gif1: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanZ1MzgydWxreXBhMDJzZTJ6ZWl1N2NndnUwOHRvajI5aTBlN3dzZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/SVCSsoKU5v6ZJLk07n/giphy.gif',
        gif2: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmU3NmRyOHlxZ293bGozd2tkM3YzaG5lOG9uajIxb3J3MHl3bXo3ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/32o1C0pz7HHC32ShtI/giphy.gif',
        gif3: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmU3NmRyOHlxZ293bGozd2tkM3YzaG5lOG9uajIxb3J3MHl3bXo3ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/hnq6UBZreLmGvwOtKH/giphy.gif',
        gif4: 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dTloOXRzNHF4bjh0MWZraW1xcHNpaHFwZ2Jzd2d4NXZ6cW1ucjl5ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cCCWygFWkpChuiPlWi/giphy.gif',
        gif5: 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dTloOXRzNHF4bjh0MWZraW1xcHNpaHFwZ2Jzd2d4NXZ6cW1ucjl5ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/djwyA3ChGKC5VkrmPy/giphy.gif',
        gif6: 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dTloOXRzNHF4bjh0MWZraW1xcHNpaHFwZ2Jzd2d4NXZ6cW1ucjl5ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/7rdCcxQDPuMgW61B1p/giphy.gif'
    };

    function applyGifBackground() {
        const bgGif = document.querySelector('.bg-gif');
        if (!bgGif) return;

        const isEnabled = localStorage.getItem('bg-gif-enabled') !== 'false';
        const isOffline = !navigator.onLine;
        const shouldHide = !isEnabled || isOffline;

        if (shouldHide) {
            document.body.classList.add('no-gif');
            return;
        }

        document.body.classList.remove('no-gif');

        const preset = localStorage.getItem('bg-gif-preset') || 'gif1';
        let gifUrl = '';

        if (preset === 'custom') {
            gifUrl = localStorage.getItem('bg-gif-custom-url') || GIF_PRESETS.gif1;
        } else {
            gifUrl = GIF_PRESETS[preset] || GIF_PRESETS.gif1;
        }

        if (gifUrl) {
            bgGif.style.background = `url('${gifUrl}') center / cover no-repeat`;
        }
    }

    function handleChange() {
        applyGifBackground();
    }

    window.addEventListener('online', handleChange);
    window.addEventListener('offline', handleChange);
    window.addEventListener('storage', handleChange);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleChange);
    } else {
        handleChange();
    }
})();

(function () {
    const DB_NAME = 'PrismVideoCacheDB';
    const STORE_NAME = 'videos';
    const KEY = 'custom_bg_video';

    function ensureVideoElement() {
        let videoEl = document.getElementById('bg-video');
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.id = 'bg-video';
            videoEl.autoplay = true;
            videoEl.loop = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            Object.assign(videoEl.style, {
                position: 'fixed',
                inset: '0',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: '0',
                opacity: '0.5',
                pointerEvents: 'none',
                filter: 'brightness(0.75) saturate(0.6)',
                display: 'none'
            });
            const bgGif = document.querySelector('.bg-gif');
            if (bgGif && bgGif.parentNode) {
                bgGif.parentNode.insertBefore(videoEl, bgGif);
            } else {
                document.body.prepend(videoEl);
            }
        }
        return videoEl;
    }

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function getVideoBlob() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(KEY);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function syncBackground() {
        const videoEl = ensureVideoElement();
        const gifEl = document.querySelector('.bg-gif');

        try {
            const blob = await getVideoBlob();
            if (blob) {
                if (videoEl.src) URL.revokeObjectURL(videoEl.src);
                videoEl.src = URL.createObjectURL(blob);
                videoEl.style.display = 'block';
                if (gifEl) gifEl.style.display = 'none';
                videoEl.play().catch(() => { });
            } else {
                if (videoEl.src) URL.revokeObjectURL(videoEl.src);
                videoEl.removeAttribute('src');
                videoEl.style.display = 'none';
                if (gifEl && localStorage.getItem('bg-gif-enabled') !== 'false' && navigator.onLine) {
                    gifEl.style.display = 'block';
                }
            }
        } catch (e) {
            if (videoEl.src) URL.revokeObjectURL(videoEl.src);
            videoEl.style.display = 'none';
            if (gifEl && localStorage.getItem('bg-gif-enabled') !== 'false' && navigator.onLine) {
                gifEl.style.display = 'block';
            }
        }
    }

    window.addEventListener('storage', syncBackground);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncBackground);
    } else {
        syncBackground();
    }
})();