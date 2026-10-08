// What has happened in the Chitonga tool: per person, lines saved, last activity, pace.
//   node status.mjs [sinceISO]        (default: everything)
import fs from 'node:fs'
const env = {}
for (const l of fs.readFileSync(process.env.CHITONGA_ENV || '.env.local', 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
const sb = async p => { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } }); if (!r.ok) throw new Error(await r.text()); return r.json() }
const since = process.argv[2]
const base = 'person,action,line_id,text,client_at,created_at'
let ev
try { ev = await sb(`chitonga_events?select=${base},ms_shown,ms_typing,keys,paste_attempts,device,platform&order=created_at` + (since ? `&created_at=gte.${since}` : '')) }
catch { try { ev = await sb(`chitonga_events?select=${base},ms_shown,ms_typing,keys,paste_attempts&order=created_at` + (since ? `&created_at=gte.${since}` : '')) } catch { ev = null } }
if (!ev) try { ev = await sb(`chitonga_events?select=${base}&order=created_at` + (since ? `&created_at=gte.${since}` : '')) } catch {}
const people = await sb('chitonga_people?select=code,role,last_seen&order=code')
const lines = await sb('chitonga_lines?select=check_status,assigned_to,translation&or=(translation.not.is.null,check_status.not.is.null)')
console.log('events:', ev.length, '| lines with a translation:', lines.filter(l => l.translation).length)
for (const p of people) {
  const mine = ev.filter(e => e.person === p.code)
  const tr = mine.filter(e => e.action === 'translate')
  const times = tr.map(e => +new Date(e.client_at || e.created_at)).sort((a, b) => a - b)
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / 1000).filter(g => g < 600)   // gaps over 10 min are breaks
  gaps.sort((a, b) => a - b)
  const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null
  const span = times.length > 1 ? (times[times.length - 1] - times[0]) / 3600000 : 0
  const shown = tr.map(e => e.ms_shown).filter(v => v != null).sort((x, y) => x - y)
  const pasted = tr.reduce((n, e) => n + (e.paste_attempts || 0), 0)
  // more than one phone on one account means a link was shared or sent to the wrong person
  const devs = {}; for (const e of mine) if (e.device) devs[e.device] = e.platform || '?'
  const nd = Object.keys(devs).length
  if (nd) console.log(`      phones: ${nd} (${Object.values(devs).join(', ')})` + (nd > 1 ? '  <-- MORE THAN ONE PHONE ON THIS ACCOUNT' : ''))
  if (shown.length) console.log(`      time on a line: median ${Math.round(shown[Math.floor(shown.length / 2)] / 1000)} s over ${shown.length} lines | paste attempts blocked: ${pasted}`)
  console.log(`${p.code.padEnd(5)} ${p.role.padEnd(10)} saves ${String(mine.length).padStart(3)} (translate ${tr.length}, flag ${mine.filter(e => e.action === 'flag').length}) last seen ${p.last_seen || '-'}` +
    (med != null ? ` | median ${Math.round(med)} s between saves, ${(tr.length / Math.max(span, 0.01)).toFixed(0)} lines/h over ${span.toFixed(1)} h` : ''))
}
const last = ev[ev.length - 1]
if (last) console.log('latest save:', last.person, last.action, last.line_id, '| at', last.created_at)
