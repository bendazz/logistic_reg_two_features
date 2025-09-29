// app.js — generate synthetic two-feature binary data, plot, and export CSV

// Minimal seeded RNG for reproducibility (Mulberry32)
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution
function randn(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng(); // Converting [0,1) to (0,1)
  while (v === 0) v = rng();
  const mag = Math.sqrt(-2.0 * Math.log(u));
  const z0 = mag * Math.cos(2.0 * Math.PI * v);
  return z0;
}

function generateData({ n = 200, seed = 42 } = {}) {
  const rng = mulberry32(seed);

  // Create two Gaussian blobs for classes 0 (blue) and 1 (red)
  // Means are separated to create a non-trivial decision boundary
  const means = {
    // Shift to lie mostly within [0,10]
    0: { x1: 3.0, x2: 3.5 },
    1: { x1: 7.0, x2: 6.5 },
  };
  const std = 1.1; // slightly wider but will clamp to [0,10]

  const data = [];
  for (let i = 0; i < n; i++) {
    const y = i < n / 2 ? 0 : 1; // balance classes
    const m = means[y];
    let x1 = m.x1 + std * randn(rng);
    let x2 = m.x2 + std * randn(rng);
    // Clamp to [0,10]
    x1 = Math.min(10, Math.max(0, x1));
    x2 = Math.min(10, Math.max(0, x2));
    data.push({ x1, x2, y });
  }
  return data;
}

function toCsv(rows) {
  const header = ["x1", "x2", "y"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(`${r.x1},${r.x2},${r.y}`);
  }
  return lines.join("\n");
}

function downloadText(filename, text) {
  // Deprecated in this app: switching to clipboard copy. Keeping function name
  // for minimal changes elsewhere.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback if clipboard API fails
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    });
  } else {
    // Fallback for very old browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
}

function createScatterChart(ctx, points) {
  const blue = points
    .filter((p) => p.y === 0)
    .map((p) => ({ x: p.x1, y: p.x2 }));
  const red = points
    .filter((p) => p.y === 1)
    .map((p) => ({ x: p.x1, y: p.x2 }));

  // Determine bounds with padding for nicer view
  const xs = points.map((p) => p.x1);
  const ys = points.map((p) => p.x2);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const padX = 0.15 * (xMax - xMin || 1);
  const padY = 0.15 * (yMax - yMin || 1);

  return new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Class 0 (blue)",
          data: blue,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#1d4ed8",
          pointRadius: 4,
          pointHoverRadius: 5,
        },
        {
          label: "Class 1 (red)",
          data: red,
          pointBackgroundColor: "#ef4444",
          pointBorderColor: "#b91c1c",
          pointRadius: 4,
          pointHoverRadius: 5,
        },
        // Horizontal reference line: x2 = 0 (y = 0)
        {
          type: "line",
          label: "x2 = 0",
          data: [
            { x: xMin - padX, y: 0 },
            { x: xMax + padX, y: 0 },
          ],
          borderColor: "#111827",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          borderDash: [],
          order: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "x1" },
          type: "linear",
          min: xMin - padX,
          max: xMax + padX,
          grid: { color: "rgba(0,0,0,0.06)" },
        },
        y: {
          title: { display: true, text: "x2" },
          min: yMin - padY,
          max: yMax + padY,
          grid: { color: "rgba(0,0,0,0.06)" },
        },
      },
      plugins: {
        legend: { position: "top" },
        tooltip: { enabled: false },
      },
    },
  });
}

// Main
let DATA = [];
let chart;
let currentSeed = 123;
let WEIGHT_STEPS = [];
let stepIndex = -1; // -1 => baseline (x2 = 0)
let animTimer = null;

function parseWeightsCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const out = [];
  const first = lines[0].toLowerCase();
  const startIdx = first.includes('w0') && first.includes('w1') && first.includes('w2') ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(/\s*,\s*/);
    if (parts.length < 3) continue;
    const w0 = parseFloat(parts[0]);
    const w1 = parseFloat(parts[1]);
    const w2 = parseFloat(parts[2]);
    if ([w0, w1, w2].every(Number.isFinite)) {
      out.push({ w0, w1, w2 });
    }
  }
  return out;
}

function setBaselineLine() {
  const xMin = chart.options.scales.x.min;
  const xMax = chart.options.scales.x.max;
  const ds = chart.data.datasets[2];
  ds.data = [
    { x: xMin, y: 0 },
    { x: xMax, y: 0 },
  ];
  ds.label = "x2 = 0";
}

function setDecisionLineFromWeights(w) {
  const xMin = chart.options.scales.x.min;
  const xMax = chart.options.scales.x.max;
  const yMin = chart.options.scales.y.min;
  const yMax = chart.options.scales.y.max;
  const ds = chart.data.datasets[2];
  const { w0, w1, w2 } = w;
  let data = [];
  if ([w0, w1, w2].every(Number.isFinite)) {
    if (Math.abs(w2) > 1e-12) {
      // General case: x2 = -(w0 + w1*x1)/w2
      data = [
        { x: xMin, y: -(w0 + w1 * xMin) / w2 },
        { x: xMax, y: -(w0 + w1 * xMax) / w2 },
      ];
    } else if (Math.abs(w1) > 1e-12) {
      // Vertical line: x1 = -w0/w1
      const xConst = -w0 / w1;
      data = [
        { x: xConst, y: yMin },
        { x: xConst, y: yMax },
      ];
    } else {
      // Degenerate: no well-defined boundary (w1==w2==0)
      data = [];
    }
  }
  ds.data = data;
  ds.label = "Decision boundary";
}

function updateAnimStatus() {
  const statusEl = document.getElementById('animStatus');
  const animateBtn = document.getElementById('animateBtn');
  const stepBtn = document.getElementById('stepBtn');
  const resetBtn = document.getElementById('resetAnimBtn');
  const loaded = WEIGHT_STEPS.length;
  if (loaded === 0) {
    statusEl.textContent = '0 steps loaded';
    animateBtn.disabled = true;
    stepBtn.disabled = true;
    resetBtn.disabled = true;
  } else {
    const at = stepIndex < 0 ? 0 : stepIndex + 1;
    statusEl.textContent = `${loaded} step${loaded !== 1 ? 's' : ''} loaded • at ${at}/${loaded}`;
    animateBtn.disabled = false;
    stepBtn.disabled = stepIndex >= loaded - 1;
    resetBtn.disabled = false;
  }
}

function stopAnimation() {
  if (animTimer !== null) {
    clearInterval(animTimer);
    animTimer = null;
  }
  const animateBtn = document.getElementById('animateBtn');
  if (animateBtn) animateBtn.textContent = 'Animate';
}

window.addEventListener("DOMContentLoaded", () => {
  DATA = generateData({ n: 200, seed: currentSeed });
  document.getElementById("nPoints").textContent = String(DATA.length);

  const ctx = document.getElementById("scatterChart");
  chart = createScatterChart(ctx, DATA);

  document.getElementById("downloadCsvBtn").addEventListener("click", () => {
    const csv = toCsv(DATA);
    downloadText("two_feature_binary_dataset.csv", csv);
    // Optional: brief visual confirmation
    const btn = document.getElementById("downloadCsvBtn");
    const prev = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = prev; }, 900);
  });

  // Regenerate button: new seed to produce a different dataset each time
  document.getElementById("regenBtn").addEventListener("click", () => {
    // Reset animation state and boundary to baseline
    stopAnimation();
    stepIndex = -1;
    currentSeed = (currentSeed * 9301 + 49297) % 233280; // simple LCG step
    DATA = generateData({ n: 200, seed: currentSeed || 1 });
    document.getElementById("nPoints").textContent = String(DATA.length);

    // Recompute datasets and update chart bounds and line
    const blue = DATA.filter(p => p.y === 0).map(p => ({ x: p.x1, y: p.x2 }));
    const red = DATA.filter(p => p.y === 1).map(p => ({ x: p.x1, y: p.x2 }));

    const xs = DATA.map(p => p.x1);
    const ys = DATA.map(p => p.x2);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const padX = 0.15 * (xMax - xMin || 1);
    const padY = 0.15 * (yMax - yMin || 1);

    chart.data.datasets[0].data = blue;
    chart.data.datasets[1].data = red;
    // Reset decision line to baseline y = 0
    chart.data.datasets[2].data = [
      { x: xMin - padX, y: 0 },
      { x: xMax + padX, y: 0 },
    ];

    chart.options.scales.x.min = xMin - padX;
    chart.options.scales.x.max = xMax + padX;
    chart.options.scales.y.min = yMin - padY;
    chart.options.scales.y.max = yMax + padY;

    // Always baseline on regenerate
    setBaselineLine();

    chart.update();
    // Initialize UI state for animation controls
    updateAnimStatus();
  });

  // Load weights CSV
  document.getElementById('loadWeightsBtn').addEventListener('click', () => {
    stopAnimation();
    const txt = (document.getElementById('weightsCsv').value || '').trim();
    const steps = parseWeightsCsv(txt);
    WEIGHT_STEPS = steps;
    stepIndex = -1;
    setBaselineLine();
    chart.update();
    updateAnimStatus();
  });

  // Step through weights
  document.getElementById('stepBtn').addEventListener('click', () => {
    if (WEIGHT_STEPS.length === 0) return;
    if (stepIndex < WEIGHT_STEPS.length - 1) {
      stepIndex += 1;
      setDecisionLineFromWeights(WEIGHT_STEPS[stepIndex]);
      chart.update();
      updateAnimStatus();
    }
  });

  // Animate through all steps
  document.getElementById('animateBtn').addEventListener('click', () => {
    if (WEIGHT_STEPS.length === 0) return;
    const btn = document.getElementById('animateBtn');
    const speed = parseInt(document.getElementById('speedRange').value, 10) || 300;
    if (animTimer !== null) {
      // Pause
      stopAnimation();
      updateAnimStatus();
      return;
    }
    // Start animation
    btn.textContent = 'Pause';
    animTimer = setInterval(() => {
      if (stepIndex < WEIGHT_STEPS.length - 1) {
        stepIndex += 1;
        setDecisionLineFromWeights(WEIGHT_STEPS[stepIndex]);
        chart.update();
        updateAnimStatus();
      } else {
        stopAnimation();
        updateAnimStatus();
      }
    }, speed);
  });

  // Reset animation state
  document.getElementById('resetAnimBtn').addEventListener('click', () => {
    stopAnimation();
    stepIndex = -1;
    setBaselineLine();
    chart.update();
    updateAnimStatus();
  });
});
