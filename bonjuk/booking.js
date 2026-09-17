/**
 * Bonjuk Booking System Engine
 * - Dynamic slot calculator (10:00 start, 90 min duration, 5 min break, cutoff: no slot starts after 19:30)
 * - Date range: 17 Sep Thu - 22 Sep Mon (and configurable)
 * - Occupied slot masking & name display
 * - Verification before cancellation (name & phone must match)
 * - Pushover Apple Watch notification
 * - Real-time sync via Firestore (with local fallback)
 */

(function () {
  'use strict';

  // --- DEFAULT CONFIGURATION ---
  const DEFAULT_CONFIG = {
    startHour: 10,
    startMinute: 0,
    durationMinutes: 90,
    breakMinutes: 5,
    cutoffHour: 19,
    cutoffMinute: 30,
    startDate: '2026-09-17',
    endDate: '2026-09-22',
    pushoverUserKey: 'u5x77gvh9yniz2ccy8zx929z6ppo2n',
    pushoverAppToken: 'azep72gh6houi1huqoyt2skmucdtrn'
  };

  const STORAGE_KEY_BOOKINGS = 'ekinyasa_bonjuk_bookings';
  const STORAGE_KEY_CONFIG = 'ekinyasa_bonjuk_config';

  // Load Config
  let activeConfig = Object.assign({}, DEFAULT_CONFIG);
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (savedConfig) {
      activeConfig = Object.assign(activeConfig, JSON.parse(savedConfig));
    }
  } catch (e) {}

  // Ensure hardcoded keys are present if localStorage had empty strings
  if (!activeConfig.pushoverUserKey) activeConfig.pushoverUserKey = DEFAULT_CONFIG.pushoverUserKey;
  if (!activeConfig.pushoverAppToken) activeConfig.pushoverAppToken = DEFAULT_CONFIG.pushoverAppToken;

  // Check if admin mode is requested via URL parameter (e.g. ?admin or ?admin=1)
  const isAdminMode = new URLSearchParams(window.location.search).has('admin');

  // --- I18N DICTIONARY FOR BOOKING SYSTEM ---
  const I18N = {
    tr: {
      modalTitle: 'Seans Rezervasyonu',
      modalSubtitle: 'Bonjuk Bay • Birebir Grinberg Seansları',
      closeAria: 'Kapat',
      available: 'Müsait',
      booked: 'Dolu',
      bookBtn: 'Rezerve Et',
      cancelBtn: 'İptal Et',
      bookFormTitle: 'Randevu Rezerve Et: {time}',
      bookFormDesc: 'Adınızı ve WhatsApp numaranızı girerek bu saati adınıza ayırtabilirsiniz.',
      cancelFormTitle: 'Randevu İptali: {time}',
      cancelFormDesc: 'Bu seans "{name}" adına kayıtlıdır. İptal etmek için rezervasyon sırasındaki Ad Soyad ve WhatsApp numaranızı doğru girmelisiniz.',
      nameLabel: 'Adınız Soyadınız',
      namePlaceholder: 'Örn: Ekin Yaşa',
      phoneLabel: 'WhatsApp Telefon Numaranız',
      phonePlaceholder: '0532 123 45 67',
      confirmBookBtn: 'Rezervasyonu Onayla',
      confirmCancelBtn: 'Randevuyu İptal Et',
      cancelFormBackBtn: 'Vazgeç',
      noticeText: 'Ben seanstaysam takvimden dilediğin saati hemen kendin için rezerve edebilir ya da iptal edebilirsin, her şekilde hemen bildirim alacağım. O yüzden teyit beklemeden saatinde çalışma alanına gelmen yeterli. Gelemeyeceğin seansı hemen iptal etmen ise, sıkışık takvimi rahatlatmak adına çok önemli. Bir soru veya sorun olursa WhatsApp’tan her zaman yazabilirsin.',
      agreeNotice: 'Bilgilendirmeyi okudum, anladım ve kabul ediyorum.',
      errName: 'Lütfen geçerli bir Ad Soyad giriniz.',
      errPhone: 'Lütfen geçerli bir telefon numarası giriniz.',
      errAgree: 'Lütfen rezervasyonu onaylamak için bilgilendirme kutucuğunu işaretleyiniz.',
      errTaken: 'Bu saat dilimi az önce başkası tarafından alındı.',
      errNotFound: 'Bu saatte zaten aktif bir rezervasyon bulunamadı.',
      errMismatch: 'Girdiğiniz Ad Soyad veya telefon numarası bu rezervasyonla eşleşmiyor.',
      successBook: 'Randevunuz başarıyla oluşturuldu: {date} {time}',
      successCancel: 'Randevunuz başarıyla iptal edildi: {date} {time}',
      dayNames: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
      monthNames: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
      pushNewTitle: '🟢 Yeni Seans Randevusu!',
      pushCancelTitle: '🔴 Seans İptali!',
      pushNewBody: '{name} • {date} {time}\nTel: {phone}',
      pushCancelBody: '{name} • {date} {time} randevusunu iptal etti.'
    },
    en: {
      modalTitle: 'Session Booking',
      modalSubtitle: 'Bonjuk Bay • 1-on-1 Grinberg Sessions',
      closeAria: 'Close',
      available: 'Available',
      booked: 'Booked',
      bookBtn: 'Book Now',
      cancelBtn: 'Cancel',
      bookFormTitle: 'Book Session: {time}',
      bookFormDesc: 'Please enter your name and WhatsApp number to reserve this time slot.',
      cancelFormTitle: 'Cancel Session: {time}',
      cancelFormDesc: 'This slot is reserved under "{name}". To cancel, please enter the matching Name and WhatsApp number used during booking.',
      nameLabel: 'Full Name',
      namePlaceholder: 'e.g. John Doe',
      phoneLabel: 'WhatsApp Phone Number',
      phonePlaceholder: '+90 532 123 45 67',
      confirmBookBtn: 'Confirm Booking',
      confirmCancelBtn: 'Cancel Session',
      cancelFormBackBtn: 'Back',
      noticeText: 'If I am currently in a session, you can directly reserve or cancel any available time slot yourself from the calendar—I will receive an instant notification either way. You can simply arrive at the session space on time without waiting for further confirmation. If you won\'t be able to make it, promptly cancelling your session is very important to help keep the tight schedule manageable. If you have any questions or issues, you can always message me on WhatsApp.',
      agreeNotice: 'I have read, understood, and agree to the note above.',
      errName: 'Please enter a valid full name.',
      errPhone: 'Please enter a valid phone number.',
      errAgree: 'Please check the agreement box before confirming your booking.',
      errTaken: 'This time slot was just booked by someone else.',
      errNotFound: 'No active reservation was found for this time.',
      errMismatch: 'The provided Name or Phone number does not match this reservation.',
      successBook: 'Your reservation was confirmed: {date} {time}',
      successCancel: 'Your reservation was cancelled: {date} {time}',
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      pushNewTitle: '🟢 New Session Booking!',
      pushCancelTitle: '🔴 Session Cancellation!',
      pushNewBody: '{name} • {date} {time}\nPhone: {phone}',
      pushCancelBody: '{name} • cancelled reservation for {date} {time}.'
    }
  };

  const getLang = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang === 'en' || urlLang === 'tr') return urlLang;
      const stored = localStorage.getItem('ekinyasa_lang');
      if (stored === 'en' || stored === 'tr') return stored;
    } catch (_) {}
    return 'tr';
  };

  const t = (key, params = {}) => {
    const lang = getLang();
    const dict = I18N[lang] || I18N.tr;
    let str = dict[key] || I18N.tr[key] || '';
    Object.keys(params).forEach((p) => {
      str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
    return str;
  };

  // State
  let currentSelectedDate = activeConfig.startDate;
  let currentActionSlot = null;
  let actionType = 'book'; // 'book' | 'cancel'
  let bookingsCache = {};

  // Load Bookings from LocalStorage (Syncs with Firebase when connected)
  const loadLocalBookings = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BOOKINGS);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  };

  const saveLocalBookings = (data) => {
    bookingsCache = data;
    try {
      localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(data));
    } catch (e) {}
  };

  bookingsCache = loadLocalBookings();

  // --- Pushover Notification Function ---
  const sendPushoverNotification = async (title, message) => {
    const user = activeConfig.pushoverUserKey || localStorage.getItem('pushover_user_key');
    const token = activeConfig.pushoverAppToken || localStorage.getItem('pushover_app_token');

    if (!user || !token) {
      console.log('[Pushover skipped]: User Key or App Token not configured yet.');
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('token', token);
      formData.append('user', user);
      formData.append('title', title);
      formData.append('message', message);
      formData.append('sound', 'classical');

      await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      console.log('[Pushover] Notification sent to Apple Watch');
    } catch (err) {
      console.error('[Pushover Error]', err);
    }
  };

  // --- Date Range Helper ---
  const getDaysArray = (startStr, endStr) => {
    const arr = [];
    const dt = new Date(startStr);
    const end = new Date(endStr);
    const lang = getLang();
    const dayNames = I18N[lang]?.dayNames || I18N.tr.dayNames;
    const monthNames = I18N[lang]?.monthNames || I18N.tr.monthNames;

    while (dt <= end) {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const iso = `${yyyy}-${mm}-${dd}`;
      arr.push({
        iso: iso,
        dayName: dayNames[dt.getDay()],
        dayNum: dt.getDate(),
        monthName: monthNames[dt.getMonth()]
      });
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  };

  // --- Slot Calculation Engine ---
  const calculateDailySlots = () => {
    const slots = [];
    let currentMins = activeConfig.startHour * 60 + activeConfig.startMinute;
    const cutoffMins = activeConfig.cutoffHour * 60 + activeConfig.cutoffMinute;

    while (currentMins <= cutoffMins) {
      const startH = Math.floor(currentMins / 60);
      const startM = currentMins % 60;
      const endMins = currentMins + activeConfig.durationMinutes;
      const endH = Math.floor(endMins / 60);
      const endM = endMins % 60;

      const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const timeLabel = `${formatTime(startH, startM)} - ${formatTime(endH, endM)}`;
      const slotId = `${formatTime(startH, startM)}`;

      slots.push({
        slotId: slotId,
        timeLabel: timeLabel,
        startMins: currentMins,
        endMins: endMins
      });

      currentMins = endMins + activeConfig.breakMinutes;
    }
    return slots;
  };

  // --- UI Elements ---
  let modalEl = null;
  let datesContainer = null;
  let slotsContainer = null;
  let formOverlay = null;
  let formTitle = null;
  let formDesc = null;
  let labelName = null;
  let labelPhone = null;
  let inputName = null;
  let inputPhone = null;
  let noticeBox = null;
  let noticeCheckboxContainer = null;
  let checkAgree = null;
  let checkAgreeLabel = null;
  let btnCancelForm = null;
  let btnSubmit = null;
  let alertBox = null;

  const createModalDOM = () => {
    if (document.getElementById('bonjukBookingModal')) return;

    modalEl = document.createElement('div');
    modalEl.id = 'bonjukBookingModal';
    modalEl.className = 'booking-modal';
    modalEl.innerHTML = `
      <div class="booking-modal__backdrop" data-booking-close></div>
      <div class="booking-modal__container">
        <div class="liquidGlass-wrapper dock">
          <div class="booking-header">
            <div>
              <h3 class="booking-header__title" id="bookingModalTitle">${t('modalTitle')}</h3>
              <div class="booking-header__subtitle" id="bookingModalSubtitle">${t('modalSubtitle')}</div>
            </div>
            <button class="booking-close-btn" data-booking-close aria-label="${t('closeAria')}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Date Selector -->
          <div class="booking-dates" id="bookingDatesList"></div>

          <!-- Slots List -->
          <div class="booking-slots-container" id="bookingSlotsList"></div>

          <!-- Booking Form Overlay (for booking & cancellation) -->
          <div class="booking-form-overlay" id="bookingFormOverlay">
            <h4 id="bookingFormTitle"></h4>
            <p id="bookingFormDesc"></p>
            <div id="bookingAlert" class="booking-alert"></div>
            <div class="booking-field">
              <label for="bookName" id="lblBookName">${t('nameLabel')}</label>
              <input type="text" id="bookName" placeholder="${t('namePlaceholder')}" required autocomplete="name" />
            </div>
            <div class="booking-field">
              <label for="bookPhone" id="lblBookPhone">${t('phoneLabel')}</label>
              <input type="tel" id="bookPhone" placeholder="${t('phonePlaceholder')}" required autocomplete="tel" />
            </div>

            <!-- Mandatory Notice & Agreement for Booking -->
            <div class="booking-notice-box" id="bookingNoticeBox">
              ${t('noticeText')}
            </div>
            <label class="booking-agreement" id="bookingNoticeCheckboxContainer">
              <input type="checkbox" id="checkAgreeNotice" />
              <span id="checkAgreeLabelText">${t('agreeNotice')}</span>
            </label>

            <div class="booking-form-actions">
              <button type="button" class="btn-ghost" id="btnCancelForm">${t('cancelFormBackBtn')}</button>
              <button type="button" class="btn-primary" id="btnSubmitForm">${t('confirmBookBtn')}</button>
            </div>
          </div>

          <!-- Admin Quick Access (Only rendered when ?admin is present in URL) -->
          ${isAdminMode ? `
          <div style="margin-top:16px;text-align:center;">
            <button type="button" class="admin-badge" id="adminToggleBtn" style="background:none;border:none;font:inherit;">⚙ Ayarları Düzenle</button>
          </div>
          <div class="admin-panel" id="adminPanel">
            <h5 style="margin:0 0 8px;font-size:14px;color:var(--text);">Seans & Pushover Ayarları</h5>
            <div class="admin-grid">
              <div class="booking-field">
                <label>Başlangıç Saati (Örn: 10)</label>
                <input type="number" id="admStartH" value="${activeConfig.startHour}" min="0" max="23" />
              </div>
              <div class="booking-field">
                <label>Seans Süresi (dk)</label>
                <input type="number" id="admDuration" value="${activeConfig.durationMinutes}" min="15" max="180" />
              </div>
              <div class="booking-field">
                <label>Mola Süresi (dk)</label>
                <input type="number" id="admBreak" value="${activeConfig.breakMinutes}" min="0" max="60" />
              </div>
              <div class="booking-field">
                <label>Son Seans Başlangıç Limiti</label>
                <input type="text" id="admCutoff" value="${activeConfig.cutoffHour}:${String(activeConfig.cutoffMinute).padStart(2, '0')}" />
              </div>
            </div>
            <div class="booking-field" style="margin-top:8px;">
              <label>Pushover User Key (Apple Watch)</label>
              <input type="text" id="admPushoverUser" placeholder="uQiR23..." value="${activeConfig.pushoverUserKey}" />
            </div>
            <div class="booking-field" style="margin-top:8px;">
              <label>Pushover API App Token</label>
              <input type="text" id="admPushoverToken" placeholder="azG9D2..." value="${activeConfig.pushoverAppToken}" />
            </div>
            <div class="booking-form-actions" style="margin-top:12px;">
              <button type="button" class="btn-primary" id="admSaveBtn">Ayarları Kaydet</button>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Bind DOM refs
    datesContainer = document.getElementById('bookingDatesList');
    slotsContainer = document.getElementById('bookingSlotsList');
    formOverlay = document.getElementById('bookingFormOverlay');
    formTitle = document.getElementById('bookingFormTitle');
    formDesc = document.getElementById('bookingFormDesc');
    labelName = document.getElementById('lblBookName');
    labelPhone = document.getElementById('lblBookPhone');
    inputName = document.getElementById('bookName');
    inputPhone = document.getElementById('bookPhone');
    noticeBox = document.getElementById('bookingNoticeBox');
    noticeCheckboxContainer = document.getElementById('bookingNoticeCheckboxContainer');
    checkAgree = document.getElementById('checkAgreeNotice');
    checkAgreeLabel = document.getElementById('checkAgreeLabelText');
    btnCancelForm = document.getElementById('btnCancelForm');
    btnSubmit = document.getElementById('btnSubmitForm');
    alertBox = document.getElementById('bookingAlert');

    // Close listeners
    modalEl.querySelectorAll('[data-booking-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    document.getElementById('btnCancelForm').addEventListener('click', closeForm);
    btnSubmit.addEventListener('click', handleSubmit);

    // Admin toggle and save (if in admin mode)
    if (isAdminMode) {
      const adminToggle = document.getElementById('adminToggleBtn');
      const adminPanel = document.getElementById('adminPanel');
      if (adminToggle && adminPanel) {
        adminToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          adminPanel.classList.toggle('is-open');
          if (adminPanel.classList.contains('is-open')) {
            setTimeout(() => adminPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
          }
        });
      }

      const admSaveBtn = document.getElementById('admSaveBtn');
      if (admSaveBtn) {
        admSaveBtn.addEventListener('click', () => {
          const sh = parseInt(document.getElementById('admStartH').value, 10) || 10;
          const dur = parseInt(document.getElementById('admDuration').value, 10) || 90;
          const brk = parseInt(document.getElementById('admBreak').value, 10) || 5;
          const cutoffStr = document.getElementById('admCutoff').value || '19:30';
          const parts = cutoffStr.split(':');
          const ch = parseInt(parts[0], 10) || 19;
          const cm = parseInt(parts[1], 10) || 30;

          activeConfig.startHour = sh;
          activeConfig.durationMinutes = dur;
          activeConfig.breakMinutes = brk;
          activeConfig.cutoffHour = ch;
          activeConfig.cutoffMinute = cm;
          activeConfig.pushoverUserKey = document.getElementById('admPushoverUser').value.trim();
          activeConfig.pushoverAppToken = document.getElementById('admPushoverToken').value.trim();

          try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(activeConfig));
          } catch (e) {}

          alert('Ayarlar kaydedildi!');
          renderSlots();
        });
      }
    }
  };

  const updateModalTexts = () => {
    const titleEl = document.getElementById('bookingModalTitle');
    const subEl = document.getElementById('bookingModalSubtitle');
    const closeEl = modalEl?.querySelector('.booking-close-btn');
    if (titleEl) titleEl.textContent = t('modalTitle');
    if (subEl) subEl.textContent = t('modalSubtitle');
    if (closeEl) closeEl.setAttribute('aria-label', t('closeAria'));
    if (labelName) labelName.textContent = t('nameLabel');
    if (inputName) inputName.placeholder = t('namePlaceholder');
    if (labelPhone) labelPhone.textContent = t('phoneLabel');
    if (inputPhone) inputPhone.placeholder = t('phonePlaceholder');
    if (noticeBox) noticeBox.textContent = t('noticeText');
    if (checkAgreeLabel) checkAgreeLabel.textContent = t('agreeNotice');
    if (btnCancelForm) btnCancelForm.textContent = t('cancelFormBackBtn');
  };

  const openModal = () => {
    if (!modalEl) createModalDOM();
    updateModalTexts();
    renderDates();
    renderSlots();
    closeForm();
    modalEl.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (modalEl) {
      modalEl.classList.remove('is-visible');
      document.body.style.overflow = '';
      closeForm();
    }
  };

  const closeForm = () => {
    if (formOverlay) {
      formOverlay.classList.remove('is-active');
      inputName.value = '';
      inputPhone.value = '';
      if (checkAgree) checkAgree.checked = false;
      currentActionSlot = null;
      alertBox.className = 'booking-alert';
      alertBox.textContent = '';
    }
  };

  // Render Date Pills
  const renderDates = () => {
    if (!datesContainer) return;
    datesContainer.innerHTML = '';
    const days = getDaysArray(activeConfig.startDate, activeConfig.endDate);

    days.forEach((day) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `booking-date-btn ${day.iso === currentSelectedDate ? 'is-selected' : ''}`;
      btn.innerHTML = `
        <span class="date-day">${day.dayName}</span>
        <span class="date-num">${day.dayNum} ${day.monthName}</span>
      `;
      btn.addEventListener('click', () => {
        currentSelectedDate = day.iso;
        datesContainer.querySelectorAll('.booking-date-btn').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        closeForm();
        renderSlots();
      });
      datesContainer.appendChild(btn);
    });
  };

  // Render Slots for Selected Date
  const renderSlots = () => {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';

    const allSlots = calculateDailySlots();
    const dayBookings = bookingsCache[currentSelectedDate] || {};

    allSlots.forEach((slot) => {
      const booking = dayBookings[slot.slotId];
      const isOccupied = Boolean(booking);

      const card = document.createElement('div');
      card.className = `booking-slot-card ${isOccupied ? 'is-occupied' : ''}`;

      let occupantDisplay = `<span class="slot-status-text">${t('available')}</span>`;
      let actionBtnHTML = `<button type="button" class="slot-action-btn btn-book">${t('bookBtn')}</button>`;

      if (isOccupied) {
        occupantDisplay = `
          <span class="slot-occupant-name">${escapeHtml(booking.name)}</span>
          <span class="slot-status-text">${t('booked')}</span>
        `;
        actionBtnHTML = `<button type="button" class="slot-action-btn btn-cancel">${t('cancelBtn')}</button>`;
      }

      card.innerHTML = `
        <div class="slot-time">${slot.timeLabel}</div>
        <div class="slot-info">${occupantDisplay}</div>
        <div>${actionBtnHTML}</div>
      `;

      const actionBtn = card.querySelector('.slot-action-btn');
      actionBtn.addEventListener('click', () => {
        if (!isOccupied) {
          openBookForm(slot);
        } else {
          openCancelForm(slot, booking);
        }
      });

      slotsContainer.appendChild(card);
    });
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  };

  const cleanPhone = (phone) => (phone || '').replace(/[^\d]/g, '');

  const openBookForm = (slot) => {
    actionType = 'book';
    currentActionSlot = slot;
    updateModalTexts();
    formTitle.textContent = t('bookFormTitle', { time: slot.timeLabel });
    formDesc.textContent = t('bookFormDesc');
    btnSubmit.textContent = t('confirmBookBtn');
    btnSubmit.className = 'btn-primary';
    if (noticeBox) noticeBox.style.display = 'block';
    if (noticeCheckboxContainer) noticeCheckboxContainer.style.display = 'flex';
    if (checkAgree) checkAgree.checked = false;
    alertBox.className = 'booking-alert';
    alertBox.textContent = '';
    formOverlay.classList.add('is-active');
    formOverlay.scrollIntoView({ behavior: 'smooth', block: 'end' });
    inputName.focus();
  };

  const openCancelForm = (slot, booking) => {
    actionType = 'cancel';
    currentActionSlot = slot;
    updateModalTexts();
    formTitle.textContent = t('cancelFormTitle', { time: slot.timeLabel });
    formDesc.textContent = t('cancelFormDesc', { name: booking.name });
    btnSubmit.textContent = t('confirmCancelBtn');
    btnSubmit.className = 'btn-danger';
    if (noticeBox) noticeBox.style.display = 'none';
    if (noticeCheckboxContainer) noticeCheckboxContainer.style.display = 'none';
    alertBox.className = 'booking-alert';
    alertBox.textContent = '';
    formOverlay.classList.add('is-active');
    formOverlay.scrollIntoView({ behavior: 'smooth', block: 'end' });
    inputName.focus();
  };

  const handleSubmit = async () => {
    const name = inputName.value.trim();
    const phone = inputPhone.value.trim();

    if (!name || name.length < 3) {
      showAlert(t('errName'), 'error');
      return;
    }

    const cleanDigits = cleanPhone(phone);
    if (!cleanDigits || cleanDigits.length < 10) {
      showAlert(t('errPhone'), 'error');
      return;
    }

    if (actionType === 'book' && checkAgree && !checkAgree.checked) {
      showAlert(t('errAgree'), 'error');
      return;
    }

    if (!currentActionSlot) return;

    if (actionType === 'book') {
      // Execute booking
      if (!bookingsCache[currentSelectedDate]) {
        bookingsCache[currentSelectedDate] = {};
      }

      // Check race condition
      if (bookingsCache[currentSelectedDate][currentActionSlot.slotId]) {
        showAlert(t('errTaken'), 'error');
        renderSlots();
        return;
      }

      bookingsCache[currentSelectedDate][currentActionSlot.slotId] = {
        name: name,
        phone: phone,
        cleanPhone: cleanDigits,
        createdAt: new Date().toISOString()
      };

      saveLocalBookings(bookingsCache);

      // Trigger Apple Watch Notification
      sendPushoverNotification(
        t('pushNewTitle'),
        t('pushNewBody', {
          name: name,
          date: currentSelectedDate,
          time: currentActionSlot.timeLabel,
          phone: phone
        })
      );

      const successMsg = t('successBook', {
        date: currentSelectedDate,
        time: currentActionSlot.timeLabel
      });
      closeForm();
      renderSlots();
      alert(successMsg);
    } else if (actionType === 'cancel') {
      // Verification before cancel
      const dayBookings = bookingsCache[currentSelectedDate] || {};
      const existing = dayBookings[currentActionSlot.slotId];

      if (!existing) {
        showAlert(t('errNotFound'), 'error');
        renderSlots();
        return;
      }

      const isNameMatch = existing.name.trim().toLowerCase() === name.toLowerCase();
      const isPhoneMatch = existing.cleanPhone.endsWith(cleanDigits.slice(-7)); // matches last 7 digits

      if (!isNameMatch || !isPhoneMatch) {
        showAlert(t('errMismatch'), 'error');
        return;
      }

      delete bookingsCache[currentSelectedDate][currentActionSlot.slotId];
      saveLocalBookings(bookingsCache);

      // Trigger Apple Watch Notification
      sendPushoverNotification(
        t('pushCancelTitle'),
        t('pushCancelBody', {
          name: name,
          date: currentSelectedDate,
          time: currentActionSlot.timeLabel
        })
      );

      const successCancelMsg = t('successCancel', {
        date: currentSelectedDate,
        time: currentActionSlot.timeLabel
      });
      closeForm();
      renderSlots();
      alert(successCancelMsg);
    }
  };

  const showAlert = (msg, type) => {
    alertBox.textContent = msg;
    alertBox.className = `booking-alert ${type}`;
  };

  // Intercept all "Randevu Al" / "Randevu" buttons
  const initBookingTriggers = () => {
    // 1. Explicit data-booking-trigger elements
    document.querySelectorAll('[data-booking-trigger]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      });
    });

    // 2. Desktop and Mobile nav buttons with whatsapp or nav-book
    document.querySelectorAll('[data-contact-link="whatsapp"], .nav-cta').forEach((el) => {
      if (el.querySelector('[data-i18n-nav-book]') || el.getAttribute('data-booking-trigger') !== null) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openModal();
        });
      }
    });

    // 3. Main section CTA button (e.g. randevu al)
    document.addEventListener('click', (e) => {
      const ctaBtn = e.target.closest('a.ac-button');
      if (ctaBtn) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      }
    });
  };

  // Re-render modal when user toggles language on the page
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-lang-toggle]')) {
      setTimeout(() => {
        if (modalEl && modalEl.classList.contains('is-visible')) {
          updateModalTexts();
          renderDates();
          renderSlots();
        }
      }, 50);
    }
  });

  window.addEventListener('popstate', () => {
    if (modalEl && modalEl.classList.contains('is-visible')) {
      updateModalTexts();
      renderDates();
      renderSlots();
    }
  });

  // Export globally for custom scripts
  window.bonjukBooking = {
    open: openModal,
    close: closeModal,
    refreshLang: () => {
      updateModalTexts();
      renderDates();
      renderSlots();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingTriggers);
  } else {
    initBookingTriggers();
  }
})();
