// Local test rig for the Chitonga tool: no Supabase, no network.
//   node devserver.mjs <seed_lines.json> [port]
// Serves site/ and the Netlify function on http://localhost:<port>, backed by a tiny in-memory
// imitation of the PostgREST calls the function makes. Personal links printed on start.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const SITE = path.resolve(import.meta.dirname, '../../site')
const port = Number(process.argv[3] || 8899)

const seed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(l => l.block === 1)
const people = [
  { code: 'T01', role: 'translator', token: 'tok_translator_one_aaaaaaaaaaaaaa', active: true },
  { code: 'T02', role: 'translator', token: 'tok_translator_two_bbbbbbbbbbbbbb', active: true },
  { code: 'CHK1', role: 'checker', token: 'tok_checker_one_cccccccccccccc', active: true },
  { code: 'T901', role: 'translator', token: 'tok_retired_old_link_xxxxxxxxxxxxx', active: true },   // retired link of T01
]
// whole documents go to one translator: alternate by document
const docs = [...new Set(seed.map(l => l.doc_id))]
const lines = seed.map(l => ({ doc_id: null, seq: null, loanwords: null, valley_variant: null, check_status: null, translated_by: null, checked_by: null, note: null, check_note: null, original_translation: null, translated_at: null, checked_at: null, ...l, assigned_to: docs.indexOf(l.doc_id) % 2 ? 'T02' : 'T01' }))
const events = [], tasks = []
const tables = { chitonga_people: people, chitonga_lines: lines, chitonga_events: events, chitonga_tasks: tasks }

const unq = s => s.replace(/^"|"$/g, '')
function matcher(key, val) {
  if (key === 'or') {
    const parts = val.slice(1, -1).split(',').map(p => p.split('.'))
    return r => parts.some(([k, ...op]) => op.join('.') === 'not.is.null' ? r[k] != null : false)
  }
  if (val.startsWith('eq.')) return r => String(r[key]) === decodeURIComponent(val.slice(3))
  if (val.startsWith('in.(')) { const set = val.slice(4, -1).split(',').map(unq); return r => set.includes(String(r[key])) }
  return () => true
}
function rest(req, url, body) {
  const t = url.pathname.replace('/rest/v1/', '')
  const rows = tables[t]
  const filters = [...url.searchParams].filter(([k]) => !['select', 'order', 'limit'].includes(k)).map(([k, v]) => matcher(k, v))
  let sel = rows.filter(r => filters.every(f => f(r)))
  if (req.method === 'GET') {
    if (url.searchParams.get('order')) sel = [...sel].sort((a, b) => a.ord - b.ord)
    const m = /(\d+)-(\d+)/.exec(req.headers.range || '')
    return m ? sel.slice(+m[1], +m[2] + 1) : sel
  }
  if (req.method === 'PATCH') { sel.forEach(r => Object.assign(r, JSON.parse(body))); return sel }
  if (req.method === 'POST') { JSON.parse(body).forEach(e => rows.push(t === 'chitonga_tasks' ? { id: rows.length + 1, status: 'open', result: null, note: null, ...e } : e)); return [] }
  return []
}

process.env.SUPABASE_URL = `http://localhost:${port}/__sb`
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dev'
const fn = require('../../netlify/functions/chitonga.js')

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  let body = ''; for await (const c of req) body += c
  if (url.pathname.startsWith('/__sb/')) {
    url.pathname = url.pathname.replace('/__sb', '')
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(rest(req, url, body)))
  }
  if (url.pathname === '/__events') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(events)) }
  if (url.pathname.startsWith('/.netlify/functions/chitonga')) {
    const r = await fn.handler({ httpMethod: req.method, headers: req.headers, body })
    res.writeHead(r.statusCode, r.headers); return res.end(r.body)
  }
  let p = path.join(SITE, url.pathname); if (url.pathname.endsWith('/')) p = path.join(p, 'index.html')
  if (!p.startsWith(SITE) || !fs.existsSync(p)) { res.writeHead(404); return res.end('nf') }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(fs.readFileSync(p))
}).listen(port, () => {
  console.log(`dev server on http://localhost:${port}/chitonga/`)
  for (const p of people) console.log(p.code, `http://localhost:${port}/chitonga/#T=${p.token}`)
})
