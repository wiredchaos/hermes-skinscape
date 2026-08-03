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

customButton?.addEventListener('click', () => selectMode('protected'));
standardButton?.addEventListener('click', () => selectMode('unrestricted'));
brandMode?.addEventListener('change', syncThemePills);
brandName?.addEventListener('input', syncIdentityName);
generateButton?.addEventListener('click', runGenerate);

syncThemePills();
syncIdentityName();
