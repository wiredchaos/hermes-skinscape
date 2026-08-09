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
        statusOutput.textContent = 'Add a still image, PFP, logo, or GitHub profile URL first.';
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

function mountMediaModeSwitcher() {
  const forge = byId('forge');
  const videoSection = byId('videoAscii');
  if (!forge || !videoSection) return;

  forge.insertAdjacentElement('afterend', videoSection);

  const imageLabel = fileInput?.closest('label');
  if (imageLabel?.firstChild) imageLabel.firstChild.textContent = 'Still image / PFP upload\n          ';
  const imageHint = imageLabel?.querySelector('.field-hint');
  if (imageHint) imageHint.textContent = 'Still images only: square PNG, JPG, or WebP under 8 MB. Choose Video → ASCII above for motion.';

  const heading = forge.querySelector('.section-heading');
  if (!heading || forge.querySelector('.media-mode-picker')) return;

  const picker = document.createElement('div');
  picker.className = 'media-mode-picker';
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Choose media input');
  picker.innerHTML = `
    <button id="chooseImageMode" class="media-mode-button is-active" type="button" aria-pressed="true">
      <strong>IMAGE / PFP</strong>
      <span>Still image → ASCII identity</span>
    </button>
    <button id="chooseVideoMode" class="media-mode-button" type="button" aria-pressed="false">
      <strong>VIDEO → ASCII</strong>
      <span>Moving video → animated ASCII</span>
    </button>`;
  heading.insertAdjacentElement('afterend', picker);

  const imageButton = byId('chooseImageMode');
  const videoButton = byId('chooseVideoMode');

  const activate = (target) => {
    const videoActive = target === 'video';
    setPressed(imageButton, !videoActive);
    setPressed(videoButton, videoActive);
    if (videoActive) {
      videoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => byId('videoFile')?.focus(), 450);
    } else {
      fileInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => fileInput?.focus(), 450);
    }
  };

  imageButton?.addEventListener('click', () => activate('image'));
  videoButton?.addEventListener('click', () => activate('video'));

  const nav = document.querySelector('.command-nav');
  if (nav && !nav.querySelector('a[href="#videoAscii"]')) {
    const videoLink = document.createElement('a');
    videoLink.href = '#videoAscii';
    videoLink.textContent = 'VIDEO';
    nav.insertBefore(videoLink, nav.querySelector('a[href="#worlds"]'));
  }
}

customButton?.addEventListener('click', () => selectMode('protected'));
standardButton?.addEventListener('click', () => selectMode('unrestricted'));
brandMode?.addEventListener('change', syncThemePills);
brandName?.addEventListener('input', syncIdentityName);
generateButton?.addEventListener('click', runGenerate);

alignHeroWithGamma();
mountMediaModeSwitcher();
syncThemePills();
syncIdentityName();
