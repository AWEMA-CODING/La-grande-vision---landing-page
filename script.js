/**
 * La Grande Vision - page immersive de pré-ouverture
 * Toute la logique reste en vanilla JS pour un chargement simple et rapide.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Paramètres facilement éditables
  // ---------------------------------------------------------------------------
  const CONFIG = {
    whatsappNumber: '33600000000', // Format international sans +, espaces, parenthèses
    defaultMessage: 'Bonjour, je souhaite en savoir plus sur vos services optiques.',
    revealThreshold: 85,
    initialSharpness: 28
  };

  const state = {
    sharpness: CONFIG.initialSharpness,
    dragging: false,
    glasses: { x: 0, y: 0 },
    glassesReady: false,
    pointerId: null
  };

  const els = {
    root: document.documentElement,
    slider: document.getElementById('focusSlider'),
    clarityValue: document.getElementById('clarityValue'),
    blurLayer: document.getElementById('blurLayer'),
    glasses: document.getElementById('glasses'),
    revealBlock: document.getElementById('revealBlock'),
    revealText: document.getElementById('claritySoon'),
    whatsappPrimary: document.getElementById('whatsappPrimary'),
    leadForm: document.getElementById('leadForm'),
    leadDisclosure: document.getElementById('leadDisclosure')
  };

  function createWhatsappLink(message) {
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodedMessage}`;
  }

  function setSharpness(value) {
    const safeValue = Math.max(0, Math.min(100, Number(value)));
    state.sharpness = safeValue;

    // Map 0..100 => blur 13px..0px
    const blurPx = ((100 - safeValue) / 100) * 13;
    els.root.style.setProperty('--blur-amount', `${blurPx.toFixed(2)}px`);
    els.root.style.setProperty('--global-sharpness', String((safeValue / 100).toFixed(2)));

    els.slider.value = String(safeValue);
    els.clarityValue.textContent = `${safeValue}%`;

    const status = els.revealBlock.querySelector('.stage-status');
    if (safeValue >= CONFIG.revealThreshold) {
      status.textContent = 'Vision nette obtenue';
      els.revealText.hidden = false;
      els.revealBlock.classList.add('is-revealed');
    } else {
      status.textContent = 'Mise au point en cours…';
      els.revealText.hidden = true;
      els.revealBlock.classList.remove('is-revealed');
    }
  }

  function initPrimaryWhatsapp() {
    els.whatsappPrimary.href = createWhatsappLink(CONFIG.defaultMessage);
  }

  function initSlider() {
    els.slider.addEventListener('input', (event) => {
      setSharpness(event.target.value);
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function initGlassesPortal() {
    if (!els.glasses || !els.blurLayer) return;

    const updateMask = () => {
      const rect = els.glasses.getBoundingClientRect();
      const blurRect = els.blurLayer.getBoundingClientRect();
      const cx = rect.left - blurRect.left + rect.width / 2;
      const cy = rect.top - blurRect.top + rect.height / 2;
      const lensRadiusX = rect.width * 0.24;
      const lensRadiusY = rect.height * 0.36;
      const gap = rect.width * 0.15;

      // Masque: la couche floue est visible partout, sauf dans les deux zones de verres.
      const mask = `
        radial-gradient(ellipse ${lensRadiusX}px ${lensRadiusY}px at ${cx - gap}px ${cy}px, transparent 88%, black 100%),
        radial-gradient(ellipse ${lensRadiusX}px ${lensRadiusY}px at ${cx + gap}px ${cy}px, transparent 88%, black 100%),
        linear-gradient(black, black)
      `;
      els.blurLayer.style.webkitMaskImage = mask;
      els.blurLayer.style.maskImage = mask;
      els.blurLayer.style.webkitMaskComposite = 'source-over';
      els.blurLayer.style.maskComposite = 'add';

      state.glassesReady = true;
    };

    const setPosition = (x, y) => {
      const stageRect = els.blurLayer.getBoundingClientRect();
      const gRect = els.glasses.getBoundingClientRect();
      const halfW = gRect.width / 2;
      const halfH = gRect.height / 2;

      const clampedX = clamp(x, halfW + 8, stageRect.width - halfW - 8);
      const clampedY = clamp(y, halfH + 8, stageRect.height - halfH - 8);

      state.glasses.x = clampedX;
      state.glasses.y = clampedY;

      els.glasses.style.left = `${clampedX}px`;
      els.glasses.style.top = `${clampedY}px`;
      els.glasses.style.transform = 'translate(-50%, -50%)';

      updateMask();
    };

    const startDrag = (event) => {
      state.dragging = true;
      state.pointerId = event.pointerId;
      els.glasses.setPointerCapture(event.pointerId);
      els.glasses.style.cursor = 'grabbing';
      event.preventDefault();
    };

    const onDrag = (event) => {
      if (!state.dragging) return;
      const stageRect = els.blurLayer.getBoundingClientRect();
      setPosition(event.clientX - stageRect.left, event.clientY - stageRect.top);

      // Plus on manipule les lunettes, plus on révèle doucement la netteté.
      if (state.sharpness < CONFIG.revealThreshold + 8) {
        setSharpness(state.sharpness + 0.3);
      }
    };

    const endDrag = (event) => {
      if (state.pointerId !== null) {
        try {
          els.glasses.releasePointerCapture(state.pointerId);
        } catch (error) {
          // Ignore release errors gracefully (older mobile browsers).
        }
      }
      state.dragging = false;
      state.pointerId = null;
      els.glasses.style.cursor = 'grab';
      if (event) event.preventDefault();
    };

    const resetCenteredPosition = () => {
      const rect = els.blurLayer.getBoundingClientRect();
      setPosition(rect.width * 0.5, rect.height * 0.46);
    };

    els.glasses.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Fallback automatique si pas d'interaction: micro déplacement cinématique.
    let autoTick = 0;
    const autoMove = () => {
      if (!state.glassesReady || state.dragging) {
        requestAnimationFrame(autoMove);
        return;
      }
      autoTick += 0.008;
      const rect = els.blurLayer.getBoundingClientRect();
      const x = rect.width * (0.5 + Math.sin(autoTick) * 0.18);
      const y = rect.height * (0.46 + Math.cos(autoTick * 1.2) * 0.08);
      setPosition(x, y);
      requestAnimationFrame(autoMove);
    };

    window.addEventListener('resize', resetCenteredPosition);
    setTimeout(resetCenteredPosition, 60);
    requestAnimationFrame(autoMove);
  }

  function initLeadForm() {
    if (!els.leadForm) return;

    els.leadForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const name = els.leadForm.leadName.value.trim();
      const need = els.leadForm.leadNeed.value;

      if (!name || !need) {
        if (!name) els.leadForm.leadName.focus();
        else els.leadForm.leadNeed.focus();
        return;
      }

      const message = [
        'Bonjour, je souhaite être informé de l\'ouverture.',
        `Nom: ${name}`,
        `Besoin: ${need}`
      ].join('\n');

      window.open(createWhatsappLink(message), '_blank', 'noopener,noreferrer');
      els.leadDisclosure.open = false;
      els.leadForm.reset();
    });
  }

  function init() {
    if (!els.slider || !els.clarityValue || !els.whatsappPrimary) return;

    initPrimaryWhatsapp();
    initSlider();
    initGlassesPortal();
    initLeadForm();
    setSharpness(CONFIG.initialSharpness);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
