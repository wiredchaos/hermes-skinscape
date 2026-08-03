const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const DEFAULT_COLUMNS = 72;
const DEFAULT_FPS = 12;
const CHARACTER_ASPECT = 0.52;
const SUPPORTED_EXTENSION = /\.(mp4|webm|mov|m4v)$/i;

const RAMPS = Object.freeze({
  detailed: '@%#*+=-:. ',
  blocks: '█▓▒░ ',
  terminal: 'MNHQ$OC?7>!:-;. ',
  minimal: '#+=-. ',
  binary: '10 '
});

const state = {
  objectUrl: null,
  loaded: false,
  rendering: false,
  recording: false,
  frameText: '',
  timer: null,
  frameCallbackId: null,
  lastFrameAt: 0,
  primedFileName: ''
};

function mountStyles() {
  if (document.querySelector('link[data-video-ascii]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './web/video-ascii.css';
  link.dataset.videoAscii = 'true';
  document.head.append(link);
}

function mountInterface() {
  if (document.getElementById('videoAscii')) return;
  const exportsSection = document.getElementById('exports');
  const section = document.createElement('section');
  section.id = 'videoAscii';
  section.className = 'video-ascii command-card glass-panel';
  section.setAttribute('aria-labelledby', 'video-ascii-title');
  section.innerHTML = `
    <div class="section-heading video-ascii-heading">
      <div>
        <p class="eyebrow">ANIMATED ASCII FORGE</p>
        <h2 id="video-ascii-title">Turn a video into living ASCII.</h2>
        <p>Upload a local video. Frames are sampled and redrawn as ASCII inside your browser. The source file is not uploaded.</p>
      </div>
      <output id="videoAsciiStatus" class="video-ascii-status" aria-live="polite">Waiting for a video.</output>
    </div>

    <div class="video-ascii-grid">
      <div class="video-ascii-controls">
        <label class="video-drop">
          Video file
          <input id="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v">
          <span>MP4, WebM, MOV, or M4V · up to 250 MB</span>
        </label>

        <div class="video-control-grid">
          <label>ASCII columns
            <input id="videoAsciiColumns" type="range" min="32" max="140" value="72">
            <output id="videoAsciiColumnsValue">72</output>
          </label>
          <label>Preview FPS
            <input id="videoAsciiFps" type="range" min="4" max="24" value="12">
            <output id="videoAsciiFpsValue">12</output>
          </label>
          <label>Glyph ramp
            <select id="videoAsciiRamp">
              <option value="detailed">Detailed</option>
              <option value="terminal">Terminal</option>
              <option value="blocks">Blocks</option>
              <option value="minimal">Minimal</option>
              <option value="binary">Binary</option>
            </select>
          </label>
          <label>Color mode
            <select id="videoAsciiColorMode">
              <option value="source">Source video color</option>
              <option value="skin">Current Hermes skin</option>
              <option value="brand">Protected brand color</option>
              <option value="mono">Monochrome</option>
            </select>
          </label>
        </div>

        <div class="video-ascii-options">
          <label><input id="videoAsciiInvert" type="checkbox"> Invert brightness</label>
          <label><input id="videoAsciiAudio" type="checkbox" checked> Include source audio in export</label>
        </div>

        <div class="video-ascii-actions">
          <button id="videoAsciiPlay" type="button" disabled>Play ASCII</button>
          <button id="videoAsciiPause" type="button" disabled>Pause</button>
          <button id="videoAsciiExport" class="primary-action button-reset" type="button" disabled>Export ASCII WebM</button>
          <button id="videoAsciiText" type="button" disabled>Current frame TXT</button>
        </div>

        <details class="inline-hint">
          <summary>What is animated ASCII?</summary>
          <p>The converter samples each decoded video frame, maps brightness to text characters, and draws the result onto a recording-ready canvas. Higher column counts look sharper but require more processing.</p>
        </details>
      </div>

      <div class="video-ascii-stage">
        <video id="asciiSourceVideo" class="ascii-source-video" playsinline webkit-playsinline preload="auto"></video>
        <canvas id="asciiVideoCanvas" width="960" height="540" aria-label="Animated ASCII video preview"></canvas>
        <div id="asciiVideoPlaceholder" class="ascii-video-placeholder">
          <strong>UPLOAD VIDEO</strong>
          <span>TO INITIALIZE THE ANIMATED ASCII GRID</span>
        </div>
        <div class="video-ascii-hud">
          <span id="videoAsciiTime">00:00 / 00:00</span>
          <span id="videoAsciiPipeline">LOCAL FRAME PIPELINE</span>
        </div>
      </div>
    </div>`;
  exportsSection?.before(section);
}

mountStyles();
mountInterface();

const byId = (id) => document.getElementById(id);
const ui = {
  file: byId('videoFile'),
  video: byId('asciiSourceVideo'),
  canvas: byId('asciiVideoCanvas'),
  placeholder: byId('asciiVideoPlaceholder'),
  status: byId('videoAsciiStatus'),
  columns: byId('videoAsciiColumns'),
  columnsValue: byId('videoAsciiColumnsValue'),
  fps: byId('videoAsciiFps'),
  fpsValue: byId('videoAsciiFpsValue'),
  ramp: byId('videoAsciiRamp'),
  colorMode: byId('videoAsciiColorMode'),
  invert: byId('videoAsciiInvert'),
  audio: byId('videoAsciiAudio'),
  play: byId('videoAsciiPlay'),
  pause: byId('videoAsciiPause'),
  export: byId('videoAsciiExport'),
  text: byId('videoAsciiText'),
  time: byId('videoAsciiTime'),
  pipeline: byId('videoAsciiPipeline')
};

const workCanvas = document.createElement('canvas');
const workContext = workCanvas.getContext('2d', { willReadFrequently: true });
const outputContext = ui.canvas?.getContext('2d', { alpha: false });

ui.video.muted = true;
ui.video.defaultMuted = true;
ui.video.playsInline = true;
ui.invert.checked = false;

function setStatus(message, tone = 'normal') {
  if (!ui.status) return;
  ui.status.textContent = message;
  ui.status.dataset.tone = tone;
}

function setPipeline(label) {
  if (ui.pipeline) ui.pipeline.textContent = label;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function currentCssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function colorForPixel(r, g, b) {
  switch (ui.colorMode.value) {
    case 'skin': return currentCssColor('--scene-text', '#f5f5f5');
    case 'brand': return currentCssColor('--brand-primary', '#ff526e');
    case 'mono': return '#f5f5f5';
    default: return `rgb(${r},${g},${b})`;
  }
}

function drawMessage(title, subtitle = '') {
  if (!outputContext) return;
  outputContext.fillStyle = currentCssColor('--scene-bg', '#090720');
  outputContext.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
  outputContext.textAlign = 'center';
  outputContext.textBaseline = 'middle';
  outputContext.fillStyle = currentCssColor('--gamma-coral', '#ff526e');
  outputContext.font = '700 34px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  outputContext.fillText(title, ui.canvas.width / 2, (ui.canvas.height / 2) - 18);
  if (subtitle) {
    outputContext.fillStyle = '#aaa3c2';
    outputContext.font = '600 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    outputContext.fillText(subtitle, ui.canvas.width / 2, (ui.canvas.height / 2) + 24);
  }
}

function prepareGeometry() {
  const columns = Number(ui.columns.value) || DEFAULT_COLUMNS;
  const sourceWidth = ui.video.videoWidth;
  const sourceHeight = ui.video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  const ratio = sourceHeight / sourceWidth;
  const rows = Math.max(10, Math.round(columns * ratio * CHARACTER_ASPECT));
  if (workCanvas.width !== columns || workCanvas.height !== rows) {
    workCanvas.width = columns;
    workCanvas.height = rows;
  }

  const targetWidth = Math.min(1280, Math.max(640, columns * 12));
  const targetHeight = Math.max(360, Math.round(targetWidth * ratio));
  if (ui.canvas.width !== targetWidth || ui.canvas.height !== targetHeight) {
    ui.canvas.width = targetWidth;
    ui.canvas.height = targetHeight;
  }
  return { columns, rows };
}

function renderFrame() {
  if (!state.loaded || ui.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  if (!workContext || !outputContext) throw new Error('Canvas rendering is unavailable in this browser.');

  const geometry = prepareGeometry();
  if (!geometry) return false;
  const { columns, rows } = geometry;

  workContext.drawImage(ui.video, 0, 0, columns, rows);
  const pixels = workContext.getImageData(0, 0, columns, rows).data;
  const ramp = RAMPS[ui.ramp.value] || RAMPS.detailed;
  const cellWidth = ui.canvas.width / columns;
  const cellHeight = ui.canvas.height / rows;
  const fontSize = Math.max(5, cellHeight * 1.08);

  outputContext.fillStyle = currentCssColor('--scene-bg', '#090720');
  outputContext.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
  outputContext.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  outputContext.textAlign = 'center';
  outputContext.textBaseline = 'middle';

  let text = '';
  let visibleGlyphs = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const index = (y * columns + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      let brightness = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      if (ui.invert.checked) brightness = 255 - brightness;
      const rampIndex = Math.min(ramp.length - 1, Math.floor((brightness / 256) * ramp.length));
      const glyph = ramp[rampIndex];
      text += glyph;
      if (glyph !== ' ') {
        visibleGlyphs += 1;
        outputContext.fillStyle = colorForPixel(r, g, b);
        outputContext.fillText(glyph, (x + 0.5) * cellWidth, (y + 0.52) * cellHeight);
      }
    }
    text += '\n';
  }

  state.frameText = text;
  ui.time.textContent = `${formatTime(ui.video.currentTime)} / ${formatTime(ui.video.duration)}`;
  setPipeline(visibleGlyphs ? 'ASCII FRAME ACTIVE' : 'FRAME DECODED · LOW CONTRAST');
  return true;
}

function renderSafely() {
  try {
    return renderFrame();
  } catch (error) {
    stopLoop();
    setStatus(error instanceof Error ? error.message : 'Unable to render this video frame.', 'error');
    setPipeline('RENDER ERROR');
    return false;
  }
}

function stopLoop() {
  state.rendering = false;
  if (state.timer) window.clearTimeout(state.timer);
  state.timer = null;
  if (state.frameCallbackId !== null && typeof ui.video.cancelVideoFrameCallback === 'function') {
    ui.video.cancelVideoFrameCallback(state.frameCallbackId);
  }
  state.frameCallbackId = null;
}

function scheduleNextFrame() {
  if (!state.rendering) return;
  const fps = Number(ui.fps.value) || DEFAULT_FPS;
  const minimumInterval = 1000 / fps;

  if (typeof ui.video.requestVideoFrameCallback === 'function') {
    state.frameCallbackId = ui.video.requestVideoFrameCallback((now) => {
      if (!state.rendering) return;
      if ((now - state.lastFrameAt) >= minimumInterval) {
        renderSafely();
        state.lastFrameAt = now;
      }
      scheduleNextFrame();
    });
    return;
  }

  state.timer = window.setTimeout(() => {
    renderSafely();
    scheduleNextFrame();
  }, minimumInterval);
}

function startLoop() {
  stopLoop();
  state.rendering = true;
  state.lastFrameAt = 0;
  renderSafely();
  scheduleNextFrame();
}

function enableControls(enabled) {
  [ui.play, ui.pause, ui.export, ui.text].forEach((button) => {
    if (button) button.disabled = !enabled;
  });
}

async function startPreview({ restart = false, automatic = false } = {}) {
  if (!state.loaded) return;
  try {
    if (restart || ui.video.ended) ui.video.currentTime = 0;
    ui.video.muted = true;
    await ui.video.play();
    startLoop();
    setStatus(
      automatic ? `${state.primedFileName} playing as animated ASCII.` : 'Animated ASCII preview playing.',
      'success'
    );
    setPipeline('ASCII STREAM ACTIVE');
  } catch {
    renderSafely();
    setStatus('Video decoded. Tap Play ASCII to begin the animated preview.', 'success');
    setPipeline('FRAME READY · TAP PLAY');
  }
}

async function primeDecodedFrame() {
  if (!state.loaded) return;
  const duration = Number.isFinite(ui.video.duration) ? ui.video.duration : 0;
  const primeTime = duration > 0.2 ? Math.min(0.12, duration * 0.05) : 0;

  if (Math.abs(ui.video.currentTime - primeTime) > 0.01) {
    await new Promise((resolve) => {
      const finish = () => resolve();
      ui.video.addEventListener('seeked', finish, { once: true });
      window.setTimeout(finish, 800);
      try {
        ui.video.currentTime = primeTime;
      } catch {
        resolve();
      }
    });
  }

  renderSafely();
  await startPreview({ automatic: true });
}

async function loadVideo(file) {
  if (!file) return;
  const hasVideoType = file.type?.startsWith('video/');
  if (!hasVideoType && !SUPPORTED_EXTENSION.test(file.name)) {
    setStatus('Choose an MP4, WebM, MOV, or M4V video.', 'error');
    return;
  }
  if (file.size > MAX_VIDEO_BYTES) {
    setStatus('Video must be 250 MB or smaller for browser processing.', 'error');
    return;
  }

  stopLoop();
  ui.video.pause();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  state.loaded = false;
  state.primedFileName = file.name;
  enableControls(false);
  ui.placeholder.hidden = false;
  ui.placeholder.querySelector('strong').textContent = 'DECODING VIDEO';
  ui.placeholder.querySelector('span').textContent = 'WAITING FOR THE FIRST PLAYABLE FRAME';
  drawMessage('DECODING VIDEO', 'Preparing local frame pipeline');
  setStatus(`Reading ${file.name}...`);
  setPipeline('DECODER INITIALIZING');
  ui.video.src = state.objectUrl;
  ui.video.load();
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm'
  ];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

async function exportAsciiVideo() {
  if (!state.loaded || state.recording) return;
  if (!window.MediaRecorder || !ui.canvas.captureStream) {
    setStatus('This browser cannot record canvas video. Try current Chrome, Edge, or Firefox.', 'error');
    return;
  }

  const fps = Number(ui.fps.value) || DEFAULT_FPS;
  const canvasStream = ui.canvas.captureStream(fps);
  let exportStream = canvasStream;

  if (ui.audio.checked && ui.video.captureStream) {
    try {
      const sourceStream = ui.video.captureStream();
      const audioTracks = sourceStream.getAudioTracks();
      exportStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
    } catch {
      setStatus('Audio capture unavailable; exporting silent ASCII video.');
    }
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(
    exportStream,
    mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined
  );
  const chunks = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.addEventListener('stop', () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    downloadBlob('hermes-animated-ascii.webm', blob);
    state.recording = false;
    ui.export.disabled = false;
    ui.video.muted = true;
    setStatus('ASCII WebM exported locally.', 'success');
    setPipeline('EXPORT COMPLETE');
  }, { once: true });

  state.recording = true;
  ui.export.disabled = true;
  setStatus('Recording ASCII video in real time. Keep this tab active...');
  setPipeline('RECORDING ASCII WEBM');
  ui.video.currentTime = 0;
  ui.video.muted = true;
  await ui.video.play();
  startLoop();
  recorder.start(1000);

  ui.video.addEventListener('ended', () => {
    stopLoop();
    if (recorder.state !== 'inactive') recorder.stop();
  }, { once: true });
}

ui.file.addEventListener('change', () => loadVideo(ui.file.files?.[0]));
ui.video.addEventListener('loadedmetadata', () => {
  setStatus(`${state.primedFileName || 'Video'} metadata loaded · ${formatTime(ui.video.duration)} · decoding first frame...`);
  setPipeline('METADATA READY · DECODING');
});
ui.video.addEventListener('loadeddata', async () => {
  if (state.loaded) return;
  state.loaded = true;
  enableControls(true);
  ui.placeholder.hidden = true;
  prepareGeometry();
  await primeDecodedFrame();
});
ui.video.addEventListener('canplay', async () => {
  if (!state.loaded) {
    state.loaded = true;
    enableControls(true);
    ui.placeholder.hidden = true;
    prepareGeometry();
    await primeDecodedFrame();
  }
});
ui.video.addEventListener('seeked', renderSafely);
ui.video.addEventListener('ended', () => {
  if (!state.recording) {
    stopLoop();
    renderSafely();
    setStatus('ASCII preview complete. Tap Play ASCII to replay.', 'success');
    setPipeline('PREVIEW COMPLETE');
  }
});
ui.video.addEventListener('error', () => {
  state.loaded = false;
  enableControls(false);
  stopLoop();
  setStatus('The browser could not decode this video. Try MP4/H.264 or WebM.', 'error');
  setPipeline('VIDEO DECODE FAILED');
  drawMessage('VIDEO DECODE FAILED', 'Try MP4/H.264 or WebM');
});
ui.play.addEventListener('click', () => startPreview({ restart: ui.video.ended }));
ui.pause.addEventListener('click', () => {
  ui.video.pause();
  stopLoop();
  renderSafely();
  setStatus('ASCII preview paused.');
  setPipeline('ASCII STREAM PAUSED');
});
ui.export.addEventListener('click', () => {
  exportAsciiVideo().catch((error) => {
    state.recording = false;
    ui.export.disabled = false;
    setStatus(error instanceof Error ? error.message : 'Unable to export ASCII video.', 'error');
    setPipeline('EXPORT ERROR');
  });
});
ui.text.addEventListener('click', () => {
  downloadBlob('hermes-ascii-frame.txt', new Blob([state.frameText], { type: 'text/plain' }));
});
ui.columns.addEventListener('input', () => {
  ui.columnsValue.textContent = ui.columns.value;
  renderSafely();
});
ui.fps.addEventListener('input', () => {
  ui.fpsValue.textContent = ui.fps.value;
  if (state.rendering) startLoop();
});
[ui.ramp, ui.colorMode, ui.invert].forEach((control) => {
  control.addEventListener('change', renderSafely);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !state.recording) {
    ui.video.pause();
    stopLoop();
  }
});
window.addEventListener('pagehide', () => {
  stopLoop();
  ui.video.pause();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
});

drawMessage('UPLOAD VIDEO', 'MP4, WebM, MOV, or M4V');
