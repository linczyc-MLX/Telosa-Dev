import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'

type UserRole = 'admin' | 'member' | 'analyst'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  VIEW_LINK_SECRET?: string
  // R2 binding name varies in real projects; we support multiple common names.
  BUCKET?: R2Bucket
  R2_BUCKET?: R2Bucket
  R2?: R2Bucket

  // Optional external integration (per your docs)
  IONOS_QUERY_URL?: string
  IONOS_API_KEY?: string

  // On Cloudflare Pages, ASSETS is commonly available for static passthrough
  ASSETS?: { fetch: (req: Request) => Promise<Response> }
}

type Vars = {
  user?: {
    id: number
    email: string
    name: string
    role: UserRole
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: Vars }>()

/** ---------- Helpers ---------- **/

const jsonError = (message: string, status = 400) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function getBucket(env: Bindings): R2Bucket {
  const b = env.BUCKET || env.R2_BUCKET || env.R2
  if (!b) throw new Error('R2 bucket binding not found (expected BUCKET or R2_BUCKET or R2).')
  return b
}

function ipFromReq(req: Request): string {
  return (
    req.headers.get('CF-Connecting-IP') ||
    req.headers.get('X-Forwarded-For') ||
    req.headers.get('X-Real-IP') ||
    ''
  )
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input))
  const bytes = new Uint8Array(buf)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function sanitizeFilename(name: string): string {
  // keep it simple + safe for Content-Disposition
  return name.replace(/[^\w.\- ()[\]]+/g, '_')
}

function parseIntId(s: string | undefined): number | null {
  if (!s) return null
  const n = Number(s)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function logActivity(
  c: any,
  userId: number,
  action: string,
  documentId?: number,
  details?: string
) {
  const ip = ipFromReq(c.req.raw)
  await c.env.DB.prepare(
    `INSERT INTO activity_log (user_id, action, document_id, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(userId, action, documentId ?? null, details ?? null, ip)
    .run()
}

async function getUserFromBearer(c: any) {
  const auth = c.req.header('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  try {
    const payload: any = await verify(m[1], c.env.JWT_SECRET)
    const id = Number(payload?.id)
    if (!id) return null
    return {
      id,
      email: String(payload.email || ''),
      name: String(payload.name || ''),
      role: String(payload.role || 'member') as UserRole,
    }
  } catch {
    return null
  }
}

function requireAuth() {
  return async (c: any, next: any) => {
    const u = await getUserFromBearer(c)
    if (!u) return jsonError('Unauthorized', 401)
    c.set('user', u)
    await next()
  }
}

function requireAdmin() {
  return async (c: any, next: any) => {
    const u = c.get('user') as Vars['user']
    if (!u) return jsonError('Unauthorized', 401)
    if (u.role !== 'admin') return jsonError('Forbidden', 403)
    await next()
  }
}

async function canAccessDocument(c: any, userId: number, role: UserRole, docId: number): Promise<boolean> {
  if (role === 'admin') return true

  const doc = await c.env.DB.prepare(
    `SELECT id, uploaded_by, is_public FROM documents WHERE id = ?`
  )
    .bind(docId)
    .first<any>()

  if (!doc) return false
  if (Number(doc.is_public) === 1) return true
  if (Number(doc.uploaded_by) === userId) return true

  const access = await c.env.DB.prepare(
    `SELECT 1 FROM document_access WHERE document_id = ? AND user_id = ? LIMIT 1`
  )
    .bind(docId, userId)
    .first<any>()

  return !!access
}

async function getDocumentRow(c: any, docId: number) {
  return c.env.DB.prepare(
    `SELECT d.*, u.name as uploaded_by_name
     FROM documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.id = ?`
  )
    .bind(docId)
    .first<any>()
}

/** ---------- Signed link (view/download) ---------- **/

type SignedDocToken = {
  typ: 'doc'
  mode: 'view' | 'download'
  docId: number
  uid: number
  role: UserRole
  exp: number
}

function tokenSecret(env: Bindings): string {
  // Separate secret is best; fallback keeps deploy simpler if you forget to set it.
  return env.VIEW_LINK_SECRET || env.JWT_SECRET
}

async function makeDocLinkToken(env: Bindings, payload: Omit<SignedDocToken, 'typ'>) {
  return sign({ typ: 'doc', ...payload }, tokenSecret(env))
}

async function verifyDocLinkToken(env: Bindings, token: string): Promise<SignedDocToken | null> {
  try {
    const p: any = await verify(token, tokenSecret(env))
    if (p?.typ !== 'doc') return null
    const exp = Number(p.exp)
    if (!exp || exp < nowSec()) return null
    return {
      typ: 'doc',
      mode: p.mode,
      docId: Number(p.docId),
      uid: Number(p.uid),
      role: p.role as UserRole,
      exp,
    }
  } catch {
    return null
  }
}

function originFromReq(req: Request): string {
  return new URL(req.url).origin
}

/** ---------- Middleware ---------- **/

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Disposition'],
    maxAge: 86400,
  })
)

/** ---------- Public: health + UI passthrough ---------- **/

app.get('/api/health', (c) => c.json({ ok: true }))

/**
 * If running on Pages, let ASSETS serve static files.
 * If not, at least return a minimal HTML shell for `/`.
 */
const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Telosa P4P Document Repository</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="bg-slate-50">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`

app.get('*', async (c) => {
  const path = new URL(c.req.url).pathname

  // Let API routes be handled by the defined handlers.
  if (path.startsWith('/api/')) return c.notFound()

  // Prefer static assets if available (Cloudflare Pages)
  const assets = (c.env as any).ASSETS
  if (assets?.fetch) {
    const res = await assets.fetch(c.req.raw)
    if (res && res.status !== 404) return res
  }

  if (path === '/' || path === '/index.html') return c.html(INDEX_HTML)
  return c.notFound()
})

/** ---------- DB init (first-time setup) ---------- **/

app.get('/api/init-db', async (c) => {
  // Tables per your repo documentation :contentReference[oaicite:2]{index=2}
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT (datetime('now')),
      last_login DATETIME
    );`,
    `CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      filename TEXT NOT NULL,
      file_key TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'other',
      mime_type TEXT,
      file_size INTEGER,
      uploaded_by INTEGER,
      uploaded_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME,
      is_public INTEGER NOT NULL DEFAULT 0,
      download_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    );`,
    `CREATE TABLE IF NOT EXISTS document_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      granted_by INTEGER NOT NULL,
      granted_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(document_id) REFERENCES documents(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(granted_by) REFERENCES users(id)
    );`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      document_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(document_id) REFERENCES documents(id)
    );`,
  ]

  for (const sql of stmts) {
    await c.env.DB.exec(sql)
  }

  // Seed demo accounts (only if not exists)
  const demos = [
    { email: 'admin@telosap4p.com', name: 'Admin User', role: 'admin' as UserRole },
    { email: 'member@telosap4p.com', name: 'Member User', role: 'member' as UserRole },
    { email: 'analyst@telosap4p.com', name: 'Analyst User', role: 'analyst' as UserRole },
  ]

  const pwHash = await sha256Hex('admin123')
  for (const u of demos) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`
    )
      .bind(u.email, pwHash, u.name, u.role)
      .run()
  }

  return c.json({ success: true })
})

/** ---------- Auth ---------- **/

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.email || !body?.password) return jsonError('Missing email/password', 400)

  const email = String(body.email).toLowerCase().trim()
  const password = String(body.password)

  const user = await c.env.DB.prepare(
    `SELECT id, email, password_hash, name, role FROM users WHERE email = ?`
  )
    .bind(email)
    .first<any>()

  if (!user) return jsonError('Invalid credentials', 401)

  const hash = await sha256Hex(password)
  if (hash !== String(user.password_hash)) return jsonError('Invalid credentials', 401)

  const payload = {
    id: Number(user.id),
    email: String(user.email),
    name: String(user.name),
    role: String(user.role) as UserRole,
    exp: nowSec() + 60 * 60 * 24, // 24h
  }

  const token = await sign(payload, c.env.JWT_SECRET)

  await c.env.DB.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`)
    .bind(payload.id)
    .run()
  await logActivity(c, payload.id, 'login')

  return c.json({ success: true, token, user: { id: payload.id, email: payload.email, name: payload.name, role: payload.role } })
})

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.email || !body?.password || !body?.name) return jsonError('Missing fields', 400)

  const email = String(body.email).toLowerCase().trim()
  const password = String(body.password)
  const name = String(body.name).trim()

  const hash = await sha256Hex(password)

  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'member')`
    )
      .bind(email, hash, name)
      .run()

    const userId = Number(res.meta.last_row_id)
    await logActivity(c, userId, 'register')

    return c.json({ success: true, userId })
  } catch {
    return jsonError('User already exists', 409)
  }
})

/** ---------- Documents ---------- **/

app.get('/api/documents', requireAuth(), async (c) => {
  const u = c.get('user')!
  const rows = await c.env.DB.prepare(
    `SELECT d.id, d.title, d.description, d.filename, d.file_type, d.mime_type, d.file_size,
            d.uploaded_by, u2.name as uploaded_by_name, d.uploaded_at, d.is_public, d.download_count
     FROM documents d
     LEFT JOIN users u2 ON u2.id = d.uploaded_by
     WHERE d.is_public = 1
        OR d.uploaded_by = ?
        OR ? = 'admin'
        OR EXISTS (SELECT 1 FROM document_access a WHERE a.document_id = d.id AND a.user_id = ?)
     ORDER BY d.uploaded_at DESC`
  )
    .bind(u.id, u.role, u.id)
    .all<any>()

  return c.json({ documents: rows.results || [] })
})

app.post('/api/documents/upload', requireAuth(), async (c) => {
  const u = c.get('user')!

  const body = await c.req.parseBody()
  const file = body['file'] as File | undefined
  if (!file) return jsonError('Missing file', 400)

  const title = String(body['title'] || file.name).trim()
  const description = String(body['description'] || '').trim()
  const fileType = String(body['fileType'] || 'other').trim() // 'report' | 'spreadsheet' | 'other'
  const isPublic = String(body['isPublic'] || '0') === '1' || String(body['isPublic'] || '').toLowerCase() === 'true'

  const bucket = getBucket(c.env)
  const safeName = sanitizeFilename(file.name)
  const key = `${Date.now()}-${crypto.randomUUID()}-${safeName}`

  const buf = await file.arrayBuffer()
  await bucket.put(key, buf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })

  const res = await c.env.DB.prepare(
    `INSERT INTO documents
      (title, description, filename, file_key, file_type, mime_type, file_size, uploaded_by, is_public, uploaded_at, download_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`
  )
    .bind(
      title,
      description || null,
      safeName,
      key,
      fileType || 'other',
      file.type || null,
      buf.byteLength,
      u.id,
      isPublic ? 1 : 0
    )
    .run()

  const documentId = Number(res.meta.last_row_id)
  await logActivity(c, u.id, 'upload', documentId, `Uploaded ${safeName}`)

  return c.json({ success: true, documentId, fileKey: key })
})

app.post('/api/documents/:id/share', requireAuth(), async (c) => {
  const u = c.get('user')!
  const docId = parseIntId(c.req.param('id'))
  if (!docId) return jsonError('Invalid document id', 400)

  // owner or admin
  const doc = await c.env.DB.prepare(`SELECT uploaded_by FROM documents WHERE id = ?`)
    .bind(docId)
    .first<any>()
  if (!doc) return jsonError('Not found', 404)

  if (u.role !== 'admin' && Number(doc.uploaded_by) !== u.id) return jsonError('Forbidden', 403)

  const body = await c.req.json().catch(() => null)
  const targetUserId = Number(body?.userId)
  if (!targetUserId) return jsonError('Missing userId', 400)

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO document_access (document_id, user_id, granted_by) VALUES (?, ?, ?)`
  )
    .bind(docId, targetUserId, u.id)
    .run()

  await logActivity(c, u.id, 'share', docId, `Shared with user ${targetUserId}`)
  return c.json({ success: true })
})

app.delete('/api/documents/:id', requireAuth(), async (c) => {
  const u = c.get('user')!
  const docId = parseIntId(c.req.param('id'))
  if (!docId) return jsonError('Invalid document id', 400)

  const doc = await c.env.DB.prepare(`SELECT uploaded_by, file_key, filename FROM documents WHERE id = ?`)
    .bind(docId)
    .first<any>()
  if (!doc) return jsonError('Not found', 404)

  if (u.role !== 'admin' && Number(doc.uploaded_by) !== u.id) return jsonError('Forbidden', 403)

  const bucket = getBucket(c.env)
  await bucket.delete(String(doc.file_key))

  await c.env.DB.prepare(`DELETE FROM document_access WHERE document_id = ?`).bind(docId).run()
  await c.env.DB.prepare(`DELETE FROM documents WHERE id = ?`).bind(docId).run()

  await logActivity(c, u.id, 'delete', docId, `Deleted ${doc.filename}`)
  return c.json({ success: true })
})

/** ---------- Signed link endpoints (NEW) ---------- **/

app.get('/api/documents/:id/view-link', requireAuth(), async (c) => {
  const u = c.get('user')!
  const docId = parseIntId(c.req.param('id'))
  if (!docId) return jsonError('Invalid document id', 400)

  const ok = await canAccessDocument(c, u.id, u.role, docId)
  if (!ok) return jsonError('Forbidden', 403)

  // 5 minutes is long enough for slow mobile opens, short enough for safety.
  const token = await makeDocLinkToken(c.env, {
    mode: 'view',
    docId,
    uid: u.id,
    role: u.role,
    exp: nowSec() + 60 * 5,
  })

  const url = `${originFromReq(c.req.raw)}/api/documents/${docId}/view?t=${encodeURIComponent(token)}`
  return c.json({ url })
})

app.get('/api/documents/:id/download-link', requireAuth(), async (c) => {
  const u = c.get('user')!
  const docId = parseIntId(c.req.param('id'))
  if (!docId) return jsonError('Invalid document id', 400)

  const ok = await canAccessDocument(c, u.id, u.role, docId)
  if (!ok) return jsonError('Forbidden', 403)

  const token = await makeDocLinkToken(c.env, {
    mode: 'download',
    docId,
    uid: u.id,
    role: u.role,
    exp: nowSec() + 60 * 5,
  })

  const url = `${originFromReq(c.req.raw)}/api/documents/${docId}/download?t=${encodeURIComponent(token)}`
  return c.json({ url })
})

/** ---------- View / Download (UPDATED: supports ?t= signed token) ---------- **/

async function resolveAuthForDoc(c: any, docId: number, mode: 'view' | 'download') {
  const token = c.req.query('t')
  if (token) {
    const p = await verifyDocLinkToken(c.env, token)
    if (!p || p.docId !== docId || p.mode !== mode) return null
    return { id: p.uid, role: p.role as UserRole, via: 'signed' as const }
  }

  const u = await getUserFromBearer(c)
  if (!u) return null
  return { id: u.id, role: u.role, via: 'bearer' as const }
}

function parseRangeHeader(rangeHeader: string | null, size: number): { start: number; end: number } | null {
  if (!rangeHeader) return null
  const m = rangeHeader.match(/bytes=(\d*)-(\d*)/i)
  if (!m) return null
  let start = m[1] ? Number(m[1]) : NaN
  let end = m[2] ? Number(m[2]) : NaN

  if (Number.isNaN(start) && !Number.isNaN(end)) {
    // suffix bytes: "-500" means last 500 bytes
    const suffix = end
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else if (!Number.isNaN(start) && Number.isNaN(end)) {
    // "500-" means from 500 to end
    end = size - 1
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start < 0 || end < start || start >= size) return null
  end = Math.min(end, size - 1)
  return { start, end }
}

async function serveDocBinary(
  c: any,
  docId: number,
  disposition: 'inline' | 'attachment',
  authUserId: number,
  authRole: UserRole,
  logAction: 'view' | 'download'
) {
  const ok = await canAccessDocument(c, authUserId, authRole, docId)
  if (!ok) return jsonError('Forbidden', 403)

  const doc = await getDocumentRow(c, docId)
  if (!doc) return jsonError('Not found', 404)

  const bucket = getBucket(c.env)
  const key = String(doc.file_key)
  const head = await bucket.head(key)
  if (!head) return jsonError('File missing in storage', 500)

  const size = Number(head.size)
  const range = parseRangeHeader(c.req.header('Range') || c.req.header('range') || null, size)

  // R2 range fetch (if requested)
  let obj: R2ObjectBody | null = null
  let status = 200
  const headers = new Headers()

  headers.set('Content-Type', String(doc.mime_type || head.httpMetadata?.contentType || 'application/octet-stream'))
  headers.set('Content-Disposition', `${disposition}; filename="${sanitizeFilename(String(doc.filename || 'document'))}"`)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'private, no-store, max-age=0')

  if (range) {
    const length = range.end - range.start + 1
    obj = await bucket.get(key, { range: { offset: range.start, length } })
    if (!obj) return jsonError('File missing in storage', 500)
    status = 206
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
    headers.set('Content-Length', String(length))
  } else {
    obj = await bucket.get(key)
    if (!obj) return jsonError('File missing in storage', 500)
    headers.set('Content-Length', String(size))
  }

  // Update stats/logs
  if (logAction === 'download') {
    await c.env.DB.prepare(`UPDATE documents SET download_count = download_count + 1 WHERE id = ?`)
      .bind(docId)
      .run()
  }
  await logActivity(c, authUserId, logAction, docId)

  return new Response(obj.body, { status, headers })
}

app.get('/api/documents/:id/view', async (c) => {
  const docId = parseIntId(c.req.param('id'))
  if (!docId) return jsonError('Invalid document id', 400)

  const auth = await resolveAuthForDoc(c, docId, 'view')
  if (!auth) return jsonError('Unauthorized', 401)

  return serveDocBinary(c, docId, 'inline', auth.id, auth.role, 'view')
})

app.get('/api/documents/:id/download', async (c) => {
  const docId = parseIntId(c.req.param('id'))
  if (!docId) return jsonError('Invalid document id', 400)

  const auth = await resolveAuthForDoc(c, docId, 'download')
  if (!auth) return jsonError('Unauthorized', 401)

  return serveDocBinary(c, docId, 'attachment', auth.id, auth.role, 'download')
})

/** ---------- Users (admin) ---------- **/

app.get('/api/users', requireAuth(), requireAdmin(), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at DESC`
  ).all<any>()

  return c.json({ users: rows.results || [] })
})

/** ---------- Activity ---------- **/

app.get('/api/activity', requireAuth(), async (c) => {
  const u = c.get('user')!
  const rows =
    u.role === 'admin'
      ? await c.env.DB.prepare(
          `SELECT a.*, u.name as user_name
           FROM activity_log a
           LEFT JOIN users u ON u.id = a.user_id
           ORDER BY a.created_at DESC
           LIMIT 500`
        ).all<any>()
      : await c.env.DB.prepare(
          `SELECT a.*
           FROM activity_log a
           WHERE a.user_id = ?
           ORDER BY a.created_at DESC
           LIMIT 500`
        )
          .bind(u.id)
          .all<any>()

  return c.json({ activities: rows.results || [] })
})

/** ---------- External DB Integration (admin) ---------- **/

app.post('/api/external/query', requireAuth(), requireAdmin(), async (c) => {
  const url = c.env.IONOS_QUERY_URL
  const apiKey = c.env.IONOS_API_KEY
  if (!url || !apiKey) return jsonError('IONOS integration not configured', 501)

  const body = await c.req.json().catch(() => null)
  if (!body?.query) return jsonError('Missing query', 400)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query: body.query, params: body.params || [] }),
  })

  const data = await res.json().catch(() => ({}))
  return c.json(data, res.status)
})

export default app
