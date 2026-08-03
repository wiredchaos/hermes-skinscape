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

const byId = (id) => document.getElementById(id);
const ui = {
  section: byId('videoAscii'),
  file: byId('videoFile'),
  source: byId('asciiSourceVideo'),
  canvas: byId('asciiVideoCanvas'),
  placeholder: