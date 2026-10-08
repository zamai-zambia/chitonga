// Every save on one account, in time order, as a CSV to sort out who did what.
//   node history.mjs <code> <out.csv>
// Columns: time (Zambia), document no., line no., English, the Chitonga saved, saved how many times, phone, phone type.
import fs from 'node:fs'
const env = {}
for (const l of fs.readFileSync(process.env.CHITONGA_ENV || '.env.local', 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
const sb = async p => { const out = []; for (let f = 0; ; f += 1000) { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, Range: `${f}-${f + 999}`, 'Range-Unit': 'items' } }); if (!r.ok) throw new Error(await r.text()); const j = await r.json(); out.push(...j); if (j.length < 1000) return out } }
const [code, out] = process.argv.slice(2)
let ev
try { ev = await sb(`chitonga_events?person=eq.${code}&select=id,line_id,action,text,created_at,device,platform&order=id`) }
catch { ev = await sb(`chitonga_events?person=eq.${code}&select=id,line_id,action,text,created_at&order=id`) }
const lines = Object.fromEntries((await sb(`chitonga_lines?assigned_to=eq.${code}&select=line_id,doc_id,seq,ord,en&order=ord`)).map(l => [l.line_id, l]))
const docNo = {}; let n = 0; for (const l of Object.values(lines)) if (!(l.doc_id in docNo)) docNo[l.doc_id] = ++n
const times = {}; for (const e of ev) times[e.line_id] = (times[e.line_id] || 0) + 1
const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"'
const cat = t => new Date(new Date(t).getTime() + 2 * 3600e3).toISOString().slice(11, 19)   // Zambia is UTC+2
const rows = ev.map(e => { const l = lines[e.line_id] || {}; return [cat(e.created_at), docNo[l.doc_id] ?? '', l.seq ?? '', l.en ?? e.line_id, e.text, times[e.line_id], e.device ?? '', e.platform ?? ''].map(q).join(',') })
fs.writeFileSync(out, '\ufefftime_zambia,document,line,english,chitonga_saved,times_this_line_was_saved,phone,phone_type\n' + rows.join('\n'), 'utf8')
console.log('wrote', rows.length, 'saves for', code, 'to', out)
