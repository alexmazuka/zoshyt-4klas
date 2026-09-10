/* Сторінка уроку: теорія → практика → домашнє завдання → підсумок */
(async function () {
  const root = document.getElementById('app');
  try { await Z.init(); } catch (e) { root.innerHTML = '<div class="card">Не вдалося завантажити дані: ' + Z.esc(e.message) + '</div>'; return; }
  document.getElementById('hdr').innerHTML = Z.header('');
  const id = Z.qs('id'); const meta = Z.state.byId[id];
  if (!meta) { root.innerHTML = '<div class="card"><h1>Урок не знайдено</h1><a href="index.html">На головну</a></div>'; return; }
  let L;
  try { L = await Z.loadJSON(meta.file); } catch (e) {
    root.innerHTML = `<div class="card"><h1>${Z.esc(meta.title)}</h1><p>${Z.subjTag(meta.subject)} Тиждень ${meta.week}, ${Z.DAYS[meta.day]}</p><div class="notice">Матеріали цього уроку ще готуються. Поки що можна виконати інші уроки цього дня.</div><a class="btn sec" href="week.html?w=${meta.week}">До тижня ${meta.week}</a></div>`; return;
  }
  const S = Z.state.subjMap[meta.subject];
  document.title = L.title + ' — ' + S.name;
  if (window.AiHelp) window.AiHelp.mount();
  const rec = Z.progress.ensure(id); Z.progress.save();
  const seed = Z.hash(id);
  const wasNew = !rec.theory && !rec.practice.done;
  if (wasNew) Z.progress.log({ type: 'open', id });

  /* таймер часу на уроці */
  let tick = 0; setInterval(() => { if (document.visibilityState === 'visible') { rec.time = (rec.time || 0) + 1; if (++tick % 15 === 0) Z.progress.set(id, rec); } }, 1000);
  document.addEventListener('visibilitychange', () => Z.progress.set(id, rec)); window.addEventListener('beforeunload', () => Z.progress.set(id, rec));

  /* навігація: попередній/наступний урок за розкладом */
  const ordered = Z.state.plan; const pos = ordered.findIndex(l => l.id === id); const next = ordered[pos + 1], prev = ordered[pos - 1];

  const STEPS = [['theory', '1. Теорія'], ['practice', '2. Практика'], ['homework', '3. Домашнє завдання'], ['summary', '4. Підсумок']];
  let step = !rec.theory ? 'theory' : !rec.practice.done ? 'practice' : !rec.homework.submitted ? 'homework' : 'summary';
  if (Z.qs('step')) step = Z.qs('step');

  function stepState(s) { if (s === 'theory') return rec.theory ? 'done' : ''; if (s === 'practice') return rec.practice.done ? 'done' : ''; if (s === 'homework') return rec.homework.submitted ? 'done' : ''; return ''; }
  function head() {
    const d = Z.dateOf(meta.week, meta.day);
    return `<div class="card"><div class="lesson-head"><div style="flex:1;min-width:240px">${Z.subjTag(meta.subject)} <span class="chip">Тиждень ${meta.week} · ${Z.DAYS[meta.day]}, ${Z.fmt(d)}</span> <span class="chip">⏱ ~${L.minutes} хв</span> <span class="chip" title="Урок № за предметом">Урок ${meta.n} з ${Z.state.bySubject[meta.subject].length}</span>
      <h1>${Z.esc(L.title)}</h1><small class="muted">${Z.esc(meta.section)}</small><div class="goal">🎯 ${Z.md(L.goal)}</div></div></div>
      <div class="steps">${STEPS.map(([k, n]) => `<button data-step="${k}" class="${step === k ? 'on' : ''} ${stepState(k)}">${stepState(k) === 'done' ? '✓ ' : ''}${n}</button>`).join('')}</div></div>`;
  }

  /* ---------- теорія ---------- */
  function theoryBlock(b) {
    const ttl = b.title ? `<b class="ttl">${Z.md(b.title)}</b>` : '';
    switch (b.type) {
      case 'p': return `<p class="blk">${Z.md(b.text)}</p>`;
      case 'rule': return `<div class="blk rule">${ttl || '<b class="ttl">Запам\'ятай</b>'}${Z.md(b.text)}</div>`;
      case 'example': return `<div class="blk example">${ttl || '<b class="ttl">Приклад</b>'}<div class="${/\n/.test(b.text) && /[\d+\-·:=|_]{3,}/.test(b.text) && meta.subject === 'math' ? 'mono' : ''}">${Z.md(b.text)}</div></div>`;
      case 'tip': return `<div class="blk tip"><b class="ttl">💡 Підказка</b>${Z.md(b.text)}</div>`;
      case 'list': return `<div class="blk">${ttl}<ul>${b.items.map(i => `<li>${Z.md(i)}</li>`).join('')}</ul></div>`;
      case 'steps': return `<div class="blk">${ttl}<ol>${b.items.map(i => `<li>${Z.md(i)}</li>`).join('')}</ol></div>`;
      case 'table': return `<div class="blk table-wrap">${ttl}<table><thead><tr>${b.head.map(h => `<th>${Z.md(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${Z.md(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'reading': { const lang = /[a-z]{3}/i.test(b.text) && !/[а-яіїєґ]/i.test(b.text) ? 'en' : 'uk'; return `<div class="blk reading"><h3>${Z.esc(b.title)} ${EX.speakBtn(b.text.replace(/\n+/g, ' '), lang)}</h3>${b.author ? `<span class="author">${Z.esc(b.author)}${b.genre ? ' · ' + Z.esc(b.genre) : ''}</span>` : (b.genre ? `<span class="author">${Z.esc(b.genre)}</span>` : '')}${b.text.split(/\n\n+/).map(p => `<p>${Z.md(p)}</p>`).join('')}</div>`; }
      case 'vocab': return `<div class="blk">${ttl || '<b class="ttl">📒 Словник</b>'}<div class="vocab">${b.items.map(i => `<div>${EX.speakBtn(i.en, 'en')}<b>${Z.esc(i.en)}</b> — ${Z.esc(i.uk)}${i.ex ? `<small class="muted" style="flex-basis:100%">${Z.esc(i.ex)}</small>` : ''}</div>`).join('')}</div></div>`;
      case 'dialogue': { const lang = b.lang || 'en'; return `<div class="blk dialogue">${ttl}${EX.speakBtn(b.lines.map(l => l.text).join(' '), lang)}${b.lines.map(l => `<p><span class="who">${Z.esc(l.who)}:</span> ${Z.md(l.text)}</p>`).join('')}</div>`; }
      case 'image': return `<div class="blk image">${Z.esc(b.emoji)}<small>${Z.md(b.caption)}</small></div>`;
      default: return '';
    }
  }
  function theoryView() {
    return `<div class="card theory"><h2 style="margin-top:0">📖 Теорія</h2>${L.theory.map(theoryBlock).join('')}
      <p style="margin-top:20px"><button class="btn" id="theoryDone">${rec.theory ? 'До вправ ▶' : 'Я прочитав — до вправ ▶'}</button></p></div>`;
  }

  /* ---------- вправи (практика і домашнє) ---------- */
  function exSet(kind) { return kind === 'practice' ? L.exercises : L.homework; }
  function bucket(kind) { return kind === 'practice' ? rec.practice : rec.homework; }
  function locked(kind) { return kind === 'practice' ? !!rec.practice.done : !!rec.homework.submitted; }

  function exercisesView(kind) {
    const list = exSet(kind), B = bucket(kind), ro = locked(kind);
    const intro = kind === 'practice'
      ? `<h2 style="margin-top:0">✏️ Практика</h2><p class="muted">Виконай усі вправи і натисни «Перевірити» під кожною. Є дві спроби: після першої помилки з'явиться підказка.</p>`
      : `<h2 style="margin-top:0">🏠 Домашнє завдання</h2><p class="muted">Виконай завдання самостійно. Письмові роботи перевірять батьки — пиши повними реченнями.</p>`;
    let review = '';
    if (kind === 'homework' && rec.homework.review) { const rv = rec.homework.review; review = `<div class="notice" style="border-color:${rv.status === 'ok' ? 'var(--ok)' : 'var(--warn)'}"><b>${rv.status === 'ok' ? '✅ Батьки перевірили домашнє завдання.' : '↩️ Батьки повернули завдання на доопрацювання.'}</b>${rv.comment ? `<br>Коментар: ${Z.esc(rv.comment)}` : ''}<br><small class="muted">${Z.fmtDT(rv.at)}</small></div>`; }
    const cards = list.map((ex, i) => EX.render(ex, i, B.answers[i], seed + i * 7, ro)).join('');
    let foot = '';
    if (kind === 'practice') {
      if (rec.practice.done) foot = resultBanner();
      else foot = `<p style="margin-top:18px"><button class="btn ok" id="finish" disabled>Завершити практику</button> <small class="muted" id="finishHint">Спочатку перевір усі вправи.</small></p>`;
    } else {
      if (rec.homework.submitted) foot = `<div class="result-banner"><div class="big">📬</div><b>Домашнє завдання здано ${Z.fmtDT(rec.homework.submitted)}</b>${rec.homework.score != null ? `<p>Завдання з автоперевіркою: <b>${rec.homework.score}%</b> ${Z.starsHTML(rec.homework.score)}</p>` : ''}<p class="muted">${Z.hwStatus(rec) === 'ok' ? 'Батьки вже перевірили. Молодець!' : 'Батьки побачать твої відповіді у своєму кабінеті.'}</p><p><button class="btn" data-go="summary">До підсумку ▶</button></p></div>`;
      else foot = `<p style="margin-top:18px"><button class="btn ok" id="submitHW" disabled>Здати домашнє завдання</button> <small class="muted" id="finishHint">Спочатку перевір усі завдання.</small></p>`;
    }
    return `<div class="card" id="exwrap" data-kind="${kind}">${intro}${review}${cards}${foot}</div>`;
  }
  function resultBanner() {
    const sc = rec.practice.score, best = rec.practice.best; const st = Z.starsOf(sc);
    const msg = sc >= 90 ? 'Чудово! Ти впорався блискуче.' : sc >= Z.PASS ? 'Добре! Тему засвоєно.' : sc >= 50 ? 'Непогано, але варто повторити теорію і спробувати ще раз.' : 'Ця тема поки складна. Перечитай теорію і виконай практику знову.';
    return `<div class="result-banner"><div class="big">${['😕', '🙂', '😃', '🤩'][st]}</div><h2 style="margin:4px 0">Результат: ${sc}% ${Z.starsHTML(sc)}</h2><p>${msg}${rec.practice.attempts > 1 ? ` <small class="muted">Спроба ${rec.practice.attempts}, найкращий результат ${best}%.</small>` : ''}</p>
      <p><button class="btn ghost" id="retry">↻ Повторити практику</button> <button class="btn" data-go="homework">Далі: домашнє завдання ▶</button></p></div>`;
  }
  function afterRender(kind) {
    const wrap = document.getElementById('exwrap'); if (!wrap) return;
    const list = exSet(kind), B = bucket(kind), ro = locked(kind);
    list.forEach((ex, i) => {
      const el = wrap.querySelector(`.ex[data-idx="${i}"]`); const R = B.results[i];
      if (R && R.final) { showFinal(ex, el, R, kind); }
      else if (!ro) { const manual = EX.isManual(ex.type); el.querySelector('.check').innerHTML = `<button class="btn sm" data-check="${i}">${manual ? 'Готово ✓' : 'Перевірити'}</button>${R && R.tries ? '<span class="chip warn">друга спроба</span>' : ''}`; }
      // зберігати відповіді під час введення
      el.addEventListener('change', () => { if (locked(kind)) return; B.answers[i] = EX.collect(ex, el); Z.progress.set(id, rec); });
      el.addEventListener('input', () => { if (locked(kind)) return; B.answers[i] = EX.collect(ex, el); if (++tick % 5 === 0) Z.progress.set(id, rec); });
    });
    wrap.querySelectorAll('button[data-check]').forEach(b => b.onclick = () => check(kind, Number(b.dataset.check)));
    updateFinish(kind);
    const fin = document.getElementById('finish'); if (fin) fin.onclick = () => finishPractice();
    const sub = document.getElementById('submitHW'); if (sub) sub.onclick = () => submitHomework();
    const rt = document.getElementById('retry'); if (rt) rt.onclick = () => { if (confirm('Почати практику знову? Попередні відповіді очистяться, найкращий результат збережеться.')) { rec.practice.answers = {}; rec.practice.results = {}; rec.practice.done = null; rec.practice.score = null; Z.progress.set(id, rec); Z.progress.log({ type: 'retry', id }); go('practice'); } };
  }
  function showFinal(ex, el, R, kind) {
    el.classList.add('final', R.score === 1 ? 'good' : R.score > 0 ? 'part' : 'bad'); EX.setReadonly(el, true); el.querySelector('.check').innerHTML = '';
    if (EX.isManual(ex.type)) { EX.feedback(el, 'info', ex.type === 'text' ? `📨 Відповідь збережено — її перевірять батьки.${ex.sample ? `<span class="ans">Зразок відповіді: <i>${Z.md(ex.sample)}</i></span>` : ''}` : '✅ Виконано'); return; }
    const lastCorrect = R.res && R.res.score === 1;
    EX.mark(ex, el, R.res || EX.grade(ex, bucket(kind).answers[el.dataset.idx]), !lastCorrect && R.score < 1);
    const pts = Math.round(R.score * 100);
    let html = R.score === 1 ? '✅ Правильно!' : lastCorrect ? `✅ Правильно — з другої спроби (зараховано ${pts}%).` : R.score > 0 ? `🟡 Частково правильно (${pts}%).` : '❌ Неправильно.';
    if (!lastCorrect && R.score < 1) html += `<span class="ans">Правильна відповідь: ${Z.md(EX.answerText(ex))}</span>`;
    if (ex.explain) html += `<div class="explain">${Z.md(ex.explain)}</div>`;
    EX.feedback(el, R.score === 1 ? 'good' : R.score > 0 ? 'part' : 'bad', html);
  }
  function check(kind, i) {
    const ex = exSet(kind)[i], B = bucket(kind); const wrap = document.getElementById('exwrap'); const el = wrap.querySelector(`.ex[data-idx="${i}"]`);
    const ans = EX.collect(ex, el); B.answers[i] = ans; const res = EX.grade(ex, ans);
    if (!res.complete) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); EX.feedback(el, 'info', ex.type === 'text' ? `Напиши трохи більше: ${res.have} з ${res.need} символів.` : ex.type === 'checklist' ? 'Відміть усі пункти, коли виконаєш.' : ex.type === 'speak' ? 'Прочитай уголос і постав позначку.' : 'Спочатку дай відповідь на всі частини завдання.'); return; }
    const R = B.results[i] || { tries: 0, first: null, score: 0, final: false }; R.tries++;
    if (R.tries === 1) R.first = res.score;
    if (res.manual) { R.score = 1; R.final = true; }
    else if (res.score === 1) { R.score = R.tries === 1 ? 1 : Math.max(R.first, 0.75); R.final = true; }
    else if (R.tries >= 2) { R.score = Math.max(R.first || 0, Math.max(0, res.score - 0.25)); R.final = true; }
    else { // перша невдала спроба
      EX.mark(ex, el, res, false);
      EX.feedback(el, 'part', `🤔 Не зовсім. Спробуй ще раз — залишилась одна спроба.${ex.hint ? `<span class="ans">Підказка: ${Z.md(ex.hint)}</span>` : ''}`);
      el.querySelector('.check').innerHTML = `<button class="btn sm" data-check="${i}">Перевірити ще раз</button><span class="chip warn">друга спроба</span>`; el.querySelector('button[data-check]').onclick = () => check(kind, i);
      B.results[i] = R; Z.progress.set(id, rec); return;
    }
    R.res = { score: res.score, detail: res.detail }; B.results[i] = R; Z.progress.set(id, rec); showFinal(ex, el, R, kind); updateFinish(kind);
  }
  function updateFinish(kind) {
    const list = exSet(kind), B = bucket(kind); const allFinal = list.every((_, i) => B.results[i] && B.results[i].final);
    const btn = document.getElementById(kind === 'practice' ? 'finish' : 'submitHW'); const hint = document.getElementById('finishHint');
    if (btn) { btn.disabled = !allFinal; if (hint) hint.textContent = allFinal ? '' : `Перевірено ${list.filter((_, i) => B.results[i] && B.results[i].final).length} з ${list.length}.`; }
  }
  function scoreOf(kind) { const list = exSet(kind), B = bucket(kind); const auto = list.map((ex, i) => [ex, B.results[i]]).filter(([ex]) => EX.isAuto(ex.type)); if (!auto.length) return 100; return Math.round(100 * auto.reduce((s, [, R]) => s + (R ? R.score : 0), 0) / auto.length); }
  function finishPractice() {
    const sc = scoreOf('practice'); rec.practice.score = sc; rec.practice.done = Date.now(); rec.practice.attempts = (rec.practice.attempts || 0) + 1; rec.practice.best = Math.max(rec.practice.best ?? 0, sc);
    Z.progress.set(id, rec); Z.progress.log({ type: 'practice', id, score: sc, attempt: rec.practice.attempts, time: rec.time }); celebrate(sc); go('practice');
  }
  function submitHomework() {
    const list = L.homework, B = rec.homework; const hasAuto = list.some(ex => EX.isAuto(ex.type));
    rec.homework.score = hasAuto ? scoreOf('homework') : null; rec.homework.submitted = Date.now(); if (rec.homework.review && rec.homework.review.status === 'redo') rec.homework.review = null;
    const texts = list.map((ex, i) => ex.type === 'text' ? { q: ex.q, a: B.answers[i] } : null).filter(Boolean);
    Z.progress.set(id, rec); Z.progress.log({ type: 'homework', id, score: rec.homework.score, texts, time: rec.time }); Z.toast('Домашнє завдання здано! 📬', 'ok'); go('summary');
  }
  function celebrate(sc) { if (sc < Z.PASS) return; const n = sc >= 90 ? 60 : 30; for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.textContent = ['🎉', '⭐', '✨', '🎊'][i % 4]; s.style.cssText = `position:fixed;left:${Math.random() * 100}vw;top:-30px;font-size:${16 + Math.random() * 18}px;z-index:99;pointer-events:none;transition:transform ${1.6 + Math.random()}s ease-in,opacity 2s`; document.body.appendChild(s); requestAnimationFrame(() => { s.style.transform = `translateY(${window.innerHeight + 60}px) rotate(${Math.random() * 360}deg)`; s.style.opacity = '0'; }); setTimeout(() => s.remove(), 2600); } }

  /* ---------- підсумок ---------- */
  function summaryView() {
    const st = Z.statusOf(id); const sc = rec.practice.best;
    let refl = '';
    if (L.reflection && L.reflection.length) refl = `<h3>🪞 Подумай</h3>${L.reflection.map((q, i) => `<div class="field"><label>${Z.md(q)}</label><textarea data-refl="${i}" style="min-height:60px">${Z.esc((rec.reflection || {})[i] || '')}</textarea></div>`).join('')}`;
    return `<div class="card"><h2 style="margin-top:0">🏁 Підсумок уроку</h2>
      <div class="grid c3"><div class="card" style="margin:0"><small class="muted">Практика</small><div class="big" style="font-size:1.6rem;font-weight:800">${sc != null ? sc + '%' : '—'}</div>${Z.starsHTML(sc)}${rec.practice.attempts > 1 ? `<small class="muted">спроб: ${rec.practice.attempts}</small>` : ''}</div>
      <div class="card" style="margin:0"><small class="muted">Домашнє завдання</small><div style="font-weight:800;font-size:1.1rem">${Z.hwStatusName(Z.hwStatus(rec))}</div>${rec.homework.score != null ? `<small>автоперевірка: ${rec.homework.score}%</small>` : ''}</div>
      <div class="card" style="margin:0"><small class="muted">Час на уроці</small><div style="font-weight:800;font-size:1.1rem">${Z.fmtTime(rec.time)}</div><small class="muted">рекомендовано ~${L.minutes} хв</small></div></div>
      ${st === 'done' ? '<p class="notice" style="border-color:var(--ok)">✅ Урок виконано повністю. Так тримати!</p>' : '<p class="notice">Щоб урок зарахувався, потрібно завершити практику і здати домашнє завдання.</p>'}
      ${refl}
      <p style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">${prev ? `<a class="btn ghost" href="${Z.lessonURL(prev.id)}">◀ ${Z.esc(Z.state.subjMap[prev.subject].short)}</a>` : ''}<a class="btn sec" href="week.html?w=${meta.week}">До розкладу тижня</a>${next ? `<a class="btn" href="${Z.lessonURL(next.id)}">Наступний урок: ${Z.esc(Z.state.subjMap[next.subject].short)} ▶</a>` : '<a class="btn" href="index.html">На головну</a>'}</p></div>`;
  }

  /* ---------- контекст для ШІ-помічника «Поясняйко» (js/ai-help.js) ---------- */
  function theoryPlain() {
    return (L.theory || []).map(b => {
      switch (b.type) {
        case 'p': case 'rule': case 'tip': case 'example': return (b.title ? b.title + ': ' : '') + b.text;
        case 'list': case 'steps': return (b.title ? b.title + ': ' : '') + (b.items || []).join('; ');
        case 'table': return (b.title ? b.title + ': ' : '') + (b.head || []).join(' | ') + '\n' + (b.rows || []).map(r => r.join(' | ')).join('\n');
        case 'reading': return (b.title || '') + '\n' + b.text;
        case 'vocab': return (b.items || []).map(i => `${i.en} — ${i.uk}`).join('; ');
        case 'dialogue': return (b.lines || []).map(l => `${l.who}: ${l.text}`).join('\n');
        case 'image': return b.caption || '';
        default: return '';
      }
    }).filter(Boolean).join('\n').slice(0, 4000);
  }
  function exQuestions(list) { return (list || []).map(ex => ex.q || (ex.type === 'truefalse' ? (ex.items || []).map(it => it.text).join('; ') : '')).filter(Boolean); }
  function aiContext() {
    return {
      subject: S.name, title: L.title, step,
      theory: (step === 'theory' || step === 'summary') ? theoryPlain() : '',
      questions: step === 'practice' ? exQuestions(L.exercises) : step === 'homework' ? exQuestions(L.homework) : [],
    };
  }

  /* ---------- маршрутизація кроків ---------- */
  function go(s) { step = s; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function render() {
    let body = step === 'theory' ? theoryView() : step === 'practice' ? exercisesView('practice') : step === 'homework' ? exercisesView('homework') : summaryView();
    root.innerHTML = head() + body;
    if (window.AiHelp) window.AiHelp.setContext(aiContext());
    root.querySelectorAll('button[data-step]').forEach(b => b.onclick = () => go(b.dataset.step));
    root.querySelectorAll('button[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    const td = document.getElementById('theoryDone'); if (td) td.onclick = () => { if (!rec.theory) { rec.theory = Date.now(); Z.progress.set(id, rec); } go('practice'); };
    if (step === 'practice' || step === 'homework') afterRender(step);
    root.querySelectorAll('textarea[data-refl]').forEach(t => t.addEventListener('input', () => { rec.reflection ||= {}; rec.reflection[t.dataset.refl] = t.value; Z.progress.set(id, rec); }));
  }
  render();
})();
