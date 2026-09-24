const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('fileInput');
const spinner    = document.getElementById('spinner');
const resultsSection = document.getElementById('results-section');
const summaryBar = document.getElementById('summaryBar');
const resultsGrid = document.getElementById('resultsGrid');
const clearBtn   = document.getElementById('clearBtn');
const workerCanvas = document.getElementById('workerCanvas');
const workerCtx  = workerCanvas.getContext('2d', { willReadFrequently: true });

let allResults = [];

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));
clearBtn.addEventListener('click', () => {
  allResults = [];
  resultsSection.style.display = 'none';
  resultsGrid.innerHTML = '';
  summaryBar.innerHTML = '';
  fileInput.value = '';
});

function applyLaplacian(grayData, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const val =
        4 * grayData[i]
        - grayData[(y - 1) * w + x]
        - grayData[(y + 1) * w + x]
        - grayData[y * w + (x - 1)]
        - grayData[y * w + (x + 1)];
      out[i] = val;
    }
  }
  return out;
}

function computeVariance(arr) {
  let sum = 0, sumSq = 0, n = arr.length;
  for (let i = 0; i < n; i++) { sum += arr[i]; sumSq += arr[i] * arr[i]; }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function toGray(data, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

function analyzeImage(imgEl) {
  const MAX_DIM = 1024;
  let w = imgEl.naturalWidth, h = imgEl.naturalHeight;
  if (w > MAX_DIM || h > MAX_DIM) {
    const scale = MAX_DIM / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  workerCanvas.width = w;
  workerCanvas.height = h;
  workerCtx.drawImage(imgEl, 0, 0, w, h);
  const imageData = workerCtx.getImageData(0, 0, w, h);
  const gray = toGray(imageData.data, w, h);
  const lap = applyLaplacian(gray, w, h);
  const variance = computeVariance(lap);
  return { variance, lap, w, h };
}

function buildHeatmap(lap, w, h) {
  let maxAbs = 0;
  for (let i = 0; i < lap.length; i++) {
    const a = Math.abs(lap[i]);
    if (a > maxAbs) maxAbs = a;
  }
  const hc = document.createElement('canvas');
  hc.width = w; hc.height = h;
  const hctx = hc.getContext('2d');
  const id = hctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const norm = maxAbs > 0 ? Math.abs(lap[i]) / maxAbs : 0;
    id.data[i * 4]     = Math.round(norm * 124 + (1 - norm) * 30);
    id.data[i * 4 + 1] = Math.round(norm * 230 + (1 - norm) * 10);
    id.data[i * 4 + 2] = Math.round(norm * 255 + (1 - norm) * 80);
    id.data[i * 4 + 3] = 255;
  }
  hctx.putImageData(id, 0, 0);
  return hc.toDataURL('image/png');
}

function varianceToScore(v) {
  if (v <= 0) return 0;
  const score = (Math.log10(v + 1) / Math.log10(20001)) * 100;
  return Math.min(100, Math.round(score));
}

function tierOf(v) {
  if (v >= 500) return { label: 'SHARP',  badge: 'badge-sharp',  color: '#00e676', text: 'Crisp edges, high detail. Suitable for analysis & processing.' };
  if (v >= 100) return { label: 'OK',     badge: 'badge-ok',     color: '#ffea00', text: 'Moderate sharpness. Usable but imperfect — mild blur or compression.' };
  return              { label: 'BLURRY', badge: 'badge-blurry', color: '#ff1744', text: 'Low edge content. Camera shake, defocus, or heavy filtering detected.' };
}

function fmtVariance(v) {
  return v < 10 ? v.toFixed(2) : v < 1000 ? v.toFixed(1) : Math.round(v).toLocaleString();
}

function createCard(result, rank, total) {
  const { name, src, variance, heatmapSrc } = result;
  const score = varianceToScore(variance);
  const tier  = tierOf(variance);
  const circ  = 2 * Math.PI * 24;
  const dashOffset = circ - (score / 100) * circ;
  const barPct = Math.min(100, (Math.log10(variance + 1) / Math.log10(20001)) * 100).toFixed(1);

  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${src}" alt="${name}" loading="lazy">
      <span class="rank-badge">#${rank} of ${total}</span>
      <span class="card-badge ${tier.badge}">${tier.label}</span>
    </div>
    <div class="card-body">
      <div class="card-name" title="${name}">${name}</div>
      <div class="score-row">
        <div class="ring-wrap">
          <svg viewBox="0 0 60 60">
            <circle class="ring-bg" cx="30" cy="30" r="24"/>
            <circle class="ring-fill" cx="30" cy="30" r="24"
              stroke="${tier.color}"
              stroke-dasharray="${circ.toFixed(2)}"
              stroke-dashoffset="${circ.toFixed(2)}"
              data-target="${dashOffset.toFixed(2)}"/>
          </svg>
          <div class="ring-text" style="color:${tier.color}">${score}</div>
        </div>
        <div class="score-info">
          <div class="score-label" style="color:${tier.color}">${tier.label}</div>
          <div class="score-verdict">${tier.text}</div>
        </div>
      </div>
      <div class="metrics">
        <div class="metric-row">
          <span class="metric-key">LAP.VARIANCE</span>
          <span class="metric-val">${fmtVariance(variance)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-key">THRESHOLD</span>
          <span class="metric-val">${variance >= 100 ? '✓ PASS' : '✗ FAIL'} @ 100</span>
        </div>
        <div class="metric-row">
          <span class="metric-key">SCORE</span>
          <span class="metric-val">${score}/100</span>
        </div>
      </div>
      <div class="var-bar-wrap">
        <div class="var-bar-label"><span>0</span><span>Blurry ←→ Sharp</span><span>500+</span></div>
        <div class="var-bar-track">
          <div class="var-bar-fill" style="width:0%; background:${tier.color}" data-target="${barPct}%"></div>
        </div>
      </div>
      <div class="heatmap-section">
        <div class="heatmap-label">EDGE HEATMAP (Laplacian response)</div>
        <img class="heatmap-canvas" src="${heatmapSrc}" alt="Edge heatmap">
      </div>
    </div>
  `;
  return card;
}

function renderSummary(results) {
  const avg = results.reduce((s, r) => s + r.variance, 0) / results.length;
  const best = results.reduce((a, b) => a.variance > b.variance ? a : b);
  const sharpCount = results.filter(r => r.variance >= 500).length;
  const blurCount  = results.filter(r => r.variance < 100).length;
  const okCount    = results.filter(r => r.variance >= 100 && r.variance < 500).length;
  const bestScore  = varianceToScore(best.variance);

  summaryBar.innerHTML = `
    <div class="stat-chip">
      <span class="label">Images</span>
      <span class="val" style="color:var(--accent2)">${results.length}</span>
    </div>
    <div class="stat-chip">
      <span class="label">Avg Variance</span>
      <span class="val" style="color:var(--cyan)">${fmtVariance(avg)}</span>
    </div>
    <div class="stat-chip">
      <span class="label">Sharp ≥500</span>
      <span class="val" style="color:var(--green)">${sharpCount} <span style="font-size:0.85rem;opacity:0.6">/ ${results.length}</span></span>
    </div>
    <div class="stat-chip">
      <span class="label">Blurry &lt;100</span>
      <span class="val" style="color:var(--red)">${blurCount} <span style="font-size:0.85rem;opacity:0.6">/ ${results.length}</span></span>
    </div>
    <div class="stat-chip">
      <span class="label">Best Score</span>
      <span class="val" style="color:${bestScore >= 63 ? 'var(--green)' : bestScore >= 47 ? 'var(--yellow)' : 'var(--red)'}">${bestScore}<span style="font-size:0.85rem;opacity:0.6">/100</span></span>
    </div>
  `;
}

function animateCards() {
  document.querySelectorAll('.ring-fill').forEach(el => {
    const target = el.dataset.target;
    requestAnimationFrame(() => { el.style.strokeDashoffset = target; });
  });
  document.querySelectorAll('.var-bar-fill').forEach(el => {
    const target = el.dataset.target;
    requestAnimationFrame(() => { el.style.width = target; });
  });
}

async function handleFiles(files) {
  if (!files || files.length === 0) return;
  const batch = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 20);
  if (batch.length === 0) return;

  spinner.style.display = 'block';
  resultsSection.style.display = 'none';

  const newResults = [];

  for (const file of batch) {
    await new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const { variance, lap, w, h } = analyzeImage(img);
        const heatmapSrc = buildHeatmap(lap, w, h);
        newResults.push({ name: file.name, src: url, variance, heatmapSrc });
        resolve();
      };
      img.onerror = resolve;
      img.src = url;
    });
  }

  allResults = [...allResults, ...newResults];
  allResults.sort((a, b) => b.variance - a.variance);

  spinner.style.display = 'none';
  resultsGrid.innerHTML = '';
  renderSummary(allResults);

  allResults.forEach((r, i) => {
    const card = createCard(r, i + 1, allResults.length);
    resultsGrid.appendChild(card);
  });

  resultsSection.style.display = 'flex';
  resultsSection.style.flexDirection = 'column';

  setTimeout(animateCards, 60);
  fileInput.value = '';
}

const backBtn = document.getElementById('backBtn');
if (backBtn) {
  backBtn.addEventListener('click', (e) => {
    if (window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  });
}
