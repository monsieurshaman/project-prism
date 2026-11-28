window.RRVault = (() => {
    const DB_NAME = 'rr2d_vault';
    const STORE = 'kv';
    const KEY = 'shards';
    const CACHE_NAME = 'rr2d-vault';
    const CACHE_URL = './rr2d-vault/shards.json';

    const openDb = () => new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('idb unavailable'));
            return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('idb blocked'));
    });

    const idbGet = async () => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
            r.onsuccess = () => { db.close(); resolve(r.result); };
            r.onerror = () => { db.close(); reject(r.error); };
        });
    };

    const idbSet = async (json) => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(json, KEY);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        });
    };

    const cacheGet = async () => {
        if (!window.caches) throw new Error('cache unavailable');
        const cache = await caches.open(CACHE_NAME);
        const res = await cache.match(CACHE_URL);
        return res ? await res.text() : undefined;
    };

    const cacheSet = async (json) => {
        if (!window.caches) throw new Error('cache unavailable');
        const cache = await caches.open(CACHE_NAME);
        await cache.put(CACHE_URL, new Response(json, { headers: { 'Content-Type': 'application/json' } }));
    };

    const parse = (json) => {
        try {
            const obj = JSON.parse(json);
            if (!obj || typeof obj !== 'object') return null;
            const n = Number(obj.shards);
            return {
                shards: (Number.isFinite(n) && n >= 0) ? Math.floor(n) : 0,
                upgrades: (obj.upgrades && typeof obj.upgrades === 'object') ? obj.upgrades : {}
            };
        } catch (e) {
            return null;
        }
    };

    const load = async () => {
        try {
            const v = parse(await idbGet());
            if (v) return v;
        } catch (e) { }
        try {
            const v = parse(await cacheGet());
            if (v) return v;
        } catch (e) { }
        return { shards: 0, upgrades: {} };
    };

    const state = { shards: 0, upgrades: {} };

    const ready = load().then(v => {
        state.shards = v.shards;
        state.upgrades = v.upgrades;
        window._rrShardCache = v.shards;
        return v;
    });

    let chain = ready;

    const persist = () => {
        const json = JSON.stringify({
            shards: Math.max(0, Math.floor(Number(state.shards) || 0)),
            upgrades: state.upgrades || {}
        });
        chain = chain.then(async () => {
            try {
                await idbSet(json);
            } catch (e) {
                try { await cacheSet(json); } catch (e2) { }
            }
        });
        return chain;
    };

    const save = (n) => {
        state.shards = Math.max(0, Math.floor(Number(n) || 0));
        return persist();
    };

    const saveUpgrades = (u) => {
        state.upgrades = Object.assign({}, u);
        return persist();
    };

    const getUpgrades = () => Object.assign({}, state.upgrades);

    return { ready, save, saveUpgrades, getUpgrades };
})();

window.rrConfig = JSON.parse(localStorage.getItem('rr_custom_config')) || {
    colorBase: '#c8b8ff',
    colorCore: '#7060cc',
    weaponSkin: 'default'
};

window._rrDefaultShopUpgrades = {
    unlockFlamethrower: 0,
    unlockMolotov: 0,
    flamerDmg: 0,
    molotovDmg: 0,
    moreHp: 0,
    moreEchoes: 0,
    betterShield: 0,
    zapperDmg: 0,
    shotgunDmg: 0,
    bazookaDmg: 0,
    grenadeDmg: 0,
    bazookaAoEDmg: 0,
    grenadeAoEDmg: 0
};

window._rrShopUpgrades = Object.assign({}, window._rrDefaultShopUpgrades);

window._rrSaveShopUpgrades = () => {
    window.RRVault.saveUpgrades(window._rrShopUpgrades);
};

window.RRVault.ready.then((v) => {
    window._rrShopUpgrades = Object.assign({}, window._rrDefaultShopUpgrades, v.upgrades || {});
    if (typeof window._rrRenderShop === 'function' && document.getElementById('shop-view').style.display === 'flex') {
        window._rrRenderShop();
    }
});

window._rrRenderShop = () => {
    const upg = window._rrShopUpgrades;
    const shards = (typeof window._rrShardCache === 'number' && window._rrShardCache >= 0)
        ? window._rrShardCache
        : 0;

    window._rrPowerupUses = window._rrPowerupUses || {
        instant_hp: 0,
        instant_shield: 0,
        instant_freeze: 0,
        instant_ammo: 0,
        instant_speed: 0,
        instant_nuke: 0
    };

    document.getElementById('shop-shards-display').innerText = shards;

    const activeScene = (window.game || window.rrGame || window.RiftRun?._game)?.scene?.getScene('MainScene');
    const isPlaying = activeScene && document.getElementById('rr-hud').style.display === 'flex';

    const weaponShopItems = [
        { key: 'unlockFlamethrower', label: 'Flamethrower Unlock', desc: 'Unlocks Flamethrower [5] for this run', cost: 219, max: 1, current: upg.unlockFlamethrower },
        { key: 'flamerDmg', label: 'Flamethrower DMG', desc: '+40% Flamethrower DMG per purchase', cost: 149, max: 5, current: upg.flamerDmg, requires: 'unlockFlamethrower' },
        { key: 'unlockMolotov', label: 'Molotov Unlock', desc: 'Unlocks Molotov [6] for this run', cost: 189, max: 1, current: upg.unlockMolotov },
        { key: 'molotovDmg', label: 'Molotov Fire DMG', desc: '+40% Molotov fire DMG per purchase', cost: 169, max: 4, current: upg.molotovDmg, requires: 'unlockMolotov' }
    ];
    const items = [
        ...weaponShopItems,
        {
            key: 'moreHp',
            label: 'More HP',
            desc: '+75 Max Integrity per purchase',
            cost: 149,
            max: 5,
            current: upg.moreHp
        },
        {
            key: 'moreEchoes',
            label: 'More Echoes',
            desc: '+1 Echo Charge per purchase',
            cost: 199,
            max: 4,
            current: upg.moreEchoes
        },
        {
            key: 'betterShield',
            label: 'Better Shield',
            desc: '+75 Max Shield HP per purchase',
            cost: 249,
            max: 5,
            current: upg.betterShield
        },
        {
            key: 'zapperDmg',
            label: 'Zapper DMG',
            desc: '+35% Zapper DMG per purchase',
            cost: 159,
            max: 6,
            current: upg.zapperDmg
        },
        {
            key: 'shotgunDmg',
            label: 'Shotgun DMG',
            desc: '+30% Shotgun DMG per purchase',
            cost: 169,
            max: 6,
            current: upg.shotgunDmg
        },
        {
            key: 'bazookaDmg',
            label: 'Bazooka DMG',
            desc: '+60% Bazooka DMG per purchase',
            cost: 199,
            max: 5,
            current: upg.bazookaDmg
        },
        {
            key: 'grenadeDmg',
            label: 'Grenade DMG',
            desc: '+50% Grenade DMG per purchase',
            cost: 179,
            max: 5,
            current: upg.grenadeDmg
        },
        {
            key: 'bazookaAoEDmg',
            label: 'Bazooka AoE',
            desc: '+60% AoE DMG (Bazooka)',
            cost: 259,
            max: 3,
            current: upg.bazookaAoEDmg
        },
        {
            key: 'grenadeAoEDmg',
            label: 'Grenade AoE',
            desc: '+50% AoE DMG (Grenade)',
            cost: 239,
            max: 3,
            current: upg.grenadeAoEDmg
        },
        {
            key: 'instant_hp',
            label: 'Instant Heal',
            desc: 'Instantly restores +35 Integrity',
            cost: 79,
            isInstant: true
        },
        {
            key: 'instant_shield',
            label: 'Instant Shield',
            desc: 'Instantly deploys Kinetic Shield',
            cost: 129,
            isInstant: true
        },
        {
            key: 'instant_freeze',
            label: 'Rift Freeze',
            desc: 'Instantly freezes all hostiles for 4s',
            cost: 149,
            isInstant: true
        },
        {
            key: 'instant_ammo',
            label: 'Infinite Ammo',
            desc: 'Instantly triggers 10s of infinite ammo',
            cost: 119,
            isInstant: true
        },
        {
            key: 'instant_speed',
            label: 'Speed Surge',
            desc: 'Instantly triggers 10s of hyper speed',
            cost: 99,
            isInstant: true
        },
        {
            key: 'instant_nuke',
            label: 'Tactical Nuke',
            desc: 'Instantly arms a single tactical nuke',
            cost: 999,
            isInstant: true
        }
    ];

    const container = document.getElementById('shop-items');
    container.innerHTML = '';

    items.forEach(item => {
        const maxed = item.isInstant ? ((window._rrPowerupUses?.[item.key] || 0) >= 4) : item.current >= item.max;
        const canAfford = shards >= item.cost;
        const disabledForMenu = item.isInstant && !isPlaying;
        const buttonDisabled = maxed || !canAfford || disabledForMenu || (!!item.requires && !upg[item.requires]);

        let buttonText = `💎 ${item.cost}`;
        if (maxed) buttonText = 'CAPPED';
        else if (item.requires && !upg[item.requires]) buttonText = 'LOCKED';
        else if (disabledForMenu) buttonText = 'IN-RUN ONLY';

        const statusVisual = item.isInstant
            ? `<span style="color:#60ff90;font-weight:bold;letter-spacing:1px;">[ INSTANT USE ] (${window._rrPowerupUses?.[item.key] || 0}/4)</span>`
            : [...Array(item.max)].map((_, i) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${i < item.current ? '#00ffff' : 'rgba(0,255,255,0.15)'};box-shadow:${i < item.current ? '0 0 6px #00ffff' : 'none'};"></span>`).join('');

        const row = document.createElement('div');
        row.style.cssText = `display:flex;flex-direction:column;justify-content:space-between;background:rgba(10,10,20,0.85);border:1px solid rgba(120,100,255,${maxed ? '0.15' : '0.4'});border-radius:8px;padding:16px;gap:12px;`;
        row.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:bold;color:${maxed ? '#5040aa' : '#c8b8ff'};">${item.label}</div>
      <div style="font-size:11px;color:#7060cc;margin-top:4px;">${item.desc}</div>
      <div style="font-size:11px;color:#00ffff;margin-top:8px;">
        ${statusVisual}
      </div>
    </div>
    <button
      onclick="window._rrBuyShopItem('${item.key}', ${item.cost}, ${item.isInstant ? 0 : item.max}, ${!!item.isInstant})"
      style="width:100%;padding:10px;background:${buttonDisabled ? 'rgba(30,30,50,0.6)' : 'rgba(0,255,255,0.15)'};border:1px solid ${buttonDisabled ? 'rgba(80,60,150,0.3)' : 'rgba(0,255,255,0.6)'};border-radius:6px;color:${buttonDisabled ? '#4a3a7a' : '#00ffff'};font-family:monospace;font-size:13px;cursor:${buttonDisabled ? 'not-allowed' : 'pointer'};font-weight:bold;transition:all 0.2s;text-align:center;">
      ${buttonText}
    </button>
  `;
        container.appendChild(row);
    });
};

window._rrBuyShopItem = (key, cost, max, isInstant) => {
    let shards = (typeof window._rrShardCache === 'number' && window._rrShardCache >= 0)
        ? window._rrShardCache
        : 0;
    if (shards < cost) return;

    const activeScene = (window.game || window.rrGame || window.RiftRun?._game)?.scene?.getScene('MainScene');

    window._rrPowerupUses = window._rrPowerupUses || {
        instant_hp: 0,
        instant_shield: 0,
        instant_freeze: 0,
        instant_ammo: 0,
        instant_speed: 0,
        instant_nuke: 0
    };

    if (isInstant) {
        const isPlaying = activeScene && document.getElementById('rr-hud').style.display === 'flex';
        if (!isPlaying) return;
        if ((window._rrPowerupUses[key] || 0) >= 4) return;

        shards -= cost;
        window._rrShardCache = shards;
        window.RRVault.save(shards);
        window._rrPowerupUses[key] = (window._rrPowerupUses[key] || 0) + 1;

        if (key === 'instant_hp') {
            activeScene.pState.hp = Math.min(activeScene.pState.maxHp, activeScene.pState.hp + 35);
            activeScene.logFeed('SHOP VENDOR: Integrity Restored +35');
        } else if (key === 'instant_shield') {
            activeScene.pState.shieldActive = true;
            activeScene.pState.shieldHp = activeScene.pState.shieldMaxHp;
            activeScene.logFeed('SHOP VENDOR: Kinetic Shield Deployed');
        } else if (key === 'instant_freeze') {
            activeScene.logFeed('SHOP VENDOR: Cryogenic Freeze Overriding Hostiles');
            activeScene.enemies.getChildren().forEach(enemy => {
                if (enemy.active) {
                    enemy.isFrozen = true;
                    activeScene.time.delayedCall(4000, () => {
                        if (enemy.active) {
                            enemy.isFrozen = false;
                            enemy.clearTint();
                        }
                    });
                }
            });
        } else if (key === 'instant_ammo') {
            activeScene.pState.infiniteAmmo = 10000;
            activeScene.logFeed('SHOP VENDOR: Infinite Ammo Matrix Active (10s)');
        } else if (key === 'instant_speed') {
            activeScene.pState.speedBoost = 10000;
            activeScene.logFeed('SHOP VENDOR: Speed Protocol Engaged (10s)');
        } else if (key === 'instant_nuke') {
            activeScene.pState.weapons['nuke'].ammo = 1;
            activeScene.pState.currentWeapon = 'nuke';
            activeScene.pState.ammo = 1;
            activeScene.pState.maxAmmo = 1;
            document.querySelectorAll('.wpn-btn').forEach(b => b.classList.remove('active'));
            activeScene.logFeed('SHOP VENDOR: CRITICAL // TACTICAL NUKE ARMED');
        }

        activeScene.updateDOM();
        window._rrRenderShop();
        return;
    }

    const upg = window._rrShopUpgrades;
    if (upg[key] >= max) return;
    const req = { flamerDmg: 'unlockFlamethrower', molotovDmg: 'unlockMolotov' }[key];
    if (req && !upg[req]) return;
    shards -= cost;
    window._rrShardCache = shards;
    window.RRVault.save(shards);
    upg[key]++;
    if (window._rrSyncWeaponButtons) window._rrSyncWeaponButtons();
    window._rrSaveShopUpgrades();
    window._rrRenderShop();

    if (activeScene && typeof activeScene.updateDOM === 'function') {
        activeScene.updateDOM();
    }

    if (window.RiftRun && window.RiftRun.applyUpgradesToScene) {
        window.RiftRun.applyUpgradesToScene();
    }
};

window._rrSyncWeaponButtons = () => {
    const upg = window._rrShopUpgrades || {};
    const map = { flamethrower: 'unlockFlamethrower', molotov: 'unlockMolotov' };
    Object.keys(map).forEach(w => {
        const btn = document.getElementById(`wpn-${w}`);
        if (btn) btn.style.display = upg[map[w]] ? 'block' : 'none';
    });
};

window._rrResetRunUpgrades = () => {
    window._rrShopUpgrades = {
        unlockFlamethrower: 0,
        unlockMolotov: 0,
        flamerDmg: 0,
        molotovDmg: 0,
        moreHp: 0,
        moreEchoes: 0,
        betterShield: 0,
        zapperDmg: 0,
        shotgunDmg: 0,
        bazookaDmg: 0,
        grenadeDmg: 0,
        bazookaAoEDmg: 0,
        grenadeAoEDmg: 0
    };
    window._rrSaveShopUpgrades();
    window._rrPowerupUses = {
        instant_hp: 0,
        instant_shield: 0,
        instant_freeze: 0,
        instant_ammo: 0,
        instant_speed: 0,
        instant_nuke: 0
    };
};

window.switchSettingsPage = (page) => {
    document.getElementById('settings-page-1').style.display = page === 1 ? 'block' : 'none';
    document.getElementById('settings-page-2').style.display = page === 2 ? 'flex' : 'none';
    document.getElementById('settings-page-3').style.display = page === 3 ? 'flex' : 'none';

    const tabs = document.getElementById('settings-tabs').children;
    tabs[0].classList.toggle('active', page === 1);
    tabs[1].classList.toggle('active', page === 2);
    tabs[2].classList.toggle('active', page === 3);

    if (page === 2) {
        document.getElementById('opt-color-base').value = window.rrConfig.colorBase;
        document.getElementById('opt-color-core').value = window.rrConfig.colorCore;
        document.getElementById('opt-wpn-skin').value = window.rrConfig.weaponSkin;
    }
};

window.saveCustomizations = () => {
    window.rrConfig = {
        colorBase: document.getElementById('opt-color-base').value,
        colorCore: document.getElementById('opt-color-core').value,
        weaponSkin: document.getElementById('opt-wpn-skin').value
    };
    localStorage.setItem('rr_custom_config', JSON.stringify(window.rrConfig));
    alert('Cosmetics saved! Reboot the game to apply changes.');
};
window.RiftRun = (() => {
    const NS = 'workshop.shaman.phaser.riftRunners';
    let _game = null;
    let settingsOrigin = 'main';
    function _showHUD() {
        document.getElementById('rr-overlay').style.display = 'none';
        document.getElementById('settings-view').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('rr-hud').style.display = 'flex';
        document.getElementById('rr-bottom').style.display = 'flex';
        document.getElementById('ammo-counter').style.display = 'block';
        document.getElementById('enemy-hud-count').style.display = 'block';
        document.getElementById('weapon-panel').style.display = 'flex';
    }
    function boot() {
        _showHUD();
        if (!_game) {
            _game = new Phaser.Game(RiftRun.config);
            window.game = _game;
        } else {
            const scene = _game.scene.keys['MainScene'];
            if (scene) {
                scene.physics.resume();
                scene.scene.restart();
            }
        }
    }
    function reboot(sceneRef) {
        _showHUD();
        sceneRef.scene.restart();
    }
    function showSettings(origin) {
        settingsOrigin = origin;
        document.getElementById('rr-overlay').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('settings-view').style.display = 'flex';
    }
    function closeSettings() {
        document.getElementById('settings-view').style.display = 'none';
        if (settingsOrigin === 'main') {
            document.getElementById('rr-overlay').style.display = 'flex';
        } else {
            document.getElementById('pause-menu').style.display = 'flex';
        }
    }
    let shopOrigin = 'main';

    function showShop(origin) {
        shopOrigin = origin;
        document.getElementById('rr-overlay').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('shop-view').style.display = 'flex';

        window._rrRenderShop();
    }

    function closeShop() {
        document.getElementById('shop-view').style.display = 'none';
        if (shopOrigin === 'main') {
            document.getElementById('rr-overlay').style.display = 'flex';
        } else {
            document.getElementById('pause-menu').style.display = 'flex';
        }
    }

    function applyUpgradesToScene() {
        if (_game) {
            const scene = _game.scene.keys['MainScene'];
            if (scene && scene.applyShopUpgrades) {
                scene.applyShopUpgrades();
            }
        }
    }

    document.getElementById('start-btn').addEventListener('click', boot);
    document.getElementById('close-settings-btn').addEventListener('click', closeSettings);
    document.getElementById('close-shop-btn').addEventListener('click', closeShop);

    return { NS, boot, reboot, showSettings, closeSettings, showShop, closeShop, applyUpgradesToScene };
})();