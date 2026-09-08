#!/usr/bin/env python3
"""Автоматична перевірка арифметики у вправах математики.
Шукає вирази виду «348 · 3», «720 : 9», «45 000 + 300», «12 − 4 · 2» у полі q (для number) або в text (для fill:
«36·4 = {144}»), обчислює їх і порівнює з answer. Друкує розбіжності. Запуск: python3 tools/check_math.py"""
import json, os, glob, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPS = {'·': '*', '×': '*', '*': '*', 'x': '*', 'х': '*', ':': '/', '÷': '/', '+': '+', '−': '-', '–': '-', '-': '-'}
NUM = r"\d[\d ]*(?:[.,]\d+)?"
EXPR = re.compile(rf"(?<![\w{{])(\(?\s*{NUM}(?:\s*[·×*xх:÷+−–-]\s*\(?\s*{NUM}\s*\)?)+)\s*(?==|\?|$|\.|,|;)")
def to_py(expr):
    e = expr
    for k, v in OPS.items(): e = e.replace(k, f' {v} ')
    e = re.sub(r"(\d) (\d)", r"\1\2", e)          # прибираємо пробіли між класами
    e = re.sub(r"(\d) (\d)", r"\1\2", e)
    e = e.replace(',', '.')
    if not re.fullmatch(r"[\d\s.+\-*/()]+", e): return None
    return e
def evaluate(expr):
    e = to_py(expr)
    if e is None: return None
    try:
        val = eval(e, {"__builtins__": {}})
    except Exception: return None
    return val
def num(s):
    try: return float(str(s).replace(' ', '').replace(',', '.'))
    except: return None
problems = []; checked = 0
for path in sorted(glob.glob(f"{ROOT}/data/lessons/math/*.json")):
    d = json.load(open(path, encoding="utf-8")); lid = d["id"]
    for kind in ("exercises", "homework"):
        for i, ex in enumerate(d.get(kind, [])):
            t = ex.get("type")
            if t == "number":
                q = ex.get("q", "")
                # беремо лише «Обчисли»-подібні запитання з одним виразом
                m = EXPR.findall(q.replace('=', ' = '))
                exprs = [x for x in m if re.search(r"[·×*xх:÷+−–-]", x)]
                if len(exprs) == 1 and not re.search(r"остач|скільки .*розряд|цифр|периметр|площ|швидк|км/год|задач", q, re.I):
                    val = evaluate(exprs[0]); a = num(ex.get("answer"))
                    if val is not None and a is not None:
                        checked += 1
                        if abs(val - a) > 1e-6: problems.append(f"{lid} {kind}[{i}] number: «{exprs[0].strip()}» = {val:g}, а answer = {a:g}")
            if t == "fill":
                text = ex.get("text", "")
                for m in re.finditer(rf"({NUM}(?:\s*[·×*xх:÷+−–-]\s*{NUM})+)\s*=\s*\{{([^{{}}|]+)(?:\|[^{{}}]*)?\}}", text):
                    val = evaluate(m.group(1)); a = num(m.group(2))
                    if val is not None and a is not None:
                        checked += 1
                        if abs(val - a) > 1e-6: problems.append(f"{lid} {kind}[{i}] fill: «{m.group(1).strip()}» = {val:g}, а в пропуску {a:g}")
                # варіант «{144} = 36·4» або «36·4 = {144}» вже покрито; також «x = {…}» пропускаємо
print(f"Перевірено виразів: {checked}; розбіжностей: {len(problems)}")
for p in problems: print("  ", p)
sys.exit(1 if problems else 0)
