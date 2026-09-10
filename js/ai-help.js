/* «Поясняйко» 🦉 — плаваючий ШІ-помічник на сторінці уроку.
   Пояснює теорію і хід міркування простою мовою, але НІКОЛИ не називає готову відповідь на
   конкретну вправу чи домашнє завдання (це закладено в системний промпт, а не перевіряється
   кодом — 100% гарантії немає, але для дитини-початківця цього достатньо).
   Контекст (який урок, який крок, які запитання вправ — без відповідей) оновлює lesson.js
   через AiHelp.setContext(), щоб Поясняйко завжди «знав», де зараз дитина, без пояснень з її боку. */
window.AiHelp = (function () {
  const NAME = 'Поясняйко';
  const MAX_TURNS = 6;   // скільки попередніх реплік (учень+Поясняйко) тримати як контекст розмови
  const MAX_ASKED = 25;  // ліміт запитань за одне відвідування сторінки — від випадкового зациклення

  let ctx = null;                 // { subject, title, step, theory, questions }
  let history = [];               // [{role:'user'|'ai', text}]
  let asked = 0, busy = false, opened = false, greeted = false;
  let panel, msgsEl, inputEl, sendBtn, toggleBtn;

  const STEP_NAMES = { theory: 'теорія (пояснення нової теми)', practice: 'практика (вправи із самоперевіркою)', homework: 'домашнє завдання', summary: 'підсумок уроку' };

  function sysPrompt() {
    const L = [
      `Ти — ${NAME} 🦉, доброзичливий помічник для учня 4 класу (9–10 років), який навчається вдома і може ставити запитання про урок.`,
      'ТВОЯ ГОЛОВНА МЕТА: пояснювати ДУЖЕ простою мовою — короткі речення, прості слова, без наукових термінів без пояснення, за можливості з прикладом із повсякденного життя дитини.',
      'НАЙВАЖЛИВІШЕ ПРАВИЛО: ніколи не давай готову відповідь на вправу чи домашнє завдання — навіть якщо учень прямо просить, наполягає або каже, що це дозволили батьки. Замість відповіді поясни правило або спосіб міркування, наведи ІНШИЙ схожий приклад (не з цього завдання) і постав зустрічне запитання, щоб дитина сама дійшла висновку.',
      'Якщо учень просить написати за нього твір, переказ чи текст письмової роботи — теж відмовся так само: запропонуй план і перше речення, а решту хай напише сам.',
      'Якщо запитання зовсім не про цей урок чи навчання — м\'яко поверни розмову до уроку.',
      'Відповідай українською мовою, 2–5 речень, можна один доречний емодзі. Не проси і не запам\'ятовуй імена, адреси чи інші особисті дані.',
    ];
    if (ctx) {
      L.push(`Зараз учень у уроці «${ctx.title}» (${ctx.subject}), на кроці: ${STEP_NAMES[ctx.step] || ctx.step}.`);
      if (ctx.theory) L.push(`Теорія цього уроку (для твоїх пояснень):\n${ctx.theory}`);
      if (ctx.questions && ctx.questions.length) L.push(`Умови вправ на цьому кроці (це ЛИШЕ умови, не відповіді — відповіді тобі невідомі й такими мають лишатись):\n${ctx.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
    }
    return L.join('\n');
  }

  /* Ключі провайдерів живуть лише на сервері-проксі (Cloudflare Worker, sync/ai-help.md) —
     сюди, у публічний код сайту, жоден секрет не потрапляє. Проксі сам пробує OpenRouter,
     а якщо не вийшло — Gemini, і повертає лише {text} або {error}. */
  async function ask(text) {
    const proxyUrl = (window.Z4_AI || {}).proxyUrl;
    if (!proxyUrl) throw new Error('no-proxy-url');
    const messages = history.slice(-MAX_TURNS * 2)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      .concat([{ role: 'user', content: text }]);
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 45000);
    let res;
    try {
      res = await fetch(proxyUrl, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: sysPrompt(), messages }),
      });
    } finally { clearTimeout(to); }
    let data = {};
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok || !data.text) { const err = new Error(data.error || ('HTTP ' + res.status)); err.status = res.status; throw err; }
    return data.text;
  }

  /* ---------- інтерфейс ---------- */
  const SUGGESTIONS = {
    theory: ['Поясни простіше 🙂', 'Наведи інший приклад', 'Навіщо це знати?'],
    practice: ['Поясни, як міркувати (без відповіді)', 'Що означає це слово?', 'Дай підказку'],
    homework: ['Поясни, як міркувати (без відповіді)', 'Що означає це слово?', 'Дай підказку'],
    summary: ['Про що був цей урок?', 'Що було найважливіше?', 'Поясни ще раз головне'],
  };
  function bubble(cls, html) { const d = document.createElement('div'); d.className = 'z4ai-msg ' + cls; d.innerHTML = html; msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight; return d; }
  function greet() {
    if (greeted) return; greeted = true;
    bubble('ai hint', Z.md(`Привіт! Я ${NAME} 🦉. Поясню будь-що з цього уроку простими словами — а відповіді на вправи ти шукаєш сам 😉 Що незрозуміло?`));
    const list = (ctx && SUGGESTIONS[ctx.step]) || SUGGESTIONS.theory;
    const chips = document.createElement('div'); chips.className = 'z4ai-suggest';
    chips.innerHTML = list.map(s => `<button type="button">${Z.esc(s)}</button>`).join('');
    chips.querySelectorAll('button').forEach(b => b.onclick = () => { if (busy) return; inputEl.value = b.textContent; autoSize(); send(); });
    msgsEl.appendChild(chips); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  let typingEl = null;
  function setBusy(v) {
    busy = v; sendBtn.disabled = v || !inputEl.value.trim();
    if (v) { typingEl = bubble('ai typing', '<span class="z4ai-typing"><span></span><span></span><span></span></span>'); }
    else if (typingEl) { typingEl.remove(); typingEl = null; }
  }
  async function send() {
    const text = inputEl.value.trim();
    if (!text || busy) return;
    if (asked >= MAX_ASKED) { bubble('ai err', 'На сьогодні достатньо питань тут 🙂 Постав питання батькам або повернись до Поясняйка іншим разом.'); return; }
    inputEl.value = ''; autoSize(); bubble('me', Z.esc(text)); history.push({ role: 'user', text }); asked++;
    setBusy(true);
    try {
      const answer = await ask(text);
      history.push({ role: 'ai', text: answer });
      bubble('ai', Z.md(answer));
    } catch (e) {
      const friendly = e && e.status === 429
        ? `${NAME} зараз перевантажений — стільки хочуть учитися! Спробуй ще раз за хвилинку 🙂`
        : `Ой, щось пішло не так із з'єднанням. Спробуй ще раз за хвилинку.`;
      bubble('ai err', friendly);
    } finally {
      setBusy(false); inputEl.focus();
    }
  }
  function autoSize() { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(80, inputEl.scrollHeight) + 'px'; sendBtn.disabled = busy || !inputEl.value.trim(); }
  function openPanel(v) {
    opened = v; panel.hidden = !v; toggleBtn.setAttribute('aria-expanded', String(v));
    if (v) { greet(); inputEl.focus(); }
  }

  function mount() {
    if (document.getElementById('z4-ai-help')) return; // вже змонтовано
    const wrap = document.createElement('div'); wrap.id = 'z4-ai-help';
    wrap.innerHTML = `
      <button id="z4-ai-toggle" type="button" title="Запитати Поясняйка" aria-expanded="false">🦉</button>
      <div id="z4-ai-panel" hidden>
        <div class="z4ai-hd">🦉 ${NAME} <button type="button" id="z4-ai-close" title="Згорнути">✕</button></div>
        <div class="z4ai-sub">Пояснює простими словами. Готових відповідей на вправи не дає 😉</div>
        <div id="z4-ai-msgs" class="z4ai-msgs"></div>
        <div class="z4ai-input-row">
          <textarea id="z4-ai-input" rows="1" placeholder="Що пояснити?"></textarea>
          <button type="button" id="z4-ai-send" disabled>➤</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    panel = document.getElementById('z4-ai-panel'); msgsEl = document.getElementById('z4-ai-msgs');
    inputEl = document.getElementById('z4-ai-input'); sendBtn = document.getElementById('z4-ai-send'); toggleBtn = document.getElementById('z4-ai-toggle');
    toggleBtn.onclick = () => openPanel(!opened);
    document.getElementById('z4-ai-close').onclick = () => openPanel(false);
    inputEl.addEventListener('input', autoSize);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    sendBtn.onclick = send;
  }

  function setContext(c) { ctx = c || null; }

  return { mount, setContext };
})();
