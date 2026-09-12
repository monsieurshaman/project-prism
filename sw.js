const CACHE_NAME = 'PRISM-v2.5.1';

const CORE_URLS = [
    '/',
    '/index.html',
    './SandBox3D/sb3d_page',
    './RiftRunners2D/rr2d_page',
    './RiftRunners2D/RiftRunners2D',
    './SandBox3D/SandBox3D_PC',
    './SandBox3D/SandBox3D_Mobile',
    './Other/ismycompteureron',
    './Other/devcheck',
    './Other/notmoving',
    './Other/gifview',
    './Other/mathlol',
    './Other/coinsort',
    './Other/websend',
    './Tools/lapscan',
    './Tools/pixelpeek',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/nocturneassets/logo.png',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/nocturneassets/logo2.png',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/nocturneassets/logo192.png',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/nocturneassets/logo512.png',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
];

const GAME_URLS = [
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/sb3dfavicon.svg',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/sb3dammo.js',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/sb3dmatyou.js',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/sb3duianim_pc.js',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/sb3duianim_mobile.js',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/blind.mp4',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/explode.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/neutral/neu1.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/neutral/neu2.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/neutral/neu3.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/evening/eve1.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/evening/eve2.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/evening/eve3.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/midnight/mid1.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/midnight/mid2.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/midnight/mid3.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/midnight/mid4.mp3',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/ground.png',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/ramp.png',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/stairs.png',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/pool.png',
    'https://cdn.jsdelivr.net/gh/nocturnestu/NOCTURNE_Library@main/SandBox3D/asset/pillars.png',
    'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.60.0/phaser.min.js',
    'https://cdn.jsdelivr.net/npm/babylonjs@9.11.0/babylon.js',
    'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js',
    'https://cdn.babylonjs.com/ammo.js',
    'https://cdn.jsdelivr.net/npm/babylonjs-loaders@9.11.0/babylonjs.loaders.min.js',
    'https://cdn.jsdelivr.net/npm/babylonjs-inspector@9.11.0/babylon.inspector.bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://assets.babylonjs.com/textures/flare.png',
];

self.addEventListener('install', e => {
    self.skipWaiting();

    const params = new URLSearchParams(self.location.search);
    const isStandalone = params.get('standalone') === 'true';
    const includeGames = params.get('includeGames') === 'true';
    const urlsToCache = includeGames ? [...CORE_URLS, ...GAME_URLS] : CORE_URLS;

    e.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            let processedAssets = 0;
            let errorCount = 0;
            const totalAssets = urlsToCache.length;

            async function broadcast(msg) {
                const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
                for (const client of clientsList) client.postMessage(msg);
            }

            async function broadcastProgress() {
                processedAssets++;
                const progress = Math.round((processedAssets / totalAssets) * 100);
                await broadcast({ type: 'CACHE_PROGRESS', progress, processed: processedAssets, total: totalAssets, errors: errorCount });
            }

            await broadcast({ type: 'CACHE_START', total: totalAssets });

            const downloadTasks = urlsToCache.map(async (url) => {
                const absoluteUrl = new URL(url, self.location.origin).href;
                try {
                    const cached = await caches.match(absoluteUrl);
                    if (cached) {
                        await broadcastProgress();
                        return;
                    }

                    const response = await fetch(absoluteUrl, { cache: 'reload' });
                    if (response.status !== 200) {
                        console.warn("Skipping non-200 asset:", absoluteUrl, response.status);
                        await broadcastProgress();
                        return;
                    }

                    if (absoluteUrl.includes('fonts.googleapis.com')) {
                        const cssText = await response.clone().text();
                        const fontUrls = [...cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);

                        for (const fontUrl of fontUrls) {
                            const fontRes = await fetch(fontUrl);
                            if (fontRes.status === 200) {
                                const fontBlob = await fontRes.blob();
                                const fontCacheRes = new Response(fontBlob.slice(0), {
                                    status: 200,
                                    headers: { 'Content-Type': fontRes.headers.get('content-type') || 'application/octet-stream' }
                                });
                                await cache.put(fontUrl, fontCacheRes);

                                if (isStandalone) {
                                    try {
                                        await setIDBData(fontUrl, { blob: fontBlob.slice(0), type: fontCacheRes.headers.get('content-type') });
                                    } catch (idbErr) {
                                        await deleteIDBData(fontUrl).catch(() => { });
                                    }
                                }
                            }
                        }
                    }

                    const blob = await response.blob();
                    const contentType = response.headers.get('content-type');

                    const cacheResponse = new Response(blob.slice(0), {
                        status: 200,
                        headers: { 'Content-Type': contentType || 'application/octet-stream' }
                    });
                    await cache.put(absoluteUrl, cacheResponse);

                    if (isStandalone) {
                        try {
                            await setIDBData(absoluteUrl, { blob: blob.slice(0), type: contentType });
                        } catch (idbErr) {
                            console.error("IDB write failed, cleaning up:", absoluteUrl, idbErr);
                            await deleteIDBData(absoluteUrl).catch(() => { });
                        }
                    }
                } catch (err) {
                    console.error("Precaching error for:", absoluteUrl, err);
                    errorCount++;
                    await broadcast({ type: 'CACHE_ERROR', url: absoluteUrl, errors: errorCount });
                    await deleteIDBData(absoluteUrl).catch(() => { });
                } finally {
                    await broadcastProgress();
                }
            });

            await Promise.all(downloadTasks);
        })
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('NOCTURNE_Studios_DB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('dynamic-cache')) {
                db.createObjectStore('dynamic-cache');
            }
        };
        request.onsuccess = (e) => {
            const db = e.target.result;
            db.onversionchange = () => {
                db.close();
            };
            resolve(db);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function getIDBData(key) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('dynamic-cache', 'readonly');
            const store = transaction.objectStore('dynamic-cache');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

function setIDBData(key, value) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('dynamic-cache', 'readwrite');
            const store = transaction.objectStore('dynamic-cache');
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

function deleteIDBData(key) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('dynamic-cache', 'readwrite');
            const store = transaction.objectStore('dynamic-cache');
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

self.addEventListener('fetch', e => {
    const url = e.request.url;

    if (e.request.method !== 'GET' || url.startsWith('chrome-extension://')) return;

    const params = new URLSearchParams(self.location.search);
    const isStandalone = params.get('standalone') === 'true';

    if (isStandalone && url.includes('giphy.com')) {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith((async () => {
        const cacheMatch = await caches.match(e.request);
        if (cacheMatch) return cacheMatch;

        try {
            const idbData = await getIDBData(url);
            if (idbData) {
                if (idbData.blob) {
                    return new Response(idbData.blob, {
                        headers: { 'Content-Type': idbData.type || 'application/octet-stream' }
                    });
                }
                return new Response(JSON.stringify(idbData), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (_) { }

        try {
            return await fetch(e.request);
        } catch (err) {
            if (url.includes('/api/settings') || url.includes('/userdata/')) {
                return new Response(JSON.stringify({ error: 'Offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return new Response('', { status: 503 });
        }
    })());
});