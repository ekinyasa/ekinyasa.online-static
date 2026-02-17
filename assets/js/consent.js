/* consent.js — ekinyasa.online çerez tercihleri */

const CONSENT_KEY = "ekinyasa_consent_v2";
const GA_MEASUREMENT_ID = "G-XXXXXXXX";
const META_PIXEL_ID = "1234567890";

function getStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function storeConsent(consent) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

function ensureGtagBaseReady() {
  if (window.__gtagBaseReady) return;
  window.__gtagBaseReady = true;
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  });
}

function updateGtagConsent(consent) {
  if (!window.gtag) return;
  const analyticsGranted = consent.analytics ? "granted" : "denied";
  const adsGranted = consent.marketing ? "granted" : "denied";
  window.gtag("consent", "update", {
    analytics_storage: analyticsGranted,
    ad_storage: adsGranted,
    ad_user_data: adsGranted,
    ad_personalization: adsGranted
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function loadAnalytics() {
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.includes("XXXX")) return;
  ensureGtagBaseReady();
  if (!window.__gaScriptPromise) {
    window.__gaScriptPromise = loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`)
      .then(() => {
        window.gtag("js", new Date());
      })
      .catch(() => {});
  }
  window.__gaScriptPromise.then(() => {
    if (!window.__gaConfigured) {
      window.__gaConfigured = true;
      window.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
    }
  });
}

function loadMarketing() {
  if (window.__metaPixelLoaded) return;
  if (!META_PIXEL_ID || META_PIXEL_ID.includes("123456")) return;
  window.__metaPixelLoaded = true;
  (function(f,b,e,v,n,t,s){
    if(f.fbq) return;
    n=f.fbq=function(){ n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments) };
    if(!f._fbq) f._fbq=n;
    n.push=n; n.loaded=!0; n.version="2.0";
    n.queue=[];
    t=b.createElement(e); t.async=!0;
    t.src=v;
    s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", META_PIXEL_ID);
  window.fbq("track", "PageView");
}

function applyConsent(consent) {
  ensureGtagBaseReady();
  updateGtagConsent(consent);
  if (consent.analytics) {
    loadAnalytics();
  }
  if (consent.marketing) {
    loadMarketing();
  }
}

function showBanner() {
  const banner = document.getElementById("cookie-banner");
  if (banner) banner.classList.add("is-visible");
}

function hideBanner() {
  const banner = document.getElementById("cookie-banner");
  if (banner) banner.classList.remove("is-visible");
}

function showModal() {
  const modal = document.getElementById("cookie-modal");
  if (!modal) return;
  modal.classList.add("is-visible");
  modal.setAttribute("aria-hidden", "false");
}

function hideModal() {
  const modal = document.getElementById("cookie-modal");
  if (!modal) return;
  modal.classList.remove("is-visible");
  modal.setAttribute("aria-hidden", "true");
}

function setPreferenceForm(consent) {
  const analytics = document.getElementById("cm-analytics");
  const marketing = document.getElementById("cm-marketing");
  if (analytics) analytics.checked = !!consent.analytics;
  if (marketing) marketing.checked = !!consent.marketing;
}

function persistAndApply(consent) {
  const payload = {
    analytics: !!consent.analytics,
    marketing: !!consent.marketing,
    ts: Date.now()
  };
  storeConsent(payload);
  applyConsent(payload);
  hideBanner();
  hideModal();
}

function openPreferences(consent) {
  const current = consent || getStoredConsent() || { analytics: false, marketing: false };
  setPreferenceForm(current);
  showModal();
}

function initConsentUI() {
  const stored = getStoredConsent();
  if (!stored) {
    showBanner();
    applyConsent({ analytics: false, marketing: false });
  } else {
    applyConsent(stored);
  }

  const btnSettings = document.getElementById("cc-settings");
  const btnAccept = document.getElementById("cc-accept");
  const btnReject = document.getElementById("cc-reject");
  const btnSave = document.getElementById("cm-save");
  const modalCloseEls = document.querySelectorAll("[data-cookie-close]");

  btnSettings?.addEventListener("click", () => {
    hideBanner();
    openPreferences(getStoredConsent() || { analytics: false, marketing: false });
  });

  btnAccept?.addEventListener("click", () => {
    persistAndApply({ analytics: true, marketing: true });
  });

  btnReject?.addEventListener("click", () => {
    persistAndApply({ analytics: false, marketing: false });
  });

  btnSave?.addEventListener("click", () => {
    const analytics = document.getElementById("cm-analytics");
    const marketing = document.getElementById("cm-marketing");
    persistAndApply({
      analytics: !!(analytics && analytics.checked),
      marketing: !!(marketing && marketing.checked)
    });
  });

  modalCloseEls.forEach((el) => {
    el.addEventListener("click", () => {
      hideModal();
      const storedConsent = getStoredConsent();
      if (!storedConsent) {
        showBanner();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideModal();
    }
  });

  window.openCookiePreferences = function () {
    hideBanner();
    openPreferences(getStoredConsent() || { analytics: false, marketing: false });
  };
}

document.addEventListener("DOMContentLoaded", initConsentUI);
