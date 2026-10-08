// Admin for the Chitonga tool. Needs migration 820 applied and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (read from the file named in CHITONGA_ENV, default .env.local). NOT YET RUN against the live database.
//   node admin.mjs seed <seed_lines.json>      load lines (block 1 first); safe to repeat, never overwrites work
//   node admin.mjs person <T01|CHK1> <translator|checker>   make a person and print their personal link
//   node admin.mjs links                       print every active person's link
//   node admin.mjs assign <block> <T01,CHK1,..> [maxDocs] give whole documents of a block to translators, round robin (only unassigned lines)
//   node admin.mjs review  <person> <from> [n]  give <person> up to n lines translated by <from> to review
//   node admin.mjs reverse <person> <from> [n]  give <person> up to n lines translated by <from> to write back into English
//   node admin.mjs given                       what each person has been given and done
//   node admin.mjs pay                         what each person is owed (checked lines only)
//   node admin.mjs export <out.csv>            checked translations: line_id,en,translation (for the SMOL sheet)
import fs from 'node:fs'
import crypto from 'node:crypto'
const env = {}
for (const l of fs.readFileSync(process.env.CHITONGA_ENV || '.env.local', 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
const BASE = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, SITE = 'https://zamai.pro/chitonga/'
const sb = (p, o = {}) => fetch(`${BASE}/rest/v1/${p}`, { ...o, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(o.headers || {}) } })
const all = async p => { const rows = []; for (let f = 0; ; f += 1000) { const r = await sb(p, { headers: { Range: `${f}-${f + 999}`, 'Range-Unit': 'items' } }); if (!r.ok) throw new Error(await r.text()); const j = await r.json(); rows.push(...j); if (j.length < 1000) return rows } }
const [cmd, a, b, c] = process.argv.slice(2)

if (cmd === 'seed') {
  const lines = JSON.parse(fs.readFileSync(a, 'utf8')).map(l => ({ doc_id: null, seq: null, ...l }))   // bulk insert needs the same keys on every row
  let n = 0
  for (let i = 0; i < lines.length; i += 500) {
    // ignore-duplicates: a line already in the table (maybe translated) is never touched
    const r = await sb('chitonga_lines?on_conflict=line_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(lines.slice(i, i + 500)) })
    if (!r.ok) throw new Error(await r.text()); n += Math.min(500, lines.length - i)
  }
  console.log('sent', n, 'lines')
} else if (cmd === 'person') {
  const token = crypto.randomBytes(24).toString('base64url')
  const r = await sb('chitonga_people', { method: 'POST', body: JSON.stringify({ code: a, role: b, token }) })
  if (!r.ok) throw new Error(await r.text())
  console.log(a, b, SITE + '#T=' + token)
} else if (cmd === 'links') {
  for (const p of await all('chitonga_people?active=eq.true&select=code,role,token&order=code')) console.log(p.code.padEnd(5), p.role.padEnd(10), SITE + '#T=' + p.token)
} else if (cmd === 'assign') {
  const who = b.split(','), rows = await all(`chitonga_lines?block=eq.${a}&assigned_to=is.null&select=doc_id,line_id,ord&order=ord`)
  const docs = [...new Set(rows.map(r => r.doc_id ?? r.line_id))].slice(0, c ? Number(c) : undefined)   // lines without a document go one by one
  const owner = {}; docs.forEach((d, i) => { owner[d] = who[i % who.length] })
  for (const w of who) {
    const mine = rows.filter(r => owner[r.doc_id ?? r.line_id] === w).map(r => `"${r.line_id}"`)
    for (let i = 0; i < mine.length; i += 50) {
      const r = await sb(`chitonga_lines?line_id=in.(${mine.slice(i, i + 50).join(',')})`, { method: 'PATCH', body: JSON.stringify({ assigned_to: w }) })
      if (!r.ok) throw new Error(await r.text())
    }
    console.log(w, mine.length, 'lines')
  }
} else if (cmd === 'review' || cmd === 'reverse') {
  // give <person> review or reverse work on up to <n> lines translated by <from>, whole documents in order
  const person = a, from = b, n = Number(c || 100)
  if (!person || !from || person === from) throw new Error('usage: admin.mjs ' + cmd + ' <person> <from> [n]  (person and from must differ)')
  const lines = await all(`chitonga_lines?translated_by=eq.${from}&translation=not.is.null&select=line_id,doc_id,ord,assigned_to,translated_by&order=ord`)
  const given = await all(`chitonga_tasks?select=kind,line_id,person`)
  const mineAssigned = new Set((await all(`chitonga_lines?assigned_to=eq.${person}&select=doc_id`)).map(r => r.doc_id))
  const docOf = Object.fromEntries((await all(`chitonga_lines?select=line_id,doc_id`)).map(r => [r.line_id, r.doc_id]))
  const docsWith = k => new Set(given.filter(t => t.person === person && t.kind === k).map(t => docOf[t.line_id]))
  // a person who saw the English of a document (translated it or reviews it) must not reverse it, and the other way round
  const sawEnglish = new Set([...mineAssigned, ...docsWith('review')]), reversing = docsWith('reverse')
  const taken = new Set(given.filter(t => t.kind === cmd).map(t => t.line_id))
  const pick = []
  for (const l of lines) {
    if (pick.length >= n) break
    if (taken.has(l.line_id) || l.assigned_to === person || l.translated_by === person) continue
    if (cmd === 'reverse' && sawEnglish.has(l.doc_id)) continue
    if (cmd === 'review' && reversing.has(l.doc_id)) continue
    pick.push({ kind: cmd, line_id: l.line_id, person })
  }
  if (!pick.length) { console.log('nothing suitable to give'); process.exit(0) }
  const r = await sb('chitonga_tasks', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(pick) })
  if (!r.ok) throw new Error(await r.text())
  console.log(`gave ${person} ${pick.length} ${cmd} item(s) on lines translated by ${from}`)
} else if (cmd === 'given') {
  const t = await all(`chitonga_tasks?select=person,kind,status&order=person`)
  const L = await all(`chitonga_lines?assigned_to=not.is.null&select=assigned_to,translation`)
  const rows = {}
  for (const l of L) { const k = l.assigned_to; rows[k] = rows[k] || {}; rows[k].translate = (rows[k].translate || 0) + 1; if (l.translation) rows[k].translated = (rows[k].translated || 0) + 1 }
  for (const x of t) { rows[x.person] = rows[x.person] || {}; const k = x.kind + (x.status === 'done' ? '_done' : '_open'); rows[x.person][k] = (rows[x.person][k] || 0) + 1 }
  for (const [p, v] of Object.entries(rows).sort()) console.log(p.padEnd(5), JSON.stringify(v))
} else if (cmd === 'pay') {
  for (const r of await all('chitonga_pay?select=*&order=code')) console.log(r.code.padEnd(5), String(r.lines).padStart(5), 'lines', ('K' + r.kwacha).padStart(9), ' ', r.basis)
} else if (cmd === 'export') {
  const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"'
  const rows = await all('chitonga_lines?check_status=in.(ok,corrected)&select=line_id,en,translation&order=ord')
  fs.writeFileSync(a, 'line_id,en,translation\n' + rows.map(r => [r.line_id, r.en, r.translation].map(q).join(',')).join('\n'), 'utf8')
  console.log('wrote', rows.length, 'checked lines to', a)
} else console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(0, 10).join('\n'))
