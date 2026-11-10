/* Мини-лендинг «Семейные квартиры» · ЖК «Ясный берег»
   Формы: Q1 — квиз «Получить каталог» (модалка + встроен на экране 4), F1 — «Записаться на экскурсию».
   Перед запуском заполнить CONFIG и тело sendLead() — см. README.md. */
(function () {
  'use strict';

  var CONFIG = {
    METRIKA_ID: null,                                   // номер счётчика Яндекс Метрики, например 12345678
    SOURCE_LABEL: 'Семейные квартиры',                  // метка источника для CRM (Домопланер)
    CATALOG_PDF: 'assets/katalog-semeynye-kvartiry.pdf' // PDF каталога, тот же домен
  };

  /* Шаг 1 квиза — число спален (планировки на странице не показываем, они только в каталоге).
     В CRM уходит lot = 2br / 3br / none и lot_label с номерами квартир этой группы. */
  var LOTS = {
    '2br': '2 спальни: №2, №45, №319', '3br': '3 спальни: №250, №754', 'none': 'Пока не решили — все 5 квартир'
  };
  var FORMS = { Q1: 'Получить каталог', F1: 'Записаться на экскурсию' };
  /* подпись для посетителя — напоминание о выборе на шагах 2–4 */
  var LOT_TITLES = { '2br': '2 спальни + кухня-гостиная', '3br': '3 спальни + кухня-гостиная' };

  /* ---------- Метрика: все цели — через goal(name) */
  function goal(name, params) {
    try {
      if (CONFIG.METRIKA_ID && typeof window.ym === 'function') window.ym(CONFIG.METRIKA_ID, 'reachGoal', name, params);
    } catch (e) { /* счётчик не должен ломать страницу */ }
    if (window.console) console.info('[goal]', name, params || '');
  }

  /* ---------- UTM из адреса (сохраняем на визит, чтобы не терять при переходах по якорям) */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'];
  var utm = (function () {
    var out = {}, q = new URLSearchParams(location.search), found = false;
    UTM_KEYS.forEach(function (k) { var v = q.get(k); if (v) { out[k] = v; found = true; } });
    try {
      if (found) sessionStorage.setItem('family_utm', JSON.stringify(out));
      else out = JSON.parse(sessionStorage.getItem('family_utm') || '{}') || {};
    } catch (e) { /* приватный режим / file:// — работаем без хранения */ }
    return out;
  })();

  /* ---------- Отправка заявки. ЗАГЛУШКА: пока пишет в консоль.
     Здесь подключить отправку в CRM (Домопланер) или на свой обработчик. Должна вернуть Promise. */
  function sendLead(payload) {
    if (window.console) console.info('[lead] Заявка (заглушка, никуда не отправлена):', payload);
    // Пример подключения:
    // return fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    //   .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    return Promise.resolve({ ok: true });
  }

  function buildPayload(form, data) {
    var lot = data.lot || 'none';
    return {
      source_label: CONFIG.SOURCE_LABEL,       // метка «Семейные квартиры»
      form: form,                              // Q1 / F1
      form_name: FORMS[form],                  // название формы
      lot: lot,                                // 2br / 3br / none
      lot_label: LOTS[lot] || '',
      family: data.family || '',               // ответ квиза, шаг 2
      purchase: data.purchase || '',           // ответ квиза, шаг 3
      when: data.when || '',                   // F1: будни / выходные / выберу с менеджером
      name: data.name || '',
      phone: data.phone,                       // +7XXXXXXXXXX
      pd_consent: true,                        // согласие на ПДн и политику — без него форма не уходит
      ads_consent: !!data.ads_consent,         // согласие на рекламную рассылку — по желанию
      utm: utm,
      page_url: location.href.split('#')[0],
      referrer: document.referrer || '',
      created_at: new Date().toISOString()
    };
  }

  /* ---------- Маска телефона +7 (___) ___-__-__ */
  function phoneDigits(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.charAt(0) === '8') d = '7' + d.slice(1);
    else if (d.charAt(0) !== '7') d = '7' + d;
    return d.slice(0, 11);
  }
  function formatPhone(d) {
    if (!d) return '';
    var s = '+7';
    if (d.length > 1) s += ' (' + d.slice(1, 4);
    if (d.length >= 5) s += ') ' + d.slice(4, 7);
    if (d.length >= 8) s += '-' + d.slice(7, 9);
    if (d.length >= 10) s += '-' + d.slice(9, 11);
    return s;
  }
  function bindPhone(input) {
    input.addEventListener('input', function () {
      input.value = formatPhone(phoneDigits(input.value));
      if (phoneDigits(input.value).length === 11) input.closest('.field').classList.remove('is-invalid');
    });
    input.addEventListener('focus', function () { if (!input.value) input.value = '+7 ('; });
    input.addEventListener('blur', function () { if (phoneDigits(input.value).length <= 1) input.value = ''; });
  }

  /* Проверка полей контакта: телефон обязателен, согласие на ПДн обязательно */
  function validateContacts(root) {
    var phone = root.querySelector('input[name=phone]');
    var consent = root.querySelector('input[name=consent]');
    var ok = true, first = null;
    if (phoneDigits(phone.value).length !== 11) { phone.closest('.field').classList.add('is-invalid'); ok = false; first = phone; }
    if (!consent.checked) { consent.closest('.consent').classList.add('is-invalid'); ok = false; first = first || consent; }
    if (first) first.focus();
    return ok;
  }
  function bindConsent(root) {
    var c = root.querySelector('input[name=consent]');
    c.addEventListener('change', function () { if (c.checked) c.closest('.consent').classList.remove('is-invalid'); });
  }

  /* последние введённые контакты и квартира — подставляем в другую форму */
  var last = { name: '', phone: '', lot: '' };

  /* ---------- Q1: квиз */
  var TPL = document.getElementById('quiz-tpl');

  function Quiz(mount, mode) {
    var self = this;
    this.mode = mode;
    mount.appendChild(TPL.content.cloneNode(true));
    this.form = mount.querySelector('.quiz');
    this.steps = this.form.querySelectorAll('[data-step]');
    this.back = this.form.querySelector('[data-back]');
    this.count = this.form.querySelector('[data-n]');
    this.countBox = this.form.querySelector('.quiz__count');
    this.bar = this.form.querySelector('.quiz__bar');
    this.progress = this.form.querySelector('.quiz__progress');
    this.progressFill = this.progress.querySelector('i');
    this.nextRow = this.form.querySelector('.quiz__next-row');
    this.next = this.form.querySelector('[data-next]');
    this.thanks = this.form.querySelector('.thanks');
    this.picked = this.form.querySelector('.quiz__picked');
    this.started = false;
    this.doneSteps = {};
    this.timer = null;

    bindPhone(this.form.querySelector('input[name=phone]'));
    bindConsent(this.form);

    this.form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.type !== 'radio') return;
      self.paintTiles();
      var n = +t.closest('[data-step]').getAttribute('data-step');
      self.start();
      self.stepDone(n);
      clearTimeout(self.timer);
      self.timer = setTimeout(function () { self.go(n + 1); }, 220);   // крупные плитки: выбор = переход дальше
    });
    this.back.addEventListener('click', function () { clearTimeout(self.timer); self.go(Math.max(1, self.step - 1)); });
    this.next.addEventListener('click', function () { self.go(self.step + 1); });
    this.form.addEventListener('submit', function (e) { e.preventDefault(); self.submit(); });

    this.go(1, true);
  }
  Quiz.prototype.val = function (name) {
    var r = this.form.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : '';
  };
  Quiz.prototype.start = function () {
    if (this.started) return;
    this.started = true;
    goal('quiz_start', { place: this.mode });
  };
  Quiz.prototype.stepDone = function (n) {
    if (n > 3 || this.doneSteps[n]) return;
    this.doneSteps[n] = true;
    goal('quiz_step_' + n, { place: this.mode });
  };
  Quiz.prototype.paintTiles = function () {
    this.form.querySelectorAll('.tile').forEach(function (l) {
      l.classList.toggle('is-checked', l.querySelector('input').checked);
    });
  };
  Quiz.prototype.go = function (n, silent) {
    this.step = n;
    this.steps.forEach(function (s) { s.hidden = +s.getAttribute('data-step') !== n; });
    this.thanks.hidden = true;
    this.bar.hidden = false; this.progress.hidden = false;
    this.back.classList.toggle('is-off', n === 1);
    this.countBox.style.visibility = n <= 3 ? 'visible' : 'hidden';
    this.count.textContent = Math.min(n, 3);
    this.progressFill.style.width = (n <= 3 ? n / 3 * 100 - (n === 3 ? 8 : 0) : 100) + '%';
    var lot = this.val('lot');                                   // выбранное число спален — напоминание на шагах 2–4
    this.picked.hidden = !(lot && LOT_TITLES[lot] && n >= 2 && n <= 4);
    if (!this.picked.hidden) this.picked.querySelector('span').textContent = LOT_TITLES[lot];
    var cur = this.form.querySelector('[data-step="' + n + '"]');
    var hasAnswer = n <= 3 && !!cur.querySelector('input:checked');
    this.nextRow.hidden = !hasAnswer;
    this.next.disabled = !hasAnswer;
    if (n === 4) {
      var nm = this.form.querySelector('input[name=name]'), ph = this.form.querySelector('input[name=phone]');
      if (!nm.value && last.name) nm.value = last.name;
      if (!ph.value && last.phone) ph.value = formatPhone(last.phone);
    }
    if (!silent && this.mode === 'inline') {
      var top = this.form.getBoundingClientRect().top;
      if (top < 70) this.form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };
  /* opts: {lot: '45' | 'none' | undefined, step: 1|2} */
  Quiz.prototype.reset = function (opts) {
    opts = opts || {};
    clearTimeout(this.timer);
    this.form.querySelectorAll('input[type=radio]').forEach(function (r) { r.checked = false; });
    this.form.querySelectorAll('.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
    this.started = false; this.doneSteps = {};
    var step = 1;
    if (opts.lot) {
      var r = this.form.querySelector('input[name=lot][value="' + opts.lot + '"]');
      if (r) r.checked = true;
      step = opts.step ? +opts.step : (opts.lot === 'none' ? 1 : 2);   // из карточки — сразу 2-й шаг
    }
    this.paintTiles();
    this.go(step, true);
  };
  Quiz.prototype.submit = function () {
    var self = this;
    if (!validateContacts(this.form)) return;
    var btn = this.form.querySelector('[type=submit]');
    var data = {
      lot: this.val('lot') || 'none', family: this.val('family'), purchase: this.val('purchase'),
      name: this.form.querySelector('input[name=name]').value.trim(),
      phone: '+' + phoneDigits(this.form.querySelector('input[name=phone]').value),
      ads_consent: this.form.querySelector('input[name=ads_consent]').checked
    };
    btn.disabled = true;
    sendLead(buildPayload('Q1', data)).then(function () {
      goal('family_catalog', { lot: data.lot });
      last.name = data.name; last.phone = phoneDigits(data.phone); last.lot = data.lot;
      self.showThanks();
    }).catch(function (err) {
      if (window.console) console.error('[lead] ошибка отправки', err);
      alert('Не удалось отправить заявку. Проверьте интернет и попробуйте ещё раз.');
    }).then(function () { btn.disabled = false; });
  };
  Quiz.prototype.showThanks = function () {
    this.steps.forEach(function (s) { s.hidden = true; });
    this.nextRow.hidden = true; this.bar.hidden = true; this.progress.hidden = true; this.picked.hidden = true;
    this.thanks.hidden = false;
    var h = this.thanks.querySelector('.quiz__q');
    h.focus({ preventScroll: true });
    if (this.mode === 'inline') this.form.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  var quizModalEl = document.getElementById('quiz-modal');
  var tourModalEl = document.getElementById('tour-modal');
  var inlineQuiz = new Quiz(document.querySelector('[data-quiz=inline]'), 'inline');
  var modalQuiz = new Quiz(quizModalEl.querySelector('[data-quiz=modal]'), 'modal');

  /* ---------- модальные окна */
  var opener = null;
  function openModal(dlg) {
    opener = document.activeElement;
    document.documentElement.classList.add('is-locked');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.scrollTop = 0;
  }
  function closeModal(dlg) { if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); } }
  [quizModalEl, tourModalEl].forEach(function (dlg) {
    dlg.addEventListener('close', function () {
      if (!quizModalEl.open && !tourModalEl.open) document.documentElement.classList.remove('is-locked');
      if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    });
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModal(dlg); return; }
      if (e.target === dlg) {                       // клик по подложке
        var r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(dlg);
      }
    });
  });

  function openQuiz(opts) {
    closeModal(tourModalEl);
    modalQuiz.reset(opts);
    openModal(quizModalEl);
    modalQuiz.start();
    if (opts && opts.lot && opts.lot !== 'none' && !opts.step) modalQuiz.stepDone(1); // квартира выбрана в карточке
  }

  /* ---------- F1: запись на экскурсию */
  var tourForm = document.getElementById('tour-form');
  var tourView = tourForm.querySelector('.form-view');
  var tourThanks = tourForm.querySelector('.thanks');
  bindPhone(tourForm.querySelector('input[name=phone]'));
  bindConsent(tourForm);

  function openTour() {
    closeModal(quizModalEl);
    tourView.hidden = false; tourThanks.hidden = true;
    tourForm.querySelectorAll('.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
    var nm = tourForm.querySelector('input[name=name]'), ph = tourForm.querySelector('input[name=phone]');
    if (!nm.value && last.name) nm.value = last.name;
    if (!ph.value && last.phone) ph.value = formatPhone(last.phone);
    openModal(tourModalEl);
  }
  tourForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateContacts(tourForm)) return;
    var btn = tourForm.querySelector('[type=submit]');
    var when = tourForm.querySelector('input[name=when]:checked');
    var data = {
      lot: last.lot || 'none',
      when: when ? when.value : '',
      name: tourForm.querySelector('input[name=name]').value.trim(),
      phone: '+' + phoneDigits(tourForm.querySelector('input[name=phone]').value),
      ads_consent: tourForm.querySelector('input[name=ads_consent]').checked
    };
    btn.disabled = true;
    sendLead(buildPayload('F1', data)).then(function () {
      goal('family_tour', { lot: data.lot });
      last.name = data.name; last.phone = phoneDigits(data.phone);
      tourView.hidden = true; tourThanks.hidden = false;
      tourThanks.querySelector('.form__title').focus({ preventScroll: true });
    }).catch(function (err) {
      if (window.console) console.error('[lead] ошибка отправки', err);
      alert('Не удалось отправить заявку. Проверьте интернет и попробуйте ещё раз.');
    }).then(function () { btn.disabled = false; });
  });

  /* ---------- общие клики */
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.flat[data-lot]');
    if (card) goal('card_' + card.getAttribute('data-lot'));   // card_2 … card_754

    var pdf = e.target.closest('[data-pdf]');
    if (pdf) goal('catalog_pdf_open');

    var todo = e.target.closest('a[data-todo]');
    if (todo && todo.getAttribute('href') === '#') {
      e.preventDefault();
      if (window.console) console.warn('[todo] Подставить ссылку на документ:', todo.getAttribute('data-todo'));
    }

    var btn = e.target.closest('[data-open]');
    if (!btn) return;
    e.preventDefault();
    if (btn.getAttribute('data-open') === 'tour') openTour();
    else openQuiz({ lot: btn.getAttribute('data-lot') || '', step: btn.getAttribute('data-step') || '' });
  });

  document.querySelectorAll('[data-pdf]').forEach(function (a) { a.setAttribute('href', CONFIG.CATALOG_PDF); });

  /* ---------- вкладки групп квартир (мобильный) */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs__btn'));
  function activateTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).classList.toggle('is-active', on);
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { activateTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        activateTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
      }
    });
  });

  /* ---------- якоря из быстрых ссылок Директа: #flats #one-child #two-children #quiz #tour #area */
  function handleHash() {
    var h = location.hash;
    if (h === '#one-child' || h === '#two-children') {
      var tab = tabs.filter(function (t) { return '#' + t.getAttribute('aria-controls') === h; })[0];
      if (tab) {
        activateTab(tab);
        var target = window.matchMedia('(min-width:1024px)').matches ? document.querySelector(h) : document.querySelector('.tabs');
        setTimeout(function () { target.scrollIntoView({ block: 'start' }); }, 30);
      }
    } else if (h === '#tour') {
      setTimeout(openTour, 250);
    }
  }
  window.addEventListener('hashchange', handleHash);
  handleHash();

  /* ---------- липкая панель: прячем, когда на экране встроенный квиз или подвал */
  var dock = document.querySelector('.dock');
  if (dock && 'IntersectionObserver' in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      dock.classList.toggle('is-hidden', seen.size > 0);
    }, { threshold: 0.15 });
    io.observe(document.querySelector('.quiz-block__form'));
    io.observe(document.querySelector('.footer'));
  }

  /* для отладки из консоли */
  window.familyLanding = { goal: goal, sendLead: sendLead, openQuiz: openQuiz, openTour: openTour, utm: utm };
  /* ---------- Отзывы: стрелки листают на одну карточку, на краях гаснут */
  (function () {
    var track = document.querySelector('.reviews__track');
    if (!track) return;
    var prev = document.querySelector('[data-rev="-1"]'), next = document.querySelector('[data-rev="1"]');
    function step() { var c = track.querySelector('.review'); return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth; }
    function sync() {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4;
    }
    [prev, next].forEach(function (b) {
      b.addEventListener('click', function () { track.scrollBy({ left: step() * Number(b.getAttribute('data-rev')), behavior: 'smooth' }); });
    });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  })();
})();
