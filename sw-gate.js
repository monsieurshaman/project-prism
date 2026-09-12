'use strict';
const GATE_CODE = '36667668';

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1533012557932138709/Ri8YPIsV669zX_eYZSZo2ao2Av7wDir_aEMZG1VZItpflM4xyK00XXDB92mbuTai1EeS';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const NOTIFY_FAILED_ATTEMPTS = false;


const PASS_THROUGH_CACHE = true;

const DB_NAME = 'prism-gate';
const DB_VERSION = 1;
const STORE_NAME = 'gate';
const SESSION_KEY = 'session';

function openDB() {
  return new Promise(function (resolve, reject) {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function idbGet(key) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function idbPut(key, value) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function idbDelete(key) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function readSession() {
  return idbGet(SESSION_KEY)
    .then(function (session) {
      if (!session || !session.username || !session.expiresAt) return null;

      if (Date.now() >= session.expiresAt) {
        return idbDelete(SESSION_KEY).then(function () { return null; });
      }

      return session;
    })
    .catch(function () { return null; });
}

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1;
}

self.addEventListener('fetch', function (event) {
  const request = event.request;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  if (url.pathname === '/sw.js' || url.pathname === '/sw-gate.js') return;

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (PASS_THROUGH_CACHE && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

async function handleNavigation(request) {
  const session = await readSession();

  if (session) {
    try {
      return await fetch(request);
    } catch (err) {
      const cached =
        (await caches.match(request)) ||
        (await caches.match('/index.html')) ||
        (await caches.match('/'));

      if (cached) return cached;

      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>prism</title></head>' +
        '<body style="background:#07070f;color:#eeeef8;font-family:sans-serif;' +
        'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">' +
        'you are offline and prism has nothing cached for this page.</body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  }

  return gateResponse();
}

async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
  } catch (err) { /* ignore */ }

  return fetch(request);
}

function gateResponse() {
  return new Response(GATE_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Prism-Gate': 'locked'
    }
  });
}

self.addEventListener('message', function (event) {
  const data = event.data;

  if (!data || data.type === undefined) return;

  if (data.type === 'GATE_UNLOCK') {
    event.waitUntil(handleUnlock(event, data));
    return;
  }

  if (data.type === 'GATE_LOCK') {
    event.waitUntil(
      idbDelete(SESSION_KEY).then(function () {
        reply(event, { type: 'GATE_RESULT', ok: true, locked: true });
      })
    );
    return;
  }

  if (data.type === 'GATE_STATE') {
    event.waitUntil(
      readSession().then(function (session) {
        reply(event, {
          type: 'GATE_STATE_RESULT',
          ok: true,
          unlocked: !!session,
          username: session ? session.username : null,
          expiresAt: session ? session.expiresAt : null
        });
      })
    );
  }
});

function reply(event, payload) {
  if (event.source && typeof event.source.postMessage === 'function') {
    event.source.postMessage(payload);
  }
}

function sanitizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 _.\-]/g, '')
    .slice(0, 32);
}

async function handleUnlock(event, data) {
  const username = sanitizeUsername(data.username);
  const code = String(data.code || '').trim();

  if (username.length < 2) {
    reply(event, {
      type: 'GATE_RESULT',
      ok: false,
      reason: 'pick a name with at least 2 characters.'
    });
    return;
  }

  if (!/^[0-9]+$/.test(code)) {
    reply(event, {
      type: 'GATE_RESULT',
      ok: false,
      reason: 'the access code is numbers only.'
    });
    return;
  }

  if (code !== GATE_CODE) {
    reply(event, {
      type: 'GATE_RESULT',
      ok: false,
      reason: 'that code is not right. try again.'
    });

    if (NOTIFY_FAILED_ATTEMPTS) {
      await notifyDiscord({
        title: 'prism access denied',
        color: 0xf87171,
        username: username,
        userAgent: data.userAgent,
        platform: data.platform,
        url: event.source && event.source.url ? event.source.url : 'unknown',
        note: 'wrong code entered'
      });
    }
    return;
  }

  const now = Date.now();
  const session = {
    username: username,
    unlockedAt: now,
    expiresAt: now + SESSION_TTL_MS
  };

  try {
    await idbPut(SESSION_KEY, session);
  } catch (err) {
    reply(event, {
      type: 'GATE_RESULT',
      ok: false,
      reason: 'prism could not save your session. check your browser storage settings.'
    });
    return;
  }

  reply(event, {
    type: 'GATE_RESULT',
    ok: true,
    username: username,
    expiresAt: session.expiresAt
  });

  await notifyDiscord({
    title: 'prism access granted',
    color: 0x7c9ef7,
    username: username,
    userAgent: data.userAgent,
    platform: data.platform,
    language: data.language,
    screen: data.screen,
    url: event.source && event.source.url ? event.source.url : 'unknown',
    unlockedAt: session.unlockedAt,
    expiresAt: session.expiresAt
  });
}

async function notifyDiscord(info) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.indexOf('xxxxxxxx') !== -1) {
    console.warn('[prism gate] webhook url is not set, skipping notification.');
    return;
  }

  const now = Date.now();
  const unlockedAt = info.unlockedAt || now;
  const expiresAt = info.expiresAt || now + SESSION_TTL_MS;

  const fields = [
    { name: 'username', value: info.username || 'unknown', inline: true },
    { name: 'unlocked at', value: '<t:' + Math.floor(unlockedAt / 1000) + ':F>', inline: true },
    { name: 'expires', value: '<t:' + Math.floor(expiresAt / 1000) + ':R>', inline: true }
  ];

  if (info.platform) {
    fields.push({ name: 'platform', value: String(info.platform).slice(0, 200), inline: true });
  }

  if (info.language) {
    fields.push({ name: 'language', value: String(info.language).slice(0, 60), inline: true });
  }

  if (info.screen) {
    fields.push({ name: 'screen', value: String(info.screen).slice(0, 60), inline: true });
  }

  fields.push({
    name: 'user agent',
    value: ('```' + String(info.userAgent || 'unknown').slice(0, 900) + '```'),
    inline: false
  });

  fields.push({
    name: 'page',
    value: String(info.url || 'unknown').slice(0, 300),
    inline: false
  });

  if (info.note) {
    fields.push({ name: 'note', value: String(info.note).slice(0, 200), inline: false });
  }

  const payload = {
    username: 'prism gate',
    embeds: [{
      title: info.title || 'prism access',
      color: info.color || 0x7c9ef7,
      fields: fields,
      footer: { text: 'project prism · gate v1' },
      timestamp: new Date(now).toISOString()
    }]
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[prism gate] could not reach the webhook.', err);
  }
}

const GATE_HTML = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#07070f" />
    <meta name="robots" content="noindex, nofollow" />
    <title>prism</title>
    <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
        rel="stylesheet" />
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
    <style>
        :root {
            --bg: #07070f;
            --surface-0: rgba(14, 14, 24, 0.72);
            --surface-1: rgba(20, 20, 36, 0.68);
            --surface-hover: rgba(36, 36, 58, 0.82);
            --border: rgba(255, 255, 255, 0.07);
            --border-strong: rgba(255, 255, 255, 0.14);
            --border-accent: rgba(124, 158, 247, 0.22);
            --primary: #7c9ef7;
            --primary-glow: rgba(124, 158, 247, 0.3);
            --primary-container: rgba(124, 158, 247, 0.18);
            --secondary: #a78bfa;
            --secondary-glow: rgba(167, 139, 250, 0.25);
            --on-primary: #080812;
            --text: #eeeef8;
            --text-sub: rgba(200, 202, 228, 0.65);
            --text-muted: rgba(160, 164, 200, 0.38);
            --r-md: 24px;
            --r-lg: 32px;
            --r-xl: 44px;
            --r-pill: 100px;
            --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
            --ease-out: cubic-bezier(0.2, 0, 0, 1);
        }

        *,
        *::before,
        *::after {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }

        html,
        body {
            min-height: 100%;
        }

        body {
            font-family: 'DM Sans', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            overflow-x: hidden;
        }

        .gate-bg {
            position: fixed;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            background:
                radial-gradient(ellipse 70% 60% at 15% 20%, rgba(124, 158, 247, 0.10) 0%, transparent 60%),
                radial-gradient(ellipse 55% 50% at 85% 80%, rgba(167, 139, 250, 0.09) 0%, transparent 60%);
        }

        .gate-card {
            position: relative;
            z-index: 2;
            width: 100%;
            max-width: 420px;
            background: var(--surface-0);
            border: 1px solid var(--border);
            border-radius: var(--r-xl);
            backdrop-filter: blur(28px);
            -webkit-backdrop-filter: blur(28px);
            padding: 34px 28px 26px;
            overflow: hidden;
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05);
            animation: card-in 0.7s var(--ease-out) both;
        }

        .gate-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 20px;
            right: 20px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18) 50%, transparent);
        }

        .gate-card::after {
            content: '';
            position: absolute;
            top: -90px;
            right: -70px;
            width: 260px;
            height: 260px;
            background: radial-gradient(circle, var(--secondary-glow) 0%, transparent 70%);
            pointer-events: none;
        }

        @keyframes card-in {
            from {
                opacity: 0;
                transform: translateY(24px) scale(0.97);
            }

            to {
                opacity: 1;
                transform: none;
            }
        }

        @keyframes shake {

            0%,
            100% {
                transform: translateX(0);
            }

            20% {
                transform: translateX(-8px);
            }

            40% {
                transform: translateX(7px);
            }

            60% {
                transform: translateX(-5px);
            }

            80% {
                transform: translateX(3px);
            }
        }

        .gate-card.shake {
            animation: shake 0.45s var(--ease-out);
        }

        .gate-top {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 26px;
            position: relative;
            z-index: 1;
        }

        .gate-logo {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            object-fit: cover;
            flex-shrink: 0;
        }

        .gate-brand {
            display: flex;
            flex-direction: column;
            gap: 1px;
            flex: 1;
            min-width: 0;
        }

        .gate-brand-name {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            color: var(--text);
            line-height: 1;
        }

        .gate-brand-sub {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: var(--primary);
            line-height: 1;
        }

        .gate-badge {
            background: var(--primary-container);
            border: 1px solid var(--border-accent);
            border-radius: var(--r-pill);
            padding: 5px 13px;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 9.5px;
            font-weight: 700;
            color: var(--primary);
            letter-spacing: 2px;
            text-transform: uppercase;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .gate-title {
            position: relative;
            z-index: 1;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 0.4px;
            line-height: 1.2;
            margin-bottom: 10px;
        }

        .gate-desc {
            position: relative;
            z-index: 1;
            font-size: 13.5px;
            line-height: 1.7;
            color: var(--text-sub);
            margin-bottom: 26px;
        }

        .gate-desc strong {
            color: var(--primary);
            font-weight: 600;
        }

        form {
            position: relative;
            z-index: 1;
        }

        .field {
            display: block;
            margin-bottom: 14px;
        }

        .field-label {
            display: block;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 9.5px;
            font-weight: 700;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            color: var(--text-muted);
            margin-bottom: 8px;
        }

        .field-input {
            width: 100%;
            background: var(--surface-1);
            border: 1px solid var(--border);
            border-radius: var(--r-md);
            color: var(--text);
            font-family: 'DM Sans', sans-serif;
            font-size: 15px;
            padding: 15px 18px;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .field-input::placeholder {
            color: var(--text-muted);
        }

        .field-input:focus {
            border-color: var(--border-accent);
            background: var(--surface-hover);
            box-shadow: 0 0 0 3px var(--primary-glow);
        }

        .field-input.code {
            font-family: 'Space Grotesk', sans-serif;
            letter-spacing: 6px;
            font-size: 17px;
        }

        .gate-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            margin-top: 22px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: var(--on-primary);
            padding: 16px 28px;
            border: none;
            border-radius: var(--r-pill);
            font-family: 'DM Sans', sans-serif;
            font-weight: 700;
            font-size: 15px;
            letter-spacing: 0.3px;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 20px var(--primary-glow), 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: transform 0.25s var(--spring), box-shadow 0.25s var(--ease-out), filter 0.25s ease;
        }

        .gate-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, transparent 60%);
        }

        .gate-btn .material-icons-round {
            font-size: 20px;
            position: relative;
            z-index: 1;
        }

        .gate-btn span:not(.material-icons-round) {
            position: relative;
            z-index: 1;
        }

        .gate-btn:hover:not(:disabled) {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 10px 36px var(--primary-glow), 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .gate-btn:active:not(:disabled) {
            transform: translateY(0) scale(0.98);
            filter: brightness(0.92);
        }

        .gate-btn:disabled {
            cursor: default;
            filter: grayscale(0.35) brightness(0.75);
        }

        .gate-status {
            position: relative;
            z-index: 1;
            margin-top: 18px;
            min-height: 20px;
            font-size: 12.5px;
            font-weight: 500;
            line-height: 1.5;
            text-align: center;
            color: var(--text-muted);
            transition: color 0.2s ease;
        }

        .gate-status.bad {
            color: #f87171;
        }

        .gate-status.good {
            color: #4ade80;
        }

        .gate-status.wait {
            color: var(--primary);
        }

        .gate-foot {
            position: relative;
            z-index: 1;
            margin-top: 26px;
            padding-top: 18px;
            border-top: 1px solid var(--border);
            font-family: 'Space Grotesk', sans-serif;
            font-size: 9.5px;
            font-weight: 500;
            letter-spacing: 1.8px;
            text-transform: uppercase;
            color: var(--text-muted);
            text-align: center;
        }

        @media (prefers-reduced-motion: reduce) {

            .gate-card,
            .gate-btn,
            .field-input {
                animation: none !important;
                transition: none !important;
            }
        }
    </style>
</head>

<body>
    <div class="gate-bg"></div>

    <div class="gate-card" id="gate-card">
        <div class="gate-top">
            <img class="gate-logo"
                src="https://cdn.jsdelivr.net/gh/monsieurshaman/project-prism@main/project-assets/logo.png"
                alt="" onerror="this.style.display='none'" />
            <div class="gate-brand">
                <div class="gate-brand-name">project</div>
                <div class="gate-brand-sub">prism</div>
            </div>
            <div class="gate-badge">locked</div>
        </div>

        <h1 class="gate-title">restricted access</h1>
        <p class="gate-desc">
            this build is shared with <strong>a few people only</strong>. pick a name for yourself and
            enter the access code to continue.
        </p>

        <form id="gate-form" autocomplete="off" novalidate>
            <label class="field">
                <span class="field-label">username</span>
                <input id="gate-username" class="field-input" type="text" maxlength="32"
                    placeholder="what should we call you?" autocomplete="off" autocapitalize="off"
                    spellcheck="false" />
            </label>

            <label class="field">
                <span class="field-label">access code</span>
                <input id="gate-code" class="field-input code" type="password" inputmode="numeric"
                    pattern="[0-9]*" placeholder="numbers only" autocomplete="off" />
            </label>

            <button id="gate-submit" class="gate-btn" type="submit">
                <span class="material-icons-round">lock_open</span>
                <span>unlock prism</span>
            </button>
        </form>

        <div class="gate-status" id="gate-status" role="status" aria-live="polite"></div>

        <div class="gate-foot">access resets every 24 hours</div>
    </div>

    <script>
        (function () {
            var card = document.getElementById('gate-card');
            var form = document.getElementById('gate-form');
            var nameInput = document.getElementById('gate-username');
            var codeInput = document.getElementById('gate-code');
            var statusEl = document.getElementById('gate-status');
            var submitBtn = document.getElementById('gate-submit');
            var busy = false;
            var timer = null;

            function setStatus(text, kind) {
                statusEl.textContent = text || '';
                statusEl.className = 'gate-status' + (kind ? ' ' + kind : '');
            }

            function shake() {
                card.classList.remove('shake');
                void card.offsetWidth;
                card.classList.add('shake');
            }

            function release() {
                busy = false;
                submitBtn.disabled = false;
                clearTimeout(timer);
            }

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                if (busy) return;

                var username = (nameInput.value || '').trim().toLowerCase().replace(/\s+/g, ' ');
                var code = (codeInput.value || '').trim();

                if (username.length < 2) {
                    setStatus('pick a name with at least 2 characters.', 'bad');
                    shake();
                    nameInput.focus();
                    return;
                }

                if (!/^[0-9]+$/.test(code)) {
                    setStatus('the access code is numbers only.', 'bad');
                    shake();
                    codeInput.focus();
                    return;
                }

                var controller = navigator.serviceWorker && navigator.serviceWorker.controller;

                if (!controller) {
                    setStatus('prism is still waking up. reload the page in a second.', 'bad');
                    return;
                }

                busy = true;
                submitBtn.disabled = true;
                setStatus('checking the code...', 'wait');

                controller.postMessage({
                    type: 'GATE_UNLOCK',
                    username: username,
                    code: code,
                    userAgent: navigator.userAgent,
                    platform: navigator.platform || '',
                    language: navigator.language || '',
                    screen: window.screen ? (window.screen.width + 'x' + window.screen.height) : ''
                });

                timer = setTimeout(function () {
                    if (!busy) return;
                    release();
                    setStatus('no response from prism. give it another go.', 'bad');
                    shake();
                }, 10000);
            });

            navigator.serviceWorker.addEventListener('message', function (e) {
                var data = e.data;
                if (!data || data.type !== 'GATE_RESULT') return;

                if (data.ok) {
                    release();
                    setStatus('access granted. loading prism...', 'good');
                    submitBtn.disabled = true;
                    setTimeout(function () { window.location.reload(); }, 800);
                    return;
                }

                release();
                codeInput.value = '';
                setStatus(data.reason || 'that did not work. try again.', 'bad');
                shake();
                codeInput.focus();
            });

            window.addEventListener('load', function () {
                if (window.innerWidth > 700) nameInput.focus();
            });
        })();
    </script>
</body>

</html>`;