/* Предмети: перелік і всі уроки предмета */
(async function () {
  const root = document.getElementById('app');
  try { await Z.init(); } catch (e) { root.innerHTML = '<div class="card">Помилка: ' + Z.esc(e.message) + '</div>'; return; }
  document.getElementById('hdr').innerHTML = Z.header('subject'); document.getElementById('ftr').innerHTML = Z.footer();
  const sid = Z.qs('s');
  if (!sid || !Z.state.subjMap[sid]) {
    root.innerHTML = `<div class="card"><h1>Предмети</h1><p class="muted">${Z.esc(Z.state.program)}. Навантаження — 25 годин на тиждень.</p></div><div class="grid c2">${Z.state.subjects.map(sub => { const S = Z.summary(l => l.subject === sub.id); return `<a class="card" href="subject.html?s=${sub.id}" style="margin:0;color:inherit;display:block"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:1.1rem">${sub.icon} ${Z.esc(sub.name)}</b><span class="chip">${sub.hours} год/тиж</span></div><div class="bar" style="margin:10px 0 6px"><i style="width:${S.pct}%;background:${sub.color}"></i></div><small class="muted">${S.done} з ${S.total} уроків${S.avg != null ? ' · середній бал ' + S.avg + '%' : ''} · ${Z.esc(sub.textbook)}</small></a>`; }).join('')}</div>`;
    return;
  }
  const sub = Z.state.subjMap[sid]; const ls = Z.state.bySubject[sid]; const S = Z.summary(l => l.subject === sid);
  const sections = []; ls.forEach(l => { let s = sections[sections.length - 1]; if (!s || s.name !== l.section) { s = { name: l.section, items: [] }; sections.push(s); } s.items.push(l); });
  document.title = sub.name + ' — Робочий зошит';
  root.innerHTML = `<div class="card"><div class="hero"><div class="ring" style="--p:${S.pct};background:conic-gradient(${sub.color} calc(var(--p)*1%),#e5e7eb 0)"><span>${S.pct}%</span></div><div><h1 style="margin:0">${sub.icon} ${Z.esc(sub.name)}</h1><small class="muted">${sub.hours} год/тиждень · ${ls.length} уроків у семестрі · виконано ${S.done}${S.avg != null ? ' · середній бал ' + S.avg + '%' : ''} · ${Z.esc(sub.textbook)}</small></div></div></div>
    ${sections.map(sec => { const d = sec.items.filter(l => Z.statusOf(l.id) === 'done').length; return `<div class="card"><h2 style="margin-top:0">${Z.esc(sec.name)} <small class="muted">${d}/${sec.items.length}</small></h2>${sec.items.map(l => Z.lessonRow(l, { date: true })).join('')}</div>`; }).join('')}`;
})();
