// Export the Chitonga working copy as xlsx via Drive (the Sheets API is not enabled on the service account's project).
//   node export.mjs <out.xlsx>
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { JWT } = require('google-auth-library')
const env = {}
for (const l of fs.readFileSync(process.env.CHITONGA_ENV || '.env.local', 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
const key = JSON.parse(Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'))
const jwt = new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/drive'], subject: 'chris@zamai.pro' })
const { token } = await jwt.getAccessToken()
const ID = '1-ITD1PiHm5DFLkGXqjRACvHe5M5DySdyBPyzaDDhqlU'
const r = await fetch(`https://www.googleapis.com/drive/v3/files/${ID}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, { headers: { Authorization: 'Bearer ' + token } })
if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 300))
fs.writeFileSync(process.argv[2], Buffer.from(await r.arrayBuffer()))
console.log('saved', process.argv[2])
