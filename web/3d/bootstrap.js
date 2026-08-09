import { initAgentropolisCity } from './city.js';

const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
styleLink.href = new URL('./city.css', import.meta.url).href;
document.head.append(styleLink);

const canvas = document.getElementById('agentropolisCanvas');
const status = document.getElementById('cityStatus');
const quality = document.getElementById('cityQuality');
const motion = document.getElementById('cityMotion');
const fallback = document.getElementById('cityFallback');
const skinName = document.getElementById('skinName');
const primary = document.getElementById('primaryColor');
const secondary = document.getElementById('secondaryColor');
const accent = document.getElementById('accentColor');

let city = null;

function cssValue(name, fallbackValue) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallbackValue;
}

function currentTheme() {
  return {
    name: skinName?.textContent?.trim() || 'community',
    background: cssValue('--scene-bg', '#07090d'),
    fog: cssValue('--scene-bg', '#07090d'),
    primary: cssValue('--brand-primary', primary?.value || '#25d9ff'),
    secondary: cssValue('--brand-secondary', secondary?.value || '#ff3b81'),
    accent: cssValue('--brand-accent', accent?.value || '#63e67b'),
    border: cssValue('--scene-border', '#1f6f7a')
  };
}

function setStatus(message, tone = 'normal') {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function syncTheme() {
  city?.setTheme(currentTheme());
}

async function start() {
  if (!canvas) return;
  try {
    setStatus('Initializing city grid...');
    city = await initAgentropolisCity({
      canvas,
      quality: quality?.value || 'auto',
      motion: motion?.checked ?? true,
      onStatus: setStatus
    });
    city.setTheme(currentTheme());
    fallback?.setAttribute('hidden', '');
  } catch (error) {
    console.error('Agentropolis 3D failed to initialize:', error);
    canvas.hidden = true;
    fallback?.removeAttribute('hidden');
    setStatus('2D fallback active', 'error');
  }
}

quality?.addEventListener('change', () => city?.setQuality(quality.value));
motion?.addEventListener('change', () => city?.setMotion(motion.checked));
primary?.addEventListener('input', syncTheme);
secondary?.addEventListener('input', syncTheme);
accent?.addEventListener('input', syncTheme);

if (skinName) {
  const observer = new MutationObserver(syncTheme);
  observer.observe(skinName, { childList: true, subtree: true, characterData: true });
}

const themeObserver = new MutationObserver(syncTheme);
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

window.addEventListener('pagehide', () => city?.destroy(), { once: true });
start();
