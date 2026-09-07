(async function () {
  const root = document.getElementById('app');
  try { await Z.init(); } catch (e) { root.innerHTML = '<div class="card">Помилка</div>'; return; }
  document.getElementById('hdr').innerHTML = Z.header('ach'); document.getElementById('ftr').innerHTML = Z.footer();
  const bd = Z.badges(); const earned = bd.filter(b => b.earned).length; const x = Z.xp(); const A = Z.summary();
  root.innerHTML = `<div class="card"><h1>🏆 Нагороди</h1><div class="hero"><div class="ring" style="--p:${Math.round(100 * earned / bd.length)}"><span>${earned}/${bd.length}</span></div><div><b>⚡ ${x} XP · рівень ${Z.level(x)}</b> <small class="muted">(до наступного рівня ${100 - x % 100} XP)</small><br><small class="muted">За практику: 10 XP + бал/10 (+5 за три зірки). За домашнє: 10 XP (+5, коли батьки перевірять).</small><br><small class="muted">Зірок зібрано: ${A.stars} · уроків виконано: ${A.done} · серія: ${Z.streak()} днів</small></div></div></div>
  <div class="grid c3">${bd.map(b => `<div class="badge ${b.earned ? 'earned' : ''}"><span class="ic">${b.icon}</span><div><b>${b.name}</b><br><small class="muted">${b.desc}</small></div></div>`).join('')}</div>`;
})();
