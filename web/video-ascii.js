const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const DEFAULT_COLUMNS = 72;
const DEFAULT_FPS = 12;
const CHARACTER_ASPECT = 0.52;

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
  timer: null
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
          <input id="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v">
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
          <p>The converter samples each video frame, maps brightness to text characters, and draws the result onto a recording-ready canvas. Higher column counts look sharper but require more processing.</p>
        </details>
      </div>

      <div class="video-ascii-stage">
        <video id="asciiSourceVideo" playsinline preload="metadata" hidden></video>
        <canvas id="asciiVideoCanvas" width="960" height="540" aria-label="Animated ASCII video preview"></canvas>
        <div id="asciiVideoPlaceholder" class="ascii-video-placeholder">
          <strong>UPLOAD VIDEO</strong>
          <span>TO INITIALIZE THE ANIMATED ASCII GRID</span>
        </div>
        <div class="video-ascii-hud">
          <span id="videoAsciiTime">00:00 / 00:00</span>
          <span>LOCAL FRAME PIPELINE</span>
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
  time: byId('videoAsciiTime')
};

const workCanvas = document.createElement('canvas');
const workContext = workCanvas.getContext('2d', { willReadFrequently: true });
const outputContext = ui.canvas.getContext('2d', { alpha: false });

function setStatus(message, tone = 'normal') {
  ui.status.textContent = message;
  ui.status.dataset.tone = tone;
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

function prepareGeometry() {
  const columns = Number(ui.columns.value) || DEFAULT_COLUMNS;
  const ratio = ui.video.videoHeight / Math.max(1, ui.video.videoWidth);
  const rows = Math.max(10, Math.round(columns * ratio * CHARACTER_ASPECT));
  workCanvas.width = columns;
  workCanvas.height = rows;

  const targetWidth = Math.min(1280, Math.max(640, columns * 12));
  const targetHeight = Math.round(targetWidth * ratio);
  ui.canvas.width = targetWidth;
  ui.canvas.height = Math.max(360, targetHeight);
  return { columns, rows };
}

function renderFrame() {
  if (!state.loaded || ui.video.readyState < 2) return;
  const { columns, rows } = prepareGeometry();
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
        outputContext.fillStyle = colorForPixel(r, g, b);
        outputContext.fillText(glyph, (x + 0.5) * cellWidth, (y + 0.52) * cellHeight);
      }
    }
    text += '\n';
  }
  state.frameText = text;
  ui.time.textContent = `${formatTime(ui.video.currentTime)} / ${formatTime(ui.video.duration)}`;
}

function stopLoop() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  state.rendering = false;
}

function startLoop() {
  stopLoop();
  const fps = Number(ui.fps.value) || DEFAULT_FPS;
  state.rendering = true;
  renderFrame();
  state.timer = window.setInterval(renderFrame, 1000 / fps);
}

function enableControls(enabled) {
  [ui.play, ui.pause, ui.export, ui.text].forEach((button) => { button.disabled = !enabled; });
}

async function loadVideo(file) {
  if (!file) return;
  if (!file.type.startsWith('video/')) {
    setStatus('Choose a supported video file.', 'error');
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
  enableControls(false);
  setStatus(`Loading ${file.name}...`);
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
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported(type)) || '';
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
  const recorder = new MediaRecorder(exportStream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks = [];
  recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
  recorder.addEventListener('stop', () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    downloadBlob('hermes-animated-ascii.webm', blob);
    state.recording = false;
    ui.export.disabled = false;
    setStatus('ASCII WebM exported locally.', 'success');
  }, { once: true });

  state.recording = true;
  ui.export.disabled = true;
  setStatus('Recording ASCII video in real time. Keep this tab active...');
  ui.video.currentTime = 0;
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
  state.loaded = true;
  ui.placeholder.hidden = true;
  enableControls(true);
  prepareGeometry();
  renderFrame();
  setStatus(`${ui.file.files?.[0]?.name || 'Video'} ready · ${formatTime(ui.video.duration)} · processed locally.`, 'success');
});
ui.video.addEventListener('seeked', renderFrame);
ui.video.addEventListener('ended', () => { if (!state.recording) stopLoop(); });
ui.video.addEventListener('error', () => {
  state.loaded = false;
  enableControls(false);
  setStatus('The browser could not decode this video. Try MP4/H.264 or WebM.', 'error');
});
ui.play.addEventListener('click', async () => { await ui.video.play(); startLoop(); });
ui.pause.addEventListener('click', () => { ui.video.pause(); stopLoop(); renderFrame(); });
ui.export.addEventListener('click', exportAsciiVideo);
ui.text.addEventListener('click', () => downloadBlob('hermes-ascii-frame.txt', new Blob([state.frameText], { type: 'text/plain' })));
ui.columns.addEventListener('input', () => { ui.columnsValue.textContent = ui.columns.value; renderFrame(); });
ui.fps.addEventListener('input', () => {
  ui.fpsValue.textContent = ui.fps.value;
  if (state.rendering) startLoop();
});
[ui.ramp, ui.colorMode, ui.invert].forEach((control) => control.addEventListener('change', renderFrame));
document.addEventListener('visibilitychange', () => { if (document.hidden && !state.recording) stopLoop(); });
window.addEventListener('pagehide', () => {
  stopLoop();
  ui.video.pause();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
});
