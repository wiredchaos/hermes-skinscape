import './video-ascii.js';

const byId = (id) => document.getElementById(id);

const brandMode = byId('brandMode');
const brandName = byId('brandName');
const identityCardName = byId('identityCardName');
const customButton = byId('themeCustom');
const standardButton = byId('themeStandard');
const generateButton = byId('generateIdentity');
const fileInput = byId('imageFile');
const imageUrl = byId('imageUrl');
const loadUrlButton = byId('loadUrl');
const terminalPreview = document.querySelector('[data-tour="preview"]');
const statusOutput = byId('status');

function setPressed(button, active) {
  if (!button) return;
  button.classList.toggle('is-active', active);
  button.setAttribute('aria-pressed', String(active));
}

function syncThemePills() {
  const mode = brandMode?.value || 'protected';
  const customActive = mode !== 'unrestricted';
  setPressed(customButton, customActive);
  setPressed(standardButton, !customActive);
}

function selectMode(mode) {
  if (!brandMode) return;
  brandMode.value = mode;
  brandMode.dispatchEvent(new Event('change', { bubbles: true }));
  syncThemePills();
}

function syncIdentityName() {
  if (!identityCardName) return;
  identityCardName.textContent = brandName?.value.trim() || 'HERMES IDENTITY';
}

function setGenerateState(label, busy) {
  if (!generateButton) return;
  generateButton.textContent = label;
  generateButton.setAttribute('aria-busy', String(busy));
  generateButton.disabled = busy;
}

function finishGenerate(message = 'Identity preview ready.') {
  setGenerateState('✦ Generate', false);
  if (statusOutput && message) {
    statusOutput.textContent = message;
    statusOutput.dataset.tone = 'success';
  }
  terminalPreview?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  terminalPreview?.classList.add('attention-pulse');
  window.setTimeout(() => terminalPreview?.classList.remove('attention-pulse'), 1800);
}

function runGenerate() {
  const hasFile = Boolean(fileInput?.files?.length);
  const hasUrl = Boolean(imageUrl?.value.trim());
  const hasRenderedIdentity = Boolean(byId('avatarPreview')?.src);

  setGenerateState('Generating...', true);

  if (!hasFile && hasUrl && !hasRenderedIdentity) {
    loadUrlButton?.click();
    window.setTimeout(() => finishGenerate('Remote identity request sent. Check the preview status.'), 1200);
    return;
  }

  if (!hasFile && !hasUrl && !hasRenderedIdentity) {
    window.setTimeout(() => {
      setGenerateState('✦ Generate', false);
      if (statusOutput) {
        statusOutput.textContent = 'Add a PFP, logo, or GitHub profile URL first.';
        statusOutput.dataset.tone = 'error';
      }
      fileInput?.focus();
      fileInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return;
  }

  window.setTimeout(() => finishGenerate(), 700);
}

function alignHeroWithGamma() {
  const heroTitle = byId('hero-title');
  const heroLead = document.querySelector('.hero-lede');
  const heroActions = document.querySelector('.hero-actions');
  const brandTitle = document.querySelector('.brand-lockup strong');

  if (brandTitle) brandTitle.textContent = 'Your Identity. Fifty Worlds...';
  if (heroTitle) heroTitle.innerHTML = 'Your Identity. Fifty Worlds. One Living Terminal City.';
  if (heroLead) {
    heroLead.textContent = 'Turn your PFP, avatar, logo, or video into a persistent Hermes terminal identity — then watch it survive across 50 rotating visual worlds.';
  }

  if (heroLead && !document.querySelector('.hero-badges')) {
    const badges = document.createElement('div');
    badges.className = 'hero-badges';
    badges.setAttribute('aria-label', 'Core features');
    ['PFP + VIDEO TO ASCII', '50 HERMES SKINS', 'AGENTROPOLIS 3D CITY'].forEach((label) => {
      const badge = document.createElement('span');
      badge.textContent = label;
      badges.appendChild(badge);
    });
    heroLead.insertAdjacentElement('afterend', badges);
  }

  const primary = heroActions?.querySelector('.primary-action');
  const secondary = heroActions?.querySelector('.secondary-action');
  if (primary) {
    primary.textContent = 'Enter the Identity Forge';
    primary.setAttribute('href', '#forge');
  }
  if (secondary) {
    secondary.textContent = 'Start the Guided Tour';
    secondary.setAttribute('href', '#quickStart');
    secondary.addEventListener('click', (event) => {
      event.preventDefault();
      byId('startTour')?.click();
    });
  }
}

customButton?.addEventListener('click', () => selectMode('protected'));
standardButton?.addEventListener('click', () => selectMode('unrestricted'));
brandMode?.addEventListener('change', syncThemePills);
brandName?.addEventListener('input', syncIdentityName);
generateButton?.addEventListener('click', runGenerate);

alignHeroWithGamma();
syncThemePills();
syncIdentityName();
