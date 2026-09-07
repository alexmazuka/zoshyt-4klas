#!/usr/bin/env python3
"""Змістовий аудит уроків (доповнює validate.py): підозрілі місця, статистика.
Запуск: python3 tools/audit.py [--brief]"""
import json, os, glob, re, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
plan = json.load(open(f"{ROOT}/data/plan.json", encoding="utf-8"))["lessons"]
AUTO = {"choice","multi","truefalse","fill","number","input","match","order","sort"}
issues = collections.defaultdict(list); stats = collections.Counter(); types = collections.Counter(); sizes = collections.defaultdict(list)
def words(s): return len(re.findall(r"\w+", s))
for l in plan:
    path = f"{ROOT}/{l['file']}"
    if not os.path.exists(path): stats["missing"] += 1; continue
    d = json.load(open(path, encoding="utf-8")); s = l["subject"]; sizes[s].append(os.path.getsize(path)); stats["files"] += 1
    ex, hw, th = d.get("exercises", []), d.get("homework", []), d.get("theory", [])
    for e in ex + hw: types[e.get("type")] += 1
    auto_ex = [e for e in ex if e.get("type") in AUTO]
    if len(set(e.get("type") for e in ex)) < 3: issues["мало різних типів вправ у практиці (<3)"].append(l["id"])
    if len(ex) < 4: issues["практика < 4 вправ"].append(l["id"])
    noexp = [e for e in auto_ex if not e.get("explain") and not e.get("hint")]
    if len(noexp) > max(2, len(auto_ex) // 2): issues["більшість автовправ без explain/hint"].append(l["id"])
    if s == "read" and not any(b.get("type") == "reading" for b in th): issues["читання без блоку reading"].append(l["id"])
    if s == "eng":
        if not any(b.get("type") == "vocab" for b in th): issues["англійська без vocab"].append(l["id"])
        if not any(e.get("type") == "speak" for e in ex + hw): issues["англійська без speak"].append(l["id"])
    for b in th:
        if b.get("type") == "reading":
            n = words(b.get("text", ""))
            if n < 60: issues["reading коротший за 60 слів"].append(f"{l['id']} ({n})")
    txt = json.dumps(d, ensure_ascii=False)
    if re.search(r"\b(підручник|у класі|вчитель)\b", txt, re.I) and s not in ("read",): stats["згадки шкільного контексту"] += 1
    for e in ex + hw:
        t = e.get("type")
        if t == "text" and len(e.get("sample", "")) < 60: issues["text із коротким sample (<60)"].append(l["id"])
        if t == "choice" and len(e.get("options", [])) < 3: issues["choice лише з 2 варіантами"].append(l["id"])
        if t == "choice" and any(re.search(r"усі (відповіді|варіанти)", str(o), re.I) for o in e.get("options", [])): issues["choice з варіантом «усі…»"].append(l["id"])
        if t == "fill":
            blanks = re.findall(r"\{([^{}]*)\}", e.get("text", ""))
            if len(blanks) > 8: issues["fill з > 8 пропусками"].append(l["id"])
    if not d.get("reflection"): stats["без reflection"] += 1
    # російські літери / типові русизми
    if re.search(r"[ыэъё]", txt): issues["російські літери"].append(l["id"])
brief = "--brief" in sys.argv
print(f"Файлів: {stats['files']} з {len(plan)}; відсутні: {stats['missing']}")
for s, arr in sorted(sizes.items()): print(f"  {s:7s} {len(arr):3d} файлів, розмір {min(arr)//1024}–{max(arr)//1024} КБ, середній {sum(arr)//len(arr)//1024} КБ")
print("Типи вправ:", dict(types.most_common()))
print(f"Без reflection: {stats['без reflection']}; згадок шкільного контексту: {stats['згадки шкільного контексту']}")
for k, v in issues.items():
    print(f"\n[{len(v)}] {k}:" + ("" if brief else " " + ", ".join(v[:40]) + (" …" if len(v) > 40 else "")))
