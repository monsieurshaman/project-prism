// Sand Box 3D Animations Module — PC Edition

(function () {
    const ANIM_KEY = 'sb3d_ui_anim';
    const isAnimEnabled = localStorage.getItem(ANIM_KEY) === 'true';

    const lang = localStorage.getItem('sb3d_lang') || 'en';
    const strings = {
        en: {
            on: "UI Animations are ON",
            off: "UI Animations are OFF",
            promptOn: "Enable Advanced UI Animations?\n\nA session restart is required to apply the magic.\n\nClick OK to restart and enable.",
            promptOff: "Disable UI Animations?\n\nA session restart is required to revert to the classic look.\n\nClick OK to restart and disable."
        },
        genz: {
            on: "UI Animations bussin ✨",
            off: "UI Animations said nah",
            promptOn: "Enable UI animations bestie? 👀\n\nGotta restart to apply the drip.\n\nOK = restart and slay\nCANCEL = stay boring",
            promptOff: "Turn off animations? valid.\n\nNeeds a restart to go back to the plain era.\n\nOK = restart\nCANCEL = nvm keep the drip"
        },
        shakespeare: {
            on: "UI Animations Resplendent ✨",
            off: "UI Animations Dormant",
            promptOn: "Dost thou wish to enable UI Animations? 👀\n\nA restart of the session is required to weave this magic.\n\nOK = Restart and let them flourish\nCANCEL = Remain in the plain era",
            promptOff: "Dost thou wish to extinguish the Animations?\n\nA session restart is required to return to the default visage.\n\nOK = Restart and strip away the motion\nCANCEL = Nay, preserve the visual splendour"
        }
    };
    const t = strings[lang] || strings.en;

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    if (isAnimEnabled) {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes sb3dSlideInLeft {
                0% { transform: translateX(-150%) scale(0.9); opacity: 0; }
                70% { transform: translateX(5%) scale(1.02); opacity: 1; }
                100% { transform: translateX(0) scale(1); opacity: 1; }
            }
            @keyframes sb3dSlideInRight {
                0% { transform: translateX(150%) scale(0.9); opacity: 0; }
                70% { transform: translateX(-5%) scale(1.02); opacity: 1; }
                100% { transform: translateX(0) scale(1); opacity: 1; }
            }
            @keyframes sb3dSlideOutLeft {
                0%   { transform: translateX(0) scale(1); opacity: 1; }
                60%  { transform: translateX(10px) scale(1.02); opacity: 0.8; }
                100% { transform: translateX(-160%) scale(0.88); opacity: 0; }
            }
            @keyframes sb3dSlideOutRight {
                0%   { transform: translateX(0) scale(1); opacity: 1; }
                60%  { transform: translateX(-10px) scale(1.02); opacity: 0.8; }
                100% { transform: translateX(160%) scale(0.88); opacity: 0; }
            }
            @keyframes sb3dModalPop {
                0% { transform: scale(0.8) translateY(30px); opacity: 0; }
                100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            @keyframes sb3dPulse {
                0% { box-shadow: 0 0 0 0 rgba(74, 163, 223, 0.4); }
                70% { box-shadow: 0 0 0 8px rgba(74, 163, 223, 0); }
                100% { box-shadow: 0 0 0 0 rgba(74, 163, 223, 0); }
            }
            @keyframes sb3dFullscreenEnter {
                0% { filter: brightness(0.3) blur(4px); transform: scale(0.98); }
                100% { filter: brightness(1) blur(0); transform: scale(1); }
            }
            @keyframes sb3dFullscreenExit {
                0% { filter: brightness(1) blur(0); transform: scale(1); }
                100% { filter: brightness(0.5) blur(3px); transform: scale(0.98); }
            }
            @keyframes sb3dIntroPop {
                0% { transform: scale(0.7); opacity: 0; }
                70% { transform: scale(1.02); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes sb3dMinimizedPop {
                0% { transform: scale(0.5); opacity: 0; }
                70% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes sb3dCatSlideOutLeft {
                0%   { transform: translateX(0); opacity: 1; }
                100% { transform: translateX(-18px); opacity: 0; }
            }
            @keyframes sb3dCatSlideInRight {
                0%   { transform: translateX(18px); opacity: 0; }
                100% { transform: translateX(0); opacity: 1; }
            }
            @keyframes sb3dModalPopOut {
                0% { transform: scale(1) translateY(0); opacity: 1; }
                100% { transform: scale(0.7) translateY(20px); opacity: 0; }
            }

            .sb3d-cat-exit {
                animation: sb3dCatSlideOutLeft 0.15s ease-in forwards !important;
                pointer-events: none;
            }
            .sb3d-cat-enter {
                animation: sb3dCatSlideInRight 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
            }
            .ui-panel-base.minimized {
                animation: sb3dMinimizedPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
            }
            .sb3d-modal-closing {
                animation: sb3dModalPopOut 0.25s ease-in forwards !important;
                pointer-events: none;
            }
            .sb3d-intro-pop {
                animation: sb3dIntroPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
            }
            body.sb3d-fullscreen-enter {
                animation: sb3dFullscreenEnter 0.5s ease-out forwards !important;
            }
            body.sb3d-fullscreen-exit {
                animation: sb3dFullscreenExit 0.4s ease-in forwards !important;
            }

            #left-panel, #properties-panel {
                transition: none !important;
            }
            #objects-panel {
                transition: right 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            }
            #left-panel.sb3d-opening {
                animation: sb3dSlideInLeft 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
            }
            #objects-panel.sb3d-opening, #properties-panel.sb3d-opening {
                animation: sb3dSlideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
            }
            #left-panel.sb3d-closing {
                animation: sb3dSlideOutLeft 0.4s cubic-bezier(0.6, -0.28, 0.74, 0.05) forwards !important;
            }
            #objects-panel.sb3d-closing, #properties-panel.sb3d-closing {
                animation: sb3dSlideOutRight 0.4s cubic-bezier(0.6, -0.28, 0.74, 0.05) forwards !important;
            }

            button {
                transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.15s ease, background 0.2s ease !important;
                will-change: transform, box-shadow;
            }
            button:not(.btn-minimize):not(.settings-close-btn):hover {
                transform: translateY(-3px) scale(1.03);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
                z-index: 10;
            }
            button:not(.btn-minimize):not(.settings-close-btn):active {
                transform: translateY(3px) scale(0.94) !important;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6) !important;
                transition: transform 0.07s ease, box-shadow 0.07s ease !important;
            }
            button.active {
                animation: sb3dPulse 2s infinite;
            }

            #game-settings-modal,
            #restart-modal,
            #postfx-modal {
                animation: sb3dModalPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                will-change: transform, opacity;
                cursor: grab;
            }
            #game-settings-modal:active,
            #restart-modal:active,
            #postfx-modal:active {
                cursor: grabbing;
            }
            #game-settings-modal button,
            #restart-modal button,
            #postfx-modal button,
            #game-settings-modal .settings-close-btn,
            #postfx-modal .settings-close-btn,
            #game-settings-modal select,
            #restart-modal select,
            #postfx-modal select,
            #game-settings-modal input,
            #restart-modal input,
            #postfx-modal input {
                cursor: grab;
            }
            #game-settings-modal input[type=range]:active,
            #restart-modal input[type=range]:active,
            #postfx-modal input[type=range]:active {
                cursor: grabbing !important;
            }
            #game-settings-modal button:active,
            #restart-modal button:active,
            #postfx-modal button:active,
            #game-settings-modal .settings-close-btn:active,
            #postfx-modal .settings-close-btn:active,
            #game-settings-modal select:active,
            #restart-modal select:active,
            #postfx-modal select:active {
                cursor: grabbing;
            }

            .slider-group {
                transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease !important;
            }
            .slider-group:hover {
                border-color: #4aa3df;
                box-shadow: 0 4px 12px rgba(74, 163, 223, 0.15);
                transform: translateX(4px);
            }
            .slider-group.sb3d-stretch-snap {
                transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            }

            .shape-icon {
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            button:hover .shape-icon {
                transform: scale(1.2) rotate(10deg);
            }

            input[type=range] {
                transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            input[type=range].sb3d-at-min {
                transform: scaleX(1.04) translateX(-3px);
                transform-origin: left center;
            }
            input[type=range].sb3d-at-max {
                transform: scaleX(1.04) translateX(3px);
                transform-origin: right center;
            }
            input[type=range]:active {
                transform: scaleY(1.15);
            }
            input[type=range]::-webkit-slider-thumb {
                transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
            }
            input[type=range]:active::-webkit-slider-thumb {
                transform: scale(1.5);
            }
            input[type=range]:hover::-webkit-slider-thumb {
                transform: scale(1.3);
            }
        `;
        document.head.appendChild(style);

        onReady(() => {
            const modals = ['settings-modal-overlay', 'postfx-modal-overlay', 'restart-modal-overlay'];
            modals.forEach(id => {
                const el = document.getElementById(id);
                if (el) document.body.appendChild(el);
            });

            function patchPanelToggle(panelId, btnId, originalFn) {
                const panel = document.getElementById(panelId);
                const btn = document.getElementById(btnId);
                if (!panel || !btn) return;

                const minimizedText = btn.innerText;
                btn.dataset.minimizedText = minimizedText;

                window[originalFn] = function () {
                    const isMinimizing = !panel.classList.contains('minimized');

                    function syncFPSAfterToggle() {
                        const objPanel = document.getElementById('objects-panel');
                        const propPanel = document.getElementById('properties-panel');
                        const hud = document.getElementById('hud-container');
                        if (!hud) return;
                        const bothOpen = !objPanel.classList.contains('minimized') && !propPanel.classList.contains('minimized');
                        hud.style.transition = 'opacity 0.3s ease';
                        hud.style.opacity = bothOpen ? '0' : '1';
                        hud.style.pointerEvents = bothOpen ? 'none' : '';
                    }

                    if (isMinimizing) {
                        panel.classList.add('sb3d-closing');
                        panel.addEventListener('animationend', () => {
                            panel.classList.remove('sb3d-closing');
                            panel.classList.add('minimized');
                            btn.innerText = btn.dataset.minimizedText || minimizedText;
                            if (typeof syncPanelPositions === 'function') syncPanelPositions();
                            syncFPSAfterToggle();
                        }, { once: true });
                    } else {
                        panel.classList.remove('minimized');
                        btn.innerText = '-';
                        if (typeof syncPanelPositions === 'function') syncPanelPositions();
                        panel.classList.add('sb3d-opening');
                        panel.addEventListener('animationend', () => {
                            panel.classList.remove('sb3d-opening');
                            syncFPSAfterToggle();
                        }, { once: true });
                    }
                };
            }

            function patchModalClose(overlayId, closeTriggerFn) {
                const overlay = document.getElementById(overlayId);
                if (!overlay) return;
                const originalFn = window[closeTriggerFn];
                if (typeof originalFn !== 'function') return;

                window[closeTriggerFn] = function () {
                    const modal = overlay.querySelector('.ui-panel-base, #game-settings-modal, #restart-modal, #postfx-modal');
                    if (modal && overlay.style.display === 'flex') {
                        modal.classList.add('sb3d-modal-closing');
                        modal.addEventListener('animationend', () => {
                            modal.classList.remove('sb3d-modal-closing');
                            originalFn();
                        }, { once: true });
                    } else {
                        originalFn();
                    }
                };
            }

            function patchCategorySwitch(originalFnName, prefix) {
                const original = window[originalFnName];
                if (typeof original !== 'function') return;

                window[originalFnName] = function (cat) {
                    const allIds = Array.from(document.querySelectorAll('[id^="' + prefix + '"]'))
                        .map(el => el.id.replace(prefix, ''));
                    const currentVisible = allIds.find(c => {
                        const el = document.getElementById(prefix + c);
                        return el && el.style.display !== 'none';
                    });
                    const currentEl = currentVisible ? document.getElementById(prefix + currentVisible) : null;

                    if (currentEl && currentVisible !== cat) {
                        currentEl.classList.add('sb3d-cat-exit');
                        currentEl.addEventListener('animationend', () => {
                            currentEl.classList.remove('sb3d-cat-exit');
                            original(cat);
                            const nextEl = document.getElementById(prefix + cat);
                            if (nextEl) {
                                nextEl.classList.add('sb3d-cat-enter');
                                nextEl.addEventListener('animationend', () => {
                                    nextEl.classList.remove('sb3d-cat-enter');
                                }, { once: true });
                            }
                        }, { once: true });
                    } else {
                        original(cat);
                    }
                };
            }

            patchCategorySwitch('switchShapeCategory', 'shape-cat-');
            patchCategorySwitch('switchSettingsCategory', 'settings-cat-');

            patchModalClose('settings-modal-overlay', 'toggleGraphicsUI');
            patchModalClose('postfx-modal-overlay', 'togglePostFXModal');
            patchModalClose('restart-modal-overlay', 'toggleRestartModal');

            onReady(() => {
                function onFullscreenChange() {
                    const isFullscreen = !!document.fullscreenElement;
                    document.body.classList.add(isFullscreen ? 'sb3d-fullscreen-enter' : 'sb3d-fullscreen-exit');
                    setTimeout(() => {
                        document.body.classList.remove('sb3d-fullscreen-enter', 'sb3d-fullscreen-exit');
                    }, 600);
                }
                document.addEventListener('fullscreenchange', onFullscreenChange);
                document.addEventListener('webkitfullscreenchange', onFullscreenChange);
                document.addEventListener('mozfullscreenchange', onFullscreenChange);
                document.addEventListener('MSFullscreenChange', onFullscreenChange);
            });

            window.sb3dIntroReveal = function () {
                const leftPanel = document.getElementById('left-panel');
                const objectsPanel = document.getElementById('objects-panel');
                const propsPanel = document.getElementById('properties-panel');
                const leftBtn = document.getElementById('btn-min-left');
                const objectsBtn = document.getElementById('btn-min-objects');
                const propsBtn = document.getElementById('btn-min-props');

                if (!leftPanel || !objectsPanel || !propsPanel) return;

                leftPanel.classList.remove('minimized');
                objectsPanel.classList.remove('minimized');
                propsPanel.classList.remove('minimized');
                if (leftBtn) leftBtn.innerText = '-';
                if (objectsBtn) objectsBtn.innerText = '-';
                if (propsBtn) propsBtn.innerText = '-';

                leftPanel.classList.add('sb3d-intro-pop');
                objectsPanel.classList.add('sb3d-intro-pop');
                propsPanel.classList.add('sb3d-intro-pop');

                setTimeout(() => {
                    if (typeof toggleLeftUI === 'function') {
                        toggleLeftUI();
                    } else {
                        leftPanel.classList.add('minimized');
                        if (leftBtn) leftBtn.innerText = '+';
                    }

                    setTimeout(() => {
                        if (typeof toggleObjectsUI === 'function') {
                            toggleObjectsUI();
                        } else {
                            objectsPanel.classList.add('minimized');
                            if (objectsBtn) objectsBtn.innerText = '+';
                        }
                    }, 100);

                    setTimeout(() => {
                        if (typeof togglePropsUI === 'function') {
                            togglePropsUI();
                        } else {
                            propsPanel.classList.add('minimized');
                            if (propsBtn) propsBtn.innerText = '+';
                        }
                    }, 200);

                    setTimeout(() => {
                        leftPanel.classList.remove('sb3d-intro-pop');
                        objectsPanel.classList.remove('sb3d-intro-pop');
                        propsPanel.classList.remove('sb3d-intro-pop');
                    }, 700);
                }, 1500);
            };

            patchPanelToggle('left-panel', 'btn-min-left', 'toggleLeftUI');
            patchPanelToggle('objects-panel', 'btn-min-objects', 'toggleObjectsUI');
            patchPanelToggle('properties-panel', 'btn-min-props', 'togglePropsUI');

            document.querySelectorAll('input[type=range]').forEach(slider => {
                const group = slider.closest('.slider-group');

                function getStretchOffset(slider) {
                    const val = parseFloat(slider.value);
                    const min = parseFloat(slider.min);
                    const max = parseFloat(slider.max);
                    const ratio = (val - min) / (max - min);
                    const deadzone = 0.08;
                    if (ratio <= deadzone) return -6 * (1 - ratio / deadzone);
                    if (ratio >= 1 - deadzone) return 6 * ((ratio - (1 - deadzone)) / deadzone);
                    return 0;
                }

                function applyStretch() {
                    if (!group) return;
                    const offset = getStretchOffset(slider);
                    group.style.transition = 'none';
                    group.style.transform = offset !== 0
                        ? `translateX(${offset}px)`
                        : 'translateX(4px)';
                }

                function releaseSnap() {
                    if (!group) return;
                    group.classList.add('sb3d-stretch-snap');
                    group.style.transform = '';
                    group.addEventListener('transitionend', () => {
                        group.classList.remove('sb3d-stretch-snap');
                    }, { once: true });
                    slider.classList.remove('sb3d-at-min', 'sb3d-at-max');
                }

                function updateEdgeClass() {
                    const val = parseFloat(slider.value);
                    const min = parseFloat(slider.min);
                    const max = parseFloat(slider.max);
                    slider.classList.remove('sb3d-at-min', 'sb3d-at-max');
                    if (val <= min) slider.classList.add('sb3d-at-min');
                    else if (val >= max) slider.classList.add('sb3d-at-max');
                }

                slider.addEventListener('input', () => {
                    applyStretch();
                    updateEdgeClass();
                });
                slider.addEventListener('pointerup', releaseSnap);
                slider.addEventListener('pointercancel', releaseSnap);
            });
        });
    }

    onReady(() => {
        function injectAnimThemingEntry() {
            const cat = document.getElementById('settings-cat-theming');
            if (!cat || document.getElementById('btn-uianim-toggle')) return;

            const isAnimOn = localStorage.getItem('sb3d_ui_anim') === 'true';
            const btnGroup = document.createElement('div');
            btnGroup.className = 'control-group';
            btnGroup.style.marginTop = '15px';

            const btn = document.createElement('button');
            btn.id = 'btn-uianim-toggle';
            btn.style.cssText = `border-left: 4px solid ${isAnimOn ? '#4aa3df' : '#555'}; padding: 12px;`;

            const icon = document.createElement('span');
            icon.className = 'shape-icon';
            icon.style.cssText = isAnimOn
                ? 'background:#4aa3df;border-radius:2px;box-shadow:0 0 5px #4aa3df;'
                : 'background:#555;border-radius:2px;';

            btn.appendChild(icon);
            btn.appendChild(document.createTextNode(' ' + (isAnimOn ? t.on : t.off)));
            if (isAnimOn) btn.classList.add('active');

            btn.addEventListener('click', () => {
                const next = !(localStorage.getItem('sb3d_ui_anim') === 'true');
                if (window.confirm(next ? t.promptOn : t.promptOff)) {
                    localStorage.setItem('sb3d_ui_anim', next.toString());
                    window.location.reload();
                }
            });

            btnGroup.appendChild(btn);
            cat.appendChild(btnGroup);
        }

        setTimeout(injectAnimThemingEntry, 900);
        setTimeout(() => {
            if (!document.getElementById('btn-uianim-toggle')) injectAnimThemingEntry();
        }, 2600);
    });
})();
