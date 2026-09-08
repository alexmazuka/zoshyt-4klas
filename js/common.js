/* Спільний модуль: дані, календар, прогрес, налаштування, синхронізація, шапка */
window.Z = (function () {
  const LS_PROGRESS = 'z4.progress', LS_SETTINGS = 'z4.settings', LS_SYNCQ = 'z4.syncq';
  const state = { cal: null, subjects: null, subjMap: {}, timetable: null, plan: null, byId: {}, bySubject: {}, byWeek: {} };
  const DAYS = ['', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
  const DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  async function loadJSON(p) { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ' → ' + r.status); return r.json(); }

  async function init() {
    const [cal, subj, plan] = await Promise.all([loadJSON('data/calendar.json'), loadJSON('data/subjects.json'), loadJSON('data/plan.json')]);
    state.cal = cal; state.subjects = subj.subjects; state.timetable = subj.timetable; state.timetableNote = subj.timetableNote; state.program = subj.program;
    state.subjMap = Object.fromEntries(subj.subjects.map(s => [s.id, s]));
    state.plan = plan.lessons; state.planMeta = plan;
    plan.lessons.forEach(l => { state.byId[l.id] = l; (state.bySubject[l.subject] ||= []).push(l); (state.byWeek[l.week] ||= []).push(l); });
    return state;
  }

  /* ---------- календар ---------- */
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmt(d, opts) { return d.toLocaleDateString('uk-UA', opts || { day: 'numeric', month: 'long' }); }
  function weekInfo(week) { return state.cal.weeks.find(w => w.week === week); }
  function dateOf(week, day) { const w = weekInfo(week); const d = parseDate(w.monday); d.setDate(d.getDate() + day - 1); return d; }
  function today() { const s = settings.get(); if (s.fakeToday) { try { return parseDate(s.fakeToday); } catch (e) { } } const t = new Date(); t.setHours(0, 0, 0, 0); return t; }
  function slotOf(date) { const iso = isoDate(date); for (const w of state.cal.weeks) for (const day of w.days) if (isoDate(dateOf(w.week, day)) === iso) return { week: w.week, day }; return null; }
  function schoolDays() { const out = []; state.cal.weeks.forEach(w => w.days.forEach(day => out.push({ week: w.week, day, iso: isoDate(dateOf(w.week, day)) }))); return out; }
  function currentWeek() {
    const t = today(), iso = isoDate(t);
    for (const w of state.cal.weeks) { const mon = parseDate(w.monday); const sun = new Date(mon); sun.setDate(sun.getDate() + 6); if (t >= mon && t <= sun) return w.week; }
    if (iso < state.cal.start) return 1;
    if (iso > state.cal.end) return state.cal.weeks[state.cal.weeks.length - 1].week;
    for (const w of state.cal.weeks) if (parseDate(w.monday) > t) return w.week;
    return state.cal.weeks[state.cal.weeks.length - 1].week;
  }
  function holidayOn(date) { const iso = isoDate(date); return state.cal.holidays.find(h => iso >= h.from && iso <= h.to) || null; }
  function nextSchoolDay(date) { const iso = isoDate(date); return schoolDays().find(s => s.iso > iso) || null; }
  function quarterOf(week) { return state.cal.quarters.find(q => week >= q.weeks[0] && week <= q.weeks[1]); }
  function lessonsOn(week, day) { return (state.byWeek[week] || []).filter(l => l.day === day).sort((a, b) => a.pos - b.pos); }

  /* ---------- прогрес ---------- */
  const progress = {
    _d: null,
    load() {
      if (!this._d) { try { this._d = JSON.parse(localStorage.getItem(LS_PROGRESS)) || {}; } catch (e) { this._d = {}; } }
      this._d.lessons ||= {}; this._d.log ||= []; return this._d;
    },
    save() { localStorage.setItem(LS_PROGRESS, JSON.stringify(this.load())); },
    get(id) { return this.load().lessons[id] || null; },
    ensure(id) {
      const d = this.load();
      if (!d.lessons[id]) d.lessons[id] = { opened: Date.now(), theory: null, practice: { answers: {}, results: {}, score: null, done: null, attempts: 0, best: null }, homework: { answers: {}, results: {}, score: null, submitted: null, review: null }, time: 0, last: Date.now() };
      return d.lessons[id];
    },
    set(id, rec) { rec.last = Date.now(); this.load().lessons[id] = rec; this.save(); },
    remove(id) { delete this.load().lessons[id]; this.save(); },
    log(ev) { const d = this.load(); ev.t = Date.now(); d.log.push(ev); if (d.log.length > 3000) d.log.splice(0, d.log.length - 3000); this.save(); sync.queue(ev); },
    exportJSON() { return JSON.stringify({ version: 1, app: 'zoshyt-4klas', exported: new Date().toISOString(), settings: { name: settings.get().name || '' }, progress: this.load() }); },
    importJSON(json) { const o = JSON.parse(json); if (!o.progress || typeof o.progress.lessons !== 'object') throw new Error('Це не файл прогресу зошита'); this._d = o.progress; this.save(); if (o.settings && o.settings.name) settings.patch({ name: o.settings.name }); },
    merge(json) { // об'єднати: беремо запис з пізнішим last
      const o = JSON.parse(json); const d = this.load(); let n = 0;
      Object.entries(o.progress.lessons || {}).forEach(([id, rec]) => { const cur = d.lessons[id]; if (!cur || (rec.last || 0) > (cur.last || 0)) { d.lessons[id] = rec; n++; } });
      const seen = new Set(d.log.map(e => e.t + e.type + (e.id || ''))); (o.progress.log || []).forEach(e => { const k = e.t + e.type + (e.id || ''); if (!seen.has(k)) { d.log.push(e); seen.add(k); } });
      d.log.sort((a, b) => a.t - b.t); this.save(); return n;
    },
    reset() { this._d = { lessons: {}, log: [] }; this.save(); localStorage.removeItem(LS_SYNCQ); }
  };

  const PASS = 70;
  function statusOf(id) { const r = progress.get(id); if (!r) return 'new'; if (r.practice.done && r.homework.submitted) return 'done'; if (r.practice.done) return 'practice'; return 'started'; }
  function statusIcon(st) { return { new: '○', started: '◔', practice: '◑', done: '●' }[st] || '○'; }
  function statusName(st) { return { new: 'не розпочато', started: 'розпочато', practice: 'практика виконана, домашнє не здано', done: 'виконано' }[st]; }
  function starsOf(score) { if (score == null) return 0; if (score >= 90) return 3; if (score >= 70) return 2; if (score >= 50) return 1; return 0; }
  function starsHTML(score) { const n = starsOf(score); return `<span class="stars" title="${score == null ? '' : score + '%'}">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`; }
  function hwStatus(r) { if (!r || !r.homework.submitted) return r && r.homework.review && r.homework.review.status === 'redo' ? 'redo' : 'none'; if (r.homework.review && r.homework.review.status === 'ok') return 'ok'; return 'submitted'; }
  function hwStatusName(s) { return { none: 'не здано', submitted: 'здано, чекає перевірки', ok: 'перевірено ✓', redo: 'повернуто на доопрацювання' }[s]; }

  function summary(filter) {
    const ls = state.plan.filter(filter || (() => true));
    let done = 0, practice = 0, started = 0, sumScore = 0, nScore = 0, time = 0, stars = 0, hwOk = 0, hwWait = 0;
    ls.forEach(l => {
      const st = statusOf(l.id); if (st === 'done') done++; else if (st === 'practice') practice++; else if (st === 'started') started++;
      const r = progress.get(l.id); if (r) { time += r.time || 0; if (r.practice.best != null) { sumScore += r.practice.best; nScore++; stars += starsOf(r.practice.best); } const h = hwStatus(r); if (h === 'ok') hwOk++; if (h === 'submitted') hwWait++; }
    });
    return { total: ls.length, done, practice, started, notStarted: ls.length - done - practice - started, avg: nScore ? Math.round(sumScore / nScore) : null, time, stars, hwOk, hwWait, pct: ls.length ? Math.round(100 * done / ls.length) : 0 };
  }
  function overdue() { const iso = isoDate(today()); return state.plan.filter(l => isoDate(dateOf(l.week, l.day)) < iso && statusOf(l.id) !== 'done'); }

  function xp() { let x = 0; Object.values(progress.load().lessons).forEach(r => { if (r.practice.done) { x += 10 + Math.round((r.practice.best || 0) / 10); if ((r.practice.best || 0) >= 90) x += 5; } if (r.homework.submitted) x += 10; if (r.homework.review && r.homework.review.status === 'ok') x += 5; }); return x; }
  function level(x) { return Math.floor(x / 100) + 1; }
  function streak() {
    const days = new Set(); progress.load().log.forEach(e => { if (e.type === 'practice' || e.type === 'homework') days.add(isoDate(new Date(e.t))); });
    const sd = schoolDays().map(s => s.iso); const t = isoDate(today());
    let idx = sd.filter(s => s <= t).length - 1; if (idx < 0) return 0;
    if (!days.has(sd[idx])) { if (sd[idx] === t) idx--; else return 0; }
    let n = 0; while (idx >= 0 && days.has(sd[idx])) { n++; idx--; }
    return n;
  }

  const BADGES = [
    { id: 'first', icon: '🚀', name: 'Перший крок', desc: 'Виконано перший урок', test: S => S.done >= 1 },
    { id: 'ten', icon: '🔟', name: 'Десятка', desc: '10 уроків виконано', test: S => S.done >= 10 },
    { id: 'fifty', icon: '⭐', name: 'Півсотні', desc: '50 уроків виконано', test: S => S.done >= 50 },
    { id: 'hundred', icon: '💯', name: 'Сотня', desc: '100 уроків виконано', test: S => S.done >= 100 },
    { id: 'twohundred', icon: '🎯', name: 'Дві сотні', desc: '200 уроків виконано', test: S => S.done >= 200 },
    { id: 'all', icon: '🏆', name: 'Семестр!', desc: 'Усі уроки семестру виконано', test: S => S.total > 0 && S.done >= S.total },
    { id: 'week', icon: '📅', name: 'Тиждень без пропусків', desc: 'Усі уроки одного тижня виконано', test: (S, c) => c.fullWeeks >= 1 },
    { id: 'weeks4', icon: '🗓️', name: 'Місяць у ритмі', desc: '4 повних тижні', test: (S, c) => c.fullWeeks >= 4 },
    { id: 'weeks8', icon: '🏅', name: 'Чверть закрито', desc: '8 повних тижнів', test: (S, c) => c.fullWeeks >= 8 },
    { id: 'streak5', icon: '🔥', name: 'Серія 5', desc: '5 навчальних днів поспіль', test: (S, c) => c.streak >= 5 },
    { id: 'streak15', icon: '🌋', name: 'Серія 15', desc: '15 навчальних днів поспіль', test: (S, c) => c.streak >= 15 },
    { id: 'math', icon: '🔢', name: 'Математик', desc: '20 уроків математики', test: (S, c) => (c.bySubj.math || 0) >= 20 },
    { id: 'ukr', icon: '✍️', name: 'Мовознавець', desc: '20 уроків української мови', test: (S, c) => (c.bySubj.ukr || 0) >= 20 },
    { id: 'read', icon: '📚', name: 'Книголюб', desc: '20 уроків читання', test: (S, c) => (c.bySubj.read || 0) >= 20 },
    { id: 'eng', icon: '🇬🇧', name: 'Поліглот', desc: '20 уроків англійської', test: (S, c) => (c.bySubj.eng || 0) >= 20 },
    { id: 'yds', icon: '🌍', name: 'Дослідник', desc: '20 уроків «Я досліджую світ»', test: (S, c) => (c.bySubj.yds || 0) >= 20 },
    { id: 'sport', icon: '🏃', name: 'Спортсмен', desc: '20 уроків фізкультури', test: (S, c) => (c.bySubj.pe || 0) >= 20 },
    { id: 'artist', icon: '🎨', name: 'Митець', desc: '10 уроків мистецтва і технологій', test: (S, c) => ((c.bySubj.art || 0) + (c.bySubj.music || 0) + (c.bySubj.design || 0)) >= 10 },
    { id: 'stars', icon: '🌟', name: 'Відмінник', desc: '10 уроків на три зірки', test: (S, c) => c.threeStars >= 10 },
    { id: 'stars50', icon: '✨', name: 'Зоряний', desc: '50 уроків на три зірки', test: (S, c) => c.threeStars >= 50 },
    { id: 'hw', icon: '📝', name: 'Домашка — клас', desc: '25 домашніх завдань перевірено батьками', test: (S, c) => c.reviewed >= 25 },
    { id: 'time', icon: '⏱️', name: 'Марафонець', desc: '20 годин навчання', test: S => S.time >= 20 * 3600 },
  ];
  function badges() {
    const S = summary(); const bySubj = {}; let threeStars = 0, reviewed = 0;
    state.plan.forEach(l => { if (statusOf(l.id) === 'done') bySubj[l.subject] = (bySubj[l.subject] || 0) + 1; const r = progress.get(l.id); if (r && r.practice.best >= 90) threeStars++; if (r && r.homework.review && r.homework.review.status === 'ok') reviewed++; });
    let fullWeeks = 0; state.cal.weeks.forEach(w => { const ls = state.byWeek[w.week] || []; if (ls.length && ls.every(l => statusOf(l.id) === 'done')) fullWeeks++; });
    const c = { bySubj, threeStars, reviewed, fullWeeks, streak: streak() };
    return BADGES.map(b => ({ id: b.id, icon: b.icon, name: b.name, desc: b.desc, earned: !!b.test(S, c) }));
  }

  /* ---------- налаштування ---------- */
  // PIN кабінету батьків ніколи не зберігається і не показується у відкритому вигляді —
  // лише SHA-256 хеш. DEFAULT_PIN_HASH — хеш початкового PIN, який повідомляють батькам окремо
  // (поза інтерфейсом сайту), щоб дитина його не побачила на екрані чи у видимому тексті сторінки.
  const DEFAULT_PIN_HASH = '7aac829dc4ec6caee619901087749dea68c06a2c825aad735bcc75aac19befe6';
  async function sha256Hex(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const settings = {
    get() { try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; } catch (e) { return {}; } },
    set(s) { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); },
    patch(p) { this.set(Object.assign(this.get(), p)); },
    pinHash() { return this.get().pinHash || DEFAULT_PIN_HASH; },
    async checkPin(entered) { return (await sha256Hex(entered)) === this.pinHash(); },
    async setPin(newPin) { this.patch({ pinHash: await sha256Hex(newPin) }); }
  };

  /* ---------- синхронізація з Google Таблицею (необов'язково) ---------- */
  const sync = {
    _q() { try { return JSON.parse(localStorage.getItem(LS_SYNCQ)) || []; } catch (e) { return []; } },
    enabled() { return !!settings.get().syncUrl; },
    queue(ev) {
      if (!this.enabled()) return;
      const l = ev.id ? state.byId[ev.id] : null; const s = settings.get();
      const q = this._q(); q.push(Object.assign({ child: s.name || '', title: l ? l.title : '', subject: l ? (state.subjMap[l.subject] || {}).name : '', week: l ? l.week : '' }, ev));
      localStorage.setItem(LS_SYNCQ, JSON.stringify(q)); this.flush();
    },
    async flush() {
      if (!this.enabled() || this._busy) return; const q = this._q(); if (!q.length) return; this._busy = true;
      try { await fetch(settings.get().syncUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: 'events', events: q }) }); localStorage.setItem(LS_SYNCQ, '[]'); settings.patch({ lastSync: Date.now() }); }
      catch (e) { console.warn('sync', e); } finally { this._busy = false; }
    },
    async snapshot() {
      const s = settings.get(); if (!s.syncUrl) throw new Error('Не вказано адресу синхронізації');
      await fetch(s.syncUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: 'snapshot', child: s.name || '', data: progress.exportJSON() }) });
      settings.patch({ lastSnapshot: Date.now() });
    },
    async pull() {
      const s = settings.get(); if (!s.syncUrl) throw new Error('Не вказано адресу синхронізації');
      const r = await fetch(s.syncUrl + (s.syncUrl.includes('?') ? '&' : '?') + 'action=snapshot'); const j = await r.json(); if (!j || !j.data) throw new Error('У хмарі ще немає знімка прогресу'); return j.data;
    }
  };

  /* ---------- утиліти ---------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<i>$2</i>').replace(/\n/g, '<br>'); }
  function hash(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h || 1; }
  function shuffle(arr, seed) { const a = arr.slice(); let s = (seed || 1) >>> 0; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; }; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function fmtTime(sec) { sec = sec || 0; const m = Math.round(sec / 60); if (m < 1) return '< 1 хв'; if (m < 60) return m + ' хв'; return Math.floor(m / 60) + ' год ' + (m % 60) + ' хв'; }
  function fmtDT(ts) { if (!ts) return '—'; const d = new Date(ts); return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); }
  function qs(k) { return new URLSearchParams(location.search).get(k); }
  function subjTag(sid) { const s = state.subjMap[sid]; return `<span class="subj-tag" style="background:${s.color}">${s.icon} ${esc(s.short)}</span>`; }
  function speak(text, lang) {
    if (!('speechSynthesis' in window)) { alert('Озвучення недоступне у цьому браузері.'); return; }
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'en' ? 'en-GB' : 'uk-UA'; u.rate = lang === 'en' ? 0.88 : 0.95;
    const pick = () => { const vs = speechSynthesis.getVoices(); const pref = lang === 'en' ? ['en-GB', 'en-US', 'en'] : ['uk-UA', 'uk']; for (const p of pref) { const v = vs.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(p.toLowerCase())); if (v) { u.voice = v; break; } } speechSynthesis.speak(u); };
    if (speechSynthesis.getVoices().length) pick(); else speechSynthesis.onvoiceschanged = () => { speechSynthesis.onvoiceschanged = null; pick(); };
  }
  function lessonURL(id) { return 'lesson.html?id=' + encodeURIComponent(id); }
  function lessonRow(l, opts) {
    opts = opts || {}; const st = statusOf(l.id); const r = progress.get(l.id); const h = hwStatus(r);
    const date = opts.date ? `<small>${DAYS_SHORT[l.day]} ${fmt(dateOf(l.week, l.day), { day: 'numeric', month: 'short' })}</small>` : '';
    const hw = st === 'done' ? `<span class="chip ${h === 'ok' ? 'ok' : ''}" title="Домашнє завдання: ${hwStatusName(h)}">${h === 'ok' ? '✓ ДЗ перевірено' : 'ДЗ здано'}</span>` : (h === 'redo' ? '<span class="chip warn">ДЗ повернуто</span>' : '');
    return `<a class="lesson-row ${st}" href="${lessonURL(l.id)}"><span class="status" title="${statusName(st)}">${statusIcon(st)}</span>${subjTag(l.subject)}<span class="t"><b>${esc(l.title)}</b>${date}</span>${r && r.practice.best != null ? starsHTML(r.practice.best) : ''}${hw}</a>`;
  }
  function header(active) {
    const s = settings.get(); const x = xp();
    const nav = [['index.html', 'Сьогодні', 'home'], ['week.html', 'Тижні', 'week'], ['subject.html', 'Предмети', 'subject'], ['achievements.html', 'Нагороди', 'ach'], ['about.html', 'Про зошит', 'about'], ['parent.html', '👨‍👩‍👦 Батькам', 'parent']];
    return `<header class="top"><a class="brand" href="index.html"><span class="logo">📘</span><span>Робочий зошит<small>4 клас · I семестр 2026/27</small></span></a>
      <nav>${nav.map(n => `<a href="${n[0]}" class="${active === n[2] ? 'on' : ''}">${n[1]}</a>`).join('')}</nav>
      <div class="me"><span class="chip" title="Очки досвіду">⚡ ${x} XP · рів. ${level(x)}</span><span class="chip" title="Навчальних днів поспіль">🔥 ${streak()}</span><span class="name">${esc(s.name || '')}</span></div></header>`;
  }
  function footer() { return `<footer>Робочий зошит для домашнього навчання · 4 клас · відповідає Типовій освітній програмі (О. Савченко) і Державному стандарту початкової освіти · <a href="about.html">Про зошит</a></footer>`; }
  function askName(cb) {
    const s = settings.get(); if (s.name) return cb && cb(s.name);
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal"><h2 style="margin-top:0">Привіт! 👋</h2><p>Як тебе звати? Ім'я буде в шапці зошита та у звітах для батьків.</p><input id="nm" placeholder="Твоє ім'я" maxlength="30"><p style="text-align:right;margin-bottom:0"><button class="btn" id="nmok">Почати</button></p></div>`;
    document.body.appendChild(bg);
    const done = () => { const v = bg.querySelector('#nm').value.trim() || 'Учень'; settings.patch({ name: v }); bg.remove(); cb && cb(v); };
    bg.querySelector('#nmok').onclick = done; bg.querySelector('#nm').onkeydown = e => { if (e.key === 'Enter') done(); }; bg.querySelector('#nm').focus();
  }
  function toast(msg, cls) { const t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1f2937;color:#fff;padding:10px 18px;border-radius:999px;font-weight:700;z-index:99;box-shadow:0 6px 20px rgba(0,0,0,.2)'; if (cls === 'bad') t.style.background = '#dc2626'; if (cls === 'ok') t.style.background = '#16a34a'; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

  window.addEventListener('load', () => { try { sync.flush(); } catch (e) { } });

  return { state, DAYS, DAYS_SHORT, init, loadJSON, parseDate, isoDate, fmt, weekInfo, dateOf, today, slotOf, schoolDays, currentWeek, holidayOn, nextSchoolDay, quarterOf, lessonsOn,
    progress, PASS, statusOf, statusIcon, statusName, starsOf, starsHTML, hwStatus, hwStatusName, summary, overdue, xp, level, streak, badges, settings, sync,
    esc, md, hash, shuffle, fmtTime, fmtDT, qs, subjTag, speak, lessonURL, lessonRow, header, footer, askName, toast };
})();
