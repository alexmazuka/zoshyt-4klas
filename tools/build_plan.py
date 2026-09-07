#!/usr/bin/env python3
"""Збирає data/plan.json з календаря, розкладу та планів предметів.
Кожному уроку призначає слот (тиждень, день) за розкладом, id = <subj>-w<WW>-d<D>.
Запуск: python3 tools/build_plan.py
"""
import json, os, sys, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cal = json.load(open(f"{ROOT}/data/calendar.json", encoding="utf-8"))
subj = json.load(open(f"{ROOT}/data/subjects.json", encoding="utf-8"))
timetable = subj["timetable"]

# 1. Слоти за розкладом
slots = {}  # subject -> list of (week, day)
for w in cal["weeks"]:
    for d in w["days"]:
        for i, s in enumerate(timetable[str(d)]):
            if "|" in s:
                a, b = s.split("|")
                s = a if w["week"] % 2 == 1 else b
            slots.setdefault(s, []).append((w["week"], d, i + 1))

# 2. Плани предметів
lessons = []
errors = []
for s in subj["subjects"]:
    sid = s["id"]
    plan = json.load(open(f"{ROOT}/data/plan/{sid}.json", encoding="utf-8"))
    flat = []
    for sec in plan["sections"]:
        for l in sec["lessons"]:
            flat.append((sec["name"], l))
    have, need = len(flat), len(slots.get(sid, []))
    if have != need:
        errors.append(f"{sid}: у плані {have} уроків, а слотів у розкладі {need}")
    for n, ((week, day, pos), (secname, l)) in enumerate(zip(slots[sid], flat), start=1):
        lid = f"{sid}-w{week:02d}-d{day}"
        lessons.append({
            "id": lid, "subject": sid, "week": week, "day": day, "pos": pos, "n": n,
            "section": secname, "title": l["t"], "brief": l.get("b", ""),
            "file": f"data/lessons/{sid}/{lid}.json",
            "exists": os.path.exists(f"{ROOT}/data/lessons/{sid}/{lid}.json"),
        })

if errors:
    print("ПОМИЛКИ:\n  " + "\n  ".join(errors)); sys.exit(1)

lessons.sort(key=lambda x: (x["week"], x["day"], x["pos"]))
out = {
    "generated": datetime.date.today().isoformat(),
    "total": len(lessons),
    "written": sum(1 for l in lessons if l["exists"]),
    "lessons": lessons,
}
json.dump(out, open(f"{ROOT}/data/plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"plan.json: {out['total']} уроків, готових файлів: {out['written']}")
missing = [l["id"] for l in lessons if not l["exists"]]
if missing and "-v" in sys.argv:
    print("Немає файлів:", " ".join(missing))
