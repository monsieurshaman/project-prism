// Sand Box 3D Material You Design Module

(function () {
    'use strict';

    const MODULE_KEY = 'sb3d_prism_md3';
    const isEnabled = localStorage.getItem(MODULE_KEY) === 'true';

    const lang = localStorage.getItem('sb3d_lang') || 'en';
    const STRINGS = {
        en: {
            on: 'Material Design Theme is ON',
            off: 'Material Design Theme is OFF',
            promptOn: 'Enable Material You (MD3) Theme?\n\nA session restart is required to apply the new design language.\n\nClick OK to restart and enable.',
            promptOff: 'Disable Material You (MD3) Theme?\n\nA session restart is required to revert to the default look.\n\nClick OK to restart and disable.',
            btnLabel: '🎨 Prism MD3 Theme',
        },
        genz: {
            on: 'Material Design drip is ON fr ✨',
            off: 'Material Design said nah 💀',
            promptOn: 'enable material you drip? 👀\n\ngotta restart to apply the new aesthetic bestie.\n\nOK = restart & slay\nCANCEL = stay basic',
            promptOff: 'turn off the MD3 glow up? valid.\n\nneeds a restart to go back to default.\n\nOK = restart\nCANCEL = nvm keep the drip',
            btnLabel: '🎨 Prism MD3 Drip',
        },
        shakespeare: {
            on: 'Material Design Theme doth Shine ✨',
            off: 'Material Design Theme Slumbers',
            promptOn: 'Dost thou wish to enable the Material You MD3 Theme? 👀\n\nA session restart is required to weave this new design.\n\nOK = Restart and let it flourish\nCANCEL = Remain in the plain era',
            promptOff: 'Dost thou wish to extinguish the MD3 Theme?\n\nA restart of the session is needed to return to the default visage.\n\nOK = Restart and strip away the theme\nCANCEL = Nay, preserve the visual splendour',
            btnLabel: '🎨 Prism MD3 Visage',
        },
    };
    const T = STRINGS[lang] || STRINGS.en;

    const MD3_TOKENS = {
        '--prism-md3-primary': '#9ECAFF',
        '--prism-md3-on-primary': '#003258',
        '--prism-md3-primary-container': '#00497D',
        '--prism-md3-on-primary-container': '#D1E4FF',
        '--prism-md3-primary-fixed': '#D1E4FF',
        '--prism-md3-on-primary-fixed': '#001B36',
        '--prism-md3-primary-fixed-dim': '#9ECAFF',
        '--prism-md3-secondary': '#BBC8DB',
        '--prism-md3-on-secondary': '#253140',
        '--prism-md3-secondary-container': '#3C4858',
        '--prism-md3-on-secondary-container': '#D7E4F7',
        '--prism-md3-tertiary': '#D7BEE6',
        '--prism-md3-on-tertiary': '#3B2948',
        '--prism-md3-tertiary-container': '#523F5F',
        '--prism-md3-on-tertiary-container': '#F3DAFF',
        '--prism-md3-surface': '#1B1B1F',
        '--prism-md3-on-surface': '#E3E2E6',
        '--prism-md3-surface-variant': '#43474E',
        '--prism-md3-on-surface-variant': '#C4C6CF',
        '--prism-md3-surface-dim': '#111318',
        '--prism-md3-surface-bright': '#37393E',
        '--prism-md3-surface-container-lowest': '#0E1014',
        '--prism-md3-surface-container-low': '#1B1B1F',
        '--prism-md3-surface-container': '#25262A',
        '--prism-md3-surface-container-high': '#2F3035',
        '--prism-md3-surface-container-highest': '#3A3B40',
        '--prism-md3-background': '#1B1B1F',
        '--prism-md3-on-background': '#E3E2E6',
        '--prism-md3-outline': '#8E9098',
        '--prism-md3-outline-variant': '#43474E',
        '--prism-md3-error': '#FFB4AB',
        '--prism-md3-on-error': '#690005',
        '--prism-md3-error-container': '#93000A',
        '--prism-md3-on-error-container': '#FFDAD6',
        '--prism-md3-inverse-surface': '#E3E2E6',
        '--prism-md3-inverse-on-surface': '#303034',
        '--prism-md3-inverse-primary': '#38618E',
        '--prism-md3-elevation-level0': '0px 0px 0px 0px rgba(0,0,0,0)',
        '--prism-md3-elevation-level1': '0px 1px 2px 0px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)',
        '--prism-md3-elevation-level2': '0px 1px 2px 0px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)',
        '--prism-md3-elevation-level3': '0px 1px 3px 0px rgba(0,0,0,0.3), 0px 4px 8px 3px rgba(0,0,0,0.15)',
        '--prism-md3-elevation-level4': '0px 2px 3px 0px rgba(0,0,0,0.3), 0px 6px 10px 4px rgba(0,0,0,0.15)',
        '--prism-md3-elevation-level5': '0px 4px 4px 0px rgba(0,0,0,0.3), 0px 8px 12px 6px rgba(0,0,0,0.15)',
        '--prism-md3-shape-corner-extra-small': '4px',
        '--prism-md3-shape-corner-small': '8px',
        '--prism-md3-shape-corner-medium': '12px',
        '--prism-md3-shape-corner-large': '16px',
        '--prism-md3-shape-corner-extra-large': '28px',
        '--prism-md3-shape-corner-full': '9999px',
    };


    if (isEnabled) {
        const STYLE_ID = 'sb3d-prism-md3-styles';

        const css = `
:root {
${Object.entries(MD3_TOKENS).map(([k, v]) => `  ${k}: ${v};`).join('\n')}
}

html, body {
    background-color: var(--prism-md3-background) !important;
    color: var(--prism-md3-on-surface) !important;
    font-family: 'Google Sans', 'Roboto', 'Segoe UI', Tahoma, sans-serif !important;
}

.ui-panel-base {
    background: var(--prism-md3-surface-container) !important;
    border: 1px solid var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-extra-large) !important;
    box-shadow: var(--prism-md3-elevation-level3) !important;
    color: var(--prism-md3-on-surface) !important;
}
.ui-panel-base h2 {
    color: var(--prism-md3-primary) !important;
    font-family: 'Google Sans', 'Roboto', sans-serif !important;
    font-weight: 500 !important;
}
.ui-panel-base .panel-header {
    border-bottom-color: var(--prism-md3-outline-variant) !important;
}
.ui-panel-base .section-label {
    color: var(--prism-md3-on-surface-variant) !important;
    font-weight: 500 !important;
}

.slider-group {
    background: var(--prism-md3-surface-container-low) !important;
    border: 1px solid var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-medium) !important;
}
.slider-label, .slider-label span {
    color: var(--prism-md3-on-surface-variant) !important;
}

button {
    background: var(--prism-md3-surface-container-high) !important;
    border: 1px solid var(--prism-md3-outline) !important;
    color: var(--prism-md3-on-surface) !important;
    border-radius: var(--prism-md3-shape-corner-full) !important;
    font-family: 'Google Sans', 'Roboto', sans-serif !important;
    font-weight: 500 !important;
    transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
}
button:hover {
    background: var(--prism-md3-secondary-container) !important;
    border-color: var(--prism-md3-primary) !important;
    box-shadow: var(--prism-md3-elevation-level2) !important;
}
button:active {
    background: var(--prism-md3-primary-container) !important;
    border-color: var(--prism-md3-primary) !important;
    box-shadow: var(--prism-md3-elevation-level1) !important;
}
button.active {
    background: var(--prism-md3-primary-container) !important;
    border-color: var(--prism-md3-primary) !important;
    color: var(--prism-md3-on-primary-container) !important;
    font-weight: 700 !important;
}

button#btn-enter-game {
    background: var(--prism-md3-primary) !important;
    border-color: var(--prism-md3-primary) !important;
    color: var(--prism-md3-on-primary) !important;
}
button#btn-enter-game:hover {
    background: var(--prism-md3-on-primary-container) !important;
    color: var(--prism-md3-primary-container) !important;
}

button#btn-clear {
    background: var(--prism-md3-error) !important;
    border-color: var(--prism-md3-error) !important;
    color: var(--prism-md3-on-error) !important;
}

button#btn-upload {
    background: var(--prism-md3-secondary-container) !important;
    border-color: var(--prism-md3-secondary) !important;
    color: var(--prism-md3-on-secondary-container) !important;
}

#game-settings-modal,
#restart-modal,
#postfx-modal {
    background: var(--prism-md3-surface-container-high) !important;
    border: 1px solid var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-extra-large) !important;
    box-shadow: var(--prism-md3-elevation-level5) !important;
}
.settings-header {
    border-bottom-color: var(--prism-md3-outline-variant) !important;
}
.settings-header h2 {
    color: var(--prism-md3-primary) !important;
}
.settings-category {
    background: var(--prism-md3-surface-container-low) !important;
    border: 1px solid var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-medium) !important;
}
.settings-close-btn {
    background: var(--prism-md3-error) !important;
    border-color: var(--prism-md3-error) !important;
    color: var(--prism-md3-on-error) !important;
    border-radius: var(--prism-md3-shape-corner-full) !important;
}

#settings-modal-overlay,
#restart-modal-overlay,
#postfx-modal-overlay {
    background: rgba(0, 0, 0, 0.75) !important;
}

.restart-option {
    background: var(--prism-md3-surface-container) !important;
    border-color: var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-medium) !important;
}
.restart-option-title {
    color: var(--prism-md3-on-surface) !important;
}
.restart-option-desc {
    color: var(--prism-md3-on-surface-variant) !important;
}
.restart-option.opt-babylon  { border-left-color: var(--prism-md3-primary) !important; }
.restart-option.opt-all      { border-left-color: #f39c12 !important; }
.restart-option.opt-reset    { border-left-color: var(--prism-md3-error) !important; }

input[type=range] {
    accent-color: var(--prism-md3-primary);
}
input[type=range]::-webkit-slider-thumb {
    background: var(--prism-md3-primary) !important;
}
input[type=color] {
    background: var(--prism-md3-surface-container) !important;
    border: 1px solid var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-small) !important;
}
select, input[type=number] {
    background: var(--prism-md3-surface-container-high) !important;
    color: var(--prism-md3-on-surface) !important;
    border: 1px solid var(--prism-md3-outline) !important;
    border-radius: var(--prism-md3-shape-corner-small) !important;
}

.meter-box {
    background: var(--prism-md3-surface-container) !important;
    border: 1px solid var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-small) !important;
    font-family: 'Google Sans', 'Roboto', monospace !important;
    color: var(--prism-md3-on-surface) !important;
    box-shadow: var(--prism-md3-elevation-level1) !important;
}
#fps-render { color: var(--prism-md3-primary) !important; }
#fps-phys   { color: var(--prism-md3-tertiary) !important; }

#btn-flashlight-hud {
    background: var(--prism-md3-surface-container-high) !important;
    border: 1px solid var(--prism-md3-outline) !important;
    border-radius: var(--prism-md3-shape-corner-full) !important;
    color: var(--prism-md3-on-surface) !important;
}

.mobile-pad .d-btn {
    background: var(--prism-md3-surface-container-high) !important;
    border: 1px solid var(--prism-md3-outline-variant) !important;
    border-radius: var(--prism-md3-shape-corner-medium) !important;
    color: var(--prism-md3-on-surface) !important;
}
.mobile-pad .d-btn:active {
    background: var(--prism-md3-primary-container) !important;
    border-color: var(--prism-md3-primary) !important;
}
.mobile-pad .pad-label {
    color: var(--prism-md3-on-surface-variant) !important;
}

.action-btn-overlay {
    background: var(--prism-md3-primary-container) !important;
    border: 2px solid var(--prism-md3-primary) !important;
    border-radius: 50% !important;
    color: var(--prism-md3-on-primary-container) !important;
    box-shadow: var(--prism-md3-elevation-level3) !important;
    font-family: 'Google Sans', 'Roboto', sans-serif !important;
}

#loading-screen {
    background: var(--prism-md3-background) !important;
}
.loader-text {
    color: var(--prism-md3-primary) !important;
    font-family: 'Google Sans', 'Roboto', sans-serif !important;
    text-shadow: 0 0 10px var(--prism-md3-primary-container) !important;
}
.loader-spinner {
    border-color: var(--prism-md3-primary-container) !important;
    border-top-color: var(--prism-md3-primary) !important;
}
#skip-loading-btn {
    border-color: var(--prism-md3-outline) !important;
    color: var(--prism-md3-on-surface-variant) !important;
    border-radius: var(--prism-md3-shape-corner-full) !important;
}

#flash-layer {
    background-color: var(--prism-md3-surface) !important;
}

::-webkit-scrollbar-track { background: var(--prism-md3-surface-container-low) !important; }
::-webkit-scrollbar-thumb { background: var(--prism-md3-outline) !important; border-radius: var(--prism-md3-shape-corner-full) !important; }

#portrait-overlay > div {
    background: var(--prism-md3-surface-dim) !important;
}
#btn-force-landscape {
    background: var(--prism-md3-primary) !important;
    border-color: var(--prism-md3-primary) !important;
    color: var(--prism-md3-on-primary) !important;
    border-radius: var(--prism-md3-shape-corner-medium) !important;
    box-shadow: 0 0 20px var(--prism-md3-primary-container) !important;
}

button#btn-none, button#btn-none-tools { border-left-color: var(--prism-md3-outline) !important; }
button#btn-push       { border-left-color: #2ecc71 !important; }
button#btn-eraser     { border-left-color: var(--prism-md3-error) !important; }
button#btn-view       { border-left-color: var(--prism-md3-tertiary) !important; }
button#btn-freeze     { border-left-color: var(--prism-md3-primary) !important; }
button#btn-build      { border-left-color: #e91e63 !important; }
button#btn-throw      { border-left-color: #f39c12 !important; }
button#btn-structure  { border-left-color: var(--prism-md3-tertiary) !important; }
button#btn-gravgun    { border-left-color: #00bcd4 !important; }
button.btn-explosive  { border-left-color: var(--prism-md3-error) !important; }
button#btn-frag       { border-left-color: #d35400 !important; }
button#btn-flashbang  { border-left-color: #f1c40f !important; }
button#btn-graphics-toggle { border-left-color: var(--prism-md3-primary) !important; }
button#btn-toggle-inspector { border-left-color: #f1c40f !important; }
button#btn-ambient    { border-left-color: var(--prism-md3-tertiary) !important; }
button#btn-postfx     { border-left-color: var(--prism-md3-error) !important; }
button#btn-filmfx     { border-left-color: #c0392b !important; }
button#btn-restart-options { border-left-color: var(--prism-md3-error) !important; }
button#btn-about-versions  { border-left-color: var(--prism-md3-primary) !important; }
button#btn-flashvid   { border-left-color: #f1c40f !important; }
button#btn-screenshake     { border-left-color: var(--prism-md3-error) !important; }
button#btn-haptics    { border-left-color: #2ecc71 !important; }
button#btn-sun        { border-left-color: #f1c40f !important; }
button#btn-daynight   { border-left-color: #f39c12 !important; }
button#btn-sync-time  { border-left-color: var(--prism-md3-primary) !important; }
button#btn-webgpu     { border-left-color: var(--prism-md3-primary) !important; }
button#btn-flashlight-enable { border-left-color: #f1c40f !important; }
button#btn-toggle-hud { border-left-color: #2ecc71 !important; }
button#btn-physics-sleep    { border-left-color: #2ecc71 !important; }
button#btn-frustum-cull     { border-left-color: #e67e22 !important; }
button#btn-perf-safeguard   { border-left-color: #f1c40f !important; }
button#btn-session-recorder { border-left-color: #00bcd4 !important; }
button#btn-export-session-log { border-left-color: #00bcd4 !important; }
button#btn-show-more { border-left-color: #c0392b !important; }
button#btn-spawn-particles { border-left-color: #a855f7 !important; }
`;

        const styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap';
        document.head.appendChild(fontLink);
    }

    function injectToggleButton() {
        const cat = document.getElementById('settings-cat-theming');
        if (!cat) return;
        if (document.getElementById('btn-prism-md3-toggle')) return;

        const btnGroup = document.createElement('div');
        btnGroup.className = 'control-group';
        btnGroup.style.marginTop = '15px';

        const btn = document.createElement('button');
        btn.id = 'btn-prism-md3-toggle';
        btn.style.borderLeft = isEnabled ? '4px solid var(--prism-md3-primary)' : '4px solid #555';
        btn.style.padding = '12px';
        btn.style.borderRadius = '9999px';

        updateButtonAppearance(btn, isEnabled);

        btn.addEventListener('click', () => {
            const newState = !isEnabled;
            const msg = newState ? T.promptOn : T.promptOff;
            if (window.confirm(msg)) {
                localStorage.setItem(MODULE_KEY, newState.toString());
                window.location.reload();
            }
        });

        btnGroup.appendChild(btn);
        cat.appendChild(btnGroup);
    }

    function updateButtonAppearance(btn, active) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'shape-icon';
        if (active) {
            iconSpan.style.cssText = 'background:var(--prism-md3-primary);border-radius:50%;box-shadow:0 0 5px var(--prism-md3-primary);';
            btn.innerHTML = '';
            btn.appendChild(iconSpan);
            btn.appendChild(document.createTextNode(' ' + T.on));
            btn.classList.add('active');
        } else {
            iconSpan.style.cssText = 'background:#555;border-radius:50%;';
            btn.innerHTML = '';
            btn.appendChild(iconSpan);
            btn.appendChild(document.createTextNode(' ' + T.off));
            btn.classList.remove('active');
        }
    }

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    onReady(() => {
        setTimeout(injectToggleButton, 800);
        setTimeout(() => {
            if (!document.getElementById('btn-prism-md3-toggle')) injectToggleButton();
        }, 2500);
    });

})();