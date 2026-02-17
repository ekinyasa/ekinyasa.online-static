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
        const resetDrawerTransform = () => {
          drawer.style.removeProperty('transform');
          drawer.style.removeProperty('transition');
          drawer.removeAttribute('data-dragging');
        };
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
          resetDrawerTransform();
          drawer.classList.remove('is-open');
          setExpandedState(false);
        };
        const openDrawer = () => {
          if (!canUseDrawer()) return;
          resetDrawerTransform();
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

        const setupDrawerDrag = () => {
          const handle = drawer.querySelector('.m-drawer-handle');
          const content = drawer.querySelector('.m-drawer-content');
          if (!handle && !content) {
            return;
          }
          const state = {
            pointerId: null,
            startY: 0,
            baseTranslate: 0,
            currentTranslate: 0,
            maxTranslate: 0,
            isDragging: false,
            waitForDirection: false,
            source: null
          };

          const removePointerListeners = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
          };

          const resetState = () => {
            state.pointerId = null;
            state.startY = 0;
            state.baseTranslate = 0;
            state.currentTranslate = 0;
            state.maxTranslate = 0;
            state.isDragging = false;
            state.waitForDirection = false;
            state.source = null;
          };

          const cleanupDrag = () => {
            resetDrawerTransform();
            removePointerListeners();
            resetState();
          };

          const startDrag = () => {
            if (state.isDragging) {
              return;
            }
            state.isDragging = true;
            drawer.style.transition = 'none';
            drawer.dataset.dragging = '1';
          };

          const getMaxTranslate = () => {
            const drawerHeight = drawer.offsetHeight;
            const handleHeight = handle ? handle.offsetHeight : 0;
            return Math.max(0, drawerHeight - handleHeight);
          };

          const onPointerMove = (event) => {
            if (state.pointerId === null || event.pointerId !== state.pointerId) {
              return;
            }
            const delta = event.clientY - state.startY;
            if (state.waitForDirection) {
              if (Math.abs(delta) < 6) {
                return;
              }
              if (delta <= 0 || (content && content.scrollTop > 0)) {
                cleanupDrag();
                return;
              }
              state.waitForDirection = false;
              startDrag();
            } else if (!state.isDragging && Math.abs(delta) > 2) {
              startDrag();
            }
            if (!state.isDragging) {
              return;
            }
            const translate = Math.min(state.maxTranslate, Math.max(0, state.baseTranslate + delta));
            state.currentTranslate = translate;
            drawer.style.transform = `translateY(${translate}px)`;
            event.preventDefault();
          };

          const onPointerUp = (event) => {
            if (state.pointerId === null || event.pointerId !== state.pointerId) {
              return;
            }
            const dragged = state.isDragging;
            const endOffset = dragged ? state.currentTranslate : state.baseTranslate;
            const max = state.maxTranslate;
            cleanupDrag();
            if (!dragged) {
              return;
            }
            const shouldOpen = endOffset < max * 0.5;
            if (shouldOpen) {
              openDrawer();
            } else {
              closeDrawer();
            }
          };

          const onPointerCancel = () => {
            cleanupDrag();
          };

          const startPointerTracking = (event, source) => {
            if (!canUseDrawer()) {
              return;
            }
            if (state.pointerId !== null) {
              return;
            }
            if (source === 'content') {
              if (!drawer.classList.contains('is-open')) {
                return;
              }
            }
            state.pointerId = event.pointerId || -1;
            state.source = source;
            state.startY = event.clientY;
            state.maxTranslate = getMaxTranslate();
            state.baseTranslate = drawer.classList.contains('is-open') ? 0 : state.maxTranslate;
            state.currentTranslate = state.baseTranslate;
            state.waitForDirection = source === 'content';
            window.addEventListener('pointermove', onPointerMove, { passive: false });
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerCancel);
            if (source === 'handle') {
              state.waitForDirection = false;
              startDrag();
              event.preventDefault();
            } else if (content && content.scrollTop > 0) {
              cleanupDrag();
            }
          };

          if (handle) {
            handle.addEventListener('pointerdown', (evt) => {
              startPointerTracking(evt, 'handle');
            });
          }
          if (content) {
            content.addEventListener('pointerdown', (evt) => {
              startPointerTracking(evt, 'content');
            });
          }
        };

        setupDrawerDrag();
      }
    }
  };

  const handleReady = () => initMobileUi();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleReady, { once: true });
  } else {
    handleReady();
  }
  document.addEventListener('content:ready', () => {
    initMobileUi();
  });
  if (window.__contentReady) {
    initMobileUi();
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
