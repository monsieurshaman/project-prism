var _pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _pwaInstallPrompt = e;
    document.getElementById('pwa-install-btn-mobile').style.display = 'flex';
    document.getElementById('pwa-install-btn-desktop').style.display = 'flex';
});

window.addEventListener('appinstalled', function () {
    _pwaInstallPrompt = null;
    document.getElementById('pwa-install-btn-mobile').style.display = 'none';
    document.getElementById('pwa-install-btn-desktop').style.display = 'none';
    localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
    updateCleanupVisibility();
});

window.addEventListener('online', () => {
    const savedState = localStorage.getItem('bg-gif-enabled') !== 'false';
    applyBgState(savedState);
});

window.addEventListener('offline', () => {
    applyBgState(localStorage.getItem('bg-gif-enabled') !== 'false');
});

window.__PRISM_ENV__ = {
    get isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    }
};

const OneUIMotion = (function () {
    const CONFIG = {
        open: 380,
        close: 300,
        bgScale: 0.95,
        bgBlur: 6,
        bgDim: 0.6,
        contentDelay: 0.35,
        contentShift: 12,
        easing: 'cubic-bezier(0.22, 0.25, 0, 1)',
        bounce: 'cubic-bezier(0.34, 1.5, 0.5, 1)',
        feedbackScale: 0.96,
        feedbackDuration: 100,
        fallbackRadius: 24
    };

    const pages = new Map();
    let lastOrigin = null;
    let feedbackAnim = null;
    let bgToken = 0;
    let pageBGToken = 0;

    function isOneUI() {
        return document.body.dataset.openAnim === 'oneui';
    }

    function isReduced() {
        return document.body.classList.contains('no-anim') ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function readRadius(el) {
        const cs = getComputedStyle(el);
        const r = cs.borderRadius || '0px';
        const first = r.split(' ')[0];
        return parseFloat(first) || 0;
    }

    function getFinalRadius(page) {
        return readRadius(page);
    }

    function rectToInset(rect, base) {
        return {
            top: Math.max(0, rect.top - base.top),
            right: Math.max(0, base.right - rect.right),
            bottom: Math.max(0, base.bottom - rect.bottom),
            left: Math.max(0, rect.left - base.left)
        };
    }

    function insetString(inset, radius) {
        return `inset(${inset.top}px ${inset.right}px ${inset.bottom}px ${inset.left}px round ${radius}px)`;
    }

    function getFallbackRect(page) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const size = 24;

        if (vw >= 1024) {
            let cy = vh / 2;
            if (page && page.isConnected) {
                const r = page.getBoundingClientRect();
                if (r.height > 0) cy = r.top + r.height / 2;
            }
            const y = Math.min(vh - size, Math.max(0, cy - size / 2));
            return { top: y, left: vw - size, right: vw, bottom: y + size, width: size, height: size };
        }

        const x = vw / 2 - size / 2;
        const y = vh - 80;
        return { top: y, left: x, right: x + size, bottom: y + size, width: size, height: size };
    }

    function getOriginRect(el) {
        if (el && el.isConnected) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) {
                return r;
            }
        }
        return getFallbackRect();
    }

    function setOrigin(el) {
        lastOrigin = el;
    }

    function feedback(el) {
        if (!isOneUI() || isReduced() || !el) return;
        if (feedbackAnim) feedbackAnim.cancel();
        feedbackAnim = el.animate(
            [{ transform: 'scale(1)' }, { transform: `scale(${CONFIG.feedbackScale})` }],
            { duration: CONFIG.feedbackDuration, easing: 'ease-out', fill: 'forwards', composite: 'add' }
        );
    }

    function releaseFeedback() {
        if (feedbackAnim) {
            const anim = feedbackAnim;
            feedbackAnim = null;
            anim.reverse();
            anim.finished.then(() => anim.cancel()).catch(() => { });
        }
    }

    function getController(page) {
        if (!pages.has(page)) {
            pages.set(page, { anims: [], origin: null, contentAnims: [], token: 0 });
        }
        return pages.get(page);
    }

    function clearInline(page) {
        page.style.removeProperty('will-change');
        page.style.removeProperty('transform');
        page.style.removeProperty('opacity');
        page.style.removeProperty('clip-path');
        page.style.removeProperty('filter');
        page.style.removeProperty('visibility');
        page.style.removeProperty('pointer-events');
        page.style.removeProperty('transition');
    }

    function clearChildren(page) {
        Array.from(page.children).forEach(child => {
            child.style.removeProperty('opacity');
            child.style.removeProperty('transform');
        });
    }

    function cancelAnimations(page) {
        const ctrl = getController(page);
        ctrl.anims.forEach(a => { try { a.cancel(); } catch (e) { } });
        ctrl.anims = [];
        ctrl.contentAnims.forEach(a => { try { a.cancel(); } catch (e) { } });
        ctrl.contentAnims = [];
        if (feedbackAnim) { feedbackAnim.cancel(); feedbackAnim = null; }
    }

    let bgAnims = [];
    let bgOpen = false;
    let bgSyncQueued = false;

    function resetBackground() {
        bgAnims.forEach(a => { try { a.cancel(); } catch (e) { } });
        bgAnims = [];
        bgToken++;
        bgOpen = false;
        const bg = document.getElementById('page');
        if (bg) {
            bg.style.removeProperty('will-change');
            bg.style.removeProperty('transform');
            bg.style.removeProperty('filter');
        }
    }

    function animateBackground(open) {
        const bg = document.getElementById('page');
        if (!bg) return;
        bgAnims.forEach(a => { try { a.commitStyles(); a.cancel(); } catch (e) { } });
        bgAnims = [];
        const token = ++bgToken;
        const cs = getComputedStyle(bg);
        const fromTransform = cs.transform;
        const fromFilter = cs.filter;
        const blurValue = document.body.classList.contains('reduce-blur') ? 0 : CONFIG.bgBlur;
        const toTransform = `scale(${open ? CONFIG.bgScale : 1})`;
        const toFilter = open ? `blur(${blurValue}px) brightness(${CONFIG.bgDim})` : 'blur(0px) brightness(1)';
        const duration = open ? CONFIG.open : CONFIG.close;

        bg.style.willChange = 'transform, filter';
        const t = bg.animate(
            [{ transform: fromTransform }, { transform: toTransform }],
            { duration, easing: open ? CONFIG.bounce : CONFIG.easing, fill: 'forwards' }
        );
        const f = bg.animate(
            [{ filter: fromFilter }, { filter: toFilter }],
            { duration, easing: CONFIG.easing, fill: 'forwards' }
        );
        bgAnims = [t, f];

        Promise.all([t.finished, f.finished]).then(() => {
            if (token !== bgToken) return;
            t.commitStyles();
            f.commitStyles();
            t.cancel();
            f.cancel();
            bgAnims = [];
            if (open) {
                bg.style.removeProperty('will-change');
            } else {
                bg.style.removeProperty('will-change');
                bg.style.removeProperty('transform');
                bg.style.removeProperty('filter');
            }
        }).catch(() => { });
    }

    function syncBackground() {
        bgSyncQueued = false;
        if (!isOneUI() || isReduced()) return;
        const anyOpen = !!document.querySelector('.app-library-page.open, #settings-page.open, #download-page.open');
        if (anyOpen === bgOpen) return;
        bgOpen = anyOpen;
        animateBackground(anyOpen);
    }

    function scheduleBackgroundSync() {
        if (bgSyncQueued) return;
        bgSyncQueued = true;
        queueMicrotask(syncBackground);
    }

    function open(page, originEl) {
        if (!page) return;
        if (!isOneUI()) {
            page.classList.add('open');
            if (originEl) lastOrigin = originEl;
            return;
        }
        if (isReduced()) {
            page.classList.add('open');
            page.classList.add('oneui-visible');
            page.style.visibility = 'visible';
            page.style.pointerEvents = 'auto';
            if (originEl) lastOrigin = originEl;
            return;
        }

        const ctrl = getController(page);
        cancelAnimations(page);
        const myToken = ++ctrl.token;

        page.classList.add('open');
        page.classList.add('oneui-visible');
        page.style.visibility = 'visible';
        page.style.pointerEvents = 'auto';

        const finalRect = page.getBoundingClientRect();
        const isDesktop = window.innerWidth >= 1024;
        const originRect = isDesktop
            ? getFallbackRect(page)
            : (originEl ? getOriginRect(originEl) : (ctrl.origin || getFallbackRect(page)));
        ctrl.origin = originRect;

        const startRadius = (originEl && !isDesktop) ? readRadius(originEl) : CONFIG.fallbackRadius;
        const endRadius = getFinalRadius(page);

        const insetStart = rectToInset(originRect, finalRect);
        const insetEnd = { top: 0, right: 0, bottom: 0, left: 0 };

        const clipFrom = insetString(insetStart, startRadius);
        const clipTo = insetString(insetEnd, endRadius);

        page.style.willChange = 'clip-path, opacity';
        page.style.clipPath = clipFrom;
        page.style.opacity = '0';

        const duration = CONFIG.open;
        const easing = CONFIG.easing;

        const clipAnim = page.animate(
            [{ clipPath: clipFrom }, { clipPath: clipTo }],
            { duration, easing, fill: 'forwards' }
        );

        const opacityAnim = page.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            { duration: duration * 0.6, easing: 'linear', fill: 'forwards' }
        );

        const popAnim = page.animate(
            [{ scale: 0.9 }, { scale: 1 }],
            { duration: duration * 1.25, easing: CONFIG.bounce, fill: 'none' }
        );

        ctrl.anims.push(clipAnim, opacityAnim, popAnim);

        const children = Array.from(page.children);
        const contentAnims = children.map(child => {
            return child.animate(
                [
                    { opacity: 0, transform: `translateY(${CONFIG.contentShift}px)` },
                    { opacity: 1, transform: 'translateY(0)' }
                ],
                {
                    duration: duration * 0.65,
                    delay: duration * CONFIG.contentDelay,
                    easing: CONFIG.bounce,
                    fill: 'forwards'
                }
            );
        });
        ctrl.contentAnims = contentAnims;

        const allAnims = [...ctrl.anims, ...contentAnims];
        Promise.all(allAnims.map(a => a.finished.catch(() => { }))).then(() => {
            if (ctrl.token !== myToken) return;
            allAnims.forEach(a => { try { a.commitStyles(); a.cancel(); } catch (e) { } });
            page.style.removeProperty('will-change');
            page.style.removeProperty('clip-path');
            page.style.removeProperty('opacity');
            page.style.pointerEvents = 'auto';
            clearChildren(page);
            ctrl.anims = [];
            ctrl.contentAnims = [];
        });

        scheduleBackgroundSync();
    }

    function close(page) {
        if (!page) return;
        if (!page.classList.contains('open') && !page.classList.contains('oneui-visible')) return;

        if (!isOneUI()) {
            page.classList.remove('open');
            return;
        }
        if (isReduced()) {
            page.classList.remove('open');
            page.classList.remove('oneui-visible');
            page.style.visibility = 'hidden';
            page.style.pointerEvents = 'none';
            return;
        }

        const ctrl = getController(page);
        cancelAnimations(page);
        const myToken = ++ctrl.token;

        page.classList.remove('open');
        page.classList.add('oneui-visible');

        const finalRect = page.getBoundingClientRect();
        const isDesktop = window.innerWidth >= 1024;
        const originEl = isDesktop ? null : lastOrigin;
        let originRect = ctrl.origin || getFallbackRect(page);
        if (originEl && originEl.isConnected) {
            const r = originEl.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) {
                originRect = r;
            }
        }
        if (isDesktop) originRect = getFallbackRect(page);

        const startRadius = getFinalRadius(page);
        const endRadius = originEl ? readRadius(originEl) : CONFIG.fallbackRadius;

        const insetStart = { top: 0, right: 0, bottom: 0, left: 0 };
        const insetEnd = rectToInset(originRect, finalRect);

        const clipFrom = insetString(insetStart, startRadius);
        const clipTo = insetString(insetEnd, endRadius);

        page.style.willChange = 'clip-path, opacity';
        page.style.clipPath = clipFrom;
        page.style.opacity = '1';

        const duration = CONFIG.close;
        const easing = CONFIG.easing;

        const children = Array.from(page.children);
        const contentAnims = children.map(child => {
            return child.animate(
                [
                    { opacity: 1, transform: 'translateY(0)' },
                    { opacity: 0, transform: `translateY(${CONFIG.contentShift}px)` }
                ],
                { duration: 120, easing: 'linear', fill: 'forwards' }
            );
        });
        ctrl.contentAnims = contentAnims;

        const clipAnim = page.animate(
            [{ clipPath: clipFrom }, { clipPath: clipTo }],
            { duration, easing, fill: 'forwards', delay: 120 }
        );

        const opacityAnim = page.animate(
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: duration * 0.4, easing: 'linear', fill: 'forwards', delay: duration * 0.6 }
        );

        ctrl.anims.push(clipAnim, opacityAnim);

        scheduleBackgroundSync();

        const allAnims = [...ctrl.anims, ...contentAnims];
        Promise.all(allAnims.map(a => a.finished.catch(() => { }))).then(() => {
            if (ctrl.token !== myToken) return;
            allAnims.forEach(a => { try { a.commitStyles(); a.cancel(); } catch (e) { } });
            page.style.removeProperty('will-change');
            page.style.removeProperty('clip-path');
            page.style.removeProperty('opacity');
            page.classList.remove('oneui-visible');
            page.style.visibility = 'hidden';
            page.style.pointerEvents = 'none';
            clearChildren(page);
            ctrl.anims = [];
            ctrl.contentAnims = [];
        });
    }

    function reset() {
        pages.forEach((ctrl, page) => {
            cancelAnimations(page);
            clearInline(page);
            clearChildren(page);
            page.classList.remove('oneui-visible');
        });
        resetBackground();
        document.querySelectorAll('.app-library-page.open, #settings-page.open, #download-page.open').forEach(p => {
            if (isOneUI()) {
                p.classList.add('oneui-visible');
                p.style.visibility = 'visible';
                p.style.pointerEvents = 'auto';
            } else {
                p.classList.remove('oneui-visible');
                p.style.removeProperty('visibility');
                p.style.removeProperty('pointer-events');
            }
        });
        pages.clear();
        scheduleBackgroundSync();
    }

    function initDownloadObserver() {
        const dl = document.getElementById('download-page');
        if (!dl) return;
        const obs = new MutationObserver(() => {
            if (!isOneUI()) return;
            if (dl.classList.contains('open') && !dl.dataset.oneuiAnim) {
                dl.dataset.oneuiAnim = '1';
                open(dl, null);
            }
        });
        obs.observe(dl, { attributes: true, attributeFilter: ['class'] });
    }

    function initOutsideClose() {
        const PAGE_SEL = '.app-library-page, #settings-page, #download-page';
        const SELF_HANDLED = '[onclick], a[href], button, input, select, textarea, label, #credits-dialog, #credits-backdrop, #bg-picker-dialog, #bg-picker-backdrop, #appearance-picker-dialog, #appearance-picker-backdrop';
        let armed = null;

        document.addEventListener('pointerdown', e => {
            armed = null;
            if (!isOneUI() || window.innerWidth < 1024) return;
            if (e.target.closest(PAGE_SEL) || e.target.closest(SELF_HANDLED)) return;
            const creditsDialog = document.getElementById('credits-dialog');
            if (creditsDialog && creditsDialog.classList.contains('open')) return;
            const openPages = Array.from(document.querySelectorAll('.app-library-page.open, #settings-page.open'));
            if (openPages.length) armed = openPages;
        }, true);

        document.addEventListener('click', e => {
            const list = armed;
            armed = null;
            if (!list || !isOneUI()) return;
            if (e.target.closest(PAGE_SEL) || e.target.closest(SELF_HANDLED)) return;
            list.forEach(p => {
                if (!p.classList.contains('open')) return;
                if (p.id === 'settings-page') toggleSettings();
                else closeAllModals();
            });
        });
    }

    function init() {
        document.addEventListener('pointerdown', e => {
            if (!isOneUI()) return;
            const el = e.target.closest('.glass-card, .dt-glass-card, .bottombar-item, .settings-trigger');
            if (el) {
                setOrigin(el);
                feedback(el);
            }
        }, true);

        document.addEventListener('pointerup', releaseFeedback, true);
        document.addEventListener('pointercancel', releaseFeedback, true);

        initOutsideClose();

        initDownloadObserver();

        window.addEventListener('resize', () => {
            if (!isOneUI()) return;
            document.querySelectorAll('.oneui-visible').forEach(p => {
                const ctrl = getController(p);
                if (ctrl.origin) {
                    const finalRect = p.getBoundingClientRect();
                    const inset = rectToInset(ctrl.origin, finalRect);
                    p.style.clipPath = insetString(inset, getFinalRadius(p));
                }
            });
        });
    }

    return {
        init,
        open,
        close,
        reset,
        setOrigin,
        get lastOrigin() { return lastOrigin; }
    };
})();

function triggerPWAInstall() {
    if (!_pwaInstallPrompt) return;
    _pwaInstallPrompt.prompt();
    _pwaInstallPrompt.userChoice.then(function (result) {
        if (result.outcome === 'accepted') _pwaInstallPrompt = null;
    });
}

function openPWAInstallPage() {
    const page = document.getElementById('pwa-install-page');
    if (page) {
        OneUIMotion.open(page, OneUIMotion.lastOrigin);
    }
}

(function () {
    const isStandalone = window.__PRISM_ENV__.isStandalone;
    if (!isStandalone) return;
    const v = localStorage.getItem('PRISM_SW_VERSION');
    const el = document.getElementById('sw-version-display');
    if (v && el) { el.textContent = v; el.style.display = 'block'; }
})();

function toggleSetting(className) {
    const isEnabled = document.body.classList.toggle(className);
    localStorage.setItem(className, isEnabled);

    const icon = document.getElementById('icon-' + className);
    icon.textContent = isEnabled ? 'toggle_on' : 'toggle_off';
    icon.style.color = isEnabled ? 'var(--primary)' : 'var(--text-muted)';
}

function dismissChangelogBubble() {
    const mobileTrigger = document.getElementById('changelog-trigger-mobile');
    if (mobileTrigger) mobileTrigger.classList.remove('has-update');
    const desktopTrigger = document.getElementById('changelog-trigger-desktop');
    if (desktopTrigger) desktopTrigger.classList.remove('has-update');

    fetch('changelog.json?t=' + Date.now(), { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data && data.release) {
                localStorage.setItem('PRISM_SEEN_CHANGELOG', data.release);
            }
        })
        .catch(() => { });
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '124, 158, 247';
}

function applyThemeVars(theme) {
    const root = document.documentElement;
    const themes = {
        blurple: { primary: '#7c9ef7', secondary: '#a78bfa' },
        amber: { primary: '#fbbf24', secondary: '#fb923c' },
        emerald: { primary: '#34d399', secondary: '#2dd4bf' },
        ruby: { primary: '#fb7185', secondary: '#f472b6' },
        mono: { primary: '#ffffff', secondary: '#a3a3a3' }
    };

    const selected = themes[theme] || themes.blurple;
    const primaryRgb = hexToRgb(selected.primary);
    const secondaryRgb = hexToRgb(selected.secondary);

    root.style.setProperty('--primary', selected.primary);
    root.style.setProperty('--secondary', selected.secondary);
    root.style.setProperty('--primary-rgb', primaryRgb);
    root.style.setProperty('--secondary-rgb', secondaryRgb);

    root.style.setProperty('--primary-glow', `rgba(${primaryRgb}, 0.3)`);
    root.style.setProperty('--secondary-glow', `rgba(${secondaryRgb}, 0.25)`);

    root.style.setProperty('--primary-dim', `rgba(${primaryRgb}, 0.12)`);
    root.style.setProperty('--secondary-dim', `rgba(${secondaryRgb}, 0.12)`);
    root.style.setProperty('--primary-container', `rgba(${primaryRgb}, 0.18)`);
    root.style.setProperty('--secondary-container', `rgba(${secondaryRgb}, 0.18)`);
    root.style.setProperty('--border-accent', `rgba(${primaryRgb}, 0.22)`);
}

function changeTheme(theme, animate = true) {
    if (!animate) {
        applyThemeVars(theme);
        localStorage.setItem('prism-theme', theme);
        return;
    }

    const veil = document.getElementById('theme-veil');
    veil.classList.add('active');

    setTimeout(() => {
        applyThemeVars(theme);
        localStorage.setItem('prism-theme', theme);

        setTimeout(() => {
            veil.classList.remove('active');
        }, 300);
    }, 500);
}

(function loadSavedTheme() {
    const saved = localStorage.getItem('prism-theme');
    if (saved) changeTheme(saved, false);
})();

function changeCardLayout(layout, persist = true) {
    const grids = [document.querySelector('.cards-grid'), document.querySelector('.dt-cards-grid')];

    grids.forEach(grid => {
        if (!grid) return;
        const cards = Array.from(grid.querySelectorAll('.glass-card, .dt-glass-card'));

        const first = cards.map(c => c.getBoundingClientRect());

        grid.classList.toggle('tile-layout', layout === 'tile');

        const last = cards.map(c => c.getBoundingClientRect());

        cards.forEach((card, i) => {
            const dx = first[i].left - last[i].left;
            const dy = first[i].top - last[i].top;
            const dw = first[i].width / last[i].width;
            const dh = first[i].height / last[i].height;

            card.style.transition = 'none';
            card.style.transformOrigin = 'top left';
            card.style.transform = `translate(${dx}px, ${dy}px) scale(${dw}, ${dh})`;

            requestAnimationFrame(() => {
                card.style.transition = 'transform 0.5s var(--spring, cubic-bezier(0.34, 1.56, 0.64, 1))';
                card.style.transform = 'translate(0, 0) scale(1, 1)';
                card.style.transitionDelay = `${i * 30}ms`;
            });

            card.addEventListener('transitionend', function cleanup() {
                card.style.transition = '';
                card.style.transform = '';
                card.style.transformOrigin = '';
                card.style.transitionDelay = '';
                card.removeEventListener('transitionend', cleanup);
            });
        });
    });

    if (persist) localStorage.setItem('prism-card-layout', layout);
}

function changeOpenAnim(value, persist = true) {
    document.body.dataset.openAnim = value;
    if (persist) localStorage.setItem('prism-open-anim', value);
    OneUIMotion.reset();
}

(function loadSavedCardLayout() {
    const saved = localStorage.getItem('prism-card-layout');
    if (saved) changeCardLayout(saved);
})();

(function loadSavedOpenAnim() {
    const saved = localStorage.getItem('prism-open-anim') || 'normal';
    changeOpenAnim(saved);
})();
OneUIMotion.init();

(function initPerformanceState() {
    ['reduce-blur', 'no-anim'].forEach(className => {
        if (localStorage.getItem(className) === 'true') {
            document.body.classList.add(className);
            const icon = document.getElementById('icon-' + className);
            if (icon) {
                icon.textContent = 'toggle_on';
                icon.style.color = 'var(--primary)';
            }
        }
    });
})();

let _includeGames = false;

function toggleIncludeGames() {
    _includeGames = !_includeGames;
    const icon = document.getElementById('icon-include-games');
    icon.textContent = _includeGames ? 'toggle_on' : 'toggle_off';
    icon.classList.toggle('toggle-on', _includeGames);
}

const CLEANUP_FLAG_KEY = 'PRISM_NEEDS_CACHE_CLEANUP';
const STORAGE_CLEARED_KEY = 'PRISM_STORAGE_CLEARED';

function updateCleanupVisibility() {
    const section = document.getElementById('cleanup-section');
    if (!section) return;
    section.style.display = localStorage.getItem(CLEANUP_FLAG_KEY) === 'true' ? 'block' : 'none';
}

(function initCleanupFlag() {
    if (window.__PRISM_ENV__.isStandalone) {
        localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
    }
    updateCleanupVisibility();
})();

(function checkStorageClearedPartition() {
    if (!window.__PRISM_ENV__.isStandalone) return;
    if (localStorage.getItem(STORAGE_CLEARED_KEY) !== 'true') return;

    setTimeout(() => {
        const proceed = confirm(
            'Prism Storage Manager\n\n' +
            'Prism\'s files are currently missing...\n' +
            'You may have used "clear leftover cache & storage" accidentally while Prism is still installed.\n\n' +
            'Do you want to fetch new files now?\n\n' +
            'OK to download — Cancel to skip.'
        );
        localStorage.removeItem(STORAGE_CLEARED_KEY);
        if (proceed) confirmAndRecache();
    }, 3400);
})();

async function confirmAndCleanup() {
    if (!confirm('Prism Storage Manager\n\nThis will clear files for you after you\'ve uninstalled Prism. Do you wish to proceed?\n\nIf you\'re still in Prism or have it installed and met this prompt, you can click CANCEL to do nothing.')) return;

    try {
        if ('caches' in window) {
            try {
                const names = await caches.keys();
                await Promise.all(names.map(n => caches.delete(n)));
            } catch (e) {
                console.warn('[Prism Cleanup] caches.keys() failed, trying known cache names', e);
                await Promise.all(['prism-cache', 'prism-static', 'prism-dynamic', 'prism-video-cache'].map(name => caches.delete(name).catch(() => {})));
            }
        }

        if (indexedDB.databases) {
            const dbs = await indexedDB.databases();
            await Promise.all(dbs.map(d => d && d.name ? new Promise(res => {
                const req = indexedDB.deleteDatabase(d.name);
                req.onsuccess = req.onerror = req.onblocked = () => res();
            }) : Promise.resolve()));
        } else {
            await Promise.all(['PrismDB', 'PrismVideoCacheDB', 'PrismChangelogDB'].map(name => new Promise(res => {
                const req = indexedDB.deleteDatabase(name);
                req.onsuccess = req.onerror = req.onblocked = () => res();
            })));
        }

        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }

        const remainingCaches = 'caches' in window ? await caches.keys() : [];
        const remainingDBs = indexedDB.databases ? await indexedDB.databases() : [];

        if (remainingCaches.length === 0 && remainingDBs.length === 0) {
            localStorage.setItem(CLEANUP_FLAG_KEY, 'false');
            localStorage.setItem(STORAGE_CLEARED_KEY, 'true');
            updateCleanupVisibility();
            alert('Cleanup complete! Leftover data has been removed.');
        } else {
            console.warn('[Prism Cleanup] Some data might remain', { remainingCaches, remainingDBs });
            localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
            updateCleanupVisibility();
            alert('Cleanup completed with warnings. Some cached data might remain. Please try again or clear site data manually.');
        }
    } catch (err) {
        console.error('[Prism Cleanup]', err);
        localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
        updateCleanupVisibility();
        alert('Cleanup failed. Please try again.');
    }
}

function confirmAndRecache() {
    const gameWarning = _includeGames ? '\n\nGame assets included for download.' : '\n\nCore files only. Game assets excluded.';
    if (!confirm(`Prism Update\nCAUTION!\n\nYou are about to update Prism to the latest version. Do you wish to proceed?${gameWarning}\n\nClick OK to update Prism.\nClick CANCEL to decline.`)) return;
    clearAndRecache('full');
}

let _cacheProgressHandler = null;

async function clearAndRecache(mode = 'full') {
    if (!navigator.onLine) return;
    const isStandalone = window.__PRISM_ENV__.isStandalone;

    const dlPage = document.getElementById('download-page');
    const dlBar = document.getElementById('download-bar');
    const dlTip = document.getElementById('download-tip');
    const dlTitle = document.getElementById('dl-phase-title');
    const dlSub = document.getElementById('dl-phase-sub');
    const dlSkip = document.getElementById('dl-skip-btn');

    const phaseBars = {
        clear: document.getElementById('dl-bar-clear'),
        check: document.getElementById('dl-bar-check'),
        download: document.getElementById('dl-bar-download'),
        cache: document.getElementById('dl-bar-cache')
    };

    dlPage.classList.add('open');
    const _dlCirc = 2 * Math.PI * 52;
    dlBar.style.transition = 'none';
    dlBar.style.strokeDashoffset = _dlCirc;
    requestAnimationFrame(() => {
        dlBar.style.transition = 'stroke-dashoffset 0.2s linear';
    });
    dlSkip.classList.remove('show');

    function setPhase(rowId, state, statusText, icon) {
        const row = document.getElementById(rowId);
        if (!row) return;
        row.className = 'dl-pipeline-row ' + state;
        row.querySelector('.dl-phase-status').textContent = statusText;
        row.querySelector('.dl-phase-icon').textContent = icon;
    }

    function setPhaseBar(phase, pct) {
        const bar = phaseBars[phase];
        if (!bar) return;
        bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
    }

    function setOverall(pct) {
        const r = 52;
        const circ = 2 * Math.PI * r;
        const clamped = Math.min(100, Math.max(0, pct));
        dlBar.style.strokeDashoffset = circ - (circ * clamped / 100);
    }

    const tips = [
        "Even bedrock can be turned to rubble under the right conditions.",
        "Osmanthus wine tastes the same as I remember... But where are those who share the memory?",
        "Aiming a beam of moonlight at Lauma's head makes her antlers grow taller, and if you get the angle just right, you can even get them to stab a piece of fruit that's too high to reach... Hmm? What then? Oh, um... you get scolded.",
        "Our pure and merciful Lady Moonchanter... So kind, so gentle, and full of compassion for all. It's no wonder that people are drawn to her.",
        "Clearly, we are different people with different ways of doing things, but I have never taken that to mean that we cannot get along. No matter what, the light of the moon will always fall favorably upon her.",
        "Water comes in many flavors to the discerning palate. Mondstadt's water is crisp and pure, while water from Liyue has an enduring aftertaste. In Inazuma, the water possesses a flavor unlike any other.",
        "The work that she has done over the centuries is truly immense.",
        "If she were to ever make a return to the stage, I should personally attend the performance and give her my heartfelt applause... Yes, I must do so when the opportunity arises.",
        "I have a great many names, though when on leave… I tend to go by Zhongli.",
        "The skies here are full of stars, but they aren't the same as the ones back home.",
        "As long as there's a dedicated laboratory, I am more than satisfied.",
        "Inazuma shines eternal, and you shall stand by my side.",
        "Witness the divine power of the Shogun!",
        "The strength of the one I protect is the sword of justice.",
        "Rain is temporary, but the glory of thunder is eternal.",
        "The rain will not slow me down.",
        "The wind of freedom blows across the land.",
        "The world looks magnificent in its light... It makes me want to compose a poem!",
        "Justice must be served, no matter what it takes. I have made peace with that.",
        "Even the stars above will fall from the sky if threatened. That is the law.",
        "I must go, my people need me. The Law must be upheld.",
        "Why do people insist on proving that their existence is more valuable than another's? Isn't simply existing enough?",
        "There will always be those who dare to brave the lightning's glow.",
        "Don't waste time trying to explain yourself to people who are committed to misunderstanding you.",
        "Heh, the weather here is quite calm... No, wait, this is a new type of storm?",
        "The journey has an end, but no need to rush.",
        "Today, I will witness a new era with my own eyes.",
        "Cherish the time you have, for it will pass in the blink of an eye.",
        "The battle has just begun. Don't let your guard down.",
        "If you can't make up your mind, take the first step. The path will unfold before you on its own.",
        "I trust in the protection of the stars.",
        "No one fights alone.",
        "Your strength shall be recorded in the history books, and every leaf and branch will bear witness.",
        "The road ahead is long and uncertain, but I'm willing to take the first step.",
        "The rule of the world is equality.",
        "It's not the storm that makes a man brave, but the courage to face it.",
        "My past is full of regrets, but the future is still ahead of me.",
        "Home is wherever we are together.",
        "Slay!",
        "The strongest oath is the one that binds one's own heart.",
        "The price of magic is memory, and the price of power is pain.",
        "Life is a series of choices. The key is to find the courage to make them.",
        "The darkness is not my enemy. It is my refuge.",
        "My blade is a symbol of my loyalty. I will never betray that.",
        "The world is full of mysteries, and I intend to solve them all.",
        "Sometimes, the simplest answer is the most profound.",
        "The past is a ghost that haunts us all. But we must not let it define our future.",
        "The only way to truly understand someone is to walk a mile in their shoes.",
        "Don't be afraid to make mistakes. It's all part of the learning process.",
        "The wind is gentle today... a sign of good fortune perhaps.",
        "I will protect the peace of Liyue Harbor with my life.",
        "Your next line is...",
        "The rules of the world are written by the strong, but the weak have the power to change them.",
        "In the end, the only thing that matters is the strength of your will.",
        "A blade's true power comes from the heart of its wielder.",
        "No matter how far you run, the law will always catch up to you.",
        "The most dangerous thing in the world is hope.",
        "I may not be able to change the world, but I can change myself.",
    ];

    function cycleTip() {
        dlTip.classList.remove('show');
        setTimeout(() => {
            dlTip.textContent = tips[Math.floor(Math.random() * tips.length)];
            dlTip.classList.add('show');
        }, 400);
    }
    cycleTip();
    const tipInterval = setInterval(cycleTip, 3000);

    let freshVersion = null;
    let finished = false;
    let skippedByUser = false;
    let downloadComplete = false;
    let storeComplete = false;
    let aborted = false;

    let settleTimer = null;

    function scheduleFinishCheck() {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(maybeFinish, 700);
    }

    function maybeFinish() {
        if (finished || skippedByUser) return;
        if (!downloadComplete || !storeComplete) return;
        finished = true;
        clearTimeout(skipTimer);
        clearTimeout(settleTimer);
        clearInterval(tipInterval);
        if (_cacheProgressHandler && navigator.serviceWorker) {
            navigator.serviceWorker.removeEventListener('message', _cacheProgressHandler);
        }
        setOverall(100);
        dlTitle.textContent = 'update finished';
        dlSub.textContent = 'update complete';
        const savedV = freshVersion || window.__PRISM_PENDING_VERSION__;
        if (savedV) localStorage.setItem('PRISM_SW_VERSION', savedV);
        setTimeout(() => {
            alert('Prism Update\n\nPrism has been fully updated. Click OK to restart.');
            window.location.reload();
        }, 700);
    }

    const skipTimer = setTimeout(() => {
        if (finished || skippedByUser) return;
        dlSkip.classList.add('show');
        dlSkip.onclick = () => {
            if (finished || skippedByUser) return;
            skippedByUser = true;
            dlSkip.onclick = null;
            dlSkip.style.pointerEvents = 'none';
            clearTimeout(skipTimer);
            clearInterval(tipInterval);
            if (_cacheProgressHandler && navigator.serviceWorker) {
                navigator.serviceWorker.removeEventListener('message', _cacheProgressHandler);
            }
            dlTitle.textContent = 'skipping';
            dlSub.textContent = 'update skipped, restarting...';
            setPhase('dl-phase-download', 'error', 'Skipped', 'skip_next');
            setPhase('dl-phase-cache', 'error', 'Skipped', 'skip_next');
            setTimeout(() => { window.location.reload(); }, 800);
        };
    }, 15000);

    if (_cacheProgressHandler && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', _cacheProgressHandler);
    }

    _cacheProgressHandler = (event) => {
        if (!event.data) return;
        const { type, progress, processed, stored, total, errors, url, checked, ok, skipped } = event.data;

        if (type === 'CACHE_START') {
            dlBar.style.transition = 'stroke-dashoffset 0.2s linear';
            setOverall(0);
            setPhase('dl-phase-check', 'active', `0 / ${total}`, 'search');
            setPhaseBar('check', 0);
            dlTitle.textContent = 'checking assets';
            dlSub.textContent = `verifying ${total} files`;
            return;
        }

        if (type === 'CACHE_CHECK') {
            const pct = Math.round((checked / total) * 100);
            setPhaseBar('check', pct);
            setOverall(5 + pct * 0.2);
            setPhase('dl-phase-check', 'active', `${checked} / ${total}`, 'search');
            dlTitle.textContent = 'checking assets';
            dlSub.textContent = `${checked} / ${total} verified`;
            return;
        }

        if (type === 'CACHE_CHECK_DONE') {
            setPhaseBar('check', 100);
            setOverall(25);
            setPhase('dl-phase-check', 'done', `${total} / ${total}`, 'check_circle');

            if (ok === 0) {
                aborted = true;
                dlTitle.textContent = 'nothing to download';
                dlSub.textContent = `${skipped} asset${skipped !== 1 ? 's' : ''} unreachable`;
                setPhase('dl-phase-download', 'error', `0 / ${total}`, 'warning');
                setPhase('dl-phase-cache', 'error', 'Skipped', 'warning');
                setPhaseBar('download', 100);
                setPhaseBar('cache', 100);
                return;
            }

            setPhase('dl-phase-download', 'active', `0 / ${ok}`, 'sync');
            setPhaseBar('download', 0);
            dlTitle.textContent = 'downloading';
            dlSub.textContent = `${ok} file${ok !== 1 ? 's' : ''} to fetch${skipped > 0 ? ` · ${skipped} skipped` : ''}`;
            return;
        }

        if (type === 'CACHE_ERROR') {
            dlSub.textContent = `${errors} skipped so far`;
            return;
        }

        if (type === 'CACHE_PROGRESS') {
            setPhaseBar('download', progress);
            setOverall(25 + progress * 0.45);

            if (progress > 0 && progress < 100) {
                setPhase('dl-phase-download', 'active', `${processed} / ${total}`, 'sync');
                dlTitle.textContent = 'downloading';
                dlSub.textContent = `${processed} / ${total}${errors > 0 ? ` · ${errors} skipped` : ''}`;
            }

            if (progress >= 100) {
                downloadComplete = true;
                setPhase('dl-phase-download', 'done', `${processed} / ${total}`, 'check_circle');
                setPhaseBar('download', 100);
                if (!storeComplete) {
                    dlTitle.textContent = 'saving to storage';
                    dlSub.textContent = 'writing files locally...';
                }
                scheduleFinishCheck();
            }
            return;
        }

        if (type === 'CACHE_STORE') {
            setPhaseBar('cache', progress);
            setOverall(70 + progress * 0.3);

            if (progress > 0 && progress < 100) {
                setPhase('dl-phase-cache', 'active', `${stored} / ${total}`, 'sync');
            }

            if (progress >= 100) {
                storeComplete = true;
                setPhase('dl-phase-cache', errors > 0 ? 'error' : 'done', errors > 0 ? `${errors} skipped` : `${stored} / ${total}`, errors > 0 ? 'warning' : 'check_circle');
                setPhaseBar('cache', 100);
                scheduleFinishCheck();
            }
            return;
        }
    };

    navigator.serviceWorker.addEventListener('message', _cacheProgressHandler);

    try {
        dlTitle.textContent = 'purging';
        dlSub.textContent = 'deleting previous IDB/Cache....';
        setPhase('dl-phase-clear', 'active', 'Running', 'sync');
        setPhaseBar('clear', 40);

        const CORE_URLS = [
            '/',
            '/index.html',
            './SandBox3D/index',
            './RiftRunners2D/index',
            './RiftRunners2D/RiftRunners2D',
            './SandBox3D/SandBox3D_PC',
            './SandBox3D/SandBox3D_Mobile',
            // './JPS/index',
            // './JPS/JiggleSim',
            './Other/index',
            './Other/ismycompteureron',
            './Other/devcheck',
            './Other/notmoving',
            './Other/gifview',
            './Other/mathlol',
            './Other/coinsort',
            './Other/websend',
            './Tools/index',
            './Tools/lapscan',
            './Tools/pixelpeek',
            './Tools/gyro3d',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Other/js/ismycompteureron.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Other/js/devcheck.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Other/js/notmoving.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Other/js/gifview.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Other/js/mathlol.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Other/js/coinsort.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Other/js/websend.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Tools/js/lapscan.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Tools/js/pixelpeek.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/Tools/js/gyro3d.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/monsieurshaman.png',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/shinobiakira.png',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/haku.png',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/logo.png',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/logo2.png',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/logo192.png',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/logo512.png',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-pwa.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-links.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism.css',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-themesync.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-404.css',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-404.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-launcher-sb3d.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-launcher-rr2d.js',
            // 'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-launcher-jps.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-launcher-sb3d.css',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-launcher-rr2d.css',
            // 'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/prism-launcher-jps.css',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/sb3d-mb.css',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/sb3d-pc.css',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/sb3d-enginecheck.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/sb3d-mb-babylonscene.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/sb3d-pc-babylonscene.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/sb3d-mb-ui.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/sb3d-pc-ui.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/RiftRunners2D/asset/rr2d-check.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/RiftRunners2D/asset/rr2d-ui.css',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/RiftRunners2D/asset/rr2d-ui.js',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/RiftRunners2D/asset/rr2d-phaserscene.js',
            'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
            'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500;700&display=swap',
            'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
        ];

        const GAME_URLS = [
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/blind.mp4',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/explode.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/neutral/neu1.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/neutral/neu2.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/neutral/neu3.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/evening/eve1.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/evening/eve2.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/evening/eve3.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/midnight/mid1.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/midnight/mid2.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/midnight/mid3.mp3',
            'https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/SandBox3D/asset/midnight/mid4.mp3',
            'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.60.0/phaser.min.js',
            'https://cdn.jsdelivr.net/npm/babylonjs@9.11.0/babylon.js',
            'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js',
            'https://cdn.jsdelivr.net/npm/babylonjs-loaders@9.11.0/babylonjs.loaders.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
            'https://assets.babylonjs.com/textures/flare.png',
        ];

        const urlsToPurge = _includeGames ? [...CORE_URLS, ...GAME_URLS] : CORE_URLS;
        const absoluteUrlsToPurge = urlsToPurge.map(u => new URL(u, location.origin).href);

        if ('caches' in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map(async (cacheName) => {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();
                await Promise.all(
                    requests
                        .filter(req => absoluteUrlsToPurge.includes(req.url))
                        .map(req => cache.delete(req))
                );
                const remaining = await cache.keys();
                if (remaining.length === 0) await caches.delete(cacheName);
            }));
        }

        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) await reg.unregister();
        }

        await new Promise((resolve) => {
            const openReq = indexedDB.open('PrismDB', 1);
            openReq.onsuccess = (e) => {
                const db = e.target.result;
                try {
                    if (!db.objectStoreNames.contains('dynamic-cache')) {
                        db.close();
                        return resolve();
                    }
                    const tx = db.transaction('dynamic-cache', 'readwrite');
                    const store = tx.objectStore('dynamic-cache');
                    const cursorReq = store.openCursor();
                    cursorReq.onsuccess = (ev) => {
                        const cursor = ev.target.result;
                        if (!cursor) return;
                        if (absoluteUrlsToPurge.includes(cursor.key)) {
                            cursor.delete();
                        }
                        cursor.continue();
                    };
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => { db.close(); resolve(); };
                } catch (err) {
                    db.close();
                    resolve();
                }
            };
            openReq.onerror = () => resolve();
        });

        setPhase('dl-phase-clear', 'done', 'Done', 'check_circle');
        setPhaseBar('clear', 100);
        setOverall(5);
        dlTitle.textContent = 'checking assets';
        dlSub.textContent = 'contacting update server...';
        setPhase('dl-phase-check', 'active', 'Starting', 'search');
        setPhaseBar('check', 0);

        try {
            const swRes = await fetch('/sw.js', { cache: 'no-store' });
            const swText = await swRes.text();
            const vMatch = swText.match(/const CACHE_NAME\s*=\s*['"](.+?)['"]/);
            if (vMatch) freshVersion = vMatch[1];
        } catch (_) { }

        const swUrl = `/sw.js?update=${Date.now()}&standalone=${isStandalone}&includeGames=${_includeGames}&forceInstall=true`;
        await navigator.serviceWorker.register(swUrl);

    } catch (err) {
        console.error('[Prism Download Mode]: Prism reinstall error: ', err);
        finished = true;
        clearTimeout(skipTimer);
        clearInterval(tipInterval);
        setPhase('dl-phase-clear', 'error', 'Failed', 'error');
        setTimeout(() => { window.location.reload(); }, 1500);
    }
}


function applyBgState(enabled) {
    document.body.classList.toggle('no-gif', !navigator.onLine || !enabled);
    if (typeof PrismBgPicker !== 'undefined') PrismBgPicker.syncSummary();
}

var GIF_PRESETS = {
    gif1: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanZ1MzgydWxreXBhMDJzZTJ6ZWl1N2NndnUwOHRvajI5aTBlN3dzZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/SVCSsoKU5v6ZJLk07n/giphy.gif',
    gif2: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmU3NmRyOHlxZ293bGozd2tkM3YzaG5lOG9uajIxb3J3MHl3bXo3ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/32o1C0pz7HHC32ShtI/giphy.gif',
    gif3: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmU3NmRyOHlxZ293bGozd2tkM3YzaG5lOG9uajIxb3J3MHl3bXo3ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/hnq6UBZreLmGvwOtKH/giphy.gif',
    gif4: 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dTloOXRzNHF4bjh0MWZraW1xcHNpaHFwZ2Jzd2d4NXZ6cW1ucjl5ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cCCWygFWkpChuiPlWi/giphy.gif',
    gif5: 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dTloOXRzNHF4bjh0MWZraW1xcHNpaHFwZ2Jzd2d4NXZ6cW1ucjl5ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/djwyA3ChGKC5VkrmPy/giphy.gif',
    gif6: 'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dTloOXRzNHF4bjh0MWZraW1xcHNpaHFwZ2Jzd2d4NXZ6cW1ucjl5ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/7rdCcxQDPuMgW61B1p/giphy.gif'
};

function applyGifUrl(url) {
    const el = document.querySelector('.bg-gif');
    if (!el) return;
    el.style.background = `url('${url}') center / cover no-repeat`;
}

(function initGifPreset() {
    const saved = localStorage.getItem('bg-gif-preset') || 'gif1';
    if (saved === 'custom') {
        const customUrl = localStorage.getItem('bg-gif-custom-url');
        if (customUrl) applyGifUrl(customUrl);
    } else if (GIF_PRESETS[saved]) {
        applyGifUrl(GIF_PRESETS[saved]);
    }
})();

var PrismBgPicker = (function () {
    const LABELS = {
        none: 'none',
        gif1: 'default gif',
        gif2: 'gif 1',
        gif3: 'gif 2',
        gif4: 'gif 3',
        gif5: 'gif 4',
        gif6: 'gif 5',
        custom: 'custom url',
        video: 'custom video'
    };
    const URL_PATTERN = /^https?:\/\/.+/i;

    let pending = null;
    let pendingFile = null;
    let pendingVideoUrl = null;
    let customTimer = null;

    function el(id) {
        return document.getElementById(id);
    }

    function hasVideo() {
        const video = el('bg-video');
        return !!(video && video.src);
    }

    function getApplied() {
        if (hasVideo()) return 'video';
        if (localStorage.getItem('bg-gif-enabled') === 'false') return 'none';
        return localStorage.getItem('bg-gif-preset') || 'gif1';
    }

    function getCustomDraft() {
        const input = el('gif-custom-url-input');
        return input ? input.value.trim() : '';
    }

    function syncSummary() {
        const status = el('bg-status');
        if (!status) return;
        const key = getApplied();
        const offline = !navigator.onLine && key !== 'none' && key !== 'video';
        status.textContent = (LABELS[key] || LABELS.gif1) + (offline ? ' (GIFs unavailable offline)' : '');
    }

    function glyph(name) {
        const icon = document.createElement('i');
        icon.className = 'material-icons-round bg-tile-glyph';
        icon.textContent = name;
        return icon;
    }

    function imageNode(url, fallbackGlyph) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = url;
        if (fallbackGlyph) img.onerror = () => img.replaceWith(glyph(fallbackGlyph));
        return img;
    }

    function videoNode(url) {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.play().catch(() => { });
        return video;
    }

    function previewNode(key) {
        if (GIF_PRESETS[key]) return imageNode(GIF_PRESETS[key]);
        if (key === 'none') return glyph('block');
        if (key === 'custom') {
            const url = getCustomDraft();
            return URL_PATTERN.test(url) ? imageNode(url, 'link') : glyph('link');
        }
        return pendingVideoUrl ? videoNode(pendingVideoUrl) : glyph('videocam');
    }

    function labelFor(key) {
        if (key === 'video') return pendingFile ? 'new video' : 'pick a video';
        return LABELS[key];
    }

    function refreshTile(key) {
        const tile = document.querySelector('.bg-tile[data-key="' + key + '"]');
        if (!tile) return;
        tile.querySelector('.bg-tile-media').replaceChildren(previewNode(key));
        tile.querySelector('.bg-tile-label').textContent = labelFor(key);
    }

    function render() {
        const grid = el('bg-picker-grid');
        grid.replaceChildren();
        ['none', ...Object.keys(GIF_PRESETS), 'custom', 'video'].forEach(key => {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'bg-tile';
            tile.dataset.key = key;
            tile.innerHTML = '<div class="bg-tile-media"></div><span class="bg-tile-label"></span><i class="material-icons-round bg-tile-check">check_circle</i>';
            tile.addEventListener('click', () => choose(key));
            grid.appendChild(tile);
            refreshTile(key);
        });
    }

    function canApply() {
        if (!pending) return false;
        if (pending === 'video') return !!pendingFile;
        if (pending === 'custom') {
            const url = getCustomDraft();
            return URL_PATTERN.test(url) && (getApplied() !== 'custom' || url !== localStorage.getItem('bg-gif-custom-url'));
        }
        return pending !== getApplied();
    }

    function syncSelection() {
        const applied = getApplied();
        document.querySelectorAll('.bg-tile').forEach(tile => {
            tile.classList.toggle('selected', tile.dataset.key === pending);
            tile.classList.toggle('current', tile.dataset.key === applied);
        });
        el('bg-picker-apply').disabled = !canApply();
    }

    function syncCustomWrap() {
        el('gif-custom-url-wrap').classList.toggle('visible', pending === 'custom');
    }

    function choose(key) {
        if (key === 'video') {
            el('video-bg-file-input').click();
            return;
        }
        pending = key;
        syncCustomWrap();
        syncSelection();
        if (key === 'custom') el('gif-custom-url-input').focus();
    }

    function pickVideo(file) {
        if (!file || !file.type.startsWith('video/')) return;
        if (pendingVideoUrl) URL.revokeObjectURL(pendingVideoUrl);
        pendingFile = file;
        pendingVideoUrl = URL.createObjectURL(file);
        pending = 'video';
        refreshTile('video');
        syncCustomWrap();
        syncSelection();
    }

    function previewCustom() {
        clearTimeout(customTimer);
        customTimer = setTimeout(() => refreshTile('custom'), 400);
        syncSelection();
    }

    function open() {
        pending = getApplied();
        pendingFile = null;
        el('gif-custom-url-input').value = localStorage.getItem('bg-gif-custom-url') || '';
        render();
        syncCustomWrap();
        syncSelection();
        el('bg-picker-backdrop').classList.add('open');
        el('bg-picker-dialog').classList.add('open');
    }

    function close() {
        el('bg-picker-backdrop').classList.remove('open');
        el('bg-picker-dialog').classList.remove('open');
        if (pendingVideoUrl) {
            URL.revokeObjectURL(pendingVideoUrl);
            pendingVideoUrl = null;
        }
        pendingFile = null;
    }

    async function apply() {
        if (!canApply()) return;
        const key = pending;

        if (key === 'video') {
            await PrismVideoBg.handleUpload(pendingFile);
        } else {
            if (key === 'none') {
                localStorage.setItem('bg-gif-enabled', 'false');
            } else {
                localStorage.setItem('bg-gif-enabled', 'true');
                if (key === 'custom') {
                    const url = getCustomDraft();
                    localStorage.setItem('bg-gif-preset', 'custom');
                    localStorage.setItem('bg-gif-custom-url', url);
                    applyGifUrl(url);
                } else {
                    localStorage.setItem('bg-gif-preset', key);
                    localStorage.removeItem('bg-gif-custom-url');
                    applyGifUrl(GIF_PRESETS[key]);
                }
            }
            applyBgState(localStorage.getItem('bg-gif-enabled') !== 'false');
            await PrismVideoBg.removeVideo();
        }

        syncSummary();
        close();
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
    });

    return { open, close, apply, pickVideo, previewCustom, syncSummary };
})();

var PrismAppearancePicker = (function () {
    const THEMES = {
        blurple: { name: 'good vibes', primary: '#7c9ef7', secondary: '#a78bfa' },
        amber: { name: 'bright amber', primary: '#fbbf24', secondary: '#fb923c' },
        emerald: { name: 'emerald', primary: '#34d399', secondary: '#2dd4bf' },
        ruby: { name: 'vibrant ruby', primary: '#fb7185', secondary: '#f472b6' },
        mono: { name: 'nostalgia', primary: '#ffffff', secondary: '#a3a3a3' }
    };
    const LAYOUTS = {
        bar: { name: 'bar style', sub: 'default' },
        tile: { name: 'tile style', sub: 'grid tiles' }
    };
    const ANIMS = {
        normal: { name: 'default animations', sub: 'classic slides' },
        oneui: { name: 'better animations', sub: 'one ui motion' }
    };

    let pendingTheme = null;
    let pendingLayout = null;
    let pendingAnim = null;

    function el(id) {
        return document.getElementById(id);
    }

    function getAppliedTheme() {
        return localStorage.getItem('prism-theme') || 'none';
    }

    function getAppliedLayout() {
        return localStorage.getItem('prism-card-layout') || 'bar';
    }

    function getAppliedAnim() {
        return localStorage.getItem('prism-open-anim') || 'normal';
    }

    function syncSummary() {
        const status = el('appearance-status');
        if (!status) return;
        status.textContent = (getAppliedTheme() === 'none'
            ? 'none'
            : THEMES[getAppliedTheme()].name) + ' · ' +
            LAYOUTS[getAppliedLayout()].name + ' · ' +
            ANIMS[getAppliedAnim()].name;
    }

    function renderThemes() {
        const grid = el('ap-theme-grid');
        grid.replaceChildren();

        ['none', ...Object.keys(THEMES)].forEach(key => {
            const isNone = key === 'none';
            const t = isNone ? null : THEMES[key];

            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'ap-theme-tile';
            tile.dataset.key = key;

            tile.innerHTML = isNone
                ? '<div class="ap-theme-swatch ap-theme-none"></div>' +
                '<i class="material-icons-round ap-theme-check">check_circle</i>' +
                '<span class="ap-theme-name">default color</span>'
                : '<div class="ap-theme-swatch" style="background: linear-gradient(135deg, ' +
                t.primary + ' 0%, ' + t.secondary + ' 100%);"></div>' +
                '<i class="material-icons-round ap-theme-check">check_circle</i>' +
                '<span class="ap-theme-name">' + t.name + '</span>';

            tile.addEventListener('click', () => chooseTheme(key));
            grid.appendChild(tile);
        });
    }

    function renderOptions(rowId, map, onPick) {
        const row = el(rowId);
        row.replaceChildren();
        Object.keys(map).forEach(key => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ap-option-btn';
            btn.dataset.key = key;
            btn.innerHTML = map[key].name + '<span class="ap-option-sub">' + map[key].sub + '</span>';
            btn.addEventListener('click', () => onPick(key));
            row.appendChild(btn);
        });
    }

    function syncOptions(rowId, current) {
        el(rowId).querySelectorAll('.ap-option-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.key === current);
        });
    }

    function syncSelection() {
        document.querySelectorAll('.ap-theme-tile').forEach(tile => {
            tile.classList.toggle('selected', tile.dataset.key === pendingTheme);
        });
        syncOptions('ap-layout-row', pendingLayout);
        syncOptions('ap-anim-row', pendingAnim);
        el('ap-card-preview').classList.toggle('tile-mode', pendingLayout === 'tile');
    }

    function previewThemeVars(key) {
        if (key === 'none') {
            clearPreviewThemeVars();
            return;
        }

        const t = THEMES[key];
        const dialog = el('appearance-picker-dialog');
        const primaryRgb = hexToRgb(t.primary);
        const secondaryRgb = hexToRgb(t.secondary);

        dialog.style.setProperty('--primary', t.primary);
        dialog.style.setProperty('--secondary', t.secondary);
        dialog.style.setProperty('--primary-rgb', primaryRgb);
        dialog.style.setProperty('--secondary-rgb', secondaryRgb);
        dialog.style.setProperty('--primary-dim', `rgba(${primaryRgb}, 0.12)`);
        dialog.style.setProperty('--primary-glow', `rgba(${primaryRgb}, 0.3)`);
        dialog.style.setProperty('--primary-container', `rgba(${primaryRgb}, 0.18)`);
        dialog.style.setProperty('--secondary-dim', `rgba(${secondaryRgb}, 0.12)`);
        dialog.style.setProperty('--secondary-glow', `rgba(${secondaryRgb}, 0.25)`);
        dialog.style.setProperty('--secondary-container', `rgba(${secondaryRgb}, 0.18)`);
        dialog.style.setProperty('--border-accent', `rgba(${primaryRgb}, 0.22)`);
        dialog.style.setProperty('--glass-tint',
            `linear-gradient(150deg, rgba(${primaryRgb}, 0.05) 0%, rgba(${secondaryRgb}, 0.025) 45%, transparent 75%)`
        );
    }

    function clearAppliedTheme() {
        const root = document.documentElement;

        [
            '--primary',
            '--secondary',
            '--primary-rgb',
            '--secondary-rgb',
            '--primary-dim',
            '--secondary-dim',
            '--primary-glow',
            '--secondary-glow',
            '--primary-container',
            '--secondary-container',
            '--border-accent'
        ].forEach(v => root.style.removeProperty(v));

        localStorage.removeItem('prism-theme');
    }

    function clearPreviewThemeVars() {
        const dialog = el('appearance-picker-dialog');
        ['--primary', '--secondary', '--primary-rgb', '--secondary-rgb',
            '--primary-dim', '--primary-glow', '--primary-container',
            '--secondary-dim', '--secondary-glow', '--secondary-container',
            '--border-accent', '--glass-tint'].forEach(v => dialog.style.removeProperty(v));
    }

    function demoAnim(key) {
        const mini = document.querySelector('#ap-card-preview .ap-mini-card');
        if (!mini) return;
        mini.classList.remove('ap-anim-demo', 'oneui');
        void mini.offsetWidth; // restart the animation
        mini.classList.add('ap-anim-demo');
        if (key === 'oneui') mini.classList.add('oneui');
    }

    function chooseTheme(key) {
        pendingTheme = key;
        previewThemeVars(key); // recolors the dialog + mini card ONLY
        syncSelection();
    }

    function chooseLayout(key) {
        pendingLayout = key;
        syncSelection(); // mini card flips to bar/tile inside the dialog only
    }

    function chooseAnim(key) {
        pendingAnim = key;
        demoAnim(key); // replays the mini card's open animation as a preview
        syncSelection();
    }

    function open() {
        pendingTheme = getAppliedTheme();
        pendingLayout = getAppliedLayout();
        pendingAnim = getAppliedAnim();
        renderThemes();
        renderOptions('ap-layout-row', LAYOUTS, chooseLayout);
        renderOptions('ap-anim-row', ANIMS, chooseAnim);
        previewThemeVars(pendingTheme);
        syncSelection();
        el('appearance-picker-backdrop').classList.add('open');
        el('appearance-picker-dialog').classList.add('open');
    }

    function close() {
        pendingTheme = pendingLayout = pendingAnim = null;
        el('appearance-picker-backdrop').classList.remove('open');
        el('appearance-picker-dialog').classList.remove('open');
        syncSummary();
    }

    function apply() {
        if (pendingTheme !== null && pendingTheme !== getAppliedTheme()) {
            if (pendingTheme === 'none') {
                clearAppliedTheme();
            } else {
                changeTheme(pendingTheme, false);
            }
        }
        if (pendingLayout && pendingLayout !== getAppliedLayout()) changeCardLayout(pendingLayout);
        if (pendingAnim && pendingAnim !== getAppliedAnim()) changeOpenAnim(pendingAnim);
        pendingTheme = pendingLayout = pendingAnim = null;
        el('appearance-picker-backdrop').classList.remove('open');
        el('appearance-picker-dialog').classList.remove('open');
        clearPreviewThemeVars();
        syncSummary();
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
    });

    syncSummary();

    return { open, close, apply, syncSummary };
})();

(function initBgState() {
    const savedState = localStorage.getItem('bg-gif-enabled');
    const isEnabled = savedState !== 'false';
    applyBgState(isEnabled);
})();

var cursorGlow = document.getElementById('cursor-glow');
window.addEventListener('mousemove', function (e) {
    if (window.innerWidth >= 1024) {
        cursorGlow.style.opacity = '1';
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
    }
});
window.addEventListener('mouseleave', function () {
    cursorGlow.style.opacity = '0';
});

function toggleSettings() {
    const page = document.getElementById('settings-page');
    const isOpening = !page.classList.contains('open');
    if (isOpening) {
        closeAllModals();
        OneUIMotion.open(page, OneUIMotion.lastOrigin);
        if (typeof PrismYourDay !== 'undefined' && PrismYourDay.syncSettingsUI) {
            PrismYourDay.syncSettingsUI();
        }
    } else {
        OneUIMotion.close(page);
    }
}

(function initPWAStatus() {
    var el = document.getElementById('pwa-status');
    var label = document.getElementById('pwa-status-label');
    var hideTimer;

    function setStatus(online) {
        el.classList.remove('online', 'offline');
        el.classList.add(online ? 'online' : 'offline');
        label.textContent = online ? 'Online' : 'Offline';
        el.classList.add('visible');
        clearTimeout(hideTimer);
        if (online) hideTimer = setTimeout(function () { el.classList.remove('visible'); }, 3000);

        ['recache-btn', 'recache-game-toggle'].forEach(function (id) {
            const target = document.getElementById(id);
            if (!target) return;
            target.style.opacity = online ? '1' : '0.4';
            target.style.pointerEvents = online ? 'auto' : 'none';
            target.style.cursor = online ? 'pointer' : 'not-allowed';
        });
    }

    window.addEventListener('online', function () { setStatus(true); });
    window.addEventListener('offline', function () { setStatus(false); });

    if (!navigator.onLine) setStatus(false);
})();

(function setupGifReloadOnOnline() {
    const bgGifElement = document.querySelector('.bg-gif');
    if (!bgGifElement) return;

    function getCurrentGifUrl() {
        const isEnabled = localStorage.getItem('bg-gif-enabled') !== 'false';
        if (!isEnabled) return null;

        const preset = localStorage.getItem('bg-gif-preset') || 'gif1';
        if (preset === 'custom') {
            return localStorage.getItem('bg-gif-custom-url') || null;
        } else {
            return GIF_PRESETS[preset] || GIF_PRESETS.gif1;
        }
    }

    function reloadGifBackground() {
        if (!navigator.onLine) return;
        const url = getCurrentGifUrl();
        if (!url) {
            document.body.classList.add('no-gif');
            return;
        }
        document.body.classList.remove('no-gif');
        const separator = url.includes('?') ? '&' : '?';
        const freshUrl = `${url}${separator}reload=${Date.now()}`;
        bgGifElement.style.background = `url('${freshUrl}') center / cover no-repeat`;
    }

    window.addEventListener('online', reloadGifBackground);
})();

function openModal(id) {
    const targetPanel = document.getElementById(id);
    if (!targetPanel) return;
    const settings = document.getElementById('settings-page');
    if (settings.classList.contains('open')) {
        OneUIMotion.close(settings);
    }
    document.querySelectorAll('.app-library-page.open').forEach(function (panel) {
        if (panel !== targetPanel) OneUIMotion.close(panel);
    });
    OneUIMotion.open(targetPanel, OneUIMotion.lastOrigin);
    document.body.style.overflow = 'hidden';
    if (id === 'modal-changelog') {
        renderChangelogHistory();
        (function () {
            const vEl = document.getElementById('cl-modal-version');
            const tEl = document.getElementById('cl-modal-title');
            const mEl = document.getElementById('cl-modal-msg');
            if (!vEl || !tEl || !mEl) return;
            fetch('changelog.json?t=' + Date.now(), { cache: 'no-store' })
                .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
                .then(function (data) {
                    vEl.textContent = data.release || '???';
                    tEl.textContent = data.title || 'no title';
                    mEl.textContent = data.message || 'no details available';
                })
                .catch(function () {
                    vEl.textContent = 'error';
                    tEl.textContent = 'failed to load';
                    mEl.textContent = 'could not reach changelog.json — check your connection.';
                });
        })();
    }
}

function closeAllModals() {
    document.querySelectorAll('.app-library-page.open').forEach(function (panel) {
        OneUIMotion.close(panel);
    });
    if (!document.getElementById('settings-page').classList.contains('open')) {
        document.body.style.overflow = '';
    }
}

function toggleCredits() {
    document.getElementById('credits-dialog').classList.toggle('open');
    document.getElementById('credits-backdrop').classList.toggle('open');
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.getElementById('credits-dialog').classList.remove('open');
        document.getElementById('credits-backdrop').classList.remove('open');
    }
});

function handleOverlayClick(e) { return; }

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllModals();
});

function createRipple(e) {
    var el = e.currentTarget;
    var boosted = document.body.dataset.openAnim === 'oneui'
        && !document.body.classList.contains('no-anim')
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (boosted) {
        var box = el.getBoundingClientRect();
        var px = e.clientX || box.left + box.width / 2;
        var py = e.clientY || box.top + box.height / 2;
        var x = px - box.left;
        var y = py - box.top;
        var radius = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
        var size = radius * 2;
        var wave = document.createElement('span');
        wave.className = 'ripple-oneui';
        wave.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (x - radius) + 'px;top:' + (y - radius) + 'px';
        el.appendChild(wave);
        var grow = wave.animate(
            [{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
            { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        );
        wave.animate(
            [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }],
            { duration: 650, easing: 'linear', fill: 'forwards' }
        );
        grow.onfinish = function () { wave.remove(); };
        return;
    }

    var existing = el.querySelector('.ripple');
    if (existing) existing.remove();
    var circle = document.createElement('span');
    var d = Math.max(el.clientWidth, el.clientHeight);
    var rect = el.getBoundingClientRect();
    circle.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - rect.left - d / 2) + 'px;top:' + (e.clientY - rect.top - d / 2) + 'px';
    circle.classList.add('ripple');
    el.appendChild(circle);
}

function getAppDataFromIDB(key, callback) {
    const request = indexedDB.open('PrismDB', 1);
    request.onsuccess = function (e) {
        const db = e.target.result;
        const transaction = db.transaction('dynamic-cache', 'readonly');
        const store = transaction.objectStore('dynamic-cache');
        const getReq = store.get(key);
        getReq.onsuccess = function () {
            callback(getReq.result);
        };
    };
}

function killStartupLoader() {
    var loader = document.getElementById('startup-loader');
    var page = document.getElementById('page');
    if (!loader) return;
    loader.style.transition = 'none';
    loader.style.opacity = '0';
    loader.style.display = 'none';
    if (page) page.style.opacity = '1';
}

(function fixSettingsButtonPlacement() {
    function reposition() {
        const btn = document.querySelector('.prism-settings-btn');
        const panel = document.querySelector('.settings-panel');
        if (!btn) return;

        btn.style.setProperty('position', 'fixed', 'important');
        btn.style.setProperty('bottom', '24px', 'important');
        btn.style.setProperty('right', '24px', 'important');
        btn.style.setProperty('top', 'auto', 'important');
        btn.style.setProperty('left', 'auto', 'important');
        btn.style.setProperty('z-index', '1000', 'important');

        if (panel) {
            panel.style.setProperty('bottom', '90px', 'important');
            panel.style.setProperty('right', '24px', 'important');
            panel.style.setProperty('top', 'auto', 'important');
            panel.style.setProperty('left', 'auto', 'important');
            panel.style.transformOrigin = 'bottom right';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', reposition);
    } else {
        reposition();
    }

    const observer = new MutationObserver(() => reposition());
    observer.observe(document.body, { childList: true, subtree: true });
})();

var PrismChangelogStore = (function () {
    const DB_NAME = 'PrismChangelogDB';
    const STORE = 'changelogs';
    const VERSION = 1;

    function openDB() {
        return new Promise(function (resolve, reject) {
            const req = indexedDB.open(DB_NAME, VERSION);
            req.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'release' });
                }
            };
            req.onsuccess = function (e) { resolve(e.target.result); };
            req.onerror = function (e) { reject(e.target.error); };
        });
    }

    function dateKey() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    function save(entry) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put({
                    release: entry.release || dateKey(),
                    title: entry.title || '',
                    message: entry.message || '',
                    storedAt: entry.storedAt || dateKey()
                });
                tx.oncomplete = function () { db.close(); resolve(); };
                tx.onerror = function () { db.close(); reject(tx.error); };
            });
        });
    }

    function getAll() {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(STORE, 'readonly');
                const req = tx.objectStore(STORE).getAll();
                req.onsuccess = function () { db.close(); resolve(req.result || []); };
                req.onerror = function () { db.close(); reject(req.error); };
            });
        });
    }

    function clear() {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).clear();
                tx.oncomplete = function () { db.close(); resolve(); };
                tx.onerror = function () { db.close(); reject(tx.error); };
            });
        });
    }

    return { save: save, getAll: getAll, clear: clear, dateKey: dateKey };
})();

function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function renderChangelogHistory() {
    const grid = document.getElementById('changelog-history-grid');
    if (!grid) return;
    PrismChangelogStore.getAll().then(function (entries) {
        entries.sort(function (a, b) {
            return String(b.storedAt || '').localeCompare(String(a.storedAt || ''));
        });
        if (!entries.length) {
            grid.innerHTML = '<div class="changelog-history-empty">no previous updates stored yet</div>';
            return;
        }
        grid.innerHTML = entries.map(function (e) {
            return '<div class="changelog-history-card">' +
                '<div class="changelog-version-badge">' + escapeHtml(e.release || 'unknown') + '</div>' +
                '<div class="changelog-history-title">' + escapeHtml(e.title || '') + '</div>' +
                '<div class="changelog-history-msg">' + escapeHtml(e.message || '') + '</div>' +
                '<div class="changelog-history-date">' + escapeHtml(e.storedAt || '') + '</div>' +
                '</div>';
        }).join('');
    }).catch(function (err) {
        console.error('[Prism Logs]: failed to read history', err);
        grid.innerHTML = '<div class="changelog-history-empty">failed to load history</div>';
    });
}

function clearChangelogHistory() {
    if (!confirm('Clear all stored changelogs?\n\nThis removes the local history but does not affect the online changelog.')) return;
    PrismChangelogStore.clear().then(function () {
        renderChangelogHistory();
    }).catch(function (err) {
        console.error('[Prism Logs]: failed to clear history', err);
        alert('Failed to clear changelog history.');
    });
}

window.addEventListener('load', function () {
    var loader = document.getElementById('startup-loader');
    var logo = document.getElementById('loader-logo');
    var wordmark = document.getElementById('loader-wordmark');
    var page = document.getElementById('page');
    var isStandalone = window.__PRISM_ENV__.isStandalone;

    function dismissLoader() {
        loader.style.opacity = '0';
        page.style.opacity = '1';
        setTimeout(function () { loader.style.display = 'none'; }, 700);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(
            `/sw.js?standalone=${isStandalone}&includeGames=false`
        );
    }

    var logoAt = Math.max(0, 1500 - performance.now());
    setTimeout(function () { logo.classList.add('show'); }, logoAt);
    setTimeout(function () { wordmark.classList.add('show'); }, logoAt + 700);
    setTimeout(dismissLoader, logoAt + 700 + 1300);
});

(function initCardPhysics() {
    let isFalling = false;

    const triggerFall = () => {
        if (isFalling) return;
        isFalling = true;

        const allCards = document.querySelectorAll('.glass-card, .dt-glass-card');

        allCards.forEach(c => {
            const randomRot = (Math.random() - 0.5) * 60;
            c.style.transition = 'transform 0.8s cubic-bezier(0.55, 0.085, 0.68, 0.53), opacity 0.6s ease';
            c.style.transform = `translateY(150vh) rotate(${randomRot}deg)`;
            c.style.opacity = '0';
            c.style.pointerEvents = 'none';
        });

        setTimeout(() => {
            allCards.forEach(c => {
                c.style.transition = 'transform 0.8s var(--spring), opacity 0.8s ease';
                c.style.transform = '';
                c.style.opacity = '';
                c.style.pointerEvents = '';
            });

            setTimeout(() => {
                allCards.forEach(c => {
                    c.style.transition = '';
                });
                isFalling = false;
            }, 800);
        }, 3000);
    };

    document.querySelectorAll('.glass-card, .dt-glass-card').forEach(card => {
        let isDragging = false;
        let wasDragged = false;
        let startX = 0;
        let startY = 0;

        let lastX = 0;
        let lastDir = 0;
        let shakeCount = 0;
        let lastShakeTime = 0;

        card.addEventListener('pointerdown', e => {
            if (document.body.classList.contains('no-anim') || isFalling) return;
            isDragging = true;
            wasDragged = false;
            startX = e.clientX;
            startY = e.clientY;
            lastX = e.clientX;
            shakeCount = 0;
            lastShakeTime = Date.now();

            card.style.transition = 'none';
            card.style.zIndex = '20';
            card.setPointerCapture(e.pointerId);
        });

        card.addEventListener('pointermove', e => {
            if (!isDragging) return;

            const rawDx = e.clientX - startX;
            const rawDy = e.clientY - startY;

            if (Math.abs(rawDx) > 5 || Math.abs(rawDy) > 5) {
                wasDragged = true;
            }

            const currentX = e.clientX;
            const deltaX = currentX - lastX;
            const now = Date.now();

            if (Math.abs(deltaX) > 12) {
                const dir = Math.sign(deltaX);
                if (dir !== lastDir && lastDir !== 0) {
                    shakeCount++;
                    lastShakeTime = now;

                    if (shakeCount > 10) {
                        releaseCard();
                        triggerFall();
                        return;
                    }
                }
                lastDir = dir;
                lastX = currentX;
            }

            if (now - lastShakeTime > 250) {
                shakeCount = 0;
            }

            const dx = rawDx * 0.35;
            const dy = rawDy * 0.35;
            const tilt = dx * 0.08;

            card.style.transform = `translate(${dx}px, ${dy}px) rotate(${tilt}deg) scale(1.03)`;
        });

        const releaseCard = () => {
            if (!isDragging) return;
            isDragging = false;
            if (!isFalling) {
                card.style.transition = '';
                card.style.transform = '';
            }
            card.style.zIndex = '';
        };

        card.addEventListener('pointerup', releaseCard);
        card.addEventListener('pointercancel', releaseCard);

        card.addEventListener('click', e => {
            if (wasDragged) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);
    });
})();

const PrismVideoBg = (function () {
    const DB_NAME = 'PrismVideoCacheDB';
    const STORE_NAME = 'videos';
    const KEY = 'custom_bg_video';
    const SOUND_KEY = 'prism-video-sound';
    const VOLUME_KEY = 'prism-video-volume';

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

    async function saveVideoBlob(blob) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(blob, KEY);
            req.onsuccess = () => resolve();
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

    async function deleteVideoBlob() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(KEY);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    function getSavedVolume() {
        const v = parseFloat(localStorage.getItem(VOLUME_KEY));
        return isNaN(v) ? 0.5 : Math.min(1, Math.max(0, v));
    }

    function isSoundOn() {
        return localStorage.getItem(SOUND_KEY) === 'true';
    }

    function applySoundState() {
        const videoEl = document.getElementById('bg-video');
        const icon = document.getElementById('video-bg-sound-icon');
        const wrap = document.getElementById('video-bg-volume-wrap');
        const slider = document.getElementById('video-bg-volume');
        const on = isSoundOn();
        const hasVideo = !!(videoEl && videoEl.src);

        if (videoEl) {
            videoEl.volume = getSavedVolume();
            videoEl.muted = !on;
            if (on && hasVideo) {
                videoEl.play().catch(() => {
                    videoEl.muted = true;
                    videoEl.play().catch(() => { });
                });
            }
        }

        if (icon) icon.textContent = on ? 'volume_up' : 'volume_off';
        if (wrap) wrap.style.display = (on && hasVideo) ? 'flex' : 'none';
        if (slider) slider.value = Math.round(getSavedVolume() * 100);
    }

    function toggleSound() {
        localStorage.setItem(SOUND_KEY, isSoundOn() ? 'false' : 'true');
        applySoundState();
    }

    function setVolume(value) {
        const v = Math.min(1, Math.max(0, Number(value) / 100));
        localStorage.setItem(VOLUME_KEY, String(v));
        const videoEl = document.getElementById('bg-video');
        if (videoEl) {
            videoEl.volume = v;
            if (isSoundOn() && videoEl.muted) {
                videoEl.muted = false;
                videoEl.play().catch(() => { });
            }
        }
    }

    function armSoundGesture() {
        if (!isSoundOn()) return;
        const unlock = () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('touchstart', unlock);
            applySoundState();
        };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock);
        window.addEventListener('touchstart', unlock, { passive: true });
    }

    async function applyVideo() {
        const videoEl = document.getElementById('bg-video');
        const gifEl = document.querySelector('.bg-gif');
        const clearBtn = document.getElementById('clear-video-bg-btn');
        const refreshBtn = document.getElementById('refresh-video-bg-btn');
        const soundBtn = document.getElementById('video-bg-sound-btn');

        if (!videoEl) return;

        try {
            const blob = await getVideoBlob();
            if (blob) {
                if (videoEl.src) URL.revokeObjectURL(videoEl.src);
                videoEl.src = URL.createObjectURL(blob);
                videoEl.style.display = 'block';
                if (gifEl) gifEl.style.display = 'none';
                if (clearBtn) clearBtn.style.display = 'inline-block';
                if (refreshBtn) refreshBtn.style.display = 'inline-block';
                if (soundBtn) soundBtn.style.display = 'inline-block';
            } else {
                videoEl.pause();
                videoEl.currentTime = 0;
                videoEl.muted = true;
                if (videoEl.src) URL.revokeObjectURL(videoEl.src);
                videoEl.removeAttribute('src');
                videoEl.load();
                videoEl.style.display = 'none';
                if (gifEl && localStorage.getItem('bg-gif-enabled') !== 'false') {
                    gifEl.style.display = 'block';
                }
                if (clearBtn) clearBtn.style.display = 'none';
                if (refreshBtn) refreshBtn.style.display = 'none';
                if (soundBtn) soundBtn.style.display = 'none';
            }
            const playbackCard = document.getElementById('video-playback-card');
            if (playbackCard) playbackCard.style.display = blob ? 'flex' : 'none';
            applySoundState();
            if (typeof PrismBgPicker !== 'undefined') PrismBgPicker.syncSummary();
        } catch (e) {
            console.error(e);
        }
    }

    function refreshVideo() {
        const videoEl = document.getElementById('bg-video');
        if (!videoEl) return;
        videoEl.pause();
        videoEl.currentTime = 0;
        videoEl.load();
        applySoundState();
        videoEl.play().catch(() => { });
    }

    async function handleUpload(file) {
        if (!file || !file.type.startsWith('video/')) return;
        await deleteVideoBlob();
        await saveVideoBlob(file);
        await applyVideo();
    }

    async function removeVideo() {
        const videoEl = document.getElementById('bg-video');
        if (videoEl) {
            videoEl.pause();
            videoEl.currentTime = 0;
            videoEl.muted = true;
            if (videoEl.src) URL.revokeObjectURL(videoEl.src);
            videoEl.removeAttribute('src');
            videoEl.load();
            videoEl.style.display = 'none';
        }
        await deleteVideoBlob();
        await applyVideo();
    }

    window.addEventListener('DOMContentLoaded', () => {
        applyVideo();
        armSoundGesture();
    });

    return {
        handleUpload,
        removeVideo,
        refreshVideo,
        applyVideo,
        toggleSound,
        setVolume,
        applySoundState
    };
})();

(function () {
    var ua = navigator.userAgent || '';
    var isMobileOS = /android|iphone|ipad|ipod|mobile/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isMobileOS) document.documentElement.classList.add('is-mobile-os');
    document.addEventListener('click', function (e) {
        if (document.documentElement.classList.contains('is-mobile-os') && e.target.closest && e.target.closest('.list-item-disabled')) {
            e.preventDefault();
        }
    }, true);
})();

var PrismYourDay = (function () {
    const USERNAME_KEY = 'PRISM_USERNAME';
    const SEEN_VERSION_KEY = 'PRISM_YOURDAY_SEEN_VERSION';

    let currentLiveVersion = null;

    function getUsername() {
        try {
            const raw = localStorage.getItem(USERNAME_KEY);
            if (!raw) return null;
            const trimmed = String(raw).trim();
            return trimmed || null;
        } catch (e) {
            return null;
        }
    }

    function setUsername(name) {
        try {
            const trimmed = String(name == null ? '' : name).trim();
            if (!trimmed) return false;
            localStorage.setItem(USERNAME_KEY, trimmed);
            return true;
        } catch (e) {
            return false;
        }
    }

    function getGreetingForHour(hour, username) {
        const name = username || 'friend';
        if (hour >= 5 && hour < 8) return 'early bird today, ' + name + '?';
        if (hour >= 8 && hour < 12) return 'good morning, ' + name;
        if (hour >= 12 && hour < 18) return 'good afternoon, ' + name;
        if (hour >= 18 && hour < 22) return 'good evening, ' + name;
        return 'welcome, night owl ' + name;
    }

    function getPeriodForHour(hour) {
        if (hour >= 5 && hour < 8) return 'earlybird';
        if (hour >= 8 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    function getIconForPeriod(period) {
        if (period === 'earlybird') return 'wb_twilight';
        if (period === 'morning' || period === 'afternoon') return 'wb_sunny';
        if (period === 'evening') return 'wb_twilight';
        return 'nightlight_round';
    }

    function updateGreeting() {
        const username = getUsername();
        const now = new Date();
        const hour = now.getHours();
        const greeting = getGreetingForHour(hour, username);
        const icon = getIconForPeriod(getPeriodForHour(hour));

        document.querySelectorAll('[data-your-day-greeting]').forEach(function (el) {
            el.textContent = greeting;
        });
        document.querySelectorAll('[data-your-day-icon]').forEach(function (el) {
            el.textContent = icon;
        });
    }

    function updateSetupUI() {
        const hasUsername = !!getUsername();
        document.querySelectorAll('[data-your-day-setup]').forEach(function (el) {
            el.classList.toggle('visible', !hasUsername);
        });
    }

    function syncSettingsUI() {
        const current = getUsername();
        const input = document.getElementById('username-setting-input');
        const display = document.getElementById('username-current-display');
        if (input && document.activeElement !== input) {
            input.value = current || '';
        }
        if (display) {
            display.textContent = current ? current : 'not set';
        }
    }

    function saveUsernameFromComponent(btn) {
        const container = (btn && btn.closest) ? btn.closest('.your-day') : document.querySelector('.your-day');
        const input = container ? container.querySelector('[data-your-day-input]') : null;
        if (!input) return;
        if (!setUsername(input.value)) {
            input.focus();
            return;
        }
        input.value = getUsername() || '';
        updateGreeting();
        updateSetupUI();
        syncSettingsUI();
    }

    function saveUsernameFromSettings() {
        const input = document.getElementById('username-setting-input');
        if (!input) return;
        if (!setUsername(input.value)) {
            input.focus();
            return;
        }
        input.value = getUsername() || '';
        updateGreeting();
        updateSetupUI();
        syncSettingsUI();
    }

    function notifyUpdate(version) {
        currentLiveVersion = version || null;
        if (!version) return;
        const inStandalone = (window.__PRISM_ENV__ && window.__PRISM_ENV__.isStandalone) || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (!inStandalone) return;
        let seen = null;
        try {
            seen = localStorage.getItem(SEEN_VERSION_KEY);
        } catch (e) { }
        if (seen === version) return;

        document.querySelectorAll('[data-your-day-notice]').forEach(function (el) {
            el.classList.add('visible');
        });
        document.querySelectorAll('[data-your-day-version]').forEach(function (el) {
            el.textContent = version;
        });
    }

    function dismissUpdate() {
        if (currentLiveVersion) {
            try {
                localStorage.setItem(SEEN_VERSION_KEY, currentLiveVersion);
            } catch (e) { }
        }
        document.querySelectorAll('[data-your-day-notice]').forEach(function (el) {
            el.classList.remove('visible');
        });
    }

    function handleNoticeClick() {
        dismissUpdate();
        if (typeof openModal === 'function') {
            openModal('modal-changelog');
        }
    }

    function scheduleGreetingUpdates() {
        setInterval(updateGreeting, 30000);

        function scheduleNextBoundary() {
            const now = new Date();
            const h = now.getHours();
            let nextHour;
            if (h < 5) nextHour = 5;
            else if (h < 8) nextHour = 8;
            else if (h < 12) nextHour = 12;
            else if (h < 18) nextHour = 18;
            else if (h < 22) nextHour = 22;
            else nextHour = 5;

            const next = new Date(now);
            if (h >= 22 && nextHour === 5) {
                next.setDate(next.getDate() + 1);
            }
            next.setHours(nextHour, 0, 0, 0);
            const delay = next.getTime() - now.getTime();
            setTimeout(function () {
                updateGreeting();
                scheduleNextBoundary();
            }, Math.max(delay, 1000));
        }

        scheduleNextBoundary();
    }

    function init() {
        updateGreeting();
        updateSetupUI();
        syncSettingsUI();
        scheduleGreetingUpdates();

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) updateGreeting();
        });

        document.querySelectorAll('[data-your-day-input]').forEach(function (input) {
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveUsernameFromComponent(input);
                }
            });
        });

        const settingsInput = document.getElementById('username-setting-input');
        if (settingsInput) {
            settingsInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveUsernameFromSettings();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        init: init,
        notifyUpdate: notifyUpdate,
        dismissUpdate: dismissUpdate,
        handleNoticeClick: handleNoticeClick,
        saveUsernameFromComponent: saveUsernameFromComponent,
        saveUsernameFromSettings: saveUsernameFromSettings,
        syncSettingsUI: syncSettingsUI,
        updateGreeting: updateGreeting,
        getUsername: getUsername
    };
})();