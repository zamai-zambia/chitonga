// Backend of the Chitonga translation tool (zamai.pro/chitonga).
//
// GET  -> { me, lines, tasks, rates }    header x-chitonga-token = the person's personal token
// POST -> { applied, rejected, lines, tasks }   body { ops: [...] }, same header
//
// Work is GIVEN to people by Zamai, item by item; the app only shows what each person has been given (Chris,
// 5 Oct 2026). Three kinds of work:
//   translate  English -> Chitonga. A line is given by chitonga_lines.assigned_to (whole documents).
//   review     check someone else's translation: OK, correct, or flag. Given as a row in chitonga_tasks.
//   reverse    Chitonga -> English by someone who never sees the English. Given as a row in chitonga_tasks.
//              The English (and anything that would reveal it) is removed from what the server sends.
// Nobody reviews or reverse-translates their own line; tools/chitonga/admin.mjs also refuses to give such work.
//
// The store is Supabase (migrations 820-823), reached with the service role key. The browser never talks to
// Supabase. Codes (T01 ...) are the only identity, no names.
//
// ops: { line_id, kind, ... }
//   translate | flag                       on a line assigned to me
//   ok | correct | check_flag              on a line I have a review task for
//   reverse | reverse_flag                 on a line I have a reverse task for (text = the English I understood)
const H = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const json = (code, obj) => ({ statusCode: code, headers: H, body: JSON.stringify(obj) });

const RATES = { translate: 1.5, review: 1, reverse: 1.5 }; // kwacha; Chris 3 and 5 Oct 2026 (review rate still open)
const COLS = 'line_id,part,doc_id,seq,ord,block,en,translation,loanwords,valley_variant,check_status,' +
  'assigned_to,translated_by,checked_by,note,check_note,original_translation';
const TASK_COLS = 'id,kind,line_id,status,result,note,created_at,done_at';
const MAX_OPS = 200;
const MAX_TEXT = 2000;

function sb(path, opts = {}) {
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('not_configured');
  return fetch(`${base}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

async function all(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await sb(path, { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error('db_' + r.status);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const inList = ids => ids.map(x => `"${String(x).replace(/"/g, '')}"`).join(',');
async function byIds(col, ids, select) {
  const out = [];
  for (let i = 0; i < ids.length; i += 40) out.push(...await all(`chitonga_lines?${col}=in.(${inList(ids.slice(i, i + 40))})&select=${select}&order=ord`));
  return out;
}

// Retired links (5 Oct 2026: the first translator's first link had been sent to three other people by mistake). A retired
// link can no longer load sentences, but a phone that still holds unsent work under it can deliver that work, which
// is saved to the account it belonged to. The save records the phone, so it can be told apart.
const RETIRED = { T901: 'T01' };

async function whoIs(token) {
  if (!token || token.length < 20) return null;
  const r = await sb(`chitonga_people?token=eq.${encodeURIComponent(token)}&active=eq.true&select=code,role`);
  if (!r.ok) throw new Error('db_' + r.status);
  const [p] = await r.json();
  if (p) sb(`chitonga_people?code=eq.${p.code}`, { method: 'PATCH', body: JSON.stringify({ last_seen: new Date().toISOString() }) }).catch(() => {});
  if (p && RETIRED[p.code]) return { code: RETIRED[p.code], role: p.role, retired: p.code };
  return p ? { code: p.code, role: p.role } : null;
}

// review and reverse work given to me; an empty list if the tasks table does not exist yet (before migration 823)
async function tasksOf(me) {
  const r = await sb(`chitonga_tasks?person=eq.${me.code}&select=${TASK_COLS}&order=id`, { headers: { Range: '0-4999', 'Range-Unit': 'items' } });
  if (r.status === 404 || r.status === 400) return [];
  if (!r.ok) throw new Error('db_' + r.status);
  return r.json();
}

// What this person may see:
//   translate: their assigned lines (whole documents);
//   review:    the lines to review, with the rest of those documents for context;
//   reverse:   the lines to reverse-translate and their documents, WITHOUT the English or anything that reveals it.
async function linesFor(me, tasks) {
  const out = new Map();
  for (const r of await all(`chitonga_lines?assigned_to=eq.${me.code}&select=${COLS}&order=ord`)) out.set(r.line_id, r);
  const ids = kind => [...new Set(tasks.filter(t => t.kind === kind).map(t => t.line_id))];
  const docsOf = async lineIds => [...new Set((await byIds('line_id', lineIds, 'doc_id')).map(r => r.doc_id).filter(Boolean))];
  const review = ids('review'), reverse = ids('reverse');
  const openDocs = new Set([...out.values()].map(r => r.doc_id));
  if (review.length) {
    const docs = await docsOf(review);
    for (const r of await byIds('doc_id', docs, COLS)) { if (!out.has(r.line_id)) out.set(r.line_id, r); openDocs.add(r.doc_id); }
    for (const r of await byIds('line_id', review, COLS)) out.set(r.line_id, r);   // lines without a document
  }
  if (reverse.length) {
    const docs = await docsOf(reverse);
    const strip = r => ({ ...r, en: null, loanwords: null, note: null, check_note: null, original_translation: null, hidden_en: true });
    for (const r of await byIds('doc_id', docs, COLS)) if (!out.has(r.line_id) && !openDocs.has(r.doc_id)) out.set(r.line_id, strip(r));
    for (const r of await byIds('line_id', reverse, COLS)) if (!out.has(r.line_id)) out.set(r.line_id, strip(r));
  }
  return [...out.values()].sort((a, b) => a.ord - b.ord);
}

// optional work measurements sent by the page with a translation: whole milliseconds, ordinary counts
const num = (v, max) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : null);

const txt = v => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : null) || null;

// Decide what one op does. Returns { patch?, task?, action, text } or { reject }.
function decide(me, row, op, task) {
  const now = new Date().toISOString();
  if (op.kind === 'translate' || op.kind === 'flag') {
    if (row.assigned_to !== me.code) return { reject: 'not_yours' };
    if (row.check_status === 'ok' || row.check_status === 'corrected') return { reject: 'locked' };
    if (op.kind === 'translate') {
      const t = txt(op.translation);
      if (!t) return { reject: 'empty' };
      return {
        action: 'translate', text: t,
        patch: {
          translation: t, loanwords: txt(op.loanwords), valley_variant: txt(op.valley_variant), note: txt(op.note),
          translated_by: me.code, translated_at: now, check_status: null, check_note: null,
          checked_by: null, checked_at: null, original_translation: null,
        },
      };
    }
    const n = txt(op.note);
    if (!n) return { reject: 'note_required' };
    return { action: 'flag', text: n, patch: { note: n, check_status: 'flagged', translated_by: me.code } };
  }

  if (op.kind === 'ok' || op.kind === 'correct' || op.kind === 'check_flag') {
    if (!task || task.kind !== 'review') return { reject: 'not_given' };
    if (row.translated_by === me.code || row.assigned_to === me.code) return { reject: 'own_line' };
    if (!row.translation && op.kind !== 'check_flag') return { reject: 'nothing_to_check' };
    const done = { status: 'done', done_at: now };
    if (op.kind === 'ok') {
      return { action: 'ok', text: row.translation, task: done, patch: { check_status: 'ok', checked_by: me.code, checked_at: now, check_note: txt(op.note) } };
    }
    if (op.kind === 'correct') {
      const t = txt(op.translation);
      if (!t) return { reject: 'empty' };
      return {
        action: 'correct', text: t, task: done,
        patch: {
          translation: t, original_translation: row.original_translation || row.translation,
          check_status: 'corrected', checked_by: me.code, checked_at: now, check_note: txt(op.note),
        },
      };
    }
    const n = txt(op.note);
    if (!n) return { reject: 'note_required' };
    return { action: 'check_flag', text: n, task: done, patch: { check_status: 'flagged', checked_by: me.code, checked_at: now, check_note: n } };
  }

  if (op.kind === 'reverse' || op.kind === 'reverse_flag') {
    if (!task || task.kind !== 'reverse') return { reject: 'not_given' };
    if (row.translated_by === me.code || row.assigned_to === me.code) return { reject: 'own_line' };
    if (op.kind === 'reverse') {
      const t = txt(op.english);
      if (!t) return { reject: 'empty' };
      return { action: 'reverse', text: t, task: { status: 'done', done_at: now, result: t, note: txt(op.note) } };
    }
    const n = txt(op.note);
    if (!n) return { reject: 'note_required' };
    return { action: 'reverse_flag', text: n, task: { status: 'done', done_at: now, result: null, note: n } };
  }
  return { reject: 'bad_kind' };
}

exports.handler = async function (event) {
  try {
    const token = event.headers['x-chitonga-token'] || event.headers['X-Chitonga-Token'];
    const me = await whoIs(token);
    if (!me) return json(403, { error: 'forbidden' });

    if (event.httpMethod === 'GET') {
      if (me.retired) return json(403, { error: 'retired' });
      const tasks = await tasksOf(me);
      return json(200, { me, rates: RATES, tasks, lines: await linesFor(me, tasks), server_time: new Date().toISOString() });
    }

    if (event.httpMethod === 'POST') {
      let b;
      try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad_json' }); }
      const ops = Array.isArray(b.ops) ? b.ops.slice(0, MAX_OPS) : [];
      if (!ops.length) return json(400, { error: 'no_ops' });

      const ids = [...new Set(ops.map(o => o && o.line_id).filter(x => typeof x === 'string'))];
      const rows = {};
      for (const r of await byIds('line_id', ids, COLS)) rows[r.line_id] = r;
      const myTasks = await tasksOf(me);
      const taskFor = (lineId, kind) => myTasks.find(t => t.line_id === lineId && (!kind || t.kind === kind));

      const applied = [], rejected = [], events = [], touchedTasks = [];
      for (const op of ops) {
        const row = op && rows[op.line_id];
        if (!row) { rejected.push({ line_id: op && op.line_id, reason: 'unknown_line' }); continue; }
        const kind = ['ok', 'correct', 'check_flag'].includes(op.kind) ? 'review' : ['reverse', 'reverse_flag'].includes(op.kind) ? 'reverse' : null;
        const task = kind ? taskFor(row.line_id, kind) : null;
        const d = decide(me, row, op, task);
        if (d.reject) { rejected.push({ line_id: row.line_id, reason: d.reject }); continue; }
        if (d.patch) {
          const r = await sb(`chitonga_lines?line_id=eq.${encodeURIComponent(row.line_id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ ...d.patch, updated_at: new Date().toISOString() }),
          });
          if (!r.ok) { rejected.push({ line_id: row.line_id, reason: 'db_' + r.status }); continue; }
          const [fresh] = await r.json();
          rows[row.line_id] = fresh;
        }
        if (d.task && task) {
          const r = await sb(`chitonga_tasks?id=eq.${task.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(d.task) });
          if (!r.ok) { rejected.push({ line_id: row.line_id, reason: 'db_' + r.status }); continue; }
          const [t] = await r.json(); Object.assign(task, t); touchedTasks.push(task);
        }
        applied.push(row.line_id);
        const at = op.at && !isNaN(Date.parse(op.at)) ? new Date(op.at).toISOString() : null;
        const ev = { line_id: row.line_id, person: me.code, action: d.action, text: d.text, client_at: at };
        if (typeof op.d === 'string' && op.d) ev.device = op.d.slice(0, 40);
        if (typeof op.u === 'string' && op.u) ev.platform = op.u.slice(0, 20);
        if (me.retired) ev.device = 'old-link:' + (ev.device || 'old-page');   // came through a retired link
        if (d.action === 'translate' || d.action === 'reverse') {
          ev.ms_shown = num(op.m, 3600000); ev.ms_typing = num(op.t, 3600000);
          ev.keys = num(op.k, 100000); ev.paste_attempts = num(op.p, 1000);
          const why = txt(op.r); if (why) ev.edit_reason = why.slice(0, 300);
        }
        events.push(ev);
      }
      if (events.length) {
        let r = await sb('chitonga_events', { method: 'POST', body: JSON.stringify(events) });
        if (!r.ok) {
          // optional columns missing (before 821/822): keep the audit trail without them
          const bare = events.map(({ ms_shown, ms_typing, keys, paste_attempts, edit_reason, device, platform, ...rest }) => rest);
          r = await sb('chitonga_events', { method: 'POST', body: JSON.stringify(bare) });
          if (!r.ok) console.error('chitonga events insert failed', r.status);
        }
      }
      // never send English back for a line this person only reverse-translates
      const fresh = [...new Set(applied)].map(id => {
        const l = rows[id];
        return taskFor(id, 'reverse') && l.assigned_to !== me.code && !taskFor(id, 'review')
          ? { ...l, en: null, loanwords: null, note: null, check_note: null, original_translation: null, hidden_en: true } : l;
      });
      return json(200, { applied: [...new Set(applied)], rejected, lines: fresh, tasks: touchedTasks });
    }

    return json(405, { error: 'method_not_allowed' });
  } catch (e) {
    console.error('chitonga', e && e.message);
    return json(e && e.message === 'not_configured' ? 503 : 500, { error: e && e.message === 'not_configured' ? 'not_configured' : 'server_error' });
  }
};
