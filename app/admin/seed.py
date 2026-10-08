"""Turn the Chitonga working-copy export into rows for chitonga_lines.

    node export.mjs wc.xlsx
    python seed.py wc.xlsx seed_lines.json

the order the SMOL maintainers asked for: block 1 = first 66 SmolDoc documents (825 lines),
block 2 = GATITOS, block 3 = SmolSent, block 4 = the rest of SmolDoc. Lines already translated in
the sheet keep their text, so the sheet can be retired without losing work.
"""
import json, sys, openpyxl

wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
# Google Sheets turned the English word "false" (GATITOS agnostic_1844) into a boolean cell; read it back as the word
clean = lambda v: ('true' if v is True else 'false' if v is False else str(v).strip() or None) if v is not None else None
out, ord_ = [], 0

def add(**r):
    global ord_
    ord_ += 1
    out.append({"ord": ord_, **r})

rows = list(wb["smoldoc"].iter_rows(values_only=True))
docs, doc, seq = 0, None, 0
smoldoc = []
for r in rows[1:]:
    en = clean(r[0])
    if not en:
        continue
    if en.startswith("ID="):
        docs += 1; doc = en[3:]; seq = 0; continue
    seq += 1
    smoldoc.append((docs, doc, seq, r))

def row(part, r, line_id, **extra):
    return dict(line_id=line_id, part=part, en=clean(r[0 if part != "gatitos" else 1]),
                translation=clean(r[1 if part != "gatitos" else 2]), **extra)

for d, doc, seq, r in smoldoc:
    if d <= 66:
        add(**row("smoldoc", r, r[2], doc_id=doc, seq=seq, block=1))
for r in list(wb["gatitos"].iter_rows(values_only=True))[1:]:
    if clean(r[1]):
        add(**row("gatitos", r, r[3] or "gatitos:" + str(r[0]), block=2))   # one line_id cell was blank
for r in list(wb["smolsent"].iter_rows(values_only=True))[1:]:
    if clean(r[0]):
        add(**row("smolsent", r, r[2], block=3))
for d, doc, seq, r in smoldoc:
    if d > 66:
        add(**row("smoldoc", r, r[2], doc_id=doc, seq=seq, block=4))

json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
from collections import Counter
print(len(out), "lines;", dict(Counter(x["block"] for x in out)), "already translated:", sum(1 for x in out if x["translation"]))
assert len({x["line_id"] for x in out}) == len(out), "duplicate line_id"
