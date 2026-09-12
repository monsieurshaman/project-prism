// Sand Box 3D Ammo.js Module

(function () {
    const PHYS_KEY = 'sb3d_physics_engine';

    if (!localStorage.getItem(PHYS_KEY)) {
        localStorage.setItem(PHYS_KEY, 'cannon');
    }

    const currentEngine = localStorage.getItem(PHYS_KEY) || 'cannon';
    const lang = localStorage.getItem('sb3d_lang') || 'en';

    const strings = {
        en: {
            label: "Physics Engine",
            cannon: "Cannon.js (Default, Fast)",
            ammo: "Ammo.js (Advanced, Heavy)",
            prompt: "Switch Physics Engine?\n\nA session restart is required to load the new physics backend.\n\nClick OK to restart and apply."
        },
        genz: {
            label: "Physics Engine fr",
            cannon: "Cannon.js (Goat, Fast af 🐐)",
            ammo: "Ammo.js (Advanced, kinda heavy ngl 💪)",
            prompt: "Switch physics engine bestie? 👀\n\nGotta restart the whole session to apply this massive W.\n\nOK = restart and slay\nCANCEL = stay on the old engine"
        },
        shakespeare: {
            label: "Engine of Physical Laws",
            cannon: "Cannon.js (Noble & Swift)",
            ammo: "Ammo.js (Advanced & Ponderous)",
            prompt: "Dost thou wish to alter the Laws of Physics? ⚙️\n\nA full restart of the session is required to weave this fundamental change.\n\nOK = Restart and reshape the world\nCANCEL = Nay, leave reality as it is"
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

    onReady(() => {
        function injectPhysicsDropdown() {
            const sysCat = document.getElementById('settings-cat-system');
            if (!sysCat) return;

            const group = document.createElement('div');
            group.className = 'control-group';
            group.style.marginBottom = '15px';
            group.style.marginTop = '15px';
            group.style.padding = '10px';
            group.style.background = 'rgba(0, 0, 0, 0.2)';
            group.style.borderRadius = '6px';
            group.style.borderLeft = '4px solid #9b59b6';

            const label = document.createElement('span');
            label.style.fontSize = '12px';
            label.style.color = '#ddd';
            label.style.marginBottom = '8px';
            label.style.display = 'block';
            label.innerText = t.label;

            const select = document.createElement('select');
            select.id = 'physics-engine-select';
            select.style.width = '100%';
            select.style.background = '#252525';
            select.style.color = '#eee';
            select.style.border = '1px solid #555';
            select.style.padding = '6px 8px';
            select.style.borderRadius = '4px';
            select.style.fontSize = '12px';
            select.style.cursor = 'pointer';

            const optCannon = document.createElement('option');
            optCannon.value = 'cannon';
            optCannon.innerText = t.cannon;

            const optAmmo = document.createElement('option');
            optAmmo.value = 'ammo';
            optAmmo.innerText = t.ammo;

            select.appendChild(optCannon);
            select.appendChild(optAmmo);
            select.value = currentEngine;

            select.addEventListener('change', (e) => {
                const newVal = e.target.value;
                if (window.confirm(t.prompt)) {
                    localStorage.setItem(PHYS_KEY, newVal);
                    window.location.reload();
                } else {
                    e.target.value = currentEngine;
                }
            });

            group.appendChild(label);
            group.appendChild(select);

            sysCat.insertBefore(group, sysCat.firstChild);
        }

        setTimeout(injectPhysicsDropdown, 500);

        function injectAmmoPhysics() {
            if (typeof workshop === 'undefined' || !workshop.shaman || !workshop.shaman.sandbox3d || !workshop.shaman.sandbox3d.scene) return;

            const scene = workshop.shaman.sandbox3d.scene;

            if (scene.isPhysicsEnabled()) return;

            const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
            const physicsPlugin = new BABYLON.AmmoJSPlugin();
            scene.enablePhysics(gravityVector, physicsPlugin);

            console.log("[SB3D Ammo.js] Ammo.js physics injected into scene.");
        }

        const checkSceneInterval = setInterval(() => {
            if (typeof workshop !== 'undefined' && workshop.shaman && workshop.shaman.sandbox3d && workshop.shaman.sandbox3d.scene) {
                clearInterval(checkSceneInterval);
                if (currentEngine === 'ammo') {
                    injectAmmoPhysics();
                }
            }
        }, 500);
    });
})();