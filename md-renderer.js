'use strict';

(function () {
  if (!Object.prototype.hasOwnProperty.call(window, '__contentReady')) {
    window.__contentReady = false;
  }
  const MARKDOWN_URL = 'landing.md';
  const EVENT_NAME = 'content:ready';
  let historySynced = false;

  const sectionsRoot = document.querySelector('[data-sections-root]');

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
      const figure = document.createElement('figure');
      const picture = document.createElement('picture');
      if (section.figure.dark) {
        const source = document.createElement('source');
        source.media = '(prefers-color-scheme: dark)';
        source.srcset = section.figure.dark;
        picture.appendChild(source);
      }
      const img = document.createElement('img');
      img.src = section.figure.light || section.figure.src || '';
      img.alt = section.figure.alt || '';
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
        const { meta } = parseFrontmatter(raw);
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
