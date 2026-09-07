#!/usr/bin/env python3
"""Перевіряє файли уроків на відповідність схемі з AUTHORING.md.
Запуск: python3 tools/validate.py [файл або папка ...]   (без аргументів — усі уроки)
Код виходу 1, якщо є помилки."""
import json, os, re, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
plan = {l["id"]: l for l in json.load(open(f"{ROOT}/data/plan.json", encoding="utf-8"))["lessons"]}
THEORY = {"p","rule","example","list","steps","table","reading","vocab","dialogue","tip","image"}
AUTO = {"choice","multi","truefalse","fill","number","input","match","order","sort"}
MANUAL = {"text","checklist","speak"}
PRACTICAL = {"pe","art","design","music"}

def check_ex(ex, where, errs, warns):
    t = ex.get("type")
    if t not in AUTO | MANUAL:
        errs.append(f"{where}: невідомий type={t!r}"); return
    if t != "truefalse" and not isinstance(ex.get("q"), str) or (t != "truefalse" and not ex.get("q","").strip()):
        errs.append(f"{where}: немає q")
    if t in ("choice","multi"):
        opts = ex.get("options")
        if not isinstance(opts, list) or len(opts) < 2: errs.append(f"{where}: options має бути списком ≥2"); return
        if len(set(map(str,opts))) != len(opts): errs.append(f"{where}: повторювані options")
        if t == "choice":
            a = ex.get("answer")
            if not isinstance(a, int) or isinstance(a, bool) or not 0 <= a < len(opts): errs.append(f"{where}: answer має бути індексом 0..{len(opts)-1}")
        else:
            a = ex.get("answer")
            if not isinstance(a, list) or not a or any((not isinstance(i,int)) or i<0 or i>=len(opts) for i in a): errs.append(f"{where}: answer має бути списком індексів")
            elif len(set(a)) != len(a): errs.append(f"{where}: повтори в answer")
    elif t == "truefalse":
        items = ex.get("items")
        if not isinstance(items, list) or len(items) < 2: errs.append(f"{where}: items ≥2"); return
        for i, it in enumerate(items):
            if not isinstance(it, dict) or not isinstance(it.get("text"), str) or not isinstance(it.get("answer"), bool):
                errs.append(f"{where}: items[{i}] має мати text і answer:true/false")
    elif t == "fill":
        txt = ex.get("text")
        if not isinstance(txt, str): errs.append(f"{where}: fill потребує text"); return
        blanks = re.findall(r"\{([^{}]*)\}", txt)
        if not blanks: errs.append(f"{where}: у text немає пропусків {{...}}")
        for b in blanks:
            if not b.strip() or any(not v.strip() for v in b.split("|")): errs.append(f"{where}: порожній варіант у {{{b}}}")
        if txt.count("{") != txt.count("}"): errs.append(f"{where}: незбалансовані дужки")
    elif t == "number":
        a = ex.get("answer")
        if isinstance(a, str):
            try: float(a.replace(" ","").replace(",", ".")) 
            except: errs.append(f"{where}: answer не число")
        elif not isinstance(a, (int,float)) or isinstance(a,bool): errs.append(f"{where}: answer має бути числом")
    elif t == "input":
        a = ex.get("answer")
        if isinstance(a, str): a = [a]
        if not isinstance(a, list) or not a or any(not isinstance(v,str) or not v.strip() for v in a): errs.append(f"{where}: answer — список рядків")
    elif t == "match":
        pairs = ex.get("pairs")
        if not isinstance(pairs, list) or len(pairs) < 2 or any(not isinstance(p,list) or len(p)!=2 for p in pairs): errs.append(f"{where}: pairs — список пар [ліво, право] (≥2)"); return
        rights = [str(p[1]) for p in pairs]
        if len(set(rights)) != len(rights): errs.append(f"{where}: праві частини пар мають бути різними")
        lefts = [str(p[0]) for p in pairs]
        if len(set(lefts)) != len(lefts): errs.append(f"{where}: ліві частини пар мають бути різними")
    elif t == "order":
        items = ex.get("items")
        if not isinstance(items, list) or len(items) < 3: errs.append(f"{where}: order потребує items ≥3")
        elif len(set(map(str,items))) != len(items): errs.append(f"{where}: повторювані items")
    elif t == "sort":
        g = ex.get("groups")
        if not isinstance(g, dict) or len(g) < 2: errs.append(f"{where}: groups — об'єкт з ≥2 групами"); return
        allitems = []
        for k, v in g.items():
            if not isinstance(v, list) or not v: errs.append(f"{where}: група {k!r} порожня")
            else: allitems += [str(x) for x in v]
        if len(set(allitems)) != len(allitems): errs.append(f"{where}: елемент повторюється у кількох групах")
    elif t == "text":
        if not isinstance(ex.get("sample"), str) or len(ex.get("sample","")) < 10: errs.append(f"{where}: text потребує sample (зразок ≥10 символів)")
    elif t == "checklist":
        items = ex.get("items")
        if not isinstance(items, list) or len(items) < 2: errs.append(f"{where}: checklist потребує items ≥2")
    elif t == "speak":
        if not isinstance(ex.get("text"), str) or not ex["text"].strip(): errs.append(f"{where}: speak потребує text")

def check_theory(b, where, errs):
    t = b.get("type")
    if t not in THEORY: errs.append(f"{where}: невідомий type блоку {t!r}"); return
    need = {"p":["text"],"rule":["text"],"example":["text"],"list":["items"],"steps":["items"],"table":["head","rows"],
            "reading":["title","text"],"vocab":["items"],"dialogue":["lines"],"tip":["text"],"image":["emoji","caption"]}[t]
    for k in need:
        if k not in b or not b[k]: errs.append(f"{where}: блок {t} без {k}")
    if t == "table":
        w = len(b.get("head",[]))
        for i, r in enumerate(b.get("rows",[])):
            if not isinstance(r, list) or len(r) != w: errs.append(f"{where}: рядок таблиці {i} має {len(r) if isinstance(r,list) else '?'} комірок, а head — {w}")
    if t == "vocab":
        for i, it in enumerate(b.get("items",[])):
            if not isinstance(it, dict) or not it.get("en") or not it.get("uk"): errs.append(f"{where}: vocab.items[{i}] потребує en і uk")
    if t == "dialogue":
        for i, it in enumerate(b.get("lines",[])):
            if not isinstance(it, dict) or not it.get("who") or not it.get("text"): errs.append(f"{where}: dialogue.lines[{i}] потребує who і text")

def validate(path):
    errs, warns = [], []
    try:
        d = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        return [f"{path}: невалідний JSON: {e}"], []
    lid = d.get("id")
    base = os.path.basename(path)[:-5]
    if lid != base: errs.append(f"id={lid!r} не збігається з іменем файлу {base}")
    if lid in plan:
        if d.get("subject") != plan[lid]["subject"]: errs.append(f"subject={d.get('subject')!r}, у плані {plan[lid]['subject']!r}")
    else:
        errs.append(f"id {lid!r} відсутній у data/plan.json")
    for k in ("title","goal"):
        if not isinstance(d.get(k), str) or len(d.get(k,"")) < 5: errs.append(f"немає {k}")
    m = d.get("minutes")
    if not isinstance(m, int) or not 10 <= m <= 90: errs.append("minutes має бути цілим 10..90")
    th = d.get("theory")
    if not isinstance(th, list) or len(th) < 2: errs.append("theory: потрібно ≥2 блоки")
    else:
        for i, b in enumerate(th): check_theory(b, f"theory[{i}]", errs)
    subj = d.get("subject")
    ex = d.get("exercises")
    if not isinstance(ex, list) or len(ex) < 3: errs.append("exercises: потрібно ≥3 (краще 4–8)")
    else:
        for i, e in enumerate(ex): check_ex(e, f"exercises[{i}]", errs, warns)
        auto = sum(1 for e in ex if e.get("type") in AUTO)
        need = 2 if subj in PRACTICAL else 3
        if auto < need: errs.append(f"exercises: автоматичних вправ {auto}, потрібно ≥{need}")
    hw = d.get("homework")
    if not isinstance(hw, list) or len(hw) < 2: errs.append("homework: потрібно ≥2 завдання")
    else:
        for i, e in enumerate(hw): check_ex(e, f"homework[{i}]", errs, warns)
        types = {e.get("type") for e in hw}
        if not (types & AUTO): errs.append("homework: потрібне ≥1 завдання з автоперевіркою")
        if subj in PRACTICAL:
            if not (types & {"text","checklist"}): errs.append("homework: потрібне text або checklist")
        elif "text" not in types: errs.append("homework: потрібне ≥1 письмове завдання type=text")
    if subj == "eng":
        alltypes = {e.get("type") for e in (ex or []) + (hw or [])}
        if "speak" not in alltypes: warns.append("eng: бажано мати вправу speak")
        if not any(b.get("type") == "vocab" for b in (th or [])): warns.append("eng: бажано мати блок vocab")
    size = os.path.getsize(path)
    if size < 2500: warns.append(f"файл малий ({size} байт) — можливо, урок занадто короткий")
    return [f"{path}: {e}" for e in errs], [f"{path}: {w}" for w in warns]

def main():
    args = sys.argv[1:] or [f"{ROOT}/data/lessons"]
    files = []
    for a in args:
        if os.path.isdir(a): files += sorted(glob.glob(f"{a}/**/*.json", recursive=True))
        else: files.append(a)
    E, W = [], []
    for f in files:
        e, w = validate(f); E += e; W += w
    for w in W: print("УВАГА:", w)
    for e in E: print("ПОМИЛКА:", e)
    print(f"Перевірено файлів: {len(files)}; помилок: {len(E)}; попереджень: {len(W)}")
    sys.exit(1 if E else 0)

if __name__ == "__main__":
    main()
