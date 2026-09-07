/* Головна: сьогодні, борги, прогрес, предмети */
(async function () {
  const root = document.getElementById('app');
  try { await Z.init(); } catch (e) { root.innerHTML = '<div class="card">Не вдалося завантажити дані: ' + Z.esc(e.message) + '</div>'; return; }
  document.getElementById('hdr').innerHTML = Z.header('home'); document.getElementById('ftr').innerHTML = Z.footer();
  Z.askName(() => { document.getElementById('hdr').innerHTML = Z.header('home'); render(); });

  function render() {
    const s = Z.settings.get(); const t = Z.today(); const slot = Z.slotOf(t); const hol = Z.holidayOn(t); const iso = Z.isoDate(t);
    const hour = new Date().getHours(); const greet = hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір';
    let todayHTML;
    if (slot) {
      const ls = Z.lessonsOn(slot.week, slot.day); const done = ls.filter(l => Z.statusOf(l.id) === 'done').length;
      todayHTML = `<div class="hero"><div class="ring" style="--p:${ls.length ? Math.round(100 * done / ls.length) : 0}"><span>${done}/${ls.length}</span></div><div><h1 style="margin:0">${Z.DAYS[slot.day]}, ${Z.fmt(t)}</h1><small class="muted">Тиждень ${slot.week} · ${Z.quarterOf(slot.week).name} · ${ls.length} уроків за розкладом</small></div></div>
        <div style="margin-top:10px">${ls.map(l => Z.lessonRow(l)).join('')}</div>
        ${done === ls.length && ls.length ? '<p class="notice" style="border-color:var(--ok)">🎉 Усі уроки на сьогодні виконано! Можна відпочити або надолужити борги.</p>' : ''}`;
    } else {
      const nxt = Z.nextSchoolDay(t);
      let why = iso < Z.state.cal.start ? `Навчальний рік починається <b>1 вересня 2026</b>.` : iso > Z.state.cal.end ? `Семестр завершено 23 грудня. Зимові канікули до 10 січня 2027! 🎄` : hol ? `Зараз <b>${hol.name.toLowerCase()}</b> (${Z.fmt(Z.parseDate(hol.from))} – ${Z.fmt(Z.parseDate(hol.to))}). Відпочивай! 🍁` : `Сьогодні <b>вихідний</b>. 😊`;
      todayHTML = `<h1 style="margin:0">${Z.fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</h1><p>${why}</p>` + (nxt ? `<p class="muted">Наступний навчальний день — ${Z.DAYS[nxt.day].toLowerCase()}, ${Z.fmt(Z.parseDate(nxt.iso))} (тиждень ${nxt.week}):</p>${Z.lessonsOn(nxt.week, nxt.day).map(l => Z.lessonRow(l)).join('')}` : '');
    }
    const od = Z.overdue(); const cw = Z.currentWeek(); const W = Z.summary(l => l.week === cw); const A = Z.summary();
    const odHTML = od.length ? `<div class="card" style="border-left:6px solid var(--bad)"><h2 style="margin-top:0">⏰ Треба надолужити: ${od.length} ${od.length === 1 ? 'урок' : od.length < 5 ? 'уроки' : 'уроків'}</h2><p class="muted">Ці уроки були в розкладі раніше, але ще не виконані. Роби по 1–2 на день додатково.</p>${od.slice(0, 6).map(l => Z.lessonRow(l, { date: true })).join('')}${od.length > 6 ? `<p><a href="week.html?w=${od[0].week}">Показати всі в розкладі тижнів →</a></p>` : ''}</div>` : (A.done ? '<div class="card" style="border-left:6px solid var(--ok)"><b>✅ Боргів немає — усе виконано за графіком.</b></div>' : '');
    const subjHTML = Z.state.subjects.map(sub => { const S = Z.summary(l => l.subject === sub.id); return `<a class="card" href="subject.html?s=${sub.id}" style="margin:0;color:inherit;display:block"><div style="display:flex;justify-content:space-between;align-items:center"><b>${sub.icon} ${Z.esc(sub.name)}</b><small class="muted">${S.done}/${S.total}</small></div><div class="bar" style="margin:8px 0 4px"><i style="width:${S.pct}%;background:${sub.color}"></i></div><small class="muted">${S.avg != null ? 'середній бал ' + S.avg + '%' : 'ще не розпочато'}</small></a>`; }).join('');
    const bd = Z.badges(); const earned = bd.filter(b => b.earned);
    root.innerHTML = `<div class="card today-box">${todayHTML}</div>${odHTML}
      <div class="grid c2"><div class="card" style="margin:0"><h2 style="margin-top:0">📅 Тиждень ${cw}</h2><div class="hero"><div class="ring" style="--p:${W.pct}"><span>${W.pct}%</span></div><div><b>${W.done} з ${W.total}</b> уроків виконано<br><small class="muted">${W.avg != null ? 'середній результат ' + W.avg + '%' : ''}${W.hwWait ? ' · ' + W.hwWait + ' ДЗ чекають перевірки' : ''}</small></div></div><p><a class="btn sec" href="week.html?w=${cw}">Розклад тижня</a></p></div>
      <div class="card" style="margin:0"><h2 style="margin-top:0">🏁 Семестр</h2><div class="hero"><div class="ring" style="--p:${A.pct}"><span>${A.pct}%</span></div><div><b>${A.done} з ${A.total}</b> уроків<br><small class="muted">зірок: ${A.stars} · час: ${Z.fmtTime(A.time)} · серія: ${Z.streak()} дн.</small></div></div><p><a class="btn sec" href="achievements.html">Нагороди: ${earned.length}/${bd.length}</a></p></div></div>
      <h2>Предмети</h2><div class="grid c3">${subjHTML}</div>
      ${earned.length ? `<h2>Останні нагороди</h2><div class="grid c4">${earned.slice(-4).map(b => `<div class="badge earned"><span class="ic">${b.icon}</span><div><b>${b.name}</b><br><small class="muted">${b.desc}</small></div></div>`).join('')}</div>` : ''}`;
  }
  render();
})();
