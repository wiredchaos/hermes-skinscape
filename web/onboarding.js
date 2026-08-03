import { ONBOARDING_CONFIG } from './onboarding-config.js';

const TOUR_STEPS = [
  {
    target: '#quickStart',
    title: 'Three moves. That is it.',
    text: 'Choose an identity, preview it across the city, then export what you made.'
  },
  {
    target: '[data-tour="identity"]',
    title: '1. Choose your identity',
    text: 'Upload a PFP or logo, or paste a public GitHub profile URL. Images are processed in your browser.'
  },
  {
    target: '[data-tour="preview"]',
    title: '2. Check the terminal',
    text: 'Your image becomes colorized ASCII. The active Hermes skin changes the terminal and city atmosphere.'
  },
  {
    target: '[data-tour="worlds"]',
    title: '3. Rotate the worlds',
    text: 'Use Previous, Play, and Next. Shuffle changes the order. Your identity stays persistent while the world changes.'
  },
  {
    target: '[data-tour="export"]',
    title: '4. Export your profile',
    text: 'Download the profile JSON, plain ASCII, or a standalone HTML preview. Nothing is applied to Hermes automatically.'
  }
];

const byId = (id) => document.getElementById(id);
const state = { index: 0, activeTarget: null };
const ui = {
  openQuickStart: byId('openQuickStart'),
  openExplainer: byId('openExplainer'),
  floatingHelp: byId('floatingHelp'),
  startTour: byId('startTour'),
  startTourSecondary: byId('startTourSecondary'),
  explainerDialog: byId('explainerDialog'),
  explainerTitle: byId('explainerTitle'),
  gammaFrame: byId('gammaFrame'),
  explainerFallback: byId('explainerFallback'),
  closeExplainer: byId('closeExplainer'),
  tourOverlay: byId('tourOverlay'),
  tourStep: byId('tourStep'),
  tourTitle: byId('tourTitle'),
  tourText: byId('tourText'),
  tourPrevious: byId('tourPrevious'),
  tourNext: byId('tourNext'),
  tourClose: byId('tourClose')
};

function safeStorage(method, key, value) {
  try {
    if (method === 'get') return window.localStorage.getItem(key);
    if (method === 'set') window.localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return null;
}

function isAllowedGammaUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'gamma.app' || url.hostname.endsWith('.gamma.app'));
  } catch {
    return false;
  }
}

function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function configureExplainer() {
  if (ui.explainerTitle) ui.explainerTitle.textContent = ONBOARDING_CONFIG.explainerTitle;
  if (!isAllowedGammaUrl(ONBOARDING_CONFIG.gammaEmbedUrl)) return;
  ui.gammaFrame.src = ONBOARDING_CONFIG.gammaEmbedUrl;
  ui.gammaFrame.hidden = false;
  ui.explainerFallback.hidden = true;
}

function openExplainer() {
  openDialog(ui.explainerDialog);
}

function clearTarget() {
  state.activeTarget?.classList.remove('tour-focus');
  state.activeTarget = null;
}

function renderTourStep() {
  const step = TOUR_STEPS[state.index];
  const target = document.querySelector(step.target);
  clearTarget();

  if (target) {
    state.activeTarget = target;
    target.classList.add('tour-focus');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ui.tourStep.textContent = `Step ${state.index + 1} of ${TOUR_STEPS.length}`;
  ui.tourTitle.textContent = step.title;
  ui.tourText.textContent = step.text;
  ui.tourPrevious.disabled = state.index === 0;
  ui.tourNext.textContent = state.index === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
}

function startTour(startIndex = 0) {
  state.index = Math.min(Math.max(startIndex, 0), TOUR_STEPS.length - 1);
  document.body.classList.add('tour-running');
  ui.tourOverlay.hidden = false;
  renderTourStep();
}

function closeTour(markComplete = false) {
  clearTarget();
  document.body.classList.remove('tour-running');
  ui.tourOverlay.hidden = true;
  if (markComplete) safeStorage('set', ONBOARDING_CONFIG.tourStorageKey, 'complete');
}

function nextTourStep() {
  if (state.index >= TOUR_STEPS.length - 1) {
    closeTour(true);
    return;
  }
  state.index += 1;
  renderTourStep();
}

function previousTourStep() {
  if (state.index === 0) return;
  state.index -= 1;
  renderTourStep();
}

function showQuickStart() {
  const quickStart = byId('quickStart');
  quickStart?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  quickStart?.classList.add('attention-pulse');
  window.setTimeout(() => quickStart?.classList.remove('attention-pulse'), 1600);
}

ui.openQuickStart?.addEventListener('click', showQuickStart);
ui.floatingHelp?.addEventListener('click', showQuickStart);
ui.openExplainer?.addEventListener('click', openExplainer);
ui.startTour?.addEventListener('click', () => startTour(0));
ui.startTourSecondary?.addEventListener('click', () => startTour(0));
ui.closeExplainer?.addEventListener('click', () => closeDialog(ui.explainerDialog));
ui.tourPrevious?.addEventListener('click', previousTourStep);
ui.tourNext?.addEventListener('click', nextTourStep);
ui.tourClose?.addEventListener('click', () => closeTour(false));

ui.explainerDialog?.addEventListener('click', (event) => {
  if (event.target === ui.explainerDialog) closeDialog(ui.explainerDialog);
});

document.addEventListener('keydown', (event) => {
  if (ui.tourOverlay?.hidden !== false) return;
  if (event.key === 'Escape') closeTour(false);
  if (event.key === 'ArrowRight') nextTourStep();
  if (event.key === 'ArrowLeft') previousTourStep();
});

function applyDeepLinks() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tour') === '1') startTour(0);
  if (params.get('explainer') === '1') openExplainer();
}

function initialize() {
  configureExplainer();
  applyDeepLinks();
  const completed = safeStorage('get', ONBOARDING_CONFIG.tourStorageKey) === 'complete';
  document.body.dataset.tourCompleted = completed ? 'true' : 'false';
}

initialize();
