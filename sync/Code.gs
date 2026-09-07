/**
 * Робочий зошит 4 клас — синхронізація прогресу в Google Таблицю.
 * Як підключити — див. sync/README.md
 *
 * Аркуші, які створює скрипт:
 *  - «Журнал»  — кожна подія окремим рядком (час, дитина, подія, предмет, тиждень, урок, бал, письмові відповіді)
 *  - «Прогрес» — зведення по уроках (останній стан кожного уроку)
 *  - «Знімок»  — повний JSON прогресу (для відновлення на іншому пристрої)
 */
var TZ = 'Europe/Kyiv';

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (body.type === 'events') {
    var log = sheet(ss, 'Журнал', ['Час', 'Дитина', 'Подія', 'Предмет', 'Тиждень', 'Урок (id)', 'Назва уроку', 'Бал, %', 'Спроба / статус', 'Письмові відповіді', 'Коментар']);
    var prog = sheet(ss, 'Прогрес', ['Урок (id)', 'Предмет', 'Тиждень', 'Назва уроку', 'Практика, %', 'Спроб', 'Домашнє', 'Автоперевірка ДЗ, %', 'Перевірка батьків', 'Останнє оновлення']);
    var rows = [];
    (body.events || []).forEach(function (ev) {
      var when = ev.t ? Utilities.formatDate(new Date(ev.t), TZ, 'dd.MM.yyyy HH:mm') : '';
      var texts = (ev.texts || []).map(function (t) { return '• ' + t.q + '\n  → ' + (t.a || '—'); }).join('\n');
      rows.push([when, ev.child || '', name(ev.type), ev.subject || '', ev.week || '', ev.id || '', ev.title || '', ev.score != null ? ev.score : '', ev.attempt || ev.status || '', texts, ev.comment || ev.note || '']);
      if (ev.id) upsert(prog, ev, when);
    });
    if (rows.length) log.getRange(log.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return out({ ok: true, n: rows.length });
  }
  if (body.type === 'snapshot') {
    var sn = sheet(ss, 'Знімок', ['Час', 'Дитина', 'JSON (частина)']);
    var data = String(body.data || ''); var chunks = [];
    for (var i = 0; i < data.length; i += 45000) chunks.push(data.substr(i, 45000));
    sn.clearContents(); sn.appendRow(['Час', 'Дитина', 'JSON (частина)']);
    var when2 = Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy HH:mm');
    chunks.forEach(function (c, k) { sn.appendRow([k === 0 ? when2 : '', k === 0 ? (body.child || '') : '', c]); });
    return out({ ok: true, chunks: chunks.length });
  }
  return out({ ok: false, error: 'unknown type' });
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (action === 'snapshot') {
    var sn = ss.getSheetByName('Знімок'); if (!sn || sn.getLastRow() < 2) return out({ ok: false, error: 'no snapshot' });
    var vals = sn.getRange(2, 3, sn.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }).join('');
    return out({ ok: true, data: vals, when: sn.getRange(2, 1).getValue() });
  }
  return out({ ok: true, app: 'zoshyt-4klas sync', hint: 'POST events/snapshot; GET ?action=snapshot' });
}

function upsert(prog, ev, when) {
  var last = prog.getLastRow(); var rowIdx = -1;
  if (last >= 2) { var ids = prog.getRange(2, 1, last - 1, 1).getValues(); for (var i = 0; i < ids.length; i++) if (ids[i][0] === ev.id) { rowIdx = i + 2; break; } }
  var row = rowIdx > 0 ? prog.getRange(rowIdx, 1, 1, 10).getValues()[0] : [ev.id, ev.subject || '', ev.week || '', ev.title || '', '', '', 'не здано', '', '', ''];
  if (ev.type === 'practice') { row[4] = ev.score; row[5] = ev.attempt || 1; }
  if (ev.type === 'homework') { row[6] = 'здано'; row[7] = ev.score != null ? ev.score : ''; row[8] = ''; }
  if (ev.type === 'review') { row[8] = (ev.status === 'ok' ? 'прийнято' : 'повернуто') + (ev.comment ? ': ' + ev.comment : ''); if (ev.status === 'redo') row[6] = 'на доопрацюванні'; }
  if (ev.type === 'reset') { row[4] = ''; row[5] = ''; row[6] = 'скинуто'; row[7] = ''; row[8] = ''; }
  row[9] = when;
  if (rowIdx > 0) prog.getRange(rowIdx, 1, 1, 10).setValues([row]); else prog.appendRow(row);
}
function sheet(ss, title, header) { var s = ss.getSheetByName(title); if (!s) { s = ss.insertSheet(title); s.appendRow(header); s.setFrozenRows(1); } return s; }
function name(t) { return { open: 'відкрив урок', practice: 'завершив практику', homework: 'здав домашнє', retry: 'повторює практику', review: 'перевірка батьків', reset: 'скинуто прогрес', import: 'імпорт даних', test: 'тестова подія' }[t] || t; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
