'use strict';

(function () {
  if (!Object.prototype.hasOwnProperty.call(window, '__contentReady')) {
    window.__contentReady = false;
  }
  const MARKDOWN_URL = 'landing.yml';
  const EVENT_NAME = 'content:ready';
  let historySynced = false;

  const sectionsRoot = document.querySelector('[data-sections-root]');
  const PROGRESSIVE_SELECTOR = 'picture[data-progressive-image="true"]';
  const PROGRESSIVE_TRANSITION = 'opacity 0.45s ease-out';
  const PROGRESSIVE_TIMEOUT = 900;
  const processedPictures = new WeakSet();
  const colorSchemeQuery = (typeof window.matchMedia === 'function')
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  const reduceMotionQuery = (typeof window.matchMedia === 'function')
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  let domReady = document.readyState === 'complete';

  const isDarkMode = () => (colorSchemeQuery ? colorSchemeQuery.matches : false);
  const prefersReducedMotion = () => (reduceMotionQuery ? reduceMotionQuery.matches : false);
  const isDocumentHidden = () => (typeof document.visibilityState === 'string' && document.visibilityState === 'hidden');

  const ensureOverlayContainerStyles = (picture) => {
    if (!picture || !picture.dataset) return;
    const { dataset } = picture;
    if (!Object.prototype.hasOwnProperty.call(dataset, 'progressiveOverlayPosition')) {
      const computedPosition = window.getComputedStyle(picture).position;
      if (computedPosition === 'static') {
        dataset.progressiveOverlayPosition = picture.style.position || '';
        picture.style.position = 'relative';
      } else {
        dataset.progressiveOverlayPosition = '__skip';
      }
    }
  };

  const restoreOverlayContainerStyles = (picture) => {
    if (!picture || !picture.dataset) return;
    const { dataset } = picture;
    if (Object.prototype.hasOwnProperty.call(dataset, 'progressiveOverlayPosition')) {
      const previous = dataset.progressiveOverlayPosition;
      if (previous !== '__skip') {
        if (previous) {
          picture.style.position = previous;
        } else {
          picture.style.removeProperty('position');
        }
      }
      delete dataset.progressiveOverlayPosition;
    }
  };

  const crossFadeSwap = (picture, baseImg, loader, finalize, animate) => {
    if (!picture || !baseImg || !loader || typeof finalize !== 'function') {
      return;
    }
    const shouldAnimate = animate && !prefersReducedMotion() && !isDocumentHidden();
    if (!shouldAnimate) {
      finalize();
      return;
    }
    if (!picture.isConnected || !baseImg.isConnected) {
      finalize();
      return;
    }
    const overlay = loader;
    overlay.removeAttribute('data-large-light');
    overlay.removeAttribute('data-large-dark');
    overlay.loading = 'eager';
    overlay.decoding = 'async';
    overlay.draggable = false;
    overlay.alt = baseImg.alt || '';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.className = baseImg.className || '';
    overlay.style.cssText = baseImg.getAttribute('style') || '';
    const computedImgStyle = window.getComputedStyle(baseImg);
    overlay.style.objectFit = computedImgStyle.objectFit;
    overlay.style.objectPosition = computedImgStyle.objectPosition;
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.maxWidth = '100%';
    overlay.style.maxHeight = '100%';
    overlay.style.margin = '0';
    overlay.style.transition = PROGRESSIVE_TRANSITION;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '1';
    overlay.style.willChange = 'opacity';

    const overlayContainer = picture.parentElement || picture;
    ensureOverlayContainerStyles(overlayContainer);
    overlayContainer.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
      });
    });

    let finished = false;
    const complete = () => {
      if (finished) return;
      finished = true;
      finalize();
      overlay.removeEventListener('transitionend', handleTransitionEnd);
      overlay.remove();
      restoreOverlayContainerStyles(overlayContainer);
    };

    const handleTransitionEnd = (event) => {
      if (event.target === overlay && event.propertyName === 'opacity') {
        complete();
      }
    };

    overlay.addEventListener('transitionend', handleTransitionEnd);
    window.setTimeout(complete, PROGRESSIVE_TIMEOUT);
  };

  const preloadImage = (url, onLoad) => {
    if (!url || typeof onLoad !== 'function') {
      return;
    }
    const loader = new Image();
    loader.decoding = 'async';
    loader.loading = 'eager';
    loader.addEventListener('load', () => {
      onLoad(loader);
    }, { once: true });
    loader.addEventListener('error', () => {
      // Keep the small image if the large version cannot be loaded.
    }, { once: true });
    loader.src = url;
  };

  const upgradePicture = (picture) => {
    if (processedPictures.has(picture)) {
      return;
    }
    const img = picture.querySelector('img');
    if (!img) {
      return;
    }
    const largeLight = img.getAttribute('data-large-light');
    const darkSource = picture.querySelector('source[data-large-dark]');
    const largeDark = darkSource ? darkSource.getAttribute('data-large-dark') : '';
    if (!largeLight && !largeDark) {
      return;
    }
    processedPictures.add(picture);
    if (largeLight) {
      preloadImage(largeLight, (loader) => {
        crossFadeSwap(
          picture,
          img,
          loader,
          () => {
            img.src = largeLight;
            img.removeAttribute('data-large-light');
          },
          !darkSource || !isDarkMode()
        );
      });
    }
    if (darkSource && largeDark) {
      preloadImage(largeDark, (loader) => {
        crossFadeSwap(
          picture,
          img,
          loader,
          () => {
            darkSource.srcset = largeDark;
            darkSource.removeAttribute('data-large-dark');
          },
          Boolean(isDarkMode())
        );
      });
    }
  };

  const initProgressiveImages = () => {
    document.querySelectorAll(PROGRESSIVE_SELECTOR).forEach((picture) => {
      upgradePicture(picture);
    });
  };

  const maybeInitProgressiveImages = () => {
    if (!domReady) {
      return;
    }
    initProgressiveImages();
  };

  document.addEventListener('DOMContentLoaded', () => {
    domReady = true;
    maybeInitProgressiveImages();
  });

  if (domReady) {
    maybeInitProgressiveImages();
  }

  const parseFrontmatter = (raw) => {
    if (!raw.startsWith('---')) {
      return { meta: {}, body: raw };
    }
    const closingIndex = raw.indexOf('\n---', 3);
    if (closingIndex === -1) {
      return { meta: {}, body: raw };
    }
    const frontmatter = raw.slice(3, closingIndex).trim();
    const body = raw.slice(closingIndex + 4).trim();
    let meta = {};
    if (window.jsyaml && typeof window.jsyaml.load === 'function') {
      try {
        meta = window.jsyaml.load(frontmatter) || {};
      } catch (error) {
        console.error('YAML parse error', error);
      }
    }
    return { meta, body };
  };

  const parseLandingPayload = (raw) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) {
      return {};
    }
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return parsed.meta || parsed;
        }
      } catch (error) {
        console.error('JSON parse error', error);
      }
    }
    if (trimmed.startsWith('---')) {
      const { meta } = parseFrontmatter(raw);
      return meta;
    }
    if (window.jsyaml && typeof window.jsyaml.load === 'function') {
      try {
        const parsed = window.jsyaml.load(trimmed);
        if (parsed && typeof parsed === 'object') {
          return parsed.meta || parsed;
        }
      } catch (error) {
        console.error('YAML parse error', error);
      }
    }
    return {};
  };

  const cleanPhoneDigits = (phone) => (phone || '').replace(/[^\d]/g, '');

  const buildWhatsAppLink = (contact) => {
    const digits = cleanPhoneDigits(contact.phone || '');
    if (!digits) return '';
    let url = `https://wa.me/${digits}`;
    if (contact.whatsapp_message) {
      url += `?text=${encodeURIComponent(contact.whatsapp_message)}`;
    }
    return url;
  };

  const formatTelHref = (phone) => {
    if (!phone) return '';
    const normalized = phone.replace(/\s+/g, '');
    return normalized.startsWith('tel:') ? normalized : `tel:${normalized}`;
  };

  const renderMarkdown = (source, context) => {
    if (!source) return '';
    let output = source;
    if (context.whatsappLink) {
      output = output.replace(/{{\s*whatsapp_link\s*}}/gi, context.whatsappLink);
    }
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(output);
    }
    return output;
  };

  const buildSectionElement = (section, index, context) => {
    const el = document.createElement('section');
    el.className = 'view';
    el.id = section.id || `section_${index + 1}`;
    if (section.figure) {
      const figureData = section.figure;
      const figure = document.createElement('figure');
      const picture = document.createElement('picture');
      const hasSmallLight = Boolean(figureData['small-light']);
      const hasSmallDark = Boolean(figureData['small-dark']);
      const enableProgressive = hasSmallLight || hasSmallDark;

      if (enableProgressive) {
        picture.dataset.progressiveImage = 'true';
      }

      const darkSourceValue = enableProgressive
        ? (figureData['small-dark'] || figureData.dark || '')
        : (figureData.dark || '');

      if (darkSourceValue) {
        const source = document.createElement('source');
        source.media = '(prefers-color-scheme: dark)';
        source.srcset = darkSourceValue;
        if (enableProgressive && figureData.dark) {
          source.setAttribute('data-large-dark', figureData.dark);
        }
        picture.appendChild(source);
      }

      const img = document.createElement('img');
      const largeLight = figureData.light || figureData.src || '';
      const smallLight = enableProgressive ? (figureData['small-light'] || largeLight) : largeLight;
      img.src = smallLight;
      img.alt = figureData.alt || '';
      if (enableProgressive && largeLight) {
        img.setAttribute('data-large-light', largeLight);
      }
      picture.appendChild(img);
      figure.appendChild(picture);
      el.appendChild(figure);
    }
    if (section.body) {
      const body = document.createElement('div');
      body.className = 'section-body';
      body.innerHTML = renderMarkdown(section.body, context);
      el.appendChild(body);
    }
    return el;
  };

  const renderSections = (sections, context) => {
    if (!sectionsRoot) return;
    sectionsRoot.innerHTML = '';
    if (!Array.isArray(sections) || !sections.length) {
      const fallback = document.createElement('section');
      fallback.className = 'view';
      const body = document.createElement('div');
      body.className = 'section-body';
      body.textContent = 'İçerik bulunamadı.';
      fallback.appendChild(body);
      sectionsRoot.appendChild(fallback);
      return;
    }
    sections.forEach((section, index) => {
      sectionsRoot.appendChild(buildSectionElement(section, index, context));
    });
    maybeInitProgressiveImages();
  };

  const updateContactInfo = (meta, context) => {
    const contact = meta.contact || {};
    const contactLinks = Array.isArray(meta.contact_links) ? meta.contact_links : [];
    const whatsappLink = context.whatsappLink;
    const telHref = formatTelHref(contact.phone || '');
    const email = contact.email || '';
    const instagram = contact.instagram || '';
    const phoneDisplay = contact.phone_display || contact.phone || '';
    const instagramHandle = contact.instagram_handle || instagram;

    const assignHref = (selector, value) => {
      document.querySelectorAll(`[data-contact-link="${selector}"]`).forEach((el) => {
        if (value) {
          el.setAttribute('href', value);
        } else {
          el.removeAttribute('href');
        }
      });
    };

    assignHref('whatsapp', whatsappLink);
    assignHref('tel', telHref);
    assignHref('email', email ? `mailto:${email}` : '');
    assignHref('instagram', instagram);

    const setText = (key, value) => {
      if (!value) return;
      document.querySelectorAll(`[data-contact-text="${key}"]`).forEach((el) => {
        el.textContent = value;
      });
    };

    setText('phone-display', phoneDisplay);
    setText('email', email);
    setText('instagram-handle', instagramHandle);

    document.querySelectorAll('[data-contact-copy]').forEach((el) => {
      const type = el.dataset.contactCopy;
      if (type === 'phone' && contact.phone) {
        el.dataset.copy = contact.phone;
      } else if (type === 'email' && email) {
        el.dataset.copy = email;
      }
    });

    document.querySelectorAll('[data-contact-links]').forEach((container) => {
      container.innerHTML = '';
      contactLinks.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'sub_links_row';
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = entry.tag || '';
        row.appendChild(tag);
        if (entry.url) {
          const link = document.createElement('a');
          link.href = entry.url;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = entry.label || entry.url;
          row.appendChild(link);
        } else if (entry.label) {
          const span = document.createElement('span');
          span.textContent = entry.label;
          row.appendChild(span);
        }
        container.appendChild(row);
      });
    });
  };

  const syncHistory = () => {
    const url = new URL(window.location.href);
    url.hash = 'landing';
    if (!historySynced) {
      history.pushState({ view: 'landing' }, '', url.toString());
      historySynced = true;
    } else {
      history.replaceState({ view: 'landing' }, '', url.toString());
    }
  };

  const dispatchContentReady = () => {
    window.__contentReady = true;
    document.dispatchEvent(new Event(EVENT_NAME));
  };

  const showError = (message) => {
    if (!sectionsRoot) return;
    sectionsRoot.innerHTML = '';
    const fallback = document.createElement('section');
    fallback.className = 'view';
    const body = document.createElement('div');
    body.className = 'section-body';
    body.textContent = message || 'İçerik yüklenemedi.';
    fallback.appendChild(body);
    sectionsRoot.appendChild(fallback);
  };

  const renderLanding = (meta) => {
    const contact = meta.contact || {};
    const context = {
      whatsappLink: buildWhatsAppLink(contact)
    };
    renderSections(meta.sections || [], context);
    updateContactInfo(meta, context);
    syncHistory();
    dispatchContentReady();
  };

  const loadLanding = () => {
    fetch(MARKDOWN_URL, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('İçerik yüklenemedi.');
        }
        return response.text();
      })
      .then((raw) => {
        const meta = parseLandingPayload(raw);
        renderLanding(meta);
      })
      .catch((error) => {
        console.error(error);
        showError('İçerik yüklenemedi.');
      });
  };

  window.addEventListener('popstate', (event) => {
    if (!event.state || event.state.view !== 'landing') {
      const url = new URL(window.location.href);
      url.hash = 'landing';
      history.replaceState({ view: 'landing' }, '', url.toString());
    }
  });

  if (sectionsRoot) {
    loadLanding();
  }
})();
