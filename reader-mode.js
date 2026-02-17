'use strict';

(function () {
  const toggles = document.querySelectorAll('[data-reader-toggle]');
  if (!toggles.length) {
    return;
  }
  const body = document.body;
  const drawer = document.querySelector('.m-drawer');
  const drawerToggles = drawer ? drawer.querySelectorAll('[data-drawer-toggle]') : [];

  const closeDrawer = () => {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawerToggles.forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
  };

  const updateToggleLabels = () => {
    const active = body.classList.contains('reader-mode');
    toggles.forEach((btn) => {
      const openLabel = btn.getAttribute('data-reader-open') || 'Oku';
      const closeLabel = btn.getAttribute('data-reader-close') || 'Kapat';
      btn.textContent = active ? closeLabel : openLabel;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    drawerToggles.forEach((btn) => {
      btn.setAttribute('aria-disabled', active ? 'true' : 'false');
    });
  };

  const setReaderMode = (active) => {
    if (active) {
      body.classList.add('reader-mode');
      closeDrawer();
      body.classList.remove('schedule-open');
    } else {
      body.classList.remove('reader-mode');
    }
    updateToggleLabels();
  };

  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = !body.classList.contains('reader-mode');
      setReaderMode(next);
    });
  });

  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && body.classList.contains('reader-mode')) {
      setReaderMode(false);
    }
  });

  updateToggleLabels();
})();
