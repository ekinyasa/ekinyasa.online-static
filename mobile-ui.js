'use strict';

(function () {
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let initialized = false;

  const initMobileUi = () => {
    if (!mobileQuery.matches || initialized) {
      return;
    }
    const body = document.body;
    if (!body || !body.classList.contains('public-view')) {
      return;
    }
    const container = document.querySelector('main.container');
    if (!container) {
      return;
    }
    const sections = Array.from(container.querySelectorAll('section.view'));
    if (!sections.length) {
      return;
    }
    initialized = true;
    const prefersReduced = reduceMotionQuery.matches;

    sections.forEach((section) => {
      section.classList.add('m-fade');
      if (section.classList.contains('is-visible')) {
        section.dataset.animated = '1';
      }
    });

    const behavior = prefersReduced ? 'auto' : 'smooth';
    const dotsNav = document.querySelector('.m-dots');
    if (dotsNav) {
      dotsNav.innerHTML = '';
      const dotButtons = [];
      if (sections.length > 1) {
        sections.forEach((section, index) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'm-dot';
          const title = section.querySelector('h2');
          const labelText = title ? title.textContent.trim() : '';
          btn.setAttribute('aria-label', labelText || `Section ${index + 1}`);
          btn.addEventListener('click', () => {
            section.scrollIntoView({ behavior, block: 'start', inline: 'start' });
          });
          dotsNav.appendChild(btn);
          dotButtons.push(btn);
        });
        const setActive = (idx) => {
          dotButtons.forEach((btn, i) => {
            btn.classList.toggle('is-active', i === idx);
          });
        };
        setActive(0);
        const activeObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) {
                return;
              }
              const idx = sections.indexOf(entry.target);
              if (idx >= 0) {
                setActive(idx);
              }
            });
          },
          { root: container, threshold: 0.55 }
        );
        sections.forEach((section) => activeObserver.observe(section));
      } else {
        dotsNav.style.display = 'none';
      }
    }

    const drawer = document.querySelector('.m-drawer');
    if (drawer) {
      const toggles = drawer.querySelectorAll('[data-drawer-toggle]');
      if (toggles.length) {
        const canUseDrawer = () => !document.body.classList.contains('reader-mode');
        const setExpandedState = (isOpen) => {
          drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
          toggles.forEach((btn) => {
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (btn.classList.contains('nav-toggle')) {
              btn.classList.toggle('active', isOpen);
            }
          });
        };
        const closeDrawer = () => {
          drawer.classList.remove('is-open');
          setExpandedState(false);
        };
        const openDrawer = () => {
          if (!canUseDrawer()) return;
          drawer.classList.add('is-open');
          setExpandedState(true);
        };
        toggles.forEach((btn) => {
          btn.addEventListener('click', () => {
            if (!canUseDrawer()) {
              closeDrawer();
              return;
            }
            if (drawer.classList.contains('is-open')) {
              closeDrawer();
            } else {
              openDrawer();
            }
          });
        });
        drawer.querySelectorAll('.m-drawer-links a').forEach((link) => {
          link.addEventListener('click', closeDrawer);
        });
        document.addEventListener('keydown', (evt) => {
          if (evt.key === 'Escape' && drawer.classList.contains('is-open')) {
            closeDrawer();
          }
        });
      }
    }
  };

  const handleReady = () => initMobileUi();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleReady, { once: true });
  } else {
    handleReady();
  }

  const mediaChangeHandler = (event) => {
    if (event.matches && !initialized) {
      initMobileUi();
    }
  };
  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', mediaChangeHandler);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(mediaChangeHandler);
  }
})();
