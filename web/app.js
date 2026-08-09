import { loadSkins } from './skins.js';

const ASCII_RAMP = '@%#*+=-:. ';
const state = {
  skins: [], index: 0, playing: false, timer: null, image: null,
  asciiText: '', extracted: ['#25d9ff', '#ff3b81', '#63e67b'], sceneOrder: []
};
const el = (id) => document.getElementById(id);
const controls = {
  file: el('imageFile'), url: el('imageUrl'), loadUrl: el('loadUrl'),
  brandName: el('brandName'), brandMode: el('brandMode'),
  primary: el('primaryColor'), secondary: el('secondaryColor'), accent: el('accentColor'),
  width: el('asciiWidth'), widthValue: el('asciiWidthValue'), interval: el('interval'),
  shuffle: el('shuffle'), play: el('playPause'), previous: el('previous'), next: el('next'),
  exportProfile: el('exportProfile'), exportAscii: el('exportAscii'), exportHtml: el('exportHtml'),
  status: el('status'), skinName: el('skinName'), skinDescription: el('skinDescription'),
  skinCounter: el('skinCounter'), ascii: el('asciiPortrait'), terminalBrand: el('terminalBrand'),
  avatarPreview: el('avatarPreview')
};

function setStatus(message, tone = 'normal') {
  controls.status.textContent = message;
  controls.status.dataset.tone = tone;
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeImageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS image URLs are allowed.');
  if (isPrivateHost(url.hostname)) throw new Error('Private-network and local URLs are blocked.');
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1) return `https://github.com/${encodeURIComponent(parts[0])}.png?size=512`;
  }
  return url.href;
}

function loadImage(src, revokeAfter = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (revokeAfter) URL.revokeObjectURL(src);
      resolve(image);
    };
    image.onerror = () => {
      if (revokeAfter) URL.revokeObjectURL(src);
      reject(new Error('The image could not be loaded. The server may block browser access.'));
    };
    image.src = src;
  });
}

function sampleCanvas(image, maxWidth = 160) {
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  return { ctx, width, height };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function extractPalette(image) {
  const { ctx, width, height } = sampleCanvas(image, 80);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const buckets = [[], [], []];
  for (let i = 0; i < pixels.length; i += 16) {
    if (pixels[i + 3] < 180) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const saturation = Math.max(...rgb) - Math.min(...rgb);
    const brightness = rgb.reduce((sum, value) => sum + value, 0) / 3;
    buckets[saturation > 80 ? 0 : brightness > 155 ? 1 : 2].push(rgb);
  }
  return buckets.map((bucket, index) => {
    if (!bucket.length) return state.extracted[index];
    const total = bucket.reduce((acc, rgb) => rgb.map((value, i) => value + acc[i]), [0, 0, 0]);
    return rgbToHex(total[0] / bucket.length, total[1] / bucket.length, total[2] / bucket.length);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function imageToAscii(image, targetWidth) {
  const ratio = image.naturalHeight / image.naturalWidth;
  const targetHeight = Math.max(8, Math.round(targetWidth * ratio * 0.48));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  const data = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
  let text = '';
  let html = '';
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const index = (y * targetWidth + x) * 4;
      const r = data[index]; const g = data[index + 1]; const b = data[index + 2]; const a = data[index + 3];
      const brightness = a < 32 ? 255 : (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      const char = ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor((brightness / 255) * ASCII_RAMP.length))];
      text += char;
      html += char === ' ' ? ' ' : `<span style="color:rgb(${r},${g},${b})">${escapeHtml(char)}</span>`;
    }
    text += '\n'; html += '\n';
  }
  return { text, html };
}

function activeBrandColors(skin) {
  const mode = controls.brandMode.value;
  if (mode === 'unrestricted') return [skin.colors.ui_accent, skin.colors.ui_label, skin.colors.ui_ok];
  if (mode === 'extracted') return state.extracted;
  return [controls.primary.value, controls.secondary.value, controls.accent.value];
}

function applyTheme() {
  if (!state.skins.length) return;
  const skinIndex = state.sceneOrder[state.index] ?? state.index;
  const skin = state.skins[skinIndex];
  const [primary, secondary, accent] = activeBrandColors(skin);
  const root = document.documentElement;
  root.style.setProperty('--scene-bg', skin.colors.background || '#080b10');
  root.style.setProperty('--scene-text', skin.colors.ui_text || '#e6edf3');
  root.style.setProperty('--scene-border', skin.colors.ui_border || skin.colors.ui_accent);
  root.style.setProperty('--scene-selection', skin.colors.selection_bg || '#17313b');
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-accent', accent);
  controls.skinName.textContent = skin.name;
  controls.skinDescription.textContent = skin.description || 'Hermes skin';
  controls.skinCounter.textContent = `${state.index + 1} / ${state.skins.length}`;
  controls.terminalBrand.textContent = controls.brandName.value.trim() || 'HERMES IDENTITY';
}

function createSceneOrder() {
  state.sceneOrder = state.skins.map((_, index) => index);
  if (controls.shuffle.checked) {
    for (let i = state.sceneOrder.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.sceneOrder[i], state.sceneOrder[j]] = [state.sceneOrder[j], state.sceneOrder[i]];
    }
  }
  state.index = 0;
  applyTheme();
}

function advance(direction = 1) {
  if (!state.skins.length) return;
  state.index = (state.index + direction + state.skins.length) % state.skins.length;
  applyTheme();
}

function stopRotation() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null; state.playing = false; controls.play.textContent = 'Play';
}
function startRotation() {
  stopRotation();
  const seconds = Math.max(2, Number(controls.interval.value) || 15);
  state.playing = true; controls.play.textContent = 'Pause';
  state.timer = window.setInterval(() => advance(1), seconds * 1000);
}
function toggleRotation() { if (state.playing) stopRotation(); else startRotation(); }

function renderIdentity() {
  if (!state.image) return;
  const result = imageToAscii(state.image, Number(controls.width.value));
  state.asciiText = result.text;
  controls.ascii.innerHTML = result.html;
  controls.avatarPreview.src = state.image.src;
  controls.avatarPreview.hidden = false;
  applyTheme();
}

async function acceptImage(image, sourceLabel) {
  try {
    state.image = image;
    state.extracted = extractPalette(image);
    [controls.primary.value, controls.secondary.value, controls.accent.value] = state.extracted;
    renderIdentity();
    setStatus(`Identity loaded from ${sourceLabel}.`, 'success');
  } catch (error) {
    setStatus(`Image loaded, but browser security blocked pixel processing: ${error.message}`, 'error');
  }
}

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function profilePayload() {
  const skin = state.skins[state.sceneOrder[state.index] ?? 0];
  return {
    version: 1,
    profile: {
      id: (controls.brandName.value || 'community-profile').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: controls.brandName.value || 'Community Profile'
    },
    brand: {
      mode: controls.brandMode.value,
      colors: { primary: controls.primary.value, secondary: controls.secondary.value, accent: controls.accent.value }
    },
    identity: { ascii_width: Number(controls.width.value), source_stored: false },
    screensaver: {
      enabled: true, include_all_50: true,
      order: controls.shuffle.checked ? 'shuffle' : 'sequential',
      interval_seconds: Number(controls.interval.value), active_skin: skin?.name || null
    }
  };
}

function standalonePreview() {
  const profile = profilePayload();
  const ascii = escapeHtml(state.asciiText || 'Upload a profile image to generate ASCII.');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(profile.profile.name)} - Hermes Identity</title><style>body{margin:0;background:#07090d;color:${controls.secondary.value};font-family:ui-monospace,monospace;display:grid;place-items:center;min-height:100vh}main{width:min(900px,92vw);background:#080b10;border:1px solid ${controls.primary.value};border-radius:24px;padding:24px}pre{overflow:auto;color:${controls.accent.value};font-size:10px;line-height:.9}</style></head><body><main><h1>${escapeHtml(profile.profile.name)}</h1><p>Exported from Hermes Skinscape.</p><pre>${ascii}</pre></main></body></html>`;
}

controls.file.addEventListener('change', async () => {
  const file = controls.file.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return setStatus('Choose an image file.', 'error');
  if (file.size > 8 * 1024 * 1024) return setStatus('Image must be smaller than 8 MB.', 'error');
  try {
    const url = URL.createObjectURL(file);
    await acceptImage(await loadImage(url, true), file.name);
  } catch (error) { setStatus(error.message, 'error'); }
});

controls.loadUrl.addEventListener('click', async () => {
  try {
    setStatus('Loading remote image...');
    const url = normalizeImageUrl(controls.url.value.trim());
    await acceptImage(await loadImage(url), new URL(url).hostname);
  } catch (error) { setStatus(error.message, 'error'); }
});

controls.width.addEventListener('input', () => { controls.widthValue.textContent = controls.width.value; });
controls.width.addEventListener('change', renderIdentity);
controls.brandName.addEventListener('input', applyTheme);
controls.brandMode.addEventListener('change', applyTheme);
controls.primary.addEventListener('input', applyTheme);
controls.secondary.addEventListener('input', applyTheme);
controls.accent.addEventListener('input', applyTheme);
controls.shuffle.addEventListener('change', createSceneOrder);
controls.interval.addEventListener('change', () => { if (state.playing) startRotation(); });
controls.play.addEventListener('click', toggleRotation);
controls.previous.addEventListener('click', () => advance(-1));
controls.next.addEventListener('click', () => advance(1));
controls.exportProfile.addEventListener('click', () => download('hermes-profile.json', 'application/json', JSON.stringify(profilePayload(), null, 2)));
controls.exportAscii.addEventListener('click', () => download('hermes-identity.txt', 'text/plain', state.asciiText || ''));
controls.exportHtml.addEventListener('click', () => download('hermes-preview.html', 'text/html', standalonePreview()));

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') advance(1);
  if (event.key === 'ArrowLeft') advance(-1);
  if (event.key === ' ') { event.preventDefault(); toggleRotation(); }
});

async function init() {
  setStatus('Loading the original 50 Hermes skins...');
  state.skins = await loadSkins('./skins');
  createSceneOrder();
  controls.widthValue.textContent = controls.width.value;
  setStatus(`${state.skins.length} skins loaded. Upload an image or paste an HTTPS URL.`, 'success');
}
init();
