"""Merge the hand-written English help notes into site/chitonga/hints.json.

    python build_hints.py seed_lines.json out.json hints_a.py hints_b.py ...

Each hints file defines H = {(doc number, line number): (plain English rewording or None, [(word, meaning), ...])},
doc number = position of the SmolDoc document in block 1 (1-based). Words must occur in the English line; those that
do not are reported and dropped. Output: {line_id: {"p": plain, "w": [[word, meaning], ...]}}, English only.
"""
import json, sys, runpy
seed = [x for x in json.load(open(sys.argv[1], encoding='utf-8')) if x['block'] == 1 and x['part'] == 'smoldoc']
docs = []
for x in seed:
    if not docs or docs[-1][0] != x['doc_id']:
        docs.append((x['doc_id'], {}))
    docs[-1][1][x['seq']] = x
H = {}
for f in sys.argv[3:]:
    H.update(runpy.run_path(f)['H'])
out, bad = {}, []
for (d, s), (p, words) in sorted(H.items()):
    x = docs[d - 1][1].get(s)
    if not x:
        bad.append((d, s, 'no such line')); continue
    ws = []
    for w, m in (words or []):
        if w.lower() in x['en'].lower():
            ws.append([w, m])
        else:
            bad.append((d, s, 'word not in line: ' + w))
    if p or ws:
        e = {}
        if p: e['p'] = p
        if ws: e['w'] = ws
        out[x['line_id']] = e
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'lines with hints of', len(seed), '| dropped:', len(bad))
for b in bad: print(' ', b)
