/* Кабінет батьків: огляд, уроки з деталями відповідей, журнал, звіти, налаштування */
(async function () {
  const root = document.getElementById('app');
  try { await Z.init(); } catch (e) { root.innerHTML = '<div class="card">Помилка: ' + Z.esc(e.message) + '</div>'; return; }
  document.getElementById('hdr').innerHTML = Z.header('parent'); document.getElementById('ftr').innerHTML = Z.footer();
  const lessonCache = {};
  async function lesson(id) { if (!lessonCache[id]) { try { lessonCache[id] = await Z.loadJSON(Z.state.byId[id].file); } catch (e) { lessonCache[id] = null; } } return lessonCache[id]; }

  /* ---- PIN ---- */
  if (sessionStorage.getItem('z4.parent') !== '1') {
    const isDefault = !Z.settings.get().pin;
    root.innerHTML = `<div class="card" style="max-width:460px;margin:40px auto"><h1>👨‍👩‍👦 Кабінет батьків</h1><p class="muted">Тут видно, як дитина виконує уроки й домашні завдання. Введіть PIN.</p>${isDefault ? '<p class="notice">Стандартний PIN — <b>2026</b>. Змініть його в налаштуваннях кабінету.</p>' : ''}<div class="field"><input id="pin" type="password" inputmode="numeric" placeholder="PIN" autocomplete="off"></div><button class="btn" id="go">Увійти</button> <span id="err" class="pill-bad"></span></div>`;
    const tryPin = () => { if (document.getElementById('pin').value === Z.settings.pin()) { sessionStorage.setItem('z4.parent', '1'); location.reload(); } else document.getElementById('err').textContent = 'Невірний PIN'; };
    document.getElementById('go').onclick = tryPin; document.getElementById('pin').onkeydown = e => { if (e.key === 'Enter') tryPin(); }; document.getElementById('pin').focus();
    return;
  }

  const TABS = [['overview', 'Огляд'], ['lessons', 'Уроки і домашні'], ['journal', 'Журнал'], ['report', 'Звіт і резервна копія'], ['settings', 'Налаштування']];
  let tab = Z.qs('tab') || 'overview'; let week = Number(Z.qs('w')) || Z.currentWeek(); let onlyHW = false; let openId = Z.qs('id') || null;
  function tabsHTML() { return `<div class="tabs">${TABS.map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}<button class="btn sm ghost" id="exit" style="margin-left:auto">Вийти з кабінету</button></div>`; }

  /* ---- Огляд ---- */
  function overview() {
    const A = Z.summary(); const od = Z.overdue(); const log = Z.progress.load().log; const last = log.length ? log[log.length - 1] : null; const s = Z.settings.get();
    const waiting = Z.state.plan.filter(l => Z.hwStatus(Z.progress.get(l.id)) === 'submitted');
    const cards = [[`${A.done} / ${A.total}`, 'уроків виконано', `<div class="bar"><i style="width:${A.pct}%"></i></div>`], [A.avg != null ? A.avg + '%' : '—', 'середній бал за практику', ''], [waiting.length, 'домашніх чекають перевірки', waiting.length ? `<a href="parent.html?tab=lessons&hw=1">переглянути →</a>` : ''], [od.length, 'уроків прострочено', od.length ? `<a href="week.html?w=${od[0].week}">тиждень ${od[0].week} →</a>` : ''], [Z.fmtTime(A.time), 'часу за уроками', ''], [Z.streak() + ' дн.', 'серія навчальних днів', last ? `<small class="muted">остання активність: ${Z.fmtDT(last.t)}</small>` : '']];
    const subjRows = Z.state.subjects.map(sub => { const S = Z.summary(l => l.subject === sub.id); return `<tr><td>${sub.icon} ${Z.esc(sub.name)}</td><td>${S.done}/${S.total}</td><td style="min-width:120px"><div class="bar"><i style="width:${S.pct}%;background:${sub.color}"></i></div></td><td>${S.avg != null ? S.avg + '%' : '—'}</td><td>${S.hwOk}/${S.hwOk + S.hwWait}</td><td>${Z.fmtTime(S.time)}</td></tr>`; }).join('');
    const weekCells = Z.state.cal.weeks.map(w => { const S = Z.summary(l => l.week === w.week); const iso = Z.isoDate(Z.dateOf(w.week, w.days[w.days.length - 1])); const past = iso < Z.isoDate(Z.today()); const col = S.pct === 100 ? 'var(--ok)' : past && S.pct < 100 ? 'var(--bad)' : S.pct > 0 ? 'var(--accent2)' : '#d1d5db'; return `<a href="parent.html?tab=lessons&w=${w.week}" title="Тиждень ${w.week}: ${S.done}/${S.total}" style="display:block;text-align:center;padding:8px 4px;border-radius:10px;background:#fff;border:2px solid ${col};color:inherit"><b>${w.week}</b><br><small>${S.done}/${S.total}</small></a>`; }).join('');
    return `<div class="grid c3">${cards.map(c => `<div class="card" style="margin:0"><div style="font-size:1.6rem;font-weight:800">${c[0]}</div><small class="muted">${c[1]}</small>${c[2]}</div>`).join('')}</div>
      <div class="card"><h2 style="margin-top:0">Тижні семестру</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(64px,1fr))">${weekCells}</div><small class="muted">зелений — тиждень виконано повністю; червоний — тиждень минув, є невиконані уроки; жовтий — у процесі.</small></div>
      <div class="card"><h2 style="margin-top:0">За предметами</h2><div class="table-wrap"><table><thead><tr><th>Предмет</th><th>Уроки</th><th></th><th>Сер. бал</th><th>ДЗ перевірено</th><th>Час</th></tr></thead><tbody>${subjRows}</tbody></table></div></div>
      ${!s.syncUrl ? '<div class="notice">💡 Щоб бачити прогрес з іншого пристрою (наприклад, з телефону), налаштуйте синхронізацію з Google Таблицею у вкладці «Налаштування» або надсилайте щотижневий звіт у вкладці «Звіт».</div>' : `<div class="notice" style="border-color:var(--ok)">☁️ Синхронізація увімкнена. Останнє надсилання подій: ${Z.fmtDT(s.lastSync)}; знімок: ${Z.fmtDT(s.lastSnapshot)}.</div>`}`;
  }

  /* ---- Уроки ---- */
  function lessonsTab() {
    const wi = Z.weekInfo(week); let ls = Z.state.byWeek[week] || []; if (onlyHW) ls = Z.state.plan.filter(l => Z.hwStatus(Z.progress.get(l.id)) === 'submitted');
    const nav = Z.state.cal.weeks.map(w => `<button class="chip" data-w="${w.week}" style="border:0;cursor:pointer;${w.week === week && !onlyHW ? 'outline:2px solid var(--accent)' : ''}">${w.week}</button>`).join(' ');
    const rows = ls.map(l => { const r = Z.progress.get(l.id); const st = Z.statusOf(l.id); const h = Z.hwStatus(r); const hwCls = h === 'ok' ? 'pill-ok' : h === 'submitted' ? 'pill-warn' : h === 'redo' ? 'pill-bad' : 'muted';
      return `<tr style="${openId === l.id ? 'background:#eef2ff' : ''}"><td>${Z.DAYS_SHORT[l.day]}<br><small class="muted">${Z.fmt(Z.dateOf(l.week, l.day), { day: 'numeric', month: 'short' })}</small></td><td>${Z.subjTag(l.subject)}</td><td><b>${Z.esc(l.title)}</b></td><td title="${Z.statusName(st)}">${Z.statusIcon(st)} <small>${Z.statusName(st).split(',')[0]}</small></td><td>${r && r.practice.best != null ? `<b>${r.practice.best}%</b> ${Z.starsHTML(r.practice.best)}${r.practice.attempts > 1 ? `<br><small class="muted">спроб: ${r.practice.attempts}</small>` : ''}` : '—'}</td><td class="${hwCls}">${Z.hwStatusName(h)}${r && r.homework.score != null ? `<br><small class="muted">авто: ${r.homework.score}%</small>` : ''}</td><td>${r ? Z.fmtTime(r.time) : '—'}<br><small class="muted">${r ? Z.fmtDT(r.last) : ''}</small></td><td><button class="btn sm sec" data-open="${l.id}">Деталі</button></td></tr>`; }).join('');
    return `<div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${nav}<label style="margin-left:auto;display:flex;gap:6px;align-items:center"><input type="checkbox" id="onlyHW" ${onlyHW ? 'checked' : ''}> лише ДЗ на перевірку</label></div>
      <h2>${onlyHW ? 'Домашні завдання, що чекають перевірки' : `Тиждень ${week}: ${Z.fmt(Z.dateOf(week, wi.days[0]))} – ${Z.fmt(Z.dateOf(week, wi.days[wi.days.length - 1]))}`}</h2>
      <div class="table-wrap"><table><thead><tr><th>День</th><th>Предмет</th><th>Урок</th><th>Статус</th><th>Практика</th><th>Домашнє</th><th>Час / активність</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="muted">Немає уроків</td></tr>'}</tbody></table></div></div><div id="detail"></div>`;
  }
  async function detail(id) {
    const box = document.getElementById('detail'); const meta = Z.state.byId[id]; const r = Z.progress.get(id); const L = await lesson(id);
    if (!L) { box.innerHTML = '<div class="card">Файл уроку недоступний.</div>'; return; }
    const block = (kind, list, B) => list.map((ex, i) => { const R = (B.results || {})[i]; const ua = EX.userAnswerText(ex, (B.answers || {})[i]); const manual = EX.isManual(ex.type);
      const verdict = !R || !R.final ? '<span class="muted">не виконано</span>' : manual ? '<span class="pill-warn">на перевірку</span>' : R.score === 1 ? `<span class="pill-ok">✓ правильно${R.tries > 1 ? ' (2-га спроба)' : ''}</span>` : R.score > 0 ? `<span class="pill-warn">частково ${Math.round(R.score * 100)}%</span>` : '<span class="pill-bad">✗ неправильно</span>';
      return `<div class="ans-row"><div class="q">${i + 1}. ${Z.md(ex.q || 'Так чи ні?')} <small>[${ex.type}]</small> — ${verdict}</div><div class="child">${Z.esc(ua)}</div>${(!R || R.score < 1 || manual) && ex.type !== 'checklist' && ex.type !== 'speak' ? `<small class="muted">${manual ? 'Зразок' : 'Правильно'}: ${Z.esc(EX.answerText(ex))}</small>` : ''}</div>`; }).join('');
    const rv = r && r.homework.review;
    box.innerHTML = `<div class="card detail"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><h2 style="margin:0">${Z.subjTag(meta.subject)} ${Z.esc(L.title)}</h2><span><a class="btn sm ghost" href="${Z.lessonURL(id)}" target="_blank">Відкрити урок ↗</a> <button class="btn sm danger" id="resetLesson">Скинути прогрес уроку</button></span></div>
      ${!r ? '<p class="muted">Дитина ще не відкривала цей урок.</p>' : `<p class="muted">Відкрито: ${Z.fmtDT(r.opened)} · теорію прочитано: ${r.theory ? Z.fmtDT(r.theory) : 'ні'} · час: ${Z.fmtTime(r.time)}</p>
      <h3>Практика ${r.practice.done ? `— ${r.practice.score}% (найкращий ${r.practice.best}%, спроб ${r.practice.attempts}), завершено ${Z.fmtDT(r.practice.done)}` : '— не завершено'}</h3>${block('practice', L.exercises, r.practice)}
      <h3>Домашнє завдання — ${Z.hwStatusName(Z.hwStatus(r))}${r.homework.submitted ? ', здано ' + Z.fmtDT(r.homework.submitted) : ''}</h3>${block('homework', L.homework, r.homework)}
      ${r.homework.submitted || rv ? `<div class="card" style="background:#f9fafb"><h3 style="margin-top:0">Перевірка батьків</h3>${rv ? `<p class="muted">Поточна оцінка: <b>${rv.status === 'ok' ? 'прийнято' : 'повернуто'}</b> ${Z.fmtDT(rv.at)}${rv.comment ? ' — ' + Z.esc(rv.comment) : ''}</p>` : ''}<div class="field"><label><input type="radio" name="rv" value="ok" ${!rv || rv.status === 'ok' ? 'checked' : ''}> ✅ Прийнято</label><label><input type="radio" name="rv" value="redo" ${rv && rv.status === 'redo' ? 'checked' : ''}> ↩️ Повернути на доопрацювання (дитина зможе переробити)</label></div><div class="field"><label>Коментар для дитини</label><textarea id="rvc" style="min-height:70px">${Z.esc(rv ? rv.comment || '' : '')}</textarea></div><button class="btn ok" id="saveRv">Зберегти перевірку</button></div>` : ''}
      ${r.reflection ? `<h3>Рефлексія</h3>${Object.entries(r.reflection).map(([i, v]) => `<div class="child">${Z.esc((L.reflection || [])[i] || '')}<br><b>${Z.esc(v)}</b></div>`).join('')}` : ''}`}</div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const sv = document.getElementById('saveRv'); if (sv) sv.onclick = () => { const status = box.querySelector('input[name=rv]:checked').value; const comment = document.getElementById('rvc').value.trim(); r.homework.review = { status, comment, at: Date.now() }; if (status === 'redo') r.homework.submitted = null; Z.progress.set(id, r); Z.progress.log({ type: 'review', id, status, comment }); Z.toast('Перевірку збережено', 'ok'); render(); detail(id); };
    document.getElementById('resetLesson').onclick = () => { if (confirm('Видалити весь прогрес цього уроку? Дитина проходитиме його з початку.')) { Z.progress.remove(id); Z.progress.log({ type: 'reset', id }); render(); } };
  }

  /* ---- Журнал ---- */
  function journal() {
    const log = Z.progress.load().log.slice().reverse().slice(0, 300);
    const name = t => ({ open: 'відкрив урок', practice: 'завершив практику', homework: 'здав домашнє', retry: 'повторює практику', review: 'перевірка батьків', reset: 'скинуто прогрес', import: 'імпорт даних' }[t] || t);
    return `<div class="card"><h2 style="margin-top:0">Журнал подій</h2><div class="table-wrap"><table><thead><tr><th>Коли</th><th>Подія</th><th>Урок</th><th>Результат</th></tr></thead><tbody>${log.map(e => { const l = e.id ? Z.state.byId[e.id] : null; return `<tr><td>${Z.fmtDT(e.t)}</td><td>${name(e.type)}</td><td>${l ? Z.subjTag(l.subject) + ' ' + Z.esc(l.title) : ''}</td><td>${e.score != null ? e.score + '%' : ''}${e.status ? (e.status === 'ok' ? 'прийнято' : 'повернуто') + (e.comment ? ': ' + Z.esc(e.comment) : '') : ''}${e.attempt > 1 ? ' (спроба ' + e.attempt + ')' : ''}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Подій ще немає</td></tr>'}</tbody></table></div></div>`;
  }

  /* ---- Звіт ---- */
  function reportText(w) {
    const s = Z.settings.get(); const wi = Z.weekInfo(w); const ls = Z.state.byWeek[w] || []; const S = Z.summary(l => l.week === w);
    const lines = [`📘 Звіт про навчання — ${s.name || 'учень'}, 4 клас`, `Тиждень ${w} (${Z.fmt(Z.dateOf(w, wi.days[0]))} – ${Z.fmt(Z.dateOf(w, wi.days[wi.days.length - 1]))})`, '', `Виконано уроків: ${S.done} з ${S.total} (${S.pct}%)`, `Середній бал за практику: ${S.avg != null ? S.avg + '%' : '—'}`, `Домашні завдання: здано ${S.hwOk + S.hwWait}, перевірено ${S.hwOk}`, `Час за уроками: ${Z.fmtTime(S.time)}`, '', 'За предметами:'];
    Z.state.subjects.forEach(sub => { const P = Z.summary(l => l.week === w && l.subject === sub.id); if (P.total) lines.push(`• ${sub.name}: ${P.done}/${P.total}${P.avg != null ? ', сер. ' + P.avg + '%' : ''}`); });
    const nd = ls.filter(l => Z.statusOf(l.id) !== 'done'); if (nd.length) { lines.push('', 'Не виконано:'); nd.forEach(l => lines.push(`• ${Z.DAYS_SHORT[l.day]} — ${Z.state.subjMap[l.subject].name}: ${l.title}`)); }
    const od = Z.overdue().filter(l => l.week < w); if (od.length) lines.push('', `Борги з попередніх тижнів: ${od.length}`);
    const A = Z.summary(); lines.push('', `Разом за семестр: ${A.done}/${A.total} уроків, ${A.stars} зірок, серія ${Z.streak()} дн.`);
    return lines.join('\n');
  }
  function report() {
    const s = Z.settings.get();
    return `<div class="card"><h2 style="margin-top:0">Звіт за тиждень</h2><div style="display:flex;gap:6px;flex-wrap:wrap">${Z.state.cal.weeks.map(w => `<button class="chip" data-rw="${w.week}" style="border:0;cursor:pointer;${w.week === week ? 'outline:2px solid var(--accent)' : ''}">${w.week}</button>`).join('')}</div>
      <textarea id="rep" class="field" style="width:100%;min-height:260px;margin-top:10px;font-family:ui-monospace,monospace;font-size:.9rem">${Z.esc(reportText(week))}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="copy">Копіювати</button><a class="btn sec" id="tg" target="_blank" href="#">Надіслати в Telegram</a><a class="btn sec" id="mail" href="#">Надіслати e-mail</a></div></div>
      <div class="card"><h2 style="margin-top:0">Резервна копія прогресу</h2><p class="muted">Прогрес зберігається у браузері цього пристрою. Раз на тиждень робіть копію — файл можна відкрити на іншому пристрої через «Імпорт».</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="exp">⬇ Експортувати JSON</button><label class="btn sec">⬆ Імпортувати JSON<input type="file" id="imp" accept="application/json" hidden></label></div>
      <p class="muted" style="margin-top:8px">Імпорт об'єднує дані: для кожного уроку зберігається новіший запис.</p></div>
      <div class="card"><h2 style="margin-top:0">☁️ Хмара (Google Таблиця)</h2>${s.syncUrl ? `<p class="muted">Кожна подія автоматично надсилається в таблицю. Тут можна надіслати повний знімок прогресу або завантажити його на цьому пристрої.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="push">Надіслати знімок у хмару</button><button class="btn sec" id="pull">Завантажити знімок із хмари</button></div><p id="cloudmsg" class="muted"></p>` : '<p class="muted">Синхронізацію не налаштовано. Див. вкладку «Налаштування».</p>'}</div>`;
  }

  /* ---- Налаштування ---- */
  function settingsTab() {
    const s = Z.settings.get();
    return `<div class="card"><h2 style="margin-top:0">Налаштування</h2>
      <div class="field"><label>Ім'я дитини</label><input id="nm" value="${Z.esc(s.name || '')}"></div>
      <div class="field"><label>Новий PIN кабінету батьків (4–8 цифр)</label><input id="pin" inputmode="numeric" placeholder="залишити без змін" autocomplete="off"></div>
      <div class="field"><label>Адреса синхронізації (Google Apps Script Web App URL)</label><input id="sync" value="${Z.esc(s.syncUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"><small class="muted">Інструкція: файл <a href="sync/README.md" target="_blank">sync/README.md</a> у репозиторії (5 хвилин: створити таблицю → вставити скрипт → опублікувати як вебзастосунок → скопіювати адресу сюди). Після цього кожна подія з'являється в таблиці, яку можна відкрити з будь-якого телефона.</small></div>
      <div class="field"><label>Тестова «сьогоднішня» дата (лише для перевірки роботи зошита, формат РРРР-ММ-ДД; порожньо = реальна дата)</label><input id="fake" value="${Z.esc(s.fakeToday || '')}" placeholder="2026-09-14"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ok" id="save">Зберегти</button><button class="btn sec" id="test" ${s.syncUrl ? '' : 'disabled'}>Надіслати тестову подію</button></div></div>
      <div class="card" style="border-left:6px solid var(--bad)"><h2 style="margin-top:0">Небезпечна зона</h2><p class="muted">Повне скидання видаляє весь прогрес і журнал на цьому пристрої. Спочатку зробіть експорт.</p><button class="btn danger" id="wipe">Скинути весь прогрес</button></div>`;
  }

  /* ---- рендер ---- */
  function render() {
    root.innerHTML = `<h1 style="margin:10px 0 4px">👨‍👩‍👦 Кабінет батьків</h1>` + tabsHTML() + (tab === 'overview' ? overview() : tab === 'lessons' ? lessonsTab() : tab === 'journal' ? journal() : tab === 'report' ? report() : settingsTab());
    root.querySelectorAll('button[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; openId = null; render(); });
    document.getElementById('exit').onclick = () => { sessionStorage.removeItem('z4.parent'); location.href = 'index.html'; };
    root.querySelectorAll('button[data-w]').forEach(b => b.onclick = () => { week = Number(b.dataset.w); onlyHW = false; openId = null; render(); });
    root.querySelectorAll('button[data-rw]').forEach(b => b.onclick = () => { week = Number(b.dataset.rw); render(); });
    root.querySelectorAll('button[data-open]').forEach(b => b.onclick = () => { openId = b.dataset.open; render(); detail(openId); });
    const oh = document.getElementById('onlyHW'); if (oh) oh.onchange = () => { onlyHW = oh.checked; render(); };
    if (tab === 'lessons' && openId) detail(openId);
    if (tab === 'report') {
      const txt = () => document.getElementById('rep').value;
      document.getElementById('copy').onclick = () => navigator.clipboard.writeText(txt()).then(() => Z.toast('Скопійовано', 'ok'));
      const upd = () => { document.getElementById('tg').href = 'https://t.me/share/url?url=' + encodeURIComponent(location.origin + location.pathname.replace(/parent\.html$/, '')) + '&text=' + encodeURIComponent(txt()); document.getElementById('mail').href = 'mailto:?subject=' + encodeURIComponent('Звіт про навчання, тиждень ' + week) + '&body=' + encodeURIComponent(txt()); };
      upd(); document.getElementById('rep').oninput = upd;
      document.getElementById('exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Z.progress.exportJSON()], { type: 'application/json' })); a.download = `zoshyt-progress-${Z.isoDate(new Date())}.json`; a.click(); };
      document.getElementById('imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const n = Z.progress.merge(t); Z.progress.log({ type: 'import', n }); Z.toast(`Імпортовано: оновлено ${n} уроків`, 'ok'); render(); } catch (err) { alert('Не вдалося імпортувати: ' + err.message); } }); };
      const push = document.getElementById('push'); if (push) push.onclick = async () => { try { await Z.sync.snapshot(); document.getElementById('cloudmsg').textContent = 'Знімок надіслано ' + Z.fmtDT(Date.now()) + '. Перевірте вкладку «Знімок» у таблиці.'; } catch (e) { document.getElementById('cloudmsg').textContent = 'Помилка: ' + e.message; } };
      const pull = document.getElementById('pull'); if (pull) pull.onclick = async () => { try { const data = await Z.sync.pull(); const n = Z.progress.merge(data); document.getElementById('cloudmsg').textContent = `Завантажено: оновлено ${n} уроків.`; Z.toast('Готово', 'ok'); } catch (e) { document.getElementById('cloudmsg').textContent = 'Помилка: ' + e.message + '. Перевірте, що вебзастосунок опубліковано з доступом «Anyone».'; } };
    }
    if (tab === 'settings') {
      document.getElementById('save').onclick = () => { const p = { name: document.getElementById('nm').value.trim(), syncUrl: document.getElementById('sync').value.trim(), fakeToday: document.getElementById('fake').value.trim() }; const pin = document.getElementById('pin').value.trim(); if (pin) { if (!/^\d{4,8}$/.test(pin)) { alert('PIN — від 4 до 8 цифр'); return; } p.pin = pin; } Z.settings.patch(p); Z.toast('Збережено', 'ok'); document.getElementById('hdr').innerHTML = Z.header('parent'); render(); };
      document.getElementById('test').onclick = async () => { Z.progress.log({ type: 'test', note: 'Тестова подія з кабінету батьків' }); await Z.sync.flush(); Z.toast('Тестову подію надіслано — перевірте таблицю через хвилину'); };
      document.getElementById('wipe').onclick = () => { if (confirm('Точно видалити ВЕСЬ прогрес на цьому пристрої?') && prompt('Введіть слово ВИДАЛИТИ для підтвердження') === 'ВИДАЛИТИ') { Z.progress.reset(); Z.toast('Прогрес скинуто'); render(); } };
    }
  }
  if (Z.qs('hw') === '1') { tab = 'lessons'; onlyHW = true; }
  render();
})();
