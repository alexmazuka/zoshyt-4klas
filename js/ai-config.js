/* Налаштування ШІ-помічника «Поясняйко» (js/ai-help.js).
   Ключі навмисно лежать у відкритому клієнтському коді (як і Firebase apiKey у firebase-init.js) —
   інакше без сервера-проксі не обійтись, а цей зошит принципово без бекенда. Захист — не секретність
   ключів, а обмеження можливої шкоди:
     - openrouter.apiKey: ліміт витрат $1/місяць виставлено в кабінеті OpenRouter (Settings → API Keys →
       ключ "German_poznayko" → Credit limit). Модель "openrouter/free" — безкоштовний роутер, який сам
       обирає серед поточних безкоштовних моделей (список час від часу змінюється в OpenRouter).
     - gemini.apiKey: резервний варіант, якщо OpenRouter недоступний. Безкоштовний рівень Gemini API —
       без прив'язки способу оплати, тобто витратити реальні гроші через цей ключ неможливо навіть
       у гіршому разі. HTTP-referrer обмеження для нього Google, на жаль, не пропонує — такий тип
       ключа (прив'язаний до service account) цю опцію не підтримує.
   Деталі — sync/ai-help.md. */
window.Z4_AI = {
  openrouter: {
    apiKey: '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',
    model: 'openrouter/free',
  },
  gemini: {
    apiKey: 'AQ.Ab8RN6IGb14VPykyS1Ebd9rVMwQkvSO7UyivKmIsFfCYhYj4FQ',
    model: 'gemini-3.1-flash-lite',
  },
};
