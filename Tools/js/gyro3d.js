(() => {
'use strict';
const $ = id => document.getElementById(id);
if (typeof THREE === 'undefined') {
  $('notice').textContent = 'Three.js failed to load from the CDN. Check your connection or host three.min.js locally.';
  return;
}

const D2R = Math.PI / 180, R2D = 180 / Math.PI, FRESH_MS = 3000, FX_MS = 400;
const el = {};
['mode','btnEnable','btnPause','btnReset','sens','sensOut','notice','perm','avail','oa','ob','og','gx','gy','gz','ax','ay','az','mstate','bar','lin','btnConnect','linkModal','linkClose','btnHost','btnJoin','btnHostStop','btnClientStop','hostCode','hostStatus','clientStatus','linkMsg','linkRole','linkHost','linkClient'].forEach(k => { el[k] = $(k); });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fresh = (now, t, ms = FRESH_MS) => now - t < ms;
const fmt = (v, d) => v === null ? '\u2014' : (v >= 0 ? '+' : '') + v.toFixed(d);
const setText = (node, text) => { if (node._t !== text) { node.textContent = text; node._t = text; } };

const AXIS_X = new THREE.Vector3(1, 0, 0), AXIS_Y = new THREE.Vector3(0, 1, 0);
const qHome = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, -0.5, 0));
const qM = new THREE.Quaternion().setFromAxisAngle(AXIS_X, Math.PI / 2);
const qMinv = qM.clone().conjugate();
const qScr = new THREE.Quaternion(), qZeroInv = new THREE.Quaternion(), qDel = new THREE.Quaternion();
const qTmp = new THREE.Quaternion(), qGyro = new THREE.Quaternion(), qTarget = new THREE.Quaternion(), qFinal = new THREE.Quaternion();
const eul = new THREE.Euler();
const vW = new THREE.Vector3(), vAx = new THREE.Vector3(), vLinT = new THREE.Vector3(), vLin = new THREE.Vector3(), vLinE = new THREE.Vector3(), gEst = new THREE.Vector3(), posT = new THREE.Vector3();
let cosA = 1, sinA = 0, angRad = 0;

const S = {
  enabled: false, pending: false, paused: false, sens: 1, perm: 'not requested', err: '', gyroErr: '', enabledAt: 0, angle: -1,
  mode: 'MOUSE MODE', intensity: 0, shakeT: 0, needCal: true, hasAcc: false, gInit: false, linMag: 0,
  tOri: -1e9, tGyro: -1e9, tGyroSensor: -1e9, tMotion: -1e9,
  ori: { a: null, b: null, g: null },
  gyro: { x: null, y: null, z: null, src: '' },
  accG: { x: null, y: null, z: null },
  lin: new THREE.Vector3(), gyroSensor: null,
  qOri: new THREE.Quaternion(), qUser: qHome.clone(),
  remote: {
    active: false,
    tRecv: -1e9,
    seq: -1,
    hello: false,
    ori: { a: null, b: null, g: null },
    gyro: { x: null, y: null, z: null },
    accG: { x: null, y: null, z: null },
    lin: new THREE.Vector3(),
    linMag: 0,
    mode: '',
    intensity: 0,
    shake: false,
    qGyro: new THREE.Quaternion(),
    needCal: true,
    qZeroInv: new THREE.Quaternion()
  },
  net: {
    role: '',
    peer: null,
    conn: null,
    code: '',
    status: '',
    busy: false,
    txTimer: 0,
    txSeq: 0
  }
};

const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  el.notice.textContent = 'WebGL is unavailable in this browser, so the 3D view cannot render.';
  return;
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.Fog(0x04060a, 9, 22);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);

function buildEnvironment() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 p;void main(){float h=p.y*.5+.5;vec3 c=mix(vec3(.01,.015,.03),vec3(.12,.2,.32),pow(h,1.5));gl_FragColor=vec4(c,1.);}'
  })));
  const panel = (w, h, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(10, 3, 0xffffff, 0, 9, 4); panel(3, 8, 0x4de1ff, -9, 2, 2); panel(3, 8, 0xff4fd8, 9, 0, -3); panel(8, 2, 0xbfd8ff, 0, -6, 8);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  pm.dispose();
}
buildEnvironment();

scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x05070b, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { near: 1, far: 18, left: -6, right: 6, top: 6, bottom: -6 });
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.PointLight(0xff4fd8, 1.2, 14); rim.position.set(-4, 1, -3); scene.add(rim);
const fill = new THREE.PointLight(0x4de1ff, 1.0, 14); fill.position.set(4, -1, 3); scene.add(fill);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.5 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -2.4; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(14, 28, 0x1a3a4a, 0x0e1c26); grid.position.y = -2.39; scene.add(grid);

const rig = new THREE.Group();
const geo = new THREE.IcosahedronGeometry(1.25, 1);
const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9fb4c9, metalness: 0.95, roughness: 0.26, flatShading: true, emissive: 0x1fd2ff, emissiveIntensity: 0 }));
body.castShadow = true; body.receiveShadow = true;
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x4de1ff, transparent: true, opacity: 0.55 }));
const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: 0xff4fd8, wireframe: true }));
rig.add(body, edges, core, new THREE.AxesHelper(2.1));
rig.quaternion.copy(S.qUser);
scene.add(rig);

function screenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  return typeof window.orientation === 'number' ? window.orientation : 0;
}
function resize() {
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(0, 0.9, 6.4 * Math.max(1, 0.95 / camera.aspect));
  camera.lookAt(0, camera.aspect < 1 ? -0.8 : -0.3, 0);
  camera.updateProjectionMatrix();
  const ang = screenAngle();
  if (ang !== S.angle) {
    S.angle = ang; angRad = ang * D2R; cosA = Math.cos(angRad); sinA = Math.sin(angRad); S.needCal = true;
  }
}

function toScreen(x, y, z, out) { out.set(x * cosA - y * sinA, x * sinA + y * cosA, z); }

function scaleQuat(q, s, out) {
  let w = q.w, x = q.x, y = q.y, z = q.z;
  if (w < 0) { w = -w; x = -x; y = -y; z = -z; }
  const sh = Math.sqrt(x * x + y * y + z * z);
  if (sh < 1e-6) { out.set(0, 0, 0, 1); return; }
  const half = Math.atan2(sh, w) * s, k = Math.sin(half) / sh;
  out.set(x * k, y * k, z * k, Math.cos(half));
}

function onOrientation(e) {
  if (S.paused) return;
  const a = num(e.alpha), b = num(e.beta), g = num(e.gamma);
  if (b === null && g === null) return;
  S.ori.a = a; S.ori.b = b; S.ori.g = g; S.tOri = performance.now();
  eul.set((b || 0) * D2R, (a || 0) * D2R, -(g || 0) * D2R, 'YXZ');
  qScr.setFromEuler(eul);
  qTmp.setFromAxisAngle(AXIS_Y, -angRad);
  qScr.multiply(qTmp);
  if (S.needCal) { qZeroInv.copy(qScr).conjugate(); S.needCal = false; }
  qDel.copy(qZeroInv).multiply(qScr);
  S.qOri.copy(qM).multiply(qDel).multiply(qMinv);
}

function onMotion(e) {
  if (S.paused) return;
  const now = performance.now();
  const ag = e.accelerationIncludingGravity, al = e.acceleration, rr = e.rotationRate;
  const gx = ag ? num(ag.x) : null, gy = ag ? num(ag.y) : null, gz = ag ? num(ag.z) : null;
  if (gx !== null || gy !== null || gz !== null) {
    S.accG.x = gx; S.accG.y = gy; S.accG.z = gz; S.hasAcc = true; S.tMotion = now;
    const cx = gx || 0, cy = gy || 0, cz = gz || 0;
    if (!S.gInit) { gEst.set(cx, cy, cz); S.gInit = true; }
    else { gEst.x += (cx - gEst.x) * 0.1; gEst.y += (cy - gEst.y) * 0.1; gEst.z += (cz - gEst.z) * 0.1; }
    const lx = al ? num(al.x) : null, ly = al ? num(al.y) : null, lz = al ? num(al.z) : null;
    if (lx !== null || ly !== null || lz !== null) S.lin.set(lx || 0, ly || 0, lz || 0);
    else S.lin.set(cx - gEst.x, cy - gEst.y, cz - gEst.z);
    S.linMag = S.lin.length();
    if (S.linMag > 12) S.shakeT = 0.8;
  }
  if (rr && now - S.tGyroSensor > 1000) {
    const ra = num(rr.alpha), rb = num(rr.beta), rg = num(rr.gamma);
    if (ra !== null || rb !== null || rg !== null) {
      S.gyro.x = rb === null ? null : rb * D2R;
      S.gyro.y = rg === null ? null : rg * D2R;
      S.gyro.z = ra === null ? null : ra * D2R;
      S.gyro.src = 'rotationRate'; S.tGyro = now;
    }
  }
}

function onGyroReading() {
  const g = S.gyroSensor;
  if (!g || S.paused) return;
  const x = num(g.x), y = num(g.y), z = num(g.z);
  if (x === null && y === null && z === null) return;
  S.gyro.x = x; S.gyro.y = y; S.gyro.z = z; S.gyro.src = 'Gyroscope API';
  S.tGyro = S.tGyroSensor = performance.now();
}

function stopGyroSensor() {
  const g = S.gyroSensor;
  if (!g) return;
  g.removeEventListener('reading', onGyroReading);
  g.removeEventListener('error', onGyroError);
  try { g.stop(); } catch (err) { /* sensor already stopped */ }
  S.gyroSensor = null;
}

function onGyroError(e) {
  S.gyroErr = (e && e.error && e.error.name) || 'error';
  stopGyroSensor();
  S.tGyroSensor = -1e9;
}

function startGyroSensor() {
  S.gyroErr = '';
  if (!('Gyroscope' in window)) return;
  try {
    const g = new Gyroscope({ frequency: 60 });
    g.addEventListener('reading', onGyroReading);
    g.addEventListener('error', onGyroError);
    S.gyroSensor = g;
    g.start();
  } catch (err) {
    S.gyroErr = (err && err.name) || 'error';
    stopGyroSensor();
  }
}

function resetReadings() {
  S.tOri = S.tGyro = S.tGyroSensor = S.tMotion = -1e9;
  S.ori.a = S.ori.b = S.ori.g = null;
  S.gyro.x = S.gyro.y = S.gyro.z = null; S.gyro.src = '';
  S.accG.x = S.accG.y = S.accG.z = null;
  S.hasAcc = false; S.gInit = false; S.lin.set(0, 0, 0); S.linMag = 0; S.shakeT = 0; S.needCal = true;
}

const PROTO = 1;
const PEER_CFG = {
  debug: 1,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
};
const REMOTE_FRESH_MS = 700;
const TX_INTERVAL_MS = 1000 / 40;

function pad8(n) {
  let s = String(n);
  while (s.length < 8) s = '0' + s;
  return s.slice(-8);
}

function randomCode() {
  const arr = new Uint32Array(1);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
  else arr[0] = Math.floor(Math.random() * 0xffffffff);
  return pad8(arr[0] % 100000000);
}

function hostPeerId(code) {
  return 'ml-host-' + code;
}

function clientPeerId() {
  const arr = new Uint32Array(2);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
  else { arr[0] = Math.random() * 0xffffffff; arr[1] = Math.random() * 0xffffffff; }
  return 'ml-cli-' + arr[0].toString(36) + arr[1].toString(36);
}

function setHostStatus(text, kind) {
  if (!el.hostStatus) return;
  el.hostStatus.textContent = text;
  if (kind) el.hostStatus.dataset.s = kind;
  else el.hostStatus.removeAttribute('data-s');
}

function setClientStatus(text, kind) {
  if (!el.clientStatus) return;
  el.clientStatus.textContent = text;
  if (kind) el.clientStatus.dataset.s = kind;
  else el.clientStatus.removeAttribute('data-s');
}

function setLinkMsg(text) {
  if (el.linkMsg) el.linkMsg.textContent = text || '';
}

function openLinkModal() {
  if (!el.linkModal) return;
  el.linkModal.hidden = false;
  if (el.btnHost) el.btnHost.focus();
}

function closeLinkModal() {
  if (!el.linkModal) return;
  if (S.net.role === 'host' || S.net.role === 'client') return;
  el.linkModal.hidden = true;
}

function showRole() {
  el.linkRole.hidden = false;
  el.linkHost.hidden = true;
  el.linkClient.hidden = true;
  setLinkMsg('');
}

function clearRemote() {
  S.remote.active = false;
  S.remote.hello = false;
  S.remote.seq = -1;
  S.remote.tRecv = -1e9;
  S.remote.ori.a = S.remote.ori.b = S.remote.ori.g = null;
  S.remote.gyro.x = S.remote.gyro.y = S.remote.gyro.z = null;
  S.remote.accG.x = S.remote.accG.y = S.remote.accG.z = null;
  S.remote.lin.set(0, 0, 0);
  S.remote.linMag = 0;
  S.remote.mode = '';
  S.remote.intensity = 0;
  S.remote.shake = false;
  S.remote.needCal = true;
}

function cleanupPeer() {
  const { conn, peer } = S.net;
  if (conn) {
    try { conn.removeAllListeners(); } catch (err) { /* noop */ }
    try { conn.close(); } catch (err) { /* noop */ }
  }
  if (peer) {
    try { peer.removeAllListeners(); } catch (err) { /* noop */ }
    try { peer.destroy(); } catch (err) { /* noop */ }
  }
  S.net.conn = null;
  S.net.peer = null;
  S.net.busy = false;
  S.net.txTimer = 0;
  S.net.txSeq = 0;
  if (S.net.role === 'client') clearRemote();
}

function endSession() {
  const role = S.net.role;
  cleanupPeer();
  S.net.role = '';
  S.net.code = '';
  S.net.status = '';
  clearRemote();
  if (role === 'host') {
    setHostStatus('Idle');
    el.btnHost.hidden = false;
    el.btnJoin.hidden = false;
    el.linkRole.hidden = false;
    el.btnHostStop.hidden = true;
    el.linkHost.hidden = true;
  } else if (role === 'client') {
    setClientStatus('Idle');
    el.linkClient.hidden = true;
    el.linkRole.hidden = false;
  }
  setLinkMsg('');
}

function stopTransmit() {
  if (S.net.txTimer) {
    clearInterval(S.net.txTimer);
    S.net.txTimer = 0;
  }
}

function packOri() {
  const a = S.ori.a, b = S.ori.b, g = S.ori.g;
  if (a === null && b === null && g === null) return null;
  return [a, b, g];
}

function packGyro() {
  const x = S.gyro.x, y = S.gyro.y, z = S.gyro.z;
  if (x === null && y === null && z === null) return null;
  return [x, y, z];
}

function packAcc() {
  const x = S.accG.x, y = S.accG.y, z = S.accG.z;
  if (x === null && y === null && z === null) return null;
  return [x, y, z];
}

function packLin() {
  if (!S.hasAcc) return null;
  return [S.lin.x, S.lin.y, S.lin.z];
}

function currentMode() {
  return S.paused ? 'PAUSED' : (S.mode || 'MOUSE MODE');
}

function startTransmit() {
  stopTransmit();
  S.net.txSeq = 0;
  const conn = S.net.conn;
  if (!conn || !conn.open) return;
  const send = () => {
    if (!S.net.conn || !S.net.conn.open) return;
    const now = performance.now();
    const msg = {
      t: 'sensor:update',
      v: PROTO,
      ts: now,
      seq: S.net.txSeq++,
      ori: packOri(),
      gyro: packGyro(),
      acc: packAcc(),
      lin: packLin(),
      mode: currentMode(),
      intensity: S.intensity,
      shake: S.shakeT > 0
    };
    try { S.net.conn.send(msg); } catch (err) { /* noop */ }
  };
  send();
  S.net.txTimer = setInterval(send, TX_INTERVAL_MS);
}

function onRemoteData(data) {
  if (!data || typeof data !== 'object') return;
  const now = performance.now();
  if (data.t === 'session:hello') {
    S.remote.hello = true;
    S.remote.needCal = true;
    return;
  }
  if (data.t === 'session:status') return;
  if (data.t !== 'sensor:update') return;
  if (data.v !== PROTO) return;
  if (typeof data.seq !== 'number' || data.seq <= S.remote.seq) return;
  S.remote.seq = data.seq;
  if (Array.isArray(data.ori) && data.ori.length === 3) {
    const [a, b, g] = data.ori;
    if (num(a) !== null || num(b) !== null || num(g) !== null) {
      S.remote.ori.a = num(a);
      S.remote.ori.b = num(b);
      S.remote.ori.g = num(g);
    }
  } else {
    S.remote.ori.a = S.remote.ori.b = S.remote.ori.g = null;
  }
  if (Array.isArray(data.gyro) && data.gyro.length === 3) {
    const [x, y, z] = data.gyro;
    S.remote.gyro.x = num(x);
    S.remote.gyro.y = num(y);
    S.remote.gyro.z = num(z);
  } else {
    S.remote.gyro.x = S.remote.gyro.y = S.remote.gyro.z = null;
  }
  if (Array.isArray(data.acc) && data.acc.length === 3) {
    const [x, y, z] = data.acc;
    S.remote.accG.x = num(x);
    S.remote.accG.y = num(y);
    S.remote.accG.z = num(z);
  } else {
    S.remote.accG.x = S.remote.accG.y = S.remote.accG.z = null;
  }
  if (Array.isArray(data.lin) && data.lin.length === 3) {
    const [x, y, z] = data.lin;
    S.remote.lin.set(num(x) || 0, num(y) || 0, num(z) || 0);
    S.remote.linMag = S.remote.lin.length();
  } else {
    S.remote.lin.set(0, 0, 0);
    S.remote.linMag = 0;
  }
  S.remote.mode = typeof data.mode === 'string' ? data.mode : '';
  S.remote.intensity = num(data.intensity) || 0;
  S.remote.shake = !!data.shake;
  S.remote.tRecv = now;
  S.remote.active = true;
}

function wireConnection(conn, isHost) {
  conn.on('open', () => {
    if (isHost) {
      setHostStatus('Device connected', 'ok');
      el.btnHostStop.hidden = false;
      S.net.conn = conn;
      clearRemote();
      S.remote.needCal = true;
      try { conn.send({ t: 'session:hello', v: PROTO }); } catch (err) { /* noop */ }
    } else {
      setClientStatus('Connected', 'ok');
      el.btnClientStop.hidden = false;
      S.net.conn = conn;
      try { conn.send({ t: 'session:hello', v: PROTO }); } catch (err) { /* noop */ }
      if (!S.enabled) enableSensors();
      startTransmit();
    }
  });
  conn.on('data', data => {
    if (isHost) onRemoteData(data);
  });
  conn.on('close', () => {
    if (isHost) {
      setHostStatus('Connection lost', 'err');
      el.btnHostStop.hidden = true;
      clearRemote();
      S.net.conn = null;
    } else {
      setClientStatus('Disconnected', 'err');
      stopTransmit();
      clearRemote();
      S.net.conn = null;
    }
  });
  conn.on('error', err => {
    const name = (err && err.type) || 'error';
    if (isHost) setHostStatus('Host error: ' + name, 'err');
    else setClientStatus('Client error: ' + name, 'err');
  });
}

function startHost() {
  if (S.net.busy || S.net.peer) return;
  const ok = window.confirm('Start a Motion Lab host session? Another device with your session code will be able to connect and send motion sensor data to this device. Only accept connections from devices you trust.');
  if (!ok) return;
  S.net.busy = true;
  S.net.role = 'host';
  S.net.code = randomCode();
  el.linkRole.hidden = true;
  el.linkHost.hidden = false;
  el.linkClient.hidden = true;
  el.btnHost.hidden = true;
  el.btnJoin.hidden = true;
  el.btnHostStop.hidden = true;
  el.hostCode.textContent = S.net.code;
  setHostStatus('Initializing...', 'wait');
  setLinkMsg('');
  let peer;
  try {
    peer = new Peer(hostPeerId(S.net.code), PEER_CFG);
  } catch (err) {
    S.net.busy = false;
    setHostStatus('Host error', 'err');
    setLinkMsg('Failed to create PeerJS instance.');
    return;
  }
  S.net.peer = peer;
  peer.on('open', () => {
    S.net.busy = false;
    setHostStatus('Waiting for connection', 'wait');
  });
  peer.on('connection', conn => {
    if (S.net.conn) {
      try { conn.close(); } catch (err) { /* noop */ }
      return;
    }
    S.net.conn = conn;
    wireConnection(conn, true);
  });
  peer.on('error', err => {
    const name = (err && err.type) || 'error';
    if (name === 'unavailable-id') {
      S.net.busy = false;
      setHostStatus('Host error: code in use', 'err');
      setLinkMsg('Retry to get a new code.');
      cleanupPeer();
      S.net.role = '';
      el.linkRole.hidden = false;
      el.linkHost.hidden = true;
      el.btnHost.hidden = false;
      el.btnJoin.hidden = false;
      return;
    }
    setHostStatus('Host error: ' + name, 'err');
  });
  peer.on('disconnected', () => {
    setHostStatus('Connection lost', 'err');
  });
  peer.on('close', () => {
    S.net.busy = false;
    cleanupPeer();
    clearRemote();
    if (S.net.role === 'host') {
      S.net.role = '';
      S.net.code = '';
      el.linkRole.hidden = false;
      el.linkHost.hidden = true;
      el.btnHost.hidden = false;
      el.btnJoin.hidden = false;
      el.btnHostStop.hidden = true;
    }
  });
}

function startClient() {
  if (S.net.busy || S.net.peer) return;
  const raw = window.prompt('Enter the 8-digit session code from the host device:');
  if (raw === null) return;
  const code = String(raw).trim();
  if (!/^\d{8}$/.test(code)) {
    setLinkMsg('Code must be exactly 8 digits.');
    return;
  }
  S.net.busy = true;
  S.net.role = 'client';
  S.net.code = code;
  el.linkRole.hidden = true;
  el.linkHost.hidden = true;
  el.linkClient.hidden = false;
  el.btnClientStop.hidden = true;
  setClientStatus('Connecting...', 'wait');
  setLinkMsg('');
  let peer;
  try {
    peer = new Peer(clientPeerId(), PEER_CFG);
  } catch (err) {
    S.net.busy = false;
    S.net.role = '';
    setClientStatus('Client error', 'err');
    setLinkMsg('Failed to create PeerJS instance.');
    el.linkRole.hidden = false;
    el.linkClient.hidden = true;
    return;
  }
  S.net.peer = peer;
  let opened = false;
  peer.on('open', () => {
    opened = true;
    const conn = peer.connect(hostPeerId(code), { reliable: false });
    wireConnection(conn, false);
  });
  peer.on('error', err => {
    const name = (err && err.type) || 'error';
    if (name === 'peer-unavailable') {
      setClientStatus('Host not found', 'err');
      setLinkMsg('No host is online for that code. Verify the code and retry.');
    } else {
      setClientStatus('Client error: ' + name, 'err');
    }
    stopTransmit();
    cleanupPeer();
    S.net.role = '';
    S.net.busy = false;
    el.btnClientStop.hidden = true;
    el.linkRole.hidden = false;
    el.linkClient.hidden = true;
  });
  peer.on('disconnected', () => {
    setClientStatus('Signaling lost', 'err');
  });
  setTimeout(() => {
    if (!opened && S.net.peer === peer) {
      setClientStatus('Connection timed out', 'err');
      setLinkMsg('Retry to attempt a new connection.');
      cleanupPeer();
      S.net.role = '';
      S.net.busy = false;
      el.linkRole.hidden = false;
      el.linkClient.hidden = true;
    }
  }, 8000);
}

function stopHost() {
  if (S.net.role !== 'host') return;
  endSession();
  showRole();
}

function stopClient() {
  if (S.net.role !== 'client') return;
  stopTransmit();
  endSession();
  showRole();
}

function detach() {
  window.removeEventListener('deviceorientation', onOrientation);
  window.removeEventListener('devicemotion', onMotion);
  stopGyroSensor();
}

function disableSensors() {
  detach();
  S.enabled = false; S.pending = false;
  resetReadings();
  el.btnEnable.textContent = 'Enable Motion Sensors';
  el.btnEnable.disabled = false;
}

async function enableSensors() {
  if (S.enabled) { disableSensors(); return; }
  if (S.pending) return;
  S.pending = true; S.err = '';
  el.btnEnable.disabled = true; el.btnEnable.textContent = 'Requesting...';
  const hasOri = 'DeviceOrientationEvent' in window, hasMot = 'DeviceMotionEvent' in window, hasGyro = 'Gyroscope' in window;
  if (!hasOri && !hasMot && !hasGyro) {
    S.perm = 'unsupported'; S.err = 'This browser exposes no motion sensor APIs. Drag or touch the object to rotate it.';
    S.pending = false; el.btnEnable.disabled = false; el.btnEnable.textContent = 'Enable Motion Sensors';
    return;
  }
  const reqs = [];
  if (hasOri && typeof DeviceOrientationEvent.requestPermission === 'function') reqs.push(DeviceOrientationEvent.requestPermission());
  if (hasMot && typeof DeviceMotionEvent.requestPermission === 'function') reqs.push(DeviceMotionEvent.requestPermission());
  if (reqs.length) {
    const res = await Promise.allSettled(reqs);
    const granted = res.some(r => r.status === 'fulfilled' && r.value === 'granted');
    if (!granted) {
      const denied = res.some(r => r.status === 'fulfilled' && r.value === 'denied');
      S.perm = denied ? 'denied' : 'error';
      if (!denied) S.err = 'Permission request failed. It must be triggered by a tap on a page served over HTTPS.';
      S.pending = false; el.btnEnable.disabled = false; el.btnEnable.textContent = 'Enable Motion Sensors';
      return;
    }
    S.perm = 'granted';
  } else {
    S.perm = 'no prompt needed';
  }
  resetReadings();
  window.addEventListener('deviceorientation', onOrientation);
  window.addEventListener('devicemotion', onMotion);
  startGyroSensor();
  S.enabled = true; S.pending = false; S.enabledAt = performance.now();
  el.btnEnable.disabled = false; el.btnEnable.textContent = 'Disable Motion Sensors';
}

function remoteFresh(now) {
  return S.remote.active && fresh(now, S.remote.tRecv, REMOTE_FRESH_MS);
}

function computeMode(now) {
  if (remoteFresh(now)) {
    if (S.remote.ori.a !== null || S.remote.ori.b !== null || S.remote.ori.g !== null) return 'REMOTE ORIENTATION';
    if (S.remote.gyro.x !== null || S.remote.gyro.y !== null || S.remote.gyro.z !== null) return 'REMOTE GYROSCOPE';
    if (S.remote.accG.x !== null || S.remote.accG.y !== null || S.remote.accG.z !== null) return 'REMOTE ACCELEROMETER';
  }
  if (S.tOri > 0) return 'ORIENTATION';
  if (fresh(now, S.tGyro)) return 'GYROSCOPE';
  if (S.hasAcc && fresh(now, S.tMotion)) return 'ACCELEROMETER FALLBACK';
  return 'MOUSE MODE';
}

let drag = null;
canvas.addEventListener('pointerdown', e => {
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, len = Math.hypot(dx, dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (len < 0.01) return;
  vAx.set(dy / len, dx / len, 0);
  qTmp.setFromAxisAngle(vAx, len * 0.008);
  S.qUser.premultiply(qTmp).normalize();
});
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

el.btnEnable.addEventListener('click', enableSensors);
el.btnConnect.addEventListener('click', openLinkModal);
el.linkClose.addEventListener('click', closeLinkModal);
el.linkModal.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) closeLinkModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !el.linkModal.hidden) closeLinkModal();
});
el.btnHost.addEventListener('click', startHost);
el.btnJoin.addEventListener('click', startClient);
el.btnHostStop.addEventListener('click', stopHost);
el.btnClientStop.addEventListener('click', stopClient);
el.btnPause.addEventListener('click', () => {
  S.paused = !S.paused;
  el.btnPause.textContent = S.paused ? 'Resume' : 'Pause';
  if (!S.paused) S.needCal = false;
});
el.btnReset.addEventListener('click', () => {
  S.qUser.copy(qHome); qGyro.identity(); S.needCal = true; S.shakeT = 0;
});
el.sens.addEventListener('input', () => {
  S.sens = parseFloat(el.sens.value) || 1;
  el.sensOut.textContent = S.sens.toFixed(2) + 'x';
});
addEventListener('resize', resize);
addEventListener('orientationchange', resize);
addEventListener('pagehide', () => {
  stopTransmit();
  cleanupPeer();
  disableSensors();
});

function update(dt, now) {
  const live = !S.paused, prev = S.mode;
  if (live) {
    S.mode = computeMode(now);
    if (prev === 'ORIENTATION' && S.mode === 'GYROSCOPE') qGyro.copy(S.qOri);
  }
  const isRemote = live && remoteFresh(now);
  if (isRemote && S.remote.needCal === false && S.remote.qGyro.lengthSq() === 0) S.remote.needCal = true;
  const gFx = isRemote
    ? (S.remote.gyro.x !== null || S.remote.gyro.y !== null || S.remote.gyro.z !== null)
    : (live && fresh(now, S.tGyro, FX_MS));
  const mFx = isRemote
    ? (S.remote.accG.x !== null || S.remote.accG.y !== null || S.remote.accG.z !== null)
    : (live && S.hasAcc && fresh(now, S.tMotion, FX_MS));
  const kRot = 1 - Math.exp(-dt * 12), kPos = 1 - Math.exp(-dt * 10), kLin = 1 - Math.exp(-dt * 14);

  if (gFx) {
    if (isRemote) toScreen(S.remote.gyro.x || 0, S.remote.gyro.y || 0, S.remote.gyro.z || 0, vW);
    else toScreen(S.gyro.x || 0, S.gyro.y || 0, S.gyro.z || 0, vW);
  } else vW.set(0, 0, 0);
  const wLen = vW.length();
  if (mFx) {
    if (isRemote) toScreen(S.remote.lin.x, S.remote.lin.y, S.remote.lin.z, vLinT);
    else toScreen(S.lin.x, S.lin.y, S.lin.z, vLinT);
  } else vLinT.set(0, 0, 0);
  vLin.lerp(vLinT, kLin);
  if (vLin.length() < 0.25) vLinE.set(0, 0, 0); else vLinE.copy(vLin);

  const mode = S.mode;
  if (live) {
    if (mode === 'REMOTE ORIENTATION') {
      if (S.remote.needCal) {
        const b = S.remote.ori.b, a = S.remote.ori.a, g = S.remote.ori.g;
        eul.set((b || 0) * D2R, (a || 0) * D2R, -(g || 0) * D2R, 'YXZ');
        qTmp.setFromEuler(eul);
        qTmp.setFromAxisAngle(AXIS_Y, -angRad);
        S.remote.qZeroInv.copy(qTmp).conjugate();
        S.remote.needCal = false;
      }
      const b = S.remote.ori.b, a = S.remote.ori.a, g = S.remote.ori.g;
      eul.set((b || 0) * D2R, (a || 0) * D2R, -(g || 0) * D2R, 'YXZ');
      qScr.setFromEuler(eul);
      qTmp.setFromAxisAngle(AXIS_Y, -angRad);
      qScr.multiply(qTmp);
      qDel.copy(S.remote.qZeroInv).multiply(qScr);
      qOri.copy(qM).multiply(qDel).multiply(qMinv);
      scaleQuat(qOri, S.sens, qTarget);
    } else if (mode === 'REMOTE GYROSCOPE') {
      if (wLen > 0.02) {
        vAx.copy(vW).multiplyScalar(1 / wLen);
        qTmp.setFromAxisAngle(vAx, wLen * S.sens * dt);
        S.remote.qGyro.multiply(qTmp).normalize();
      }
      qTarget.copy(S.remote.qGyro);
    } else if (mode === 'REMOTE ACCELEROMETER') {
      const s = S.sens * 0.05;
      eul.set(clamp(-vLinE.z * s, -0.6, 0.6), clamp(vLinE.y * s * 0.5, -0.6, 0.6), clamp(vLinE.x * s, -0.6, 0.6), 'XYZ');
      qTarget.setFromEuler(eul);
    } else if (mode === 'ORIENTATION') {
      scaleQuat(S.qOri, S.sens, qTarget);
    } else if (mode === 'GYROSCOPE') {
      if (wLen > 0.02) {
        vAx.copy(vW).multiplyScalar(1 / wLen);
        qTmp.setFromAxisAngle(vAx, wLen * S.sens * dt);
        qGyro.multiply(qTmp).normalize();
      }
      qTarget.copy(qGyro);
    } else if (mode === 'ACCELEROMETER FALLBACK') {
      const s = S.sens * 0.05;
      eul.set(clamp(-vLinE.z * s, -0.6, 0.6), clamp(vLinE.y * s * 0.5, -0.6, 0.6), clamp(vLinE.x * s, -0.6, 0.6), 'XYZ');
      qTarget.setFromEuler(eul);
    } else {
      qTarget.identity();
    }
  }
  if (mode === 'MOUSE MODE' && !drag && !reduceMotion) {
    qTmp.setFromAxisAngle(AXIS_Y, dt * 0.3);
    S.qUser.premultiply(qTmp).normalize();
  }
  qFinal.copy(S.qUser).multiply(qTarget);
  rig.quaternion.slerp(qFinal, kRot);

  posT.set(-vLinE.x, -vLinE.y, -vLinE.z).multiplyScalar(0.07 * S.sens);
  posT.x = clamp(posT.x, -1.2, 1.2); posT.y = clamp(posT.y, -1.2, 1.2); posT.z = clamp(posT.z, -1.2, 1.2);
  const shakeActive = S.shakeT > 0 || (isRemote && S.remote.shake);
  if (S.shakeT > 0) S.shakeT -= dt;
  if (shakeActive) {
    const a = reduceMotion ? 0.02 : 0.12;
    posT.x += (Math.random() - 0.5) * a; posT.y += (Math.random() - 0.5) * a; posT.z += (Math.random() - 0.5) * a;
  }
  rig.position.lerp(posT, kPos);

  const remoteIntensity = isRemote ? S.remote.intensity : 0;
  const target = Math.max(Math.min(vLinE.length() / 12, 1), Math.min(wLen / 6, 1), remoteIntensity);
  S.intensity = clamp(S.intensity + (target - S.intensity) * (1 - Math.exp(-dt * 8)), 0, 1);
  body.material.emissiveIntensity = S.intensity * 0.8 + (S.shakeT > 0 ? 0.4 : 0);
  edges.material.opacity = 0.5 + S.intensity * 0.5;
  if (!reduceMotion) { core.rotation.y += dt * (0.4 + wLen * 1.2); core.rotation.x += dt * 0.25; }
}

function noticeText(now) {
  if (S.err) return S.err;
  if (S.perm === 'denied') return 'Motion permission was denied. iOS: fully close Safari, reopen this page and tap Enable again (or allow Motion & Orientation Access in Settings > Safari). Android: Chrome menu > Settings > Site settings > Motion sensors > Allow.';
  if (!window.isSecureContext) return 'Motion sensors need a secure context: open this page over HTTPS or http://localhost (not file:// or plain http). Drag to rotate still works.';
  if (S.enabled) {
    const any = S.tOri > 0 || fresh(now, S.tGyro) || (S.hasAcc && fresh(now, S.tMotion));
    if (!any && now - S.enabledAt > 2500) return 'Listening, but no sensor readings are arriving. Desktop browsers usually have no motion sensors, so drag the object instead. On a phone, check the site\u2019s motion sensor permission.';
    return '';
  }
  return 'Tap Enable Motion Sensors on a phone or tablet, or just drag the object. Requires HTTPS or localhost; support varies by browser.';
}

function updateHud(now) {
  const mode = S.paused ? 'PAUSED' : S.mode;
  setText(el.mode, mode);
  if (el.mode.dataset.mode !== mode) el.mode.dataset.mode = mode;
  const isRemote = remoteFresh(now);
  const remoteStale = S.remote.hello && !S.remote.active && S.net.role === 'host';
  const oriOk = isRemote
    ? (S.remote.ori.a !== null || S.remote.ori.b !== null || S.remote.ori.g !== null)
    : S.tOri > 0;
  const gOk = isRemote
    ? (S.remote.gyro.x !== null || S.remote.gyro.y !== null || S.remote.gyro.z !== null)
    : fresh(now, S.tGyro);
  const aOk = isRemote
    ? (S.remote.accG.x !== null || S.remote.accG.y !== null || S.remote.accG.z !== null)
    : (S.hasAcc && fresh(now, S.tMotion));
  document.body.dataset.live = ((isRemote && (oriOk || gOk || aOk)) || (S.enabled && (oriOk || gOk || aOk))) ? '1' : '0';
  setText(el.perm, 'Permission: ' + S.perm + (S.net.role ? '  link: ' + S.net.role : ''));
  const srcO = isRemote ? 'REMOTE ORIENTATION' : 'orientation';
  const srcG = isRemote ? 'REMOTE GYRO' : 'gyro';
  const srcA = isRemote ? 'REMOTE ACCEL' : 'accel';
  setText(el.avail, srcO + ' ' + (oriOk ? '\u25CF' : '\u25CB') + '  ' + srcG + ' ' + (gOk ? '\u25CF' : '\u25CB') + '  ' + srcA + ' ' + (aOk ? '\u25CF' : '\u25CB') + (remoteStale ? '  REMOTE DATA STALE' : ''));
  const oa = isRemote ? S.remote.ori.a : S.ori.a;
  const ob = isRemote ? S.remote.ori.b : S.ori.b;
  const og = isRemote ? S.remote.ori.g : S.ori.g;
  setText(el.oa, oriOk ? fmt(oa, 1) : '\u2014');
  setText(el.ob, oriOk ? fmt(ob, 1) : '\u2014');
  setText(el.og, oriOk ? fmt(og, 1) : '\u2014');
  const gSrc = isRemote ? S.remote.gyro : S.gyro;
  const gv = v => (gOk && v !== null) ? fmt(v * R2D, 1) : '\u2014';
  setText(el.gx, gv(gSrc.x)); setText(el.gy, gv(gSrc.y)); setText(el.gz, gv(gSrc.z));
  const aSrc = isRemote ? S.remote.accG : S.accG;
  const av = v => (aOk && v !== null) ? fmt(v, 2) : '\u2014';
  setText(el.ax, av(aSrc.x)); setText(el.ay, av(aSrc.y)); setText(el.az, av(aSrc.z));
  let ms = 'OFF';
  if (isRemote) ms = !(oriOk || gOk || aOk) ? 'NO DATA' : S.remote.shake ? 'SHAKE' : S.remote.intensity > 0.12 ? 'MOVING' : 'STILL';
  else if (S.enabled) ms = !(oriOk || gOk || aOk) ? 'NO DATA' : S.shakeT > 0 ? 'SHAKE' : S.intensity > 0.12 ? 'MOVING' : 'STILL';
  setText(el.mstate, ms);
  el.bar.style.transform = 'scaleX(' + S.intensity.toFixed(3) + ')';
  const linMag = isRemote ? S.remote.linMag : S.linMag;
  setText(el.lin, aOk ? 'linear ' + linMag.toFixed(2) + ' m/s\u00B2' : 'linear \u2014');
  setText(el.notice, noticeText(now));
}

let last = performance.now(), hudT = 1;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;
  update(dt, now);
  renderer.render(scene, camera);
  hudT += dt;
  if (hudT >= 0.1) { hudT = 0; updateHud(now); }
}

resize();
requestAnimationFrame(frame);
})();