const dataInput = document.getElementById('dataInput');
const fileInput = document.getElementById('fileInput');
const sampleButton = document.getElementById('sampleButton');
const computeButton = document.getElementById('computeButton');
const spectrumCanvas = document.getElementById('spectrumCanvas');
const ctx = spectrumCanvas.getContext('2d');

const colorSwatch = document.getElementById('colorSwatch');
const srgbText = document.getElementById('srgbText');
const hexText = document.getElementById('hexText');
const xyzText = document.getElementById('xyzText');
const xyyText = document.getElementById('xyyText');
const labText = document.getElementById('labText');

const REF_WHITE = { x: 95.047, y: 100.0, z: 108.883 };

function parseSpectralData(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    const cleaned = line.trim();
    if (!cleaned || cleaned.startsWith('#') || cleaned.startsWith('//')) {
      continue;
    }
    const numbers = cleaned.match(/-?\d*\.?\d+/g);
    if (!numbers || numbers.length < 2) {
      continue;
    }
    const wavelength = Number(numbers[0]);
    const reflectance = Number(numbers[1]);
    if (Number.isNaN(wavelength) || Number.isNaN(reflectance)) {
      continue;
    }
    entries.push({ wavelength, reflectance });
  }

  entries.sort((a, b) => a.wavelength - b.wavelength);
  return entries;
}

function interpolateReflectance(entries, wavelength) {
  if (!entries.length) {
    return 0;
  }
  if (wavelength <= entries[0].wavelength) {
    return entries[0].reflectance;
  }
  if (wavelength >= entries[entries.length - 1].wavelength) {
    return entries[entries.length - 1].reflectance;
  }
  for (let i = 0; i < entries.length - 1; i += 1) {
    const current = entries[i];
    const next = entries[i + 1];
    if (wavelength >= current.wavelength && wavelength <= next.wavelength) {
      const t = (wavelength - current.wavelength) / (next.wavelength - current.wavelength);
      return current.reflectance + t * (next.reflectance - current.reflectance);
    }
  }
  return 0;
}

function normalizeReflectance(value) {
  if (value > 1.0) {
    return value / 100;
  }
  return value;
}

function computeXYZ(entries) {
  const { wavelengths, xbar, ybar, zbar, d65 } = CMF_DATA;
  const step = 5;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let kDen = 0;

  wavelengths.forEach((wl, idx) => {
    const raw = interpolateReflectance(entries, wl);
    const r = normalizeReflectance(raw);
    const spd = d65[idx];
    kDen += spd * ybar[idx] * step;
    sumX += r * spd * xbar[idx] * step;
    sumY += r * spd * ybar[idx] * step;
    sumZ += r * spd * zbar[idx] * step;
  });

  const k = kDen === 0 ? 0 : 100 / kDen;
  return {
    x: sumX * k,
    y: sumY * k,
    z: sumZ * k
  };
}

function xyzToLinearRgb({ x, y, z }) {
  const xr = x / 100;
  const yr = y / 100;
  const zr = z / 100;
  return {
    r: 3.2406 * xr - 1.5372 * yr - 0.4986 * zr,
    g: -0.9689 * xr + 1.8758 * yr + 0.0415 * zr,
    b: 0.0557 * xr - 0.2040 * yr + 1.0570 * zr
  };
}

function linearToSrgb(channel) {
  if (channel <= 0.0031308) {
    return 12.92 * channel;
  }
  return 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function xyzToLab({ x, y, z }) {
  const fx = fLab(x / REF_WHITE.x);
  const fy = fLab(y / REF_WHITE.y);
  const fz = fLab(z / REF_WHITE.z);
  return {
    l: Math.max(0, 116 * fy - 16),
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

function fLab(t) {
  const delta = 6 / 29;
  if (t > Math.pow(delta, 3)) {
    return Math.cbrt(t);
  }
  return t / (3 * delta * delta) + 4 / 29;
}

function xyzToXyy({ x, y, z }) {
  const sum = x + y + z;
  if (sum === 0) {
    return { x: 0, y: 0, Y: y };
  }
  return { x: x / sum, y: y / sum, Y: y };
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function drawSpectrum(entries) {
  const width = spectrumCanvas.width;
  const height = spectrumCanvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#d0d7e2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 5; i += 1) {
    const y = (height - 40) * (i / 5) + 20;
    ctx.moveTo(40, y);
    ctx.lineTo(width - 20, y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#5c6f88';
  ctx.beginPath();
  ctx.moveTo(40, 20);
  ctx.lineTo(40, height - 20);
  ctx.lineTo(width - 20, height - 20);
  ctx.stroke();

  if (!entries.length) {
    return;
  }

  const minWl = 380;
  const maxWl = 780;

  ctx.strokeStyle = '#1e6fff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let wl = minWl; wl <= maxWl; wl += 5) {
    const value = interpolateReflectance(entries, wl);
    const r = normalizeReflectance(value);
    const x = 40 + ((wl - minWl) / (maxWl - minWl)) * (width - 60);
    const y = height - 20 - r * (height - 60);
    if (wl === minWl) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function updateResults(entries) {
  const xyz = computeXYZ(entries);
  const lab = xyzToLab(xyz);
  const xyy = xyzToXyy(xyz);
  const linearRgb = xyzToLinearRgb(xyz);
  const srgb = {
    r: clamp01(linearToSrgb(linearRgb.r)),
    g: clamp01(linearToSrgb(linearRgb.g)),
    b: clamp01(linearToSrgb(linearRgb.b))
  };

  const rgb255 = {
    r: Math.round(srgb.r * 255),
    g: Math.round(srgb.g * 255),
    b: Math.round(srgb.b * 255)
  };

  const hex = `#${rgb255.r.toString(16).padStart(2, '0')}${rgb255.g
    .toString(16)
    .padStart(2, '0')}${rgb255.b.toString(16).padStart(2, '0')}`.toUpperCase();

  colorSwatch.style.background = hex;
  srgbText.textContent = `sRGB: ${rgb255.r}, ${rgb255.g}, ${rgb255.b}`;
  hexText.textContent = `HEX: ${hex}`;
  xyzText.textContent = `${formatNumber(xyz.x, 2)}, ${formatNumber(xyz.y, 2)}, ${formatNumber(xyz.z, 2)}`;
  xyyText.textContent = `${formatNumber(xyy.x, 4)}, ${formatNumber(xyy.y, 4)}, ${formatNumber(xyy.Y, 2)}`;
  labText.textContent = `${formatNumber(lab.l, 2)}, ${formatNumber(lab.a, 2)}, ${formatNumber(lab.b, 2)}`;
}

function handleCompute() {
  const entries = parseSpectralData(dataInput.value);
  if (!entries.length) {
    drawSpectrum([]);
    colorSwatch.style.background = '#eee';
    srgbText.textContent = 'sRGB: -';
    hexText.textContent = 'HEX: -';
    xyzText.textContent = '-';
    xyyText.textContent = '-';
    labText.textContent = '-';
    return;
  }
  drawSpectrum(entries);
  updateResults(entries);
}

fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    dataInput.value = e.target.result;
    handleCompute();
  };
  reader.readAsText(file);
});

sampleButton.addEventListener('click', () => {
  dataInput.value = SAMPLE_QTX;
  handleCompute();
});

computeButton.addEventListener('click', () => {
  handleCompute();
});

drawSpectrum([]);
