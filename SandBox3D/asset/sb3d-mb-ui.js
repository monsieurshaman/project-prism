let selectedShape = 'box'; 
    let freezeAction = 'freeze'; 
    let isBuildMode = false; 
    let currentSize = 1.0; 
let currentMass = 1.5;
let spawnedMeshes = [];    
let sceneRef = null;
let viewTargetMesh = null; 
let targetFPS = 60;
let lastFrameTime = performance.now();
let isHUDVisible = false;
let isFrustumCullingEnabled = true;
let isPhysicsSleepingEnabled = false;
let performanceSafeguardActive = true;
let isSafeguardInCooldown = false;
let lowFpsCounter = 0;
let sb3dPostPipeline = null;
let isDayNightEnabled = true;
let isSyncingDeviceTime = false;
let syncDeviceTimeInterval = null;
let dayNightLightRef = null;
let dayNightDirRef = null;
let dayNightSkyRef = null;
let isFlashlightEnabled = false;
let isFlashlightOn = false;
let flashlightRef = null;
let explosionVolume = 1.0;
let isFlashbangVideoEnabled = true;
let isScreenShakeEnabled = true;
let isHapticsEnabled = true;
let isSunEnabled = localStorage.getItem('sb3d_sun') !== 'false';
let sunMeshRef = null;
let lastNightState = false;
let midnightGlitchTriggered = false;
let currentReflectivity = 1.0;
let nightPulseLight = null;
let nightPulseInterval = null;
let pulseAnimObserver = null;
let heldMesh = null;
let panelEditingHeld = false;
let buildEditMesh = null;
const BM_ROT_STEP = Math.PI / 12;
let propsPressTimer = null;
let propsPressActive = false;
let propsLongHandled = false;
let savedSpawnColor = '#3498db';
let savedPanelTitle = '';
let holdDistance = 7.0;
let isRotationMode = false;
let isFreeFlyMode = false;
let playerGrounded = false;
let playerVelocityY = 0;
let playerHeight = 3.5;
let playerRadius = 0.8;
let playerMass = 3;
let jumpRequested = false;
let jumpCooldownFrames = 0;
let gravgunEulerState = { x: 0, y: 0, z: 0 };
let isSpawnParticlesEnabled = localStorage.getItem('sb3d_spawn_particles') !== 'false';
let isBgPillarsEnabled = localStorage.getItem('sb3d_bgPillars') !== '0';
let isBgDecorsEnabled = localStorage.getItem('sb3d_bgDecors') !== '0';

const moveState = { up: false, down: false, left: false, right: false };

function fmt(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ''));
}

const customModelTemplates = [null, null, null];

function getNextCustomSlot() {
    const idx = customModelTemplates.findIndex(s => s === null);
    return idx === -1 ? 2 : idx;
}

function refreshCustomButtons() {
    if (currentHotbarCategory === 'custom') {
renderHotbar();
    }
}

const SB3D_VERSION = (() => {
    const el = document.querySelector('.loader-subtext-version');
    if (!el) return 'Unknown';
    const match = (el.innerText || el.textContent).match(/v[\d.]+/i);
    return match ? match[0] : 'Unknown';
})();

const SB3D_EDITION = (() => {
    const el = document.querySelector('.loader-text');
    if (!el) return 'Unknown';
    return (el.innerText || el.textContent).trim();
})();

setTimeout(() => {
    const btn = document.getElementById('skip-loading-btn');
    if (btn) btn.style.display = 'inline-block';
}, 7000);

function skipLoading() {
    const ls = document.getElementById('loading-screen');
    ls.style.transition = 'opacity 0.5s ease';
    ls.style.opacity = '0';
    setTimeout(() => ls.style.display = 'none', 500);
}

function enterGame() {
    const de = document.documentElement;
    if (de.requestFullscreen) de.requestFullscreen();
    else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen();
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }
}

function triggerUpload() {
    const engine = workshop.shaman.sandbox3d.engine;
    if (engine && (engine.isWebGPU || engine instanceof BABYLON.WebGPUEngine)) {
        alert("Custom 3D model uploads are disabled in WebGPU mode to prevent Context Lost crashes.\n\nPlease switch to WebGL in Game Settings to use this feature.");
        return;
    }
    document.getElementById('file-input').click();
}

function triggerScreenShake(intensity = 1.0) {
    if (!isScreenShakeEnabled) return;
    const cam = workshop.shaman.sandbox3d.cameraFree;
    if (!cam) return;
    const origin = cam.position.clone();
    const target = cam.target.clone();
    let elapsed = 0;
    const duration = 400;
    const mag = 0.6 * intensity;
    const obs = workshop.shaman.sandbox3d.scene.onBeforeRenderObservable.add(() => {
        elapsed += workshop.shaman.sandbox3d.scene.getEngine().getDeltaTime();
        const decay = 1 - elapsed / duration;
        if (decay <= 0) {
            cam.position.copyFrom(origin);
            cam.target.copyFrom(target);
            workshop.shaman.sandbox3d.scene.onBeforeRenderObservable.remove(obs);
            return;
        }
        cam.position.x = origin.x + (Math.random() - 0.5) * mag * decay;
        cam.position.y = origin.y + (Math.random() - 0.5) * mag * decay;
        cam.position.z = origin.z + (Math.random() - 0.5) * mag * decay;
    });
}

function toggleScreenShake() {
    isScreenShakeEnabled = !isScreenShakeEnabled;
    const btn = document.getElementById('btn-screenshake');
    if (!btn) return;
    btn.innerHTML = isScreenShakeEnabled
        ? `<span class="shape-icon" style="background:#e74c3c;border-radius:2px;box-shadow:0 0 5px #e74c3c;"></span> Screen Shake is ON`
        : `<span class="shape-icon" style="background:#555;border-radius:2px;"></span> Screen Shake is OFF`;
}

function spawnParticleBurst(position, scene) {
    if (!isSpawnParticlesEnabled || !scene) return;

    const ps = new BABYLON.ParticleSystem("spawnBurst_" + Date.now(), 40, scene);
    ps.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
    ps.emitter = position.clone();
    ps.minEmitBox = new BABYLON.Vector3(-0.1, 0, -0.1);
    ps.maxEmitBox = new BABYLON.Vector3(0.1, 0, 0.1);
    ps.color1 = new BABYLON.Color4(1, 0.9, 0.4, 1.0);
    ps.color2 = new BABYLON.Color4(0.8, 0.3, 1.0, 1.0);
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize = 0.08;
    ps.maxSize = 0.25;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.55;
    ps.emitRate = 300;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    ps.gravity = new BABYLON.Vector3(0, -3, 0);
    ps.direction1 = new BABYLON.Vector3(-1, 3, -1);
    ps.direction2 = new BABYLON.Vector3(1, 5, 1);
    ps.minAngularSpeed = 0;
    ps.maxAngularSpeed = Math.PI;
    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;
    ps.updateSpeed = 0.02;
    ps.targetStopDuration = 0.12;
    ps.disposeOnStop = true;
    ps.start();
}

function toggleSpawnParticles() {
    isSpawnParticlesEnabled = !isSpawnParticlesEnabled;
    localStorage.setItem('sb3d_spawn_particles', isSpawnParticlesEnabled ? 'true' : 'false');
    updateSpawnParticlesButton();
}

function updateSpawnParticlesButton() {
    const btn = document.getElementById('btn-spawn-particles');
    if (!btn) return;
    if (isSpawnParticlesEnabled) {
        btn.innerHTML = `<span class="shape-icon" style="background:#a855f7;border-radius:50%;box-shadow:0 0 5px #a855f7;"></span> Spawn FX is ON`;
        btn.style.borderLeftColor = '#a855f7';
        btn.classList.add('active');
    } else {
        btn.innerHTML = `<span class="shape-icon" style="background:#555;border-radius:50%;"></span> Spawn FX is OFF`;
        btn.style.borderLeftColor = '#555';
        btn.classList.remove('active');
    }
}

function triggerHaptic(intensity = 1.0) {
    if (!isHapticsEnabled || !navigator.vibrate) return;
    const dur = Math.round(80 + intensity * 120);
    navigator.vibrate([dur, 30, Math.round(dur * 0.4)]);
}

function toggleHaptics() {
    isHapticsEnabled = !isHapticsEnabled;
    const btn = document.getElementById('btn-haptics');
    if (!btn) return;
    btn.innerHTML = isHapticsEnabled
        ? `<span class="shape-icon" style="background:#2ecc71;border-radius:50%;box-shadow:0 0 5px #2ecc71;"></span> Haptics is ON`
        : `<span class="shape-icon" style="background:#555;border-radius:50%;"></span> Haptics is OFF`;
}

function handleFileUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const blobUrl = URL.createObjectURL(file);
        const ext = file.name.split('.').pop().toLowerCase();
        
        if(sceneRef) {
            const slotIdx = getNextCustomSlot();
            const displayName = file.name.length > 15 ? file.name.substring(0, 12) + "..." : file.name;

            BABYLON.SceneLoader.ImportMesh("", "", blobUrl, sceneRef,
                function (meshes, particleSystems, skeletons) {
                    if (meshes.length === 0) return;

                    let min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                    let max = new BABYLON.Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

                    meshes.forEach(m => {
                        m.setParent(null); 
                        const b = m.getHierarchyBoundingVectors();
                        min = BABYLON.Vector3.Minimize(min, b.min);
                        max = BABYLON.Vector3.Maximize(max, b.max);
                    });

                    const width = max.x - min.x;
                    const height = max.y - min.y;
                    const depth = max.z - min.z;
                    const center = min.add(max).scale(0.5);

                    const hitBox = BABYLON.MeshBuilder.CreateBox("customHitbox", {width: width, height: height, depth: depth}, sceneRef);
                    hitBox.isVisible = false; 
                    
                    meshes.forEach(m => {
                        m.parent = hitBox;
                        m.position = m.position.subtract(center);
                    });

                    hitBox.setEnabled(false);
                    
                    if (customModelTemplates[slotIdx] && customModelTemplates[slotIdx].mesh) {
                        customModelTemplates[slotIdx].mesh.dispose();
                    }
                    customModelTemplates[slotIdx] = {
                        mesh: hitBox,
                        dimensions: { width, height, depth }
                    };
                    const nameEl = document.getElementById('custom-name-' + slotIdx);
                    if (nameEl) nameEl.innerText = displayName;
                    refreshCustomButtons();
                    selectShape('custom_' + slotIdx);
                    
                    input.value = "";
                }, 
                null, 
                function (scene, message, exception) {
                    console.error("Error loading file:", message);
                    alert("Failed to load model.");
                },
                "." + ext
            );
        }
    }
}

function toggleWorldSettingsUI() {
    const overlay = document.getElementById('world-settings-modal-overlay');
    if (!overlay) return;
    const isHidden = overlay.style.display === 'none' || overlay.style.display === '';
    overlay.style.display = isHidden ? 'flex' : 'none';
}

function toggleHelpUI() {
    const overlay = document.getElementById('help-modal-overlay');
    if (!overlay) return;
    const isHidden = overlay.style.display === 'none' || overlay.style.display === '';
    overlay.style.display = isHidden ? 'flex' : 'none';
}

function triggerWorldSaveUpload() {
    if (!sceneRef) {
        alert("Scene is not ready yet. Please wait a moment and try again.");
        return;
    }
    const inp = document.getElementById('world-save-input');
    if (inp) inp.click();
}

function detectWorldTypeFromMesh(mesh) {
    if (!mesh || mesh.isDisposed()) return null;

    const name = (mesh.name || '').toLowerCase();
    if (name.includes('custominstance') || name.includes('customhitbox')) return null;
    if (name === 'projectile' || name === 'frag' || name === 'explosion') return null;
    if (['bomb', 'frag_bomb', 'fire_bomb', 'ice_bomb', 'flashbang'].includes(name)) return null;

    let base = name;
    if (base.startsWith('s_')) base = base.substring(2);
    if (base.startsWith('ws_')) base = base.substring(3);

    const mat = mesh.material;
    const isPbr = mat instanceof BABYLON.PBRMaterial;
    const isMirrorMat = isPbr && mat.metallic >= 0.95 &&
    (mat.reflectionTexture || (workshop.shaman.sandbox3d.MirrorSystem?.probe));
    const isGlassMat = isPbr && mat.alpha < 1.0 && mat.subSurface && mat.subSurface.isRefractionEnabled;

    const isIce = (mesh.metadata && mesh.metadata.isIceMat) || base === 'ice' || base === 'ice_mat';
    const isRubber = (mesh.metadata && mesh.metadata.isRubberMat) || base === 'rubber' || base === 'rubber_mat';

    let shape = base;
    if (shape.startsWith('glass_')) shape = shape.replace('glass_', '');
    if (shape.startsWith('mirror_')) shape = shape.replace('mirror_', '');
    if (shape === 'cyl') shape = 'cylinder';
    if (shape === 'tri') shape = 'triangle';

    if (isIce) return 'ice_mat';
    if (isRubber) return 'rubber_mat';

    if (base.startsWith('glass_') || isGlassMat) {
        if (shape === 'box') return 'glass_box';
        if (shape === 'sphere') return 'glass_sphere';
        if (shape === 'cylinder') return 'glass_cylinder';
        if (shape === 'triangle') return 'glass_triangle';
    }

    if (base.startsWith('mirror_') || isMirrorMat) {
        if (shape === 'box') return 'mirror_box';
        if (shape === 'sphere') return 'mirror_sphere';
        if (shape === 'cylinder') return 'mirror_cylinder';
        if (shape === 'triangle') return 'mirror_triangle';
    }

    if (shape === 'box') return 'cube';
    if (shape === 'sphere') return 'sphere';
    if (shape === 'cylinder') return 'cylinder';
    if (shape === 'triangle') return 'triangle';
    if (shape === 'pyramid') return 'pyramid';
    if (shape === 'torus') return 'torus';

    return null;
}

function extractMeshColorHex(mesh) {
    if (!mesh || !mesh.material) return '#3498db';
    let c = null;
    if (mesh.material instanceof BABYLON.PBRMaterial) c = mesh.material.albedoColor;
    else if (mesh.material.diffuseColor) c = mesh.material.diffuseColor;
    if (!c) return '#3498db';
    const r = Math.max(0, Math.min(255, Math.round(c.r * 255)));
    const g = Math.max(0, Math.min(255, Math.round(c.g * 255)));
    const b = Math.max(0, Math.min(255, Math.round(c.b * 255)));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function extractMeshSize(mesh) {
    try {
        const bb = mesh.getBoundingInfo().boundingBox.extendSize;
        const sx = Math.abs(mesh.scaling.x) || 1;
        const sy = Math.abs(mesh.scaling.y) || 1;
        const sz = Math.abs(mesh.scaling.z) || 1;
        const fullX = bb.x * 2 * sx;
        const fullY = bb.y * 2 * sy;
        const fullZ = bb.z * 2 * sz;
        return Math.max(fullX, fullY, fullZ);
    } catch (e) {
        return currentSize || 1.0;
    }
}

function extractMeshMass(mesh, objectType) {
    let mass = 1.5;
    if (mesh.metadata && mesh.metadata.originalMass !== undefined) {
        mass = mesh.metadata.originalMass;
    } else if (mesh.physicsImpostor) {
        mass = mesh.physicsImpostor.mass;
    }
    if (objectType === 'rubber_mat') mass = mass / 0.4;
    return mass;
}

function extractMeshRotation(mesh) {
    let euler;
    if (mesh.rotationQuaternion) {
        euler = mesh.rotationQuaternion.toEulerAngles();
    } else {
        euler = mesh.rotation;
    }
    const xDeg = BABYLON.Tools.ToDegrees(euler.x);
    const yDeg = BABYLON.Tools.ToDegrees(euler.y);
    const zDeg = BABYLON.Tools.ToDegrees(euler.z);
    return `${xDeg.toFixed(4)}, ${yDeg.toFixed(4)}, ${zDeg.toFixed(4)}`;
}

function parseWorldRotation(rot) {
    if (!rot) return null;
    let parts = null;
    if (Array.isArray(rot) && rot.length >= 3) {
        parts = [parseFloat(rot[0]), parseFloat(rot[1]), parseFloat(rot[2])];
    } else if (typeof rot === 'string') {
        parts = rot.split(',').map(s => parseFloat(s.trim()));
    } else if (typeof rot === 'object') {
        parts = [parseFloat(rot.x), parseFloat(rot.y), parseFloat(rot.z)];
    }
    if (!parts || parts.length < 3 || !parts.every(n => !isNaN(n))) return null;
    return { x: parts[0], y: parts[1], z: parts[2] };
}

function saveCurrentWorld() {
    if (!sceneRef) {
        alert("Scene is not ready yet. Please wait a moment and try again.");
        return;
    }

    const status = document.getElementById('world-save-status');
    const savedObjects = [];
    let skipped = 0;
    let banned = 0;

    spawnedMeshes.forEach(mesh => {
        if (!mesh || mesh.isDisposed()) return;

        const name = (mesh.name || '').toLowerCase();
        const isBannedName = ['bomb', 'frag_bomb', 'fire_bomb', 'ice_bomb', 'flashbang']
            .some(b => name === b || name.startsWith(b + '_'));
        const isCustom = name.includes('custominstance') || name.includes('customhitbox');

        if (isBannedName) { banned++; skipped++; return; }
        if (isCustom) { banned++; skipped++; return; }

        const objectType = detectWorldTypeFromMesh(mesh);
        if (!objectType) { skipped++; return; }

        let size = extractMeshSize(mesh);
        let mass = extractMeshMass(mesh, objectType);

        if (!isFinite(size) || size <= 0) size = 1.0;
        if (!isFinite(mass) || mass < 0) mass = 0;

        savedObjects.push({
            object: objectType,
            location: `${mesh.position.x.toFixed(4)}, ${mesh.position.y.toFixed(4)}, ${mesh.position.z.toFixed(4)}`,
            rotation: extractMeshRotation(mesh),
            color: extractMeshColorHex(mesh),
            size: parseFloat(size.toFixed(4)),
            mass: parseFloat(mass.toFixed(4))
        });
    });

    if (savedObjects.length === 0) {
        alert(
            "Nothing to save.\n\n" +
            "Only build-mode blocks and physics objects can be saved.\nExplosives, custom 3D models, and fragments are excluded."
        );
        if (status) status.innerText = "Nothing to save.";
        return;
    }

    const worldSave = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        edition: SB3D_EDITION,
        sb3dVersion: SB3D_VERSION,
        objectCount: savedObjects.length,
        objects: savedObjects
    };

    const json = JSON.stringify(worldSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `sb3d_worldsave_${dateTag}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const skippedNote = skipped > 0 ? fmt(" Skipped {skipped} ({banned} banned).", { skipped: skipped, banned: banned }) : '';
    const report = fmt("Saved {count} object(s).", { count: savedObjects.length }) + skippedNote;
    if (status) status.innerText = report;
    console.log(`[WorldSave] ${report}`);

    const btn = document.getElementById('btn-world-save');
    if (btn) {
        btn.classList.add('active');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<span class="shape-icon" style="background:#16a085; border-radius:2px;"></span> ${fmt("Saved {count} object(s)!", { count: savedObjects.length })}`;
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('active');
        }, 2000);
    }
}

const WORLD_COLOR_NAMES = {
    red:     '#e74c3c', blue:   '#3498db', green:  '#2ecc71',
    yellow:  '#f1c40f', orange: '#e67e22', purple: '#9b59b6',
    pink:    '#e91e63', cyan:   '#00bcd4', white:  '#ffffff',
    black:   '#000000', gray:   '#808080', grey:   '#808080',
    brown:   '#8b4513', lime:   '#00ff00', magenta:'#ff00ff',
    navy:    '#000080', teal:   '#008080', silver: '#c0c0c0',
    gold:    '#ffd700', violet: '#8a2be2', indigo: '#4b0082',
    turquoise:'#40e0d0', maroon:'#800000', olive:  '#808000',
};

const WORLD_SAVE_BANNED = ['bomb', 'frag_bomb', 'fire_bomb', 'ice_bomb', 'flashbang'];

function resolveWorldColor(c) {
    if (!c || typeof c !== 'string') return '#3498db';
    const k = c.trim().toLowerCase();
    if (WORLD_COLOR_NAMES[k]) return WORLD_COLOR_NAMES[k];
    if (k.startsWith('#')) {
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(k)) return k;
    }
    return '#3498db';
}

function parseWorldLocation(loc) {
    if (!loc) return null;
    if (Array.isArray(loc) && loc.length >= 3) {
        const x = parseFloat(loc[0]), y = parseFloat(loc[1]), z = parseFloat(loc[2]);
        if ([x, y, z].every(n => !isNaN(n))) return { x, y, z };
        return null;
    }
    if (typeof loc === 'string') {
        const parts = loc.split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
            return { x: parts[0], y: parts[1], z: parts[2] };
        }
        return null;
    }
    if (typeof loc === 'object') {
        const x = parseFloat(loc.x), y = parseFloat(loc.y), z = parseFloat(loc.z);
        if ([x, y, z].every(n => !isNaN(n))) return { x, y, z };
        return null;
    }
    return null;
}

function normalizeWorldType(raw) {
    let t = String(raw || '').trim().toLowerCase();
    const aliases = {
        'cube': 'box', 'box': 'box',
        'ball': 'sphere', 'sphere': 'sphere',
        'cyl': 'cylinder', 'cylinder': 'cylinder',
        'tri': 'triangle', 'triangle': 'triangle',
        'glass_cube': 'glass_box', 'glass_box': 'glass_box',
        'glass_ball': 'glass_sphere', 'glass_sphere': 'glass_sphere',
        'glass_cyl': 'glass_cylinder', 'glass_cylinder': 'glass_cylinder',
        'glass_tri': 'glass_triangle', 'glass_triangle': 'glass_triangle',
        'mirror_cube': 'mirror_box', 'mirror_box': 'mirror_box',
        'mirror_ball': 'mirror_sphere', 'mirror_sphere': 'mirror_sphere',
        'mirror_cyl': 'mirror_cylinder', 'mirror_cylinder': 'mirror_cylinder',
        'mirror_tri': 'mirror_triangle', 'mirror_triangle': 'mirror_triangle',
        'pyramid': 'pyramid',
        'torus': 'torus', 'donut': 'torus',
        'ice': 'ice_mat', 'ice_mat': 'ice_mat',
        'rubber': 'rubber_mat', 'rubber_mat': 'rubber_mat',
    };
    return aliases[t] || t;
}

    function handleWorldSaveUpload(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const status = document.getElementById('world-save-status');

        if (status) status.innerText = fmt('Reading "{file}"...', { file: file.name });

    const reader = new FileReader();
    reader.onload = (e) => {
        let data;
        try {
            data = JSON.parse(e.target.result);
        } catch (err) {
            console.error('[WorldSave] JSON parse error:', err);
            alert("Failed to parse world save JSON:" + '\n\n' + err.message);
            if (status) status.innerText = "Parse error.";
            input.value = '';
            return;
        }

        const objects = Array.isArray(data) ? data : (data && Array.isArray(data.objects) ? data.objects : null);
        if (!objects) {
            alert("Invalid world save format.\n\n" + 'Expected a top-level "objects" array (or a raw array of objects).');
            if (status) status.innerText = "Invalid format.";
            input.value = '';
            return;
        }

        const confirmMsg =
            `World Save Detected\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `File   : ${file.name}\n` +
            `Objects: ${objects.length}\n\n` +
            `Proceed to load this world into the current scene?`;

        if (!confirm(confirmMsg)) {
            if (status) status.innerText = "Cancelled.";
            input.value = '';
            return;
        }

        let placed = 0;
        let skipped = 0;
        let banned = 0;

        objects.forEach(o => {
            const rawType = o && (o.object || o.type);
            const normType = normalizeWorldType(rawType);

            if (WORLD_SAVE_BANNED.includes(normType) || normType.startsWith('custom_')) {
                banned++;
                skipped++;
                return;
            }

            const mesh = spawnWorldSaveObject(o, sceneRef);
            if (mesh) placed++;
            else skipped++;
        });

        const report =
            fmt("Loaded {count} object(s).", { count: placed }) +
            (skipped > 0 ? fmt(" Skipped {skipped} ({banned} banned/unsupported).", { skipped: skipped, banned: banned }) : '');

        if (status) status.innerText = report;
        console.log(`[WorldSave] ${report}`);
        input.value = '';
    };

    reader.onerror = () => {
        alert("Failed to read the file.");
        if (status) status.innerText = "Read error.";
        input.value = '';
    };

    reader.readAsText(file);
}

function spawnWorldSaveObject(data, scene) {
    if (!scene || !data || typeof data !== 'object') return null;

    const type = normalizeWorldType(data.object || data.type);
    if (!type) return null;
    if (WORLD_SAVE_BANNED.includes(type)) return null;
    if (type.startsWith('custom_')) return null;

    const validBase = ['box', 'sphere', 'cylinder', 'triangle', 'pyramid', 'torus', 'ice_mat', 'rubber_mat'];
    const isGlass = type.startsWith('glass_');
    const isMirror = type.startsWith('mirror_');
    let baseType = type;
    if (isGlass) baseType = type.replace('glass_', '');
    if (isMirror) baseType = type.replace('mirror_', '');
    if (!validBase.includes(baseType)) return null;

    const pos = parseWorldLocation(data.location || data.position || data.pos);
    if (!pos) return null;

    const size = Math.max(0.01, parseFloat(data.size) || 1.0);
    const mass = parseFloat(data.mass);
    const finalMass = isNaN(mass) ? 1.5 : mass;

    const colorHex = resolveWorldColor(data.color);
    const baseColor = BABYLON.Color3.FromHexString(colorHex);

    let mesh;
    let mat;

    if (isGlass) {
        mat = new BABYLON.PBRMaterial("wsGlassMat" + Date.now() + Math.random(), scene);
        mat.metallic = 0.0;
        mat.roughness = 0.05;
        mat.alpha = 0.45;
        mat.subSurface.isRefractionEnabled = true;
        mat.subSurface.indexOfRefraction = 1.5;
        mat.albedoColor = baseColor;
    } else if (isMirror) {
        mat = new BABYLON.PBRMaterial("wsMirrorMat" + Date.now() + Math.random(), scene);
        mat.metallic = 1.0;
        mat.roughness = 0.0;
        mat.albedoColor = baseColor;
        if (workshop.shaman.sandbox3d.MirrorSystem.probe) {
            mat.reflectionTexture = workshop.shaman.sandbox3d.MirrorSystem.probe.cubeTexture;
        }
    } else {
        mat = new BABYLON.StandardMaterial("wsMat" + Date.now() + Math.random(), scene);
        mat.diffuseColor = baseColor;
    }

    if (baseType === 'box') {
        mesh = BABYLON.MeshBuilder.CreateBox(isGlass ? "ws_glass_box" : (isMirror ? "ws_mirror_box" : "ws_box"),
            { size: size }, scene);
    } else if (baseType === 'sphere') {
        mesh = BABYLON.MeshBuilder.CreateSphere(isGlass ? "ws_glass_sphere" : (isMirror ? "ws_mirror_sphere" : "ws_sphere"),
            { diameter: size }, scene);
    } else if (baseType === 'cylinder') {
        mesh = BABYLON.MeshBuilder.CreateCylinder(isGlass ? "ws_glass_cyl" : (isMirror ? "ws_mirror_cyl" : "ws_cyl"),
            { height: size, diameter: size / 2 }, scene);
    } else if (baseType === 'triangle') {
        mesh = BABYLON.MeshBuilder.CreateCylinder(isGlass ? "ws_glass_tri" : (isMirror ? "ws_mirror_tri" : "ws_tri"),
            { height: size, diameter: size, tessellation: 3 }, scene);
    } else if (baseType === 'pyramid') {
        mesh = BABYLON.MeshBuilder.CreateCylinder("ws_pyramid",
            { height: size, diameterTop: 0, diameterBottom: size, tessellation: 4 }, scene);
    } else if (baseType === 'torus') {
        mesh = BABYLON.MeshBuilder.CreateTorus("ws_torus",
            { diameter: size, thickness: size * 0.3, tessellation: 24 }, scene);
    } else if (baseType === 'ice_mat') {
        mesh = BABYLON.MeshBuilder.CreateBox("ws_ice", { size: size }, scene);
        mat = new BABYLON.PBRMaterial("wsIceMat" + Date.now(), scene);
        mat.metallic = 0.0;
        mat.roughness = 0.02;
        mat.alpha = 0.75;
        mat.subSurface.isRefractionEnabled = true;
        mat.subSurface.indexOfRefraction = 1.31;
        mat.albedoColor = new BABYLON.Color3(0.6, 0.9, 1.0);
        mat.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.3);
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.isIceMat = true;
    } else if (baseType === 'rubber_mat') {
        mesh = BABYLON.MeshBuilder.CreateSphere("ws_rubber", { diameter: size }, scene);
        mat = new BABYLON.StandardMaterial("wsRubberMat" + Date.now(), scene);
        mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.isRubberMat = true;
    }

    if (!mesh) return null;

    mesh.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    mesh.material = mat;

    const rot = parseWorldRotation(data.rotation);
    if (rot) {
        mesh.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
            BABYLON.Tools.ToRadians(rot.x),
            BABYLON.Tools.ToRadians(rot.y),
            BABYLON.Tools.ToRadians(rot.z)
        );
    }

    let impostorType = BABYLON.PhysicsImpostor.BoxImpostor;
    if (baseType === 'sphere' || baseType === 'rubber_mat') impostorType = BABYLON.PhysicsImpostor.SphereImpostor;
    if (baseType === 'cylinder' || baseType === 'triangle' || baseType === 'pyramid') impostorType = BABYLON.PhysicsImpostor.CylinderImpostor;
    if (baseType === 'torus') impostorType = BABYLON.PhysicsImpostor.SphereImpostor;

    const physParams = { mass: finalMass, restitution: 0.1, friction: 0.8 };
    if (baseType === 'ice_mat') { physParams.restitution = 0.6; physParams.friction = 0.01; }
    if (baseType === 'rubber_mat') { physParams.restitution = 0.92; physParams.friction = 0.6; physParams.mass = finalMass * 0.4; }

    mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, impostorType, physParams, scene);

    spawnParticleBurst(mesh.position, scene);
    spawnedMeshes.push(mesh);

    if (!isMirror && !isGlass) {
        workshop.shaman.sandbox3d.MirrorSystem.addToRenderList(mesh);
    }

    return mesh;
}

function toggleLeftUI() {
    const left = document.getElementById('left-panel');
    const leftBtn = document.getElementById('btn-min-left');
    const isMinimizing = !left.classList.contains('minimized');
    
    if (isMinimizing) {
        left.classList.add('minimized');
        leftBtn.innerText = "T";
    } else {
        left.classList.remove('minimized');
        leftBtn.innerText = "-";
    }
}

function toggleHUDVisibility() {
    isHUDVisible = !isHUDVisible;
    const hud = document.getElementById('hud-container');
    const btn = document.getElementById('btn-toggle-hud');

    if (isHUDVisible) {
        hud.style.display = 'flex';
        btn.innerHTML = `<span class="shape-icon" style="background:#2ecc71;border-radius:2px;"></span> Showing FPS Meters`;
        btn.style.borderColor = '#2ecc71';
    } else {
        hud.style.display = 'none';
        btn.innerHTML = `<span class="shape-icon" style="background:#e74c3c;border-radius:2px;"></span> Hiding FPS Meters`;
        btn.style.borderColor = '#e74c3c';
    }
}

function toggleFlashlightEnable() {
    isFlashlightEnabled = !isFlashlightEnabled;
    const btn = document.getElementById('btn-flashlight-enable');
    const hud = document.getElementById('flashlight-hud');

    if (isFlashlightEnabled) {
        btn.innerHTML = `<span class="shape-icon" style="background:#f1c40f;border-radius:50%;box-shadow:0 0 6px #f1c40f;"></span> Flashlights ON`;
        btn.style.borderLeftColor = '#f1c40f';
        btn.classList.add('active');
        hud.style.display = 'block';
    } else {
        btn.innerHTML = `<span class="shape-icon" style="background:#555;border-radius:50%;"></span> Flashlights OFF`;
        btn.style.borderLeftColor = '#f1c40f';
        btn.classList.remove('active');
        hud.style.display = 'none';
        if (isFlashlightOn) toggleFlashlight();
    }
}

function toggleFlashlight() {
    if (!sceneRef || !workshop.shaman.sandbox3d.cameraFree) return;

    isFlashlightOn = !isFlashlightOn;

    const btn = document.getElementById('btn-flashlight-hud');
    const dot = document.getElementById('flashlight-hud-dot');

    if (isFlashlightOn) {
        if (!flashlightRef) {
            flashlightRef = new BABYLON.SpotLight(
                "sb3dFlashlight",
                BABYLON.Vector3.Zero(),
                new BABYLON.Vector3(0, 0, 1),
                Math.PI / 2,
                8,
                sceneRef
            );
            flashlightRef.intensity = 6;
            flashlightRef.range = 80;
            flashlightRef.diffuse = new BABYLON.Color3(1, 0.97, 0.88);
            flashlightRef.specular = new BABYLON.Color3(1, 1, 1);

            sceneRef.registerBeforeRender(syncFlashlightToCamera);
            console.log("[Flashlight] SpotLight created & registered ✓");
        }

        flashlightRef.setEnabled(true);
        btn.style.background = 'rgba(60,55,20,0.92)';
        btn.style.borderColor = '#f1c40f';
        btn.style.color = '#f1c40f';
        dot.style.background = '#f1c40f';
        dot.style.boxShadow = '0 0 6px #f1c40f';
        console.log("[Flashlight] ON");
    } else {
        if (flashlightRef) flashlightRef.setEnabled(false);
        btn.style.background = 'rgba(30,30,30,0.85)';
        btn.style.borderColor = '#555';
        btn.style.color = '#ccc';
        dot.style.background = '#555';
        dot.style.boxShadow = 'none';
        console.log("[Flashlight] OFF");
    }
}

function syncFlashlightToCamera() {
    if (!flashlightRef || !isFlashlightOn) return;

    const cam = workshop.shaman.sandbox3d.cameraFree;
    if (!cam) return;

    flashlightRef.position = cam.position.clone();
    flashlightRef.direction = cam.getForwardRay().direction.clone();
}

function toggleSafeguard() {
    performanceSafeguardActive = !performanceSafeguardActive;
    const btn = document.getElementById('btn-perf-safeguard');
    btn.innerHTML = performanceSafeguardActive
        ? `<span class="shape-icon" style="background:#f1c40f;border-radius:2px;"></span> Crash Protection ACTIVE`
        : `<span class="shape-icon" style="background:#555;border-radius:2px;"></span> Crash Protection OFF`;
}

function triggerMidnightGlitch() {
    if (document.getElementById('midnight-glitch-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'midnight-glitch-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = 9998;
    overlay.style.pointerEvents = 'none';
    overlay.style.backgroundColor = 'transparent';
    overlay.classList.add('glitch-mode');

    const tear = document.createElement('div');
    tear.className = 'tear-effect';
    overlay.appendChild(tear);

    const bar = document.createElement('div');
    bar.className = 'glitch-bar';
    overlay.appendChild(bar);

    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.remove();
    }, 500);
}

function toggleDayNight() {
    isDayNightEnabled = !isDayNightEnabled;
    const btn = document.getElementById('btn-daynight');
    const panel = document.getElementById('daynight-panel');

    if (isDayNightEnabled) {
        btn.innerHTML = `<span class="shape-icon" style="background:#f39c12;border-radius:50%;box-shadow:0 0 6px #f39c12;"></span> Time System is ACTIVE`;
        btn.style.borderLeftColor = '#f39c12';
        btn.classList.add('active');
        panel.style.display = 'block';
        const slider = document.getElementById('opt-tod');
        if (slider) setTimeOfDay(slider.value);
        resetNightPulseSystem();
    } else {
        btn.innerHTML = `<span class="shape-icon" style="background:#f39c12;border-radius:50%;"></span> Time System is OFF`;
        btn.style.borderLeftColor = '#f39c12';
        btn.classList.remove('active');
        panel.style.display = 'none';

        if (dayNightLightRef) {
            dayNightLightRef.intensity = 1.2;
            dayNightLightRef.diffuse = new BABYLON.Color3(1, 1, 1);
            dayNightLightRef.groundColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        }
        if (dayNightDirRef) {
            dayNightDirRef.intensity = 1.2;
            dayNightDirRef.diffuse = new BABYLON.Color3(1, 1, 1);
            dayNightDirRef.direction = new BABYLON.Vector3(0, -1, 0);
        }
        if (sceneRef) {
            sceneRef.clearColor = new BABYLON.Color4(0.55, 0.7, 0.85, 1.0);
        }
        if (sunMeshRef && isSunEnabled) {
            const sunPos = dayNightDirRef.direction.clone().normalize().scale(-2000);
            sunMeshRef.position = sunPos;
            sunMeshRef.isVisible = true;
        }
        const slider = document.getElementById('opt-tod');
        if (slider) {
            slider.value = 720;
            document.getElementById('val-tod').innerText = '12:00';
        }
        if (isSyncingDeviceTime) {
            toggleSyncDeviceTime();
        }
    }
}

function toggleSun(forceInit = false) {
    if (!forceInit) {
        isSunEnabled = !isSunEnabled;
        localStorage.setItem('sb3d_sun', isSunEnabled.toString());
    }

    const btn = document.getElementById('btn-sun');

    if (btn) {
        if (isSunEnabled) {
            btn.innerHTML = `<span class="shape-icon" style="background:#f1c40f;border-radius:50%;box-shadow:0 0 6px #f1c40f;"></span> Sun is ON`;
            btn.style.borderLeftColor = '#f1c40f';
        } else {
            btn.innerHTML = `<span class="shape-icon" style="background:#555;border-radius:50%;"></span> Sun is OFF`;
            btn.style.borderLeftColor = '#555';
        }
    }

    if (!sceneRef || !dayNightDirRef) return;

    if (isSunEnabled) {
        if (!sunMeshRef) {
            sunMeshRef = BABYLON.MeshBuilder.CreateSphere("sunMesh", { diameter: 80 }, sceneRef);
            const sunMat = new BABYLON.StandardMaterial("sunMat", sceneRef);
            sunMat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.6);
            sunMeshRef.alwaysSelectAsActiveMesh = true;
            sunMeshRef.infiniteDistance = true;
            sunMeshRef.checkCollisions = false;
            sunMat.disableLighting = true;
            sunMeshRef.material = sunMat;
            sunMeshRef.isPickable = false;
        }

        sunMeshRef.isVisible = true;
        const sunDir = dayNightDirRef.direction.clone().normalize();
        sunMeshRef.position = sunDir.scale(-2000);
    } else {
        if (sunMeshRef) {
            sunMeshRef.isVisible = false;
        }
    }
}

function setTimeOfDay(minutesRaw) {
    const minutes = parseInt(minutesRaw);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const label = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
    document.getElementById('val-tod').innerText = label;

    const slider = document.getElementById('opt-tod');
    if (slider) slider.value = minutes;

    if (!isDayNightEnabled || !sceneRef) return;

    const t = minutes / 1440;

    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunX = Math.cos(sunAngle);
    const sunY = Math.sin(sunAngle);

    const isDay = sunY > 0;
    const isDawn = t > 0.2 && t < 0.35;
    const isDusk = t > 0.65 && t < 0.8;
    const isNight = !isDay;
    if (isNight && !lastNightState && !midnightGlitchTriggered) {
        if (Math.random() < 0.3) {
            triggerMidnightGlitch();
        }
        midnightGlitchTriggered = true;
    } else if (!isNight) {
        midnightGlitchTriggered = false;
    }

    let skyR, skyG, skyB;
    if (isNight) {
        const nightDepth = Math.max(0, -sunY);
        skyR = 0.01 + nightDepth * 0.02;
        skyG = 0.01 + nightDepth * 0.02;
        skyB = 0.05 + nightDepth * 0.08;
    } else if (isDawn) {
        const p = (t - 0.2) / 0.15;
        skyR = 0.05 + p * 0.55;
        skyG = 0.02 + p * 0.35;
        skyB = 0.08 + p * 0.25;
    } else if (isDusk) {
        const p = 1 - (t - 0.65) / 0.15;
        skyR = 0.05 + p * 0.55;
        skyG = 0.02 + p * 0.25;
        skyB = 0.08 + p * 0.35;
    } else {
        const dayStrength = Math.min(sunY * 2, 1);
        skyR = 0.25 * dayStrength;
        skyG = 0.45 * dayStrength;
        skyB = 0.75 * dayStrength;
    }
    sceneRef.clearColor = new BABYLON.Color4(skyR, skyG, skyB, 1);

    if (dayNightLightRef) {
        const ambIntensity = isNight
            ? Math.max(0.05, 0.1 - Math.abs(sunY) * 0.1)
            : 0.3 + sunY * 0.9;

        dayNightLightRef.intensity = ambIntensity;

        if (isNight) {
            dayNightLightRef.diffuse = new BABYLON.Color3(0.3, 0.3, 0.6);
            dayNightLightRef.groundColor = new BABYLON.Color3(0.02, 0.02, 0.04);
        } else if (isDawn || isDusk) {
            dayNightLightRef.diffuse = new BABYLON.Color3(1.0, 0.6, 0.3);
            dayNightLightRef.groundColor = new BABYLON.Color3(0.1, 0.05, 0.02);
        } else {
            dayNightLightRef.diffuse = new BABYLON.Color3(1, 1, 1);
            dayNightLightRef.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);
        }
    }

    if (dayNightDirRef) {
        if (isNight) {
            dayNightDirRef.intensity = 0;
        } else {
            dayNightDirRef.intensity = Math.max(0, sunY) * 1.2;
            dayNightDirRef.direction = new BABYLON.Vector3(sunX, -Math.abs(sunY), -0.5).normalize();

            if (isDawn || isDusk) {
                dayNightDirRef.diffuse = new BABYLON.Color3(1.0, 0.5, 0.2);
            } else {
                dayNightDirRef.diffuse = new BABYLON.Color3(1.0, 0.98, 0.9);
            }
        }
    }
    if (sunMeshRef && isSunEnabled) {
        sunMeshRef.position = dayNightDirRef.direction.normalizeToNew().scale(-2000);
        sunMeshRef.isVisible = !isNight;
    }
    resetNightPulseSystem();
}

function cleanupNightPulse() {
    if (nightPulseLight) {
        nightPulseLight.intensity = 0;
    }
    if (pulseAnimObserver && sceneRef) {
        sceneRef.onBeforeRenderObservable.remove(pulseAnimObserver);
        pulseAnimObserver = null;
    }
}

function resetNightPulseSystem() {
    if (!sceneRef) return;
    if (nightPulseInterval) {
        clearInterval(nightPulseInterval);
        nightPulseInterval = null;
    }
    cleanupNightPulse();
    startNightPulseSystem(sceneRef);
}

function triggerPulseAnimation(scene) {
    if (!nightPulseLight) return;

    if (pulseAnimObserver) {
        scene.onBeforeRenderObservable.remove(pulseAnimObserver);
        pulseAnimObserver = null;
    }

    let pulseStep = 0;
    const maxIntensity = 2.0;
    const speed = 0.04;

    nightPulseLight.intensity = 0;

    pulseAnimObserver = scene.onBeforeRenderObservable.add(() => {
        pulseStep += speed;

        const currentIntensity = Math.sin(pulseStep) * maxIntensity;

        if (pulseStep >= Math.PI) {
            nightPulseLight.intensity = 0;
            scene.onBeforeRenderObservable.remove(pulseAnimObserver);
            pulseAnimObserver = null;
        } else {
            nightPulseLight.intensity = Math.max(0, currentIntensity);
        }
    });
}

function startNightPulseSystem(scene) {
    if (nightPulseInterval) clearInterval(nightPulseInterval);

    if (!nightPulseLight) {
        nightPulseLight = new BABYLON.DirectionalLight("nightPulseLight", new BABYLON.Vector3(0, -1, 0), scene);
        nightPulseLight.intensity = 0;
    }

    nightPulseInterval = setInterval(() => {
        if (!isDayNightEnabled || !scene) return;

        const sliderVal = parseInt(document.getElementById('opt-tod').value);
        const t = sliderVal / 1440;

        const sunAngle = (t - 0.25) * Math.PI * 2;
        const sunY = Math.sin(sunAngle);

        const isNight = sunY <= 0;
        const isDawn = t > 0.2 && t < 0.35;

        if (!isNight || isDawn) {
            cleanupNightPulse();
            return;
        }

        const isMidnight = t < 0.1 || t > 0.9;

        if (isMidnight) {
            nightPulseLight.diffuse = new BABYLON.Color3(0.8, 0.1, 0.1);
        } else {
            nightPulseLight.diffuse = new BABYLON.Color3(0.7, 0.8, 1.0);
        }

        triggerPulseAnimation(scene);

    }, 5000);
}

function toggleSyncDeviceTime() {
    isSyncingDeviceTime = !isSyncingDeviceTime;
    const btn = document.getElementById('btn-sync-time');
    const slider = document.getElementById('opt-tod');

    if (isSyncingDeviceTime) {
        btn.innerHTML = `<span class="shape-icon" style="background:#2ecc71;border-radius:50%;box-shadow:0 0 5px #2ecc71;"></span> Syncing with current time`;
        btn.style.borderLeftColor = '#2ecc71';
        btn.classList.add('active');
        if (slider) slider.disabled = true;
        applyDeviceTime();
        syncDeviceTimeInterval = setInterval(applyDeviceTime, 10000);
    } else {
        btn.innerHTML = `<span class="shape-icon" style="background:#3498db;border-radius:50%;"></span> Not syncing with current time`;
        btn.style.borderLeftColor = '#3498db';
        btn.classList.remove('active');
        if (slider) slider.disabled = false;
        clearInterval(syncDeviceTimeInterval);
        syncDeviceTimeInterval = null;
    }
}

function applyDeviceTime() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    setTimeOfDay(minutes);
    console.log(`[DayNight] Synced to device time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
}

function togglePhysicsSleeping() {
    isPhysicsSleepingEnabled = !isPhysicsSleepingEnabled;
    const btn = document.getElementById('btn-physics-sleep');

    if (isPhysicsSleepingEnabled) {
        btn.innerHTML = `<span class="shape-icon" style="background:#2ecc71;border-radius:2px;box-shadow:0 0 5px #2ecc71;"></span> Objects will sleep when inactive`;
        btn.classList.add('active');
        btn.style.borderColor = '#2ecc71';
    } else {
        spawnedMeshes.forEach(mesh => {
            if (mesh && !mesh.isDisposed() && mesh.physicsImpostor) {
                mesh.physicsImpostor.wakeUp();
                if (mesh.metadata) { mesh.metadata.lastMovedTime = performance.now(); mesh.metadata.isSleeping = false; }
            }
        });
        btn.innerHTML = `<span class="shape-icon" style="background:#e67e22;border-radius:2px;"></span> Objects will not sleep when inactive`;
        btn.classList.remove('active');
        btn.style.borderColor = '#e67e22';
    }
}

function toggleGraphicsUI() {
    const overlay = document.getElementById('settings-modal-overlay');
    const btn = document.getElementById('btn-graphics-toggle');
    const isHidden = overlay.style.display === 'none' || overlay.style.display === '';

    if (isHidden) {
        overlay.style.display = 'flex';
        btn.classList.add('active');
        const catSelect = document.getElementById('settings-category-select');
        if (catSelect) switchSettingsCategory(catSelect.value);
    } else {
        overlay.style.display = 'none';
        btn.classList.remove('active');
    }
}

    function showAboutVersions() {
    const babylonVersion = BABYLON.Engine.Version || 'Unknown';

    let cannonVersion = 'Unknown';
    if (typeof CANNON !== 'undefined' && CANNON.version) {
        cannonVersion = CANNON.version;
    }

    const sb3dVersion = SB3D_VERSION;

    alert(
        `Version Info\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Edition: ${SB3D_EDITION}\n` +
        `SandBox3D: ${sb3dVersion}\n` +
        `Babylon.js: v${babylonVersion}\n` +
        `Cannon.js: v${cannonVersion}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Under project prism\n` +
        `Lead by monsieurshaman`
    );
}

function toggleFrustumCulling() {
    isFrustumCullingEnabled = !isFrustumCullingEnabled;
    const btn = document.getElementById('btn-frustum-cull');

    if (isFrustumCullingEnabled) {
        btn.innerHTML = `<span class="shape-icon" style="background:#2ecc71;border-radius:2px;box-shadow:0 0 5px #2ecc71;"></span> Frustum Culling is ON`;
        btn.classList.add('active');
        btn.style.borderColor = '#2ecc71';
    } else {
        spawnedMeshes.forEach(mesh => {
            if (mesh && !mesh.isDisposed() && mesh.isEnabled()) {
                if (mesh.name.includes("customInstance") || mesh.name.includes("customHitbox")) { mesh.isVisible = false; }
                else { mesh.isVisible = true; }
                mesh.getChildMeshes().forEach(c => c.isVisible = true);
            }
        });
        btn.innerHTML = `<span class="shape-icon" style="background:#e67e22;border-radius:2px;"></span> Frustum Culling is OFF`;
        btn.classList.remove('active');
        btn.style.borderColor = '#e67e22';
    }
}

function toggleWebGPU() {
    const isCurrentlyWebGPU = localStorage.getItem('sb3d_use_webgpu') === 'true';
    const nextWebGPUState = !isCurrentlyWebGPU;
    const targetAPI = nextWebGPUState ? 'WebGPU' : 'WebGL2';

    if (!confirm(
        `Switch to ${targetAPI}?\n\n` +
        `This change requires a session restart to switch Graphics APIs.\n\n` +
        `Continue?`
    )) return;

    localStorage.setItem('sb3d_use_webgpu', nextWebGPUState.toString());
    location.reload();
}

function updateWebGPUButtonState() {
    const btn = document.getElementById('btn-webgpu');
    if (!btn) return;
    const isWebGPU = localStorage.getItem('sb3d_use_webgpu') === 'true';

    if (isWebGPU) {
        btn.innerHTML = `<span class="shape-icon" style="background:#2ecc71;border-radius:50%;box-shadow:0 0 5px #2ecc71;"></span> Using WebGPU`;
        btn.classList.add('active');
        btn.style.borderColor = '#2ecc71';
    } else {
        btn.innerHTML = `<span class="shape-icon" style="background:#3498db;border-radius:50%;"></span> Not using WebGPU`;
        btn.classList.remove('active');
        btn.style.borderColor = '#3498db';
    }
}

function toggleAmbientAudio() {
    const btn = document.getElementById('btn-ambient');
    const isEnabled = workshop.shaman.sandbox3d.TemporalAudio.toggle();

    if (isEnabled) {
        btn.innerHTML = `<span class="shape-icon" style="background:#2ecc71;border-radius:50%;box-shadow:0 0 5px #2ecc71;"></span> Ambient Environment is ON`;
        btn.classList.add('active');
        btn.style.borderColor = '#2ecc71';
    } else {
        btn.innerHTML = `<span class="shape-icon" style="background:#9b59b6;border-radius:50%;"></span> Ambient Environment is OFF`;
        btn.classList.remove('active');
        btn.style.borderColor = '#9b59b6';
    }
}

function toggleBgPillars() {
    const scene = workshop.shaman.sandbox3d.scene;
    if (!scene) return;
    isBgPillarsEnabled = !isBgPillarsEnabled;
    scene.meshes.filter(m => m.name.startsWith("bgPillar_")).forEach(m => m.setEnabled(isBgPillarsEnabled));
    localStorage.setItem('sb3d_bgPillars', isBgPillarsEnabled ? '1' : '0');
    const btn = document.getElementById('btn-bg-pillars');
    if (btn) btn.innerHTML = isBgPillarsEnabled
        ? `<span class="shape-icon" style="background:#78909c;border-radius:2px;"></span> BG Pillars are ON`
        : `<span class="shape-icon" style="background:#555;border-radius:2px;"></span> BG Pillars are OFF`;
}

function toggleBgDecors() {
    const scene = workshop.shaman.sandbox3d.scene;
    if (!scene) return;
    isBgDecorsEnabled = !isBgDecorsEnabled;
    scene.meshes.filter(m => m.name.startsWith("bg_") || m.name.startsWith("platform_")).forEach(m => m.setEnabled(isBgDecorsEnabled));
    localStorage.setItem('sb3d_bgDecors', isBgDecorsEnabled ? '1' : '0');
    const btn = document.getElementById('btn-bg-decors');
    if (btn) btn.innerHTML = isBgDecorsEnabled
        ? `<span class="shape-icon" style="background:#80cbc4;border-radius:50%;"></span> BG Decors are ON`
        : `<span class="shape-icon" style="background:#555;border-radius:50%;"></span> BG Decors are OFF`;
}

function updateAmbientVolume(val) {
    const vol = parseFloat(val);
    document.getElementById('ambient-vol-display').innerText = vol.toFixed(1);

    const tempAudio = workshop.shaman.sandbox3d.TemporalAudio;
    tempAudio.volume = vol;

    if (tempAudio.gainNode && tempAudio.audioCtx) {
        tempAudio.gainNode.gain.linearRampToValueAtTime(vol, tempAudio.audioCtx.currentTime + 0.1);
    } else if (tempAudio.activeSound) {
        tempAudio.activeSound.volume = Math.min(vol, 1.0);
    }
}

function updateExplosionVolume(val) {
    explosionVolume = parseFloat(val);
    document.getElementById('explosion-vol-display').innerText = explosionVolume.toFixed(1);
}

function toggleFlashbangVideo() {
    isFlashbangVideoEnabled = !isFlashbangVideoEnabled;
    const btn = document.getElementById('btn-flashvid');
    btn.innerHTML = isFlashbangVideoEnabled
        ? `<span class="shape-icon" style="background:#f1c40f;border-radius:2px;"></span> Flashbang Video is ON`
        : `<span class="shape-icon" style="background:#555;border-radius:2px;"></span> Flashbang Video is OFF`;
}


function updateGameSettings() {
    const resScale = document.getElementById('opt-res').value;
    const viewDist = document.getElementById('opt-view').value;
    const fovVal = document.getElementById('opt-fov').value;
    document.getElementById('val-res').innerText = resScale + "%";
    document.getElementById('val-view').innerText = viewDist + "m";
    document.getElementById('val-fov').innerText = fovVal;

    const sb3d = workshop.shaman.sandbox3d;
    if (sb3d.cameraFree) {
        sb3d.cameraFree.fov = parseFloat(fovVal);
        sb3d.engine.setHardwareScalingLevel(1 / (resScale / 100));
        sb3d.cullingDistance = parseFloat(viewDist);

        if (sunMeshRef) {
            sunMeshRef.setEnabled(isSunEnabled);
        }
    }
}

function togglePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    const btn = document.getElementById('btn-props-hotbar');
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (isOpen) { buildEditMesh = null; syncPanelToHeld(); }
    if (btn) btn.classList.toggle('active', !isOpen);
}

let currentHotbarCategory = 'shapes';
let selectionLabelTimer = null;
let selectionLabelActive = false;

const HOTBAR_CATEGORIES = {
    shapes: [
        { id: 'box', label: 'Cube', iconClass: 'icon-box' },
        { id: 'sphere', label: 'Sphere', iconClass: 'icon-sphere' },
        { id: 'cylinder', label: 'Cylinder', iconClass: 'icon-cyl' },
        { id: 'triangle', label: 'Triangle', iconClass: 'icon-tri' },
    ],
    glass: [
        { id: 'glass_box', label: 'Glass Cube', iconClass: 'icon-box', iconStyle: 'opacity:0.5;' },
        { id: 'glass_sphere', label: 'Glass Sphere', iconClass: 'icon-sphere', iconStyle: 'opacity:0.5;' },
        { id: 'glass_cylinder', label: 'Glass Cylinder', iconClass: 'icon-cyl', iconStyle: 'opacity:0.5;' },
        { id: 'glass_triangle', label: 'Glass Triangle', iconClass: 'icon-tri', iconStyle: 'opacity:0.5;' },
    ],
    mirror: [
        { id: 'mirror_box', label: 'Mirror Cube', iconClass: 'icon-box', iconStyle: 'background:linear-gradient(135deg,#eee,#aaa);' },
        { id: 'mirror_sphere', label: 'Mirror Sphere', iconClass: 'icon-sphere', iconStyle: 'background:linear-gradient(135deg,#eee,#aaa);' },
        { id: 'mirror_cylinder', label: 'Mirror Cylinder', iconClass: 'icon-cyl', iconStyle: 'background:linear-gradient(135deg,#eee,#aaa);' },
        { id: 'mirror_triangle', label: 'Mirror Triangle', iconClass: 'icon-tri', iconStyle: 'border-bottom-color:#ccc;filter:drop-shadow(0 -2px 1px #eee);' },
    ],
    special_shapes: [
        { id: 'pyramid', label: 'Pyramid', iconClass: 'icon-tri' },
        { id: 'torus', label: 'Torus', iconClass: 'icon-torus' },
    ],
    special_mats: [
        { id: 'ice_mat', label: 'Ice', iconClass: 'icon-ice-mat' },
        { id: 'rubber_mat', label: 'Rubber', iconClass: 'icon-rubber' },
    ],
    explosives: [
        { id: 'bomb', label: 'Bomb', iconClass: 'icon-bomb' },
        { id: 'frag_bomb', label: 'Cluster Bomb', iconClass: 'icon-frag' },
        { id: 'flashbang', label: 'Flashbang', iconClass: 'icon-flash' },
        { id: 'fire_bomb', label: 'Fire Bomb', iconClass: 'icon-fire' },
        { id: 'ice_bomb', label: 'Ice Bomb', iconClass: 'icon-icebomb' },
    ],
    custom: [],
};

function renderHotbar() {
    const slotsContainer = document.getElementById('hotbar-slots');
    if (!slotsContainer) return;

    slotsContainer.innerHTML = '';

    let items;
    if (currentHotbarCategory === 'custom') {
        items = customModelTemplates
            .map((tmpl, i) => tmpl ? { id: 'custom_' + i, label: 'Model ' + (i + 1), iconClass: 'icon-custom' } : null)
            .filter(Boolean);
    } else {
        items = HOTBAR_CATEGORIES[currentHotbarCategory] || [];
    }

    items.forEach(item => {
        const slot = document.createElement('div');
        slot.className = 'hotbar-slot';
        slot.dataset.shape = item.id;
        const styleAttr = item.iconStyle ? ` style="${item.iconStyle}"` : '';
        slot.innerHTML = `<span class="shape-icon ${item.iconClass || ''}"${styleAttr}></span>`;
        slot.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            selectHotbarShape(item.id, item.label);
        }, { passive: false });
        slotsContainer.appendChild(slot);
    });

    updateHotbarActiveState();
}

function updateHotbarActiveState() {
    document.querySelectorAll('.hotbar-slot').forEach(slot => {
        slot.classList.toggle('active', slot.dataset.shape === selectedShape);
    });
}

function switchHotbarCategory(cat) {
    currentHotbarCategory = cat;
    renderHotbar();
}

function selectHotbarShape(shapeId, label) {
    selectShape(shapeId);
    showSelectionLabel(label);
}

function showSelectionLabel(label) {
    const hint = document.getElementById('selection-label-hint');
    if (!hint) return;

    hint.textContent = label;
    hint.style.display = 'block';
    void hint.offsetWidth;
    hint.style.opacity = '1';
    selectionLabelActive = true;

    if (selectionLabelTimer) clearTimeout(selectionLabelTimer);
    selectionLabelTimer = setTimeout(() => {
        hint.style.opacity = '0';
        selectionLabelActive = false;
        setTimeout(() => { hint.style.display = 'none'; }, 220);
    }, 1000);
}

function switchSettingsCategory(cat) {
    ['system', 'audio', 'environment', 'overlay', 'debugging'].forEach(c => {
        const el = document.getElementById('settings-cat-' + c);
        if (el) el.style.display = c === cat ? 'block' : 'none';
    });
}

function toggleBuildMode() {
    if (selectedShape === 'eraser' || selectedShape === 'view') {
        selectShape('box');
        isBuildMode = true; 
    } else {
        isBuildMode = !isBuildMode; 
    }

    const btn = document.getElementById('btn-build');
    if(isBuildMode) btn.classList.add('active');
    else btn.classList.remove('active');
    updateBuildModeHint();
}

function updateBuildModeHint() {
    const hint = document.getElementById('build-mode-hint');
    if (hint) hint.style.display = isBuildMode ? 'block' : 'none';
}

function disableBuildMode() {
    isBuildMode = false;
    const btn = document.getElementById('btn-build');
    if (btn) btn.classList.remove('active');
    updateBuildModeHint();
}

function selectShape(shape) {
    selectedShape = shape;
    const structSettings = document.getElementById('structure-settings');
    const reflectSettings = document.getElementById('reflectivity-settings');
    
    document.querySelectorAll('button').forEach(b => {
        if (!b.classList.contains('btn-minimize') && b.id !== 'btn-enter-game' && b.id !== 'btn-build' && b.id !== 'btn-upload' && b.id !== 'btn-props-hotbar') {
            b.classList.remove('active');
        }
    });

    if (shape === 'structure') {
        structSettings.style.display = 'block';
    } else {
        structSettings.style.display = 'none';
    }

    if (shape.startsWith('mirror_')) {
        reflectSettings.style.display = 'block';
    } else {
        reflectSettings.style.display = 'none';
    }

    if (shape === 'view') {
        workshop.shaman.sandbox3d.resetCameraTarget();
    }
    else {
        viewTargetMesh = null;
    }

    let btnId = 'btn-' + shape;
    if (shape === 'cylinder') btnId = 'btn-cyl';
    if (shape === 'triangle') btnId = 'btn-tri';
    if (shape === 'frag_bomb') btnId = 'btn-frag';
    if (shape === 'flashbang') btnId = 'btn-flashbang';
    if (shape === 'fire_bomb') btnId = 'btn-firebomb';
    if (shape === 'ice_bomb') btnId = 'btn-icebomb';
    if (shape === 'glass_cylinder') btnId = 'btn-glass_cyl';
    if (shape === 'glass_triangle') btnId = 'btn-glass_tri';
    if (shape === 'mirror_cylinder') btnId = 'btn-mirror_cyl';
    if (shape === 'mirror_triangle') btnId = 'btn-mirror_tri';
    if (shape === 'gravgun') btnId = 'btn-gravgun';
    
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');

    updateHotbarActiveState();
}

function setFPS(val) {
    targetFPS = val;
    document.querySelectorAll('.fps-btn').forEach(btn => {
        btn.classList.remove('active');
        if ((val === 0 && btn.innerText === '∞') || btn.innerText == val) btn.classList.add('active');
    });
}


function updateSize(val) {
    if (getEditTarget()) { applyHeldSize(parseFloat(val)); return; }
    currentSize = parseFloat(val);
    document.getElementById('size-display').innerText = currentSize.toFixed(1);

    currentMass = (currentSize * 1.5);

    const massSlider = document.getElementById('mass-slider');
    const massDisplay = document.getElementById('mass-display');

    massSlider.value = currentMass;
    massDisplay.innerText = currentMass.toFixed(1);
}

function updateMass(val) {
    if (getEditTarget()) { applyHeldMass(parseFloat(val)); return; }
    currentMass = parseFloat(val);
    document.getElementById('mass-display').innerText = currentMass.toFixed(1);        
}

function getHeldEditMeta(mesh) {
    if (!mesh.metadata) mesh.metadata = {};
    const md = mesh.metadata;
    if (md.sbUnit === undefined) {
        let unit = 0;
        if (typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() > 0) {
            const e = mesh.getBoundingInfo().boundingBox.extendSize;
            unit = Math.max(e.x, e.y, e.z) * 2;
        } else {
            const hv = mesh.getHierarchyBoundingVectors(true);
            const d = hv.max.subtract(hv.min);
            unit = Math.max(d.x, d.y, d.z) / (mesh.scaling.x || 1);
        }
        md.sbUnit = unit > 0 ? unit : 1;
    }
    return md;
}

function getMeshHex(mesh) {
    const m = mesh.material;
    if (!m) return null;
    if (m.albedoColor) return m.albedoColor.toHexString();
    if (m.diffuseColor) return m.diffuseColor.toHexString();
    return null;
}

function rebuildHeldImpostor(mesh) {
    const old = mesh.physicsImpostor;
    if (!old) return;
    const type = old.type;
    const params = { mass: 0, restitution: old.restitution, friction: old.friction };
    old.dispose();
    mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, type, params, mesh.getScene());
    mesh.physicsImpostor.sleep();
}

function applyHeldMass(mass, syncSlider) {
    const target = getEditTarget();
    if (!target || (target.metadata && target.metadata.isBuildObj)) return;
    const md = getHeldEditMeta(target);
    md.gravGunMass = mass;
    if (md.bombMass !== undefined) md.bombMass = mass;
    document.getElementById('mass-display').innerText = mass.toFixed(1);
    if (syncSlider) document.getElementById('mass-slider').value = mass;
}

function applyHeldSize(size) {
    const mesh = getEditTarget();
    if (!mesh) return;
    if (mesh.metadata && mesh.metadata.isBuildObj) {
        applyBuildObjectSize(mesh, size);
        document.getElementById('size-display').innerText = size.toFixed(1);
        return;
    }
    const md = getHeldEditMeta(mesh);
    mesh.scaling.setAll(size / md.sbUnit);
    rebuildHeldImpostor(mesh);
    if (md.bombSize !== undefined) md.bombSize = size;
    document.getElementById('size-display').innerText = size.toFixed(1);
    applyHeldMass(size * 1.5, true);
}

function applyHeldColor(hex) {
    const target = getEditTarget();
    if (!target || !target.material) return;
    const c = BABYLON.Color3.FromHexString(hex);
    const m = target.material;
    if (m.albedoColor) m.albedoColor = c;
    else if (m.diffuseColor) m.diffuseColor = c;
}

function onColorPickerInput(hex) {
    if (getEditTarget()) applyHeldColor(hex);
}

function syncPanelToHeld() {
    const title = document.getElementById('properties-panel-title');
    const sizeSlider = document.getElementById('size-slider');
    const massSlider = document.getElementById('mass-slider');
    const sizeDisp = document.getElementById('size-display');
    const massDisp = document.getElementById('mass-display');
    const picker = document.getElementById('color-picker');
    const target = getEditTarget();
    const isBM = !!(target && target.metadata && target.metadata.isBuildObj);
    const massGroup = massSlider.closest('.slider-group');
    const rotGroup = document.getElementById('bm-rotation-settings');

    if (target) {
        if (!panelEditingHeld) {
            savedSpawnColor = picker.value;
            savedPanelTitle = title ? title.textContent : '';
            panelEditingHeld = true;
        }
        let size;
        if (isBM) {
            size = target.metadata.buildGrid;
        } else {
            const md = getHeldEditMeta(target);
            size = md.sbUnit * target.scaling.x;
            const mass = md.gravGunMass !== undefined ? md.gravGunMass : target.physicsImpostor.mass;
            massSlider.value = mass;
            massDisp.innerText = mass.toFixed(1);
        }
        sizeSlider.value = size;
        sizeDisp.innerText = size.toFixed(1);
        if (massGroup) massGroup.style.display = isBM ? 'none' : '';
        if (rotGroup) rotGroup.style.display = isBM ? 'block' : 'none';
        if (isBM) updateBuildRotReadout(target);
        const hex = getMeshHex(target);
        if (hex) picker.value = hex;
        picker.disabled = !hex;
        if (title) title.textContent = isBM ? 'Editing Build Object' : 'Editing Held Object';
    } else if (panelEditingHeld) {
        panelEditingHeld = false;
        sizeSlider.value = currentSize;
        sizeDisp.innerText = currentSize.toFixed(1);
        massSlider.value = currentMass;
        massDisp.innerText = currentMass.toFixed(1);
        picker.value = savedSpawnColor;
        picker.disabled = false;
        if (title) title.textContent = savedPanelTitle;
        if (massGroup) massGroup.style.display = '';
        if (rotGroup) rotGroup.style.display = 'none';
    }
}

function updateBuildRotReadout(mesh) {
    const el = document.getElementById('bm-rot-readout');
    if (!el) return;
    const r = (mesh.metadata && mesh.metadata.buildRot) || { x: 0, y: 0, z: 0 };
    const deg = (n) => Math.round(n * BM_ROT_STEP * 180 / Math.PI);
    el.textContent = 'X ' + deg(r.x) + '°   Y ' + deg(r.y) + '°   Z ' + deg(r.z) + '°';
}

function rotateBuildObject(axis, dir) {
    const mesh = getEditTarget();
    if (!mesh || !mesh.metadata || !mesh.metadata.isBuildObj) return;
    const md = mesh.metadata;
    if (!md.buildBaseRot) {
        md.buildBaseRot = mesh.rotationQuaternion
            ? mesh.rotationQuaternion.clone()
            : BABYLON.Quaternion.RotationYawPitchRoll(mesh.rotation.y, mesh.rotation.x, mesh.rotation.z);
        md.buildRot = { x: 0, y: 0, z: 0 };
    }
    const total = Math.round((Math.PI * 2) / BM_ROT_STEP);
    md.buildRot[axis] = ((md.buildRot[axis] + dir) % total + total) % total;
    const r = md.buildRot;
    const delta = BABYLON.Quaternion.RotationYawPitchRoll(r.y * BM_ROT_STEP, r.x * BM_ROT_STEP, r.z * BM_ROT_STEP);
    mesh.rotationQuaternion = delta.multiply(md.buildBaseRot);
    rebuildHeldImpostor(mesh);
    updateBuildRotReadout(mesh);
}

function getEditTarget() {
    if (heldMesh && !heldMesh.isDisposed()) return heldMesh;
    if (buildEditMesh && buildEditMesh.isDisposed()) {
        buildEditMesh = null;
        syncPanelToHeld();
    }
    return buildEditMesh;
}

function applyBuildObjectSize(mesh, size) {
    const md = mesh.metadata;
    const oldGrid = md.buildGrid;
    const snap = (c) => Math.round((c - oldGrid / 2) / size) * size + size / 2;
    mesh.scaling.scaleInPlace(size / oldGrid);
    mesh.position.set(snap(mesh.position.x), snap(mesh.position.y), snap(mesh.position.z));
    md.buildGrid = size;
    rebuildHeldImpostor(mesh);
}

function getEditPick() {
    return typeof getCenterPick === 'function' ? getCenterPick() : workshop.shaman.sandbox3d.getCenterPick();
}

function tryOpenBuildObjectEdit() {
    if (heldMesh && !heldMesh.isDisposed()) return false;
    const pick = getEditPick();
    if (!pick || !pick.hit || !pick.pickedMesh) return false;
    let mesh = pick.pickedMesh;
    if (mesh.parent && (mesh.parent.name.includes("customHitbox") || mesh.parent.name.includes("customInstance"))) {
        mesh = mesh.parent;
    }
    if (!mesh.metadata || !mesh.metadata.isBuildObj) return false;
    buildEditMesh = mesh;
    const panel = document.getElementById('properties-panel');
    if (panel && panel.style.display !== 'block') togglePropertiesPanel();
    syncPanelToHeld();
    return true;
}

function beginPropsPress() {
    propsPressActive = true;
    propsLongHandled = false;
    clearTimeout(propsPressTimer);
    propsPressTimer = setTimeout(() => {
        propsPressTimer = null;
        propsLongHandled = tryOpenBuildObjectEdit();
    }, 450);
}

function endPropsPress() {
    if (!propsPressActive) return;
    propsPressActive = false;
    const wasPending = propsPressTimer !== null;
    clearTimeout(propsPressTimer);
    propsPressTimer = null;
    if (wasPending || !propsLongHandled) togglePropertiesPanel();
    propsLongHandled = false;
}

function cancelPropsPress() {
    clearTimeout(propsPressTimer);
    propsPressTimer = null;
    propsPressActive = false;
    propsLongHandled = false;
}

function updateReflectivity(val) {
    currentReflectivity = parseFloat(val);
    document.getElementById('reflect-display').innerText = currentReflectivity.toFixed(2);
}

function updateGrabbedControls() {
    syncPanelToHeld();
    const ctrl = document.getElementById('grabbed-controls');
    if (!ctrl) return;
    if (heldMesh && !heldMesh.isDisposed()) {
        ctrl.classList.add('visible');
    } else {
        ctrl.classList.remove('visible');
        isRotationMode = false;
        const rotBtn = document.getElementById('btn-rotate-toggle');
        if (rotBtn) rotBtn.classList.remove('active');
    }
}

function updateGrabHint() {
    getEditTarget();
    const hint = document.getElementById('grab-hint');
    const eraserHud = document.getElementById('eraser-hud');
    if (eraserHud) eraserHud.style.display = 'none';

    if (heldMesh && heldMesh.isDisposed()) {
        heldMesh = null;
        isRotationMode = false;
        const _gb = document.getElementById('btn-grab');
        if (_gb) { _gb.textContent = 'GRAB'; _gb.classList.remove('grabbing'); }
        const _cur = document.getElementById('center-cursor');
        if (_cur) _cur.classList.remove('grabbing');
        updateGrabbedControls();
    }

    if (!hint) return;

    if (selectionLabelActive) {
        hint.style.display = 'none';
        return;
    }

    const sb3d = workshop.shaman.sandbox3d;
    if (!sb3d.scene || !sb3d.cameraFree) {
        hint.style.display = 'none';
        return;
    }

    if (heldMesh && !heldMesh.isDisposed()) {
        const rotTag = isRotationMode ? '  ·  ROTATING' : '';
        const txt = `Tap UNGRAB to drop  ·  Tap FREEZE to freeze  ·  ${holdDistance.toFixed(1)}m${rotTag}`;
        if (hint.textContent !== txt) hint.textContent = txt;
        hint.style.display = 'block';
        return;
    }

    const propPanelEl = document.getElementById('properties-panel');
    const anyPanelOpen =
        !document.getElementById('left-panel').classList.contains('minimized') ||
        (propPanelEl && propPanelEl.style.display === 'block');

    const settingsOverlay = document.getElementById('settings-modal-overlay');
    const worldOverlay = document.getElementById('world-settings-modal-overlay');
    const helpOverlay = document.getElementById('help-modal-overlay');
    const anyModalOpen =
        (settingsOverlay && settingsOverlay.style.display === 'flex') ||
        (worldOverlay && worldOverlay.style.display === 'flex') ||
        (helpOverlay && helpOverlay.style.display === 'flex');

    if (anyPanelOpen || anyModalOpen) {
        hint.style.display = 'none';
        return;
    }

    const pick = sb3d.getCenterPick();
    if (!pick || !pick.hit || !pick.pickedMesh) {
        hint.style.display = 'none';
        return;
    }

    let mesh = pick.pickedMesh;
    if (mesh.parent && (mesh.parent.name.includes('customHitbox') || mesh.parent.name.includes('customInstance'))) {
        mesh = mesh.parent;
    }

    const name = mesh.name || '';
    const nonGrabbable =
        name === 'ground' ||
        name === 'ramp' ||
        name === 'pillar' ||
        name === 'poolFloor' ||
        name === 'wallN' || name === 'wallS' || name === 'wallE' || name === 'wallW' ||
        name.startsWith('stair_step_') ||
        name === 'drainButton' || name === 'drainButtonBase' ||
        name === 'sunMesh' ||
        name === 'waterVolume' ||
        name === 'voidPlatform' ||
        name === 'sb3dPlayerBody' ||
        name === 'explosion';

    if (nonGrabbable) {
        hint.style.display = 'none';
        return;
    }

    const isErasable = spawnedMeshes.indexOf(mesh) !== -1;
    const mass = mesh.physicsImpostor ? mesh.physicsImpostor.mass : 0;
    const isGrabbable = mass > 0;
    const isFrozenObj = !!(mesh.metadata && mesh.metadata.originalMass !== undefined);

    if (isErasable && isFrozenObj) {
        if (eraserHud) eraserHud.style.display = 'block';
        if (hint.textContent !== 'Tap UNFREEZE to unfreeze · Tap ERASE to remove ') hint.textContent = 'Tap UNFREEZE to unfreeze · Tap ERASE to remove';
        hint.style.display = 'block';
        return;
    }

    if (isErasable) {
        if (eraserHud) eraserHud.style.display = 'block';
        const txt = isGrabbable
            ? 'Tap GRAB to grab ·  Tap FREEZE to freeze ·  Tap ERASE to remove'
            : 'Tap ERASE to remove this object';
        if (hint.textContent !== txt) hint.textContent = txt;
        hint.style.display = 'block';
        return;
    }

    if (!isGrabbable) {
        hint.style.display = 'none';
        return;
    }

    if (hint.textContent !== 'Tap GRAB to grab') hint.textContent = 'Tap GRAB to grab';
    hint.style.display = 'block';
}

function toggleGrab() {
    const sb3d = workshop.shaman.sandbox3d;
    const btn = document.getElementById('btn-grab');
    const cursor = document.getElementById('center-cursor');

    if (heldMesh) {
        const released = heldMesh;
        if (released.physicsImpostor && released.metadata && released.metadata.gravGunMass !== undefined) {
            const savedPos = released.position.clone();
            const savedRot = released.rotationQuaternion ? released.rotationQuaternion.clone() : null;

            released.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
            released.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            released.physicsImpostor.forceUpdate();
            released.physicsImpostor.setMass(released.metadata.gravGunMass);

            released.position.copyFrom(savedPos);
            if (savedRot && released.rotationQuaternion) {
                released.rotationQuaternion.copyFrom(savedRot);
            }
            released.physicsImpostor.forceUpdate();

            released.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
            released.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            released.physicsImpostor.sleep();

            released.metadata.pendingReleaseWake = true;
            released.metadata.releaseGraceFrames = 90;
        }
        heldMesh = null;
        isRotationMode = false;
        if (btn) { btn.textContent = 'GRAB'; btn.classList.remove('grabbing'); }
        if (cursor) cursor.classList.remove('grabbing');
        updateGrabbedControls();
        return;
    }

    const pick = sb3d.getCenterPick();
    if (!pick || !pick.hit || !pick.pickedMesh) return;
    let mesh = pick.pickedMesh;
    if (mesh.parent && (mesh.parent.name.includes("customHitbox") || mesh.parent.name.includes("customInstance"))) {
        mesh = mesh.parent;
    }
    if (!mesh.physicsImpostor || mesh.physicsImpostor.mass === 0) return;
    if (mesh.name === 'ground' || mesh.name === 'ramp') return;

    if (sb3d.cameraFree && pick.pickedPoint) {
        const rawDist = BABYLON.Vector3.Distance(sb3d.cameraFree.position, pick.pickedPoint);
        holdDistance = Math.max(2.0, Math.min(20.0, rawDist));
    }

    heldMesh = mesh;
    if (!heldMesh.metadata) heldMesh.metadata = {};
    heldMesh.metadata.gravGunMass = heldMesh.physicsImpostor.mass;
    heldMesh.metadata.releaseGraceFrames = 0;
    heldMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
    heldMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    heldMesh.physicsImpostor.setMass(0);
    heldMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
    heldMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    heldMesh.physicsImpostor.sleep();

    if (btn) { btn.textContent = 'UNGRAB'; btn.classList.add('grabbing'); }
    if (cursor) cursor.classList.add('grabbing');
    updateGrabbedControls();
}

function tryJump() {
    if (isFreeFlyMode) return;
    jumpRequested = true;
}

function updateModeButton() {
    const btn = document.getElementById('btn-mode');
    if (!btn) return;
    if (isFreeFlyMode) {
        btn.textContent = 'PLAYER';
        btn.classList.add('fly-active');
    } else {
        btn.textContent = 'FLY';
        btn.classList.remove('fly-active');
    }
}

function togglePlayerFlyMode() {
    isFreeFlyMode = !isFreeFlyMode;
    playerVelocityY = 0;
    playerGrounded = false;
    jumpRequested = false;

    const sb3d = workshop.shaman.sandbox3d;
    const cam = sb3d.cameraFree;
    const body = sb3d.playerBody;

    if (isFreeFlyMode) {
        if (body) {
            if (body.physicsImpostor) {
                body.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                body.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                body.physicsImpostor.sleep();
            }
            body.setEnabled(false);
        }
    } else {
        if (body && cam) {
            body.position.x = cam.position.x;
            body.position.y = cam.position.y - playerHeight / 2;
            body.position.z = cam.position.z;
            body.setEnabled(true);
            if (body.physicsImpostor) {
                body.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                body.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                body.physicsImpostor.wakeUp();
            }
        }
    }
    updateModeButton();
}

function thawMesh(mesh) {
    if (!mesh || !mesh.physicsImpostor || !mesh.metadata || mesh.metadata.originalMass === undefined) return false;
    const savedPos = mesh.position.clone();
    const savedRot = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null;
    mesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.forceUpdate();
    mesh.physicsImpostor.setMass(mesh.metadata.originalMass);
    mesh.position.copyFrom(savedPos);
    if (savedRot && mesh.rotationQuaternion) {
        mesh.rotationQuaternion.copyFrom(savedRot);
    }
    mesh.physicsImpostor.forceUpdate();
    mesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.sleep();
    mesh.metadata.pendingReleaseWake = true;
    mesh.metadata.releaseGraceFrames = 90;
    if (mesh.metadata.iceEmissive && mesh.material && mesh.material.emissiveColor) {
        mesh.material.emissiveColor = mesh.metadata.iceEmissive;
    }
    delete mesh.metadata.originalMass;
    delete mesh.metadata.iceEmissive;
    delete mesh.metadata.originalColor;
    return true;
}

function freezeMesh(mesh, iceTint) {
    if (!mesh || !mesh.physicsImpostor || mesh.physicsImpostor.mass <= 0) return false;
    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.originalMass = mesh.physicsImpostor.mass;
    mesh.physicsImpostor.setMass(0);
    mesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.sleep();
    if (iceTint && mesh.material && mesh.material.emissiveColor) {
        mesh.metadata.iceEmissive = mesh.material.emissiveColor.clone();
        mesh.material.emissiveColor = new BABYLON.Color3(0.1, 0.6, 1);
    }
    return true;
}

function thawMesh(mesh) {
    if (!mesh || !mesh.physicsImpostor || !mesh.metadata || mesh.metadata.originalMass === undefined) return false;
    const savedPos = mesh.position.clone();
    const savedRot = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null;
    mesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.forceUpdate();
    mesh.physicsImpostor.setMass(mesh.metadata.originalMass);
    mesh.position.copyFrom(savedPos);
    if (savedRot && mesh.rotationQuaternion) {
        mesh.rotationQuaternion.copyFrom(savedRot);
    }
    mesh.physicsImpostor.forceUpdate();
    mesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    mesh.physicsImpostor.sleep();
    mesh.metadata.pendingReleaseWake = true;
    mesh.metadata.releaseGraceFrames = 90;
    if (mesh.metadata.iceEmissive && mesh.material && mesh.material.emissiveColor) {
        mesh.material.emissiveColor = mesh.metadata.iceEmissive;
    }
    delete mesh.metadata.originalMass;
    delete mesh.metadata.iceEmissive;
    delete mesh.metadata.originalColor;
    return true;
}

function getFreezeTarget() {
    if (heldMesh && !heldMesh.isDisposed()) return { mesh: heldMesh, held: true, frozen: false };
    const pick = workshop.shaman.sandbox3d.getCenterPick();
    if (!pick || !pick.hit || !pick.pickedMesh) return null;
    let mesh = pick.pickedMesh;
    if (mesh.parent && (mesh.parent.name.includes("customHitbox") || mesh.parent.name.includes("customInstance"))) {
        mesh = mesh.parent;
    }
    if (!mesh.physicsImpostor || mesh.name === 'sb3dPlayerBody') return null;
    if (spawnedMeshes.indexOf(mesh) === -1) return null;
    const frozen = !!(mesh.metadata && mesh.metadata.originalMass !== undefined);
    if (!frozen && mesh.physicsImpostor.mass <= 0) return null;
    return { mesh: mesh, held: false, frozen: frozen };
}

function freezeHeldMesh() {
    const held = heldMesh;
    if (!held || held.isDisposed() || !held.physicsImpostor) return;
    if (held.metadata && held.metadata.gravGunMass !== undefined) {
        held.physicsImpostor.setMass(held.metadata.gravGunMass);
        delete held.metadata.gravGunMass;
    }
    held.metadata.releaseGraceFrames = 0;
    heldMesh = null;
    isRotationMode = false;
    freezeMesh(held, false);
    const grabBtn = document.getElementById('btn-grab');
    if (grabBtn) { grabBtn.textContent = 'GRAB'; grabBtn.classList.remove('grabbing'); }
    const cursor = document.getElementById('center-cursor');
    if (cursor) cursor.classList.remove('grabbing');
    updateGrabbedControls();
}

function toggleFreezeTarget() {
    const target = getFreezeTarget();
    if (!target) return;
    if (target.held) {
        freezeHeldMesh();
    } else if (target.frozen) {
        thawMesh(target.mesh);
    } else {
        freezeMesh(target.mesh, false);
    }
    updateFreezeButton();
}

function updateFreezeButton() {
    const btn = document.getElementById('btn-freeze-action');
    if (!btn) return;
    const target = getFreezeTarget();
    if (!target) {
        btn.classList.remove('visible');
        return;
    }
    const label = target.frozen ? 'UNFREEZE' : 'FREEZE';
    if (btn.textContent !== label) btn.textContent = label;
    btn.classList.toggle('thaw', target.frozen);
    btn.classList.add('visible');
}

function toggleViewMode() {
    if(selectedShape === 'view') {
        viewTargetMesh = null;
        selectShape('box'); 
    } else {
        selectShape('view');
    }
}

function clearObjects() {
    if (!sceneRef) return;
    if (selectedShape === 'view') toggleViewMode();
    viewTargetMesh = null;

    if (heldMesh) {
        heldMesh = null;
        const _gb = document.getElementById('btn-grab');
        if (_gb) { _gb.textContent = 'GRAB'; _gb.classList.remove('grabbing'); }
        const _cur = document.getElementById('center-cursor');
        if (_cur) _cur.classList.remove('grabbing');
    }
    isRotationMode = false;

    spawnedMeshes.forEach(mesh => { if (mesh && !mesh.isDisposed()) mesh.dispose(); });
    spawnedMeshes = [];
    updateGrabbedControls();
}

function setupMobileButtons() {
    const bindHold = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        const pointers = new Set();
        const sync = () => { moveState[key] = pointers.size > 0; };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            pointers.add(e.pointerId);
            sync();
        }, { passive: false });
        const release = (e) => {
            if (pointers.has(e.pointerId)) {
                pointers.delete(e.pointerId);
                sync();
            }
        };
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
    };
    bindHold('btn-move-up', 'up');
    bindHold('btn-move-down', 'down');
    bindHold('btn-move-left', 'left');
    bindHold('btn-move-right', 'right');

    window.addEventListener('blur', () => {
        moveState.up = false;
        moveState.down = false;
        moveState.left = false;
        moveState.right = false;
    });
}
setupMobileButtons();

function bindTapButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    let activePointer = -1;
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (activePointer === e.pointerId) return;
        activePointer = e.pointerId;
        handler();
    }, { passive: false });
    const release = (e) => {
        if (activePointer === e.pointerId) activePointer = -1;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
}

function setupPlayerButtons() {
    bindTapButton('btn-jump', tryJump);
    bindTapButton('btn-grab', toggleGrab);
    bindTapButton('btn-freeze-action', toggleFreezeTarget);
    bindTapButton('btn-mode', togglePlayerFlyMode);
    updateModeButton();
}

function bindHoldButton(id, handler, repeatDelay = 250, repeatInterval = 80) {
    const el = document.getElementById(id);
    if (!el) return;
    let activePointer = -1;
    let holdTimer = null;
    let repeatTimer = null;

    const stopTimers = () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
    };

    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (activePointer === e.pointerId) return;
        activePointer = e.pointerId;
        handler();
        holdTimer = setTimeout(() => {
            repeatTimer = setInterval(handler, repeatInterval);
        }, repeatDelay);
    }, { passive: false });

    const stop = (e) => {
        if (activePointer === e.pointerId) {
            activePointer = -1;
            stopTimers();
        }
    };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('pointerleave', stop);
}

function erasePointedObject() {
    const sb3d = workshop.shaman.sandbox3d;
    if (!sb3d.scene || !sb3d.cameraFree) return;
    const pick = sb3d.getCenterPick();
    if (!pick || !pick.hit || !pick.pickedMesh) return;
    let mesh = pick.pickedMesh;
    if (mesh.parent && (mesh.parent.name.includes('customHitbox') || mesh.parent.name.includes('customInstance'))) {
        mesh = mesh.parent;
    }
    if (spawnedMeshes.indexOf(mesh) === -1) return;

    if (mesh === heldMesh) {
        heldMesh = null;
        isRotationMode = false;
        const _gb = document.getElementById('btn-grab');
        if (_gb) { _gb.textContent = 'GRAB'; _gb.classList.remove('grabbing'); }
        const _cur = document.getElementById('center-cursor');
        if (_cur) _cur.classList.remove('grabbing');
        updateGrabbedControls();
    }

    workshop.shaman.sandbox3d.MirrorSystem.removeFromRenderList(mesh);
    mesh.dispose();
    const idx = spawnedMeshes.indexOf(mesh);
    if (idx > -1) spawnedMeshes.splice(idx, 1);
}

function setupEraserHud() {
    const btn = document.getElementById('btn-eraser-hud');
    if (!btn) return;
    let activePointer = -1;
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (activePointer === e.pointerId) return;
        activePointer = e.pointerId;
        erasePointedObject();
    }, { passive: false });
    const release = (e) => { if (activePointer === e.pointerId) activePointer = -1; };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
}

function setupGrabbedControls() {
    bindTapButton('btn-rotate-toggle', () => {
        if (!heldMesh || heldMesh.isDisposed()) return;
        isRotationMode = !isRotationMode;
        const btn = document.getElementById('btn-rotate-toggle');
        if (btn) btn.classList.toggle('active', isRotationMode);
        if (isRotationMode && !heldMesh.rotationQuaternion) {
            heldMesh.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(heldMesh.rotation);
        }
    });

    bindHoldButton('btn-dist-up', () => {
        if (!heldMesh || heldMesh.isDisposed()) return;
        holdDistance = Math.min(20.0, holdDistance + 0.5);
    });

    bindHoldButton('btn-dist-down', () => {
        if (!heldMesh || heldMesh.isDisposed()) return;
        holdDistance = Math.max(2.0, holdDistance - 0.5);
    });
}

function setupTouchLook() {
    const canvas = document.getElementById('renderCanvas');
    if (!canvas) return;

    const TOUCH_LOOK_SENSITIVITY = 0.005;
    const DRAG_THRESHOLD = 4;

    let activeTouchId = null;
    let lastX = 0;
    let lastY = 0;
    let dragStarted = false;

    canvas.addEventListener('touchstart', (e) => {
        if (activeTouchId !== null) return;
        const t = e.changedTouches[0];
        activeTouchId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
        dragStarted = false;
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (activeTouchId === null) return;
        const cam = workshop.shaman.sandbox3d.cameraFree;
        if (!cam) return;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier !== activeTouchId) continue;

            const dx = t.clientX - lastX;
            const dy = t.clientY - lastY;
            lastX = t.clientX;
            lastY = t.clientY;

            if (!dragStarted && (Math.abs(dx) + Math.abs(dy)) > DRAG_THRESHOLD) {
                dragStarted = true;
            }
            if (!dragStarted) return;

            if (isRotationMode && heldMesh && !heldMesh.isDisposed()) {
                const rotSpeed = 0.01;
                if (!heldMesh.rotationQuaternion) {
                    heldMesh.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(heldMesh.rotation);
                }
                const yawQuat = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -dx * rotSpeed);
                const camRight = cam.getDirection(BABYLON.Vector3.Right());
                const pitchQuat = BABYLON.Quaternion.RotationAxis(camRight, -dy * rotSpeed);
                heldMesh.rotationQuaternion = yawQuat.multiply(pitchQuat).multiply(heldMesh.rotationQuaternion);
                heldMesh.rotationQuaternion.normalize();
                if (heldMesh.physicsImpostor) {
                    heldMesh.physicsImpostor.forceUpdate();
                }
                break;
            }

            cam.rotation.y += dx * TOUCH_LOOK_SENSITIVITY;
            cam.rotation.x += dy * TOUCH_LOOK_SENSITIVITY;
            cam.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cam.rotation.x));
            break;
        }
    }, { passive: true });

    const endHandler = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
                activeTouchId = null;
                dragStarted = false;
                break;
            }
        }
    };
    canvas.addEventListener('touchend', endHandler, { passive: true });
    canvas.addEventListener('touchcancel', endHandler, { passive: true });
}

setupTouchLook();
setupPlayerButtons();
setupGrabbedControls();
setupEraserHud();