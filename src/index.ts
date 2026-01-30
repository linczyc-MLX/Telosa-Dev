import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
  // Optional external DB proxy (if you use it elsewhere)
  IONOS_API_URL?: string;
  IONOS_API_TOKEN?: string;
};

type JwtPayload = {
  sub: string; // user id
  email: string;
  name: string;
  role: 'admin' | 'member';
  exp: number; // unix seconds
  iat: number; // unix seconds
};

const app = new Hono<{ Bindings: Env; Variables: { user?: JwtPayload } }>();

/* ----------------------------- small helpers ----------------------------- */

const te = new TextEncoder();

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function hexFromBuf(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', te.encode(input));
  return hexFromBuf(buf);
}

function b64urlFromBytes(bytes: Uint8Array) {
  // btoa expects binary string
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesFromB64url(b64url: string) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    te.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(data));
  return new Uint8Array(sig);
}

async function signJwt(payload: Omit<JwtPayload, 'iat'>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = nowSec();
  const full: JwtPayload = { ...payload, iat };
  const enc = (obj: any) => b64urlFromBytes(te.encode(JSON.stringify(obj)));
  const h = enc(header);
  const p = enc(full);
  const data = `${h}.${p}`;
  const sig = await hmacSha256(secret, data);
  return `${data}.${b64urlFromBytes(sig)}`;
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = await hmacSha256(secret, data);
  const got = bytesFromB64url(s);

  // constant-time compare
  if (got.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
  if (diff !== 0) return null;

  const payloadJson = new TextDecoder().decode(bytesFromB64url(p));
  let payload: JwtPayload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }
  if (!payload?.exp || nowSec() > payload.exp) return null;
  return payload;
}

function parseCookies(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = v;
  }
  return out;
}

function setCookie(name: string, value: string, opts: { maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; path?: string } = {}) {
  const segs = [`${name}=${value}`];
  segs.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge !== undefined) segs.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) segs.push('HttpOnly');
  if (opts.secure) segs.push('Secure');
  if (opts.sameSite) segs.push(`SameSite=${opts.sameSite}`);
  return segs.join('; ');
}

function json(c: any, status: number, body: any, extraHeaders?: Record<string, string>) {
  const h = new Headers(extraHeaders);
  h.set('Content-Type', 'application/json; charset=utf-8');
  return c.newResponse(JSON.stringify(body), status, h);
}

/* ----------------------------- CORS (minimal) ---------------------------- */

app.use('/api/*', async (c, next) => {
  // Same-origin is typical for Pages; this is permissive but safe for credentials.
  const origin = c.req.header('Origin');
  const allowed = origin && (
    origin.startsWith('https://archive.telosa.dev') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost')
  );

  if (allowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    c.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Disposition, Content-Length');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }

  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

/* --------------------------- auth middleware ----------------------------- */

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;

  // Public endpoints
  if (
    path === '/api/init-db' ||
    path === '/api/auth/login' ||
    path === '/api/auth/register'
  ) {
    await next();
    return;
  }

  const auth = c.req.header('Authorization');
  const cookies = parseCookies(c.req.header('Cookie') ?? null);
  const cookieToken = cookies['telosa_token'];

  let token: string | null = null;
  if (auth?.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();
  else if (cookieToken) token = cookieToken;

  if (!token) return json(c, 401, { success: false, error: 'Unauthorized' });

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return json(c, 401, { success: false, error: 'Unauthorized' });

  c.set('user', payload);
  await next();
});

/* ------------------------------ db helpers ------------------------------- */

let tablesCache: string[] | null = null;

async function listTables(db: D1Database) {
  if (tablesCache) return tablesCache;
  const r = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
  tablesCache = (r.results as any[]).map(x => String(x.name));
  return tablesCache;
}

async function pickTable(db: D1Database, candidates: string[]) {
  const tables = await listTables(db);
  for (const c of candidates) if (tables.includes(c)) return c;
  return null;
}

type ColMap = Record<string, string>;
const colCache = new Map<string, ColMap>();

async function tableCols(db: D1Database, table: string) {
  const key = `cols:${table}`;
  const cached = colCache.get(key);
  if (cached) return cached;

  const r = await db.prepare(`PRAGMA table_info(${table})`).all();
  const names = new Set((r.results as any[]).map(x => String(x.name)));

  const has = (...cands: string[]) => cands.find(n => names.has(n)) ?? null;

  // Provide flexible mapping for likely variants
  const map: ColMap = {
    // users
    user_id: has('id', 'user_id', 'userId') ?? 'id',
    user_email: has('email', 'user_email', 'userEmail') ?? 'email',
    user_name: has('name', 'full_name', 'fullName') ?? 'name',
    user_role: has('role', 'user_role', 'userRole') ?? 'role',
    user_pass: has('password_hash', 'passwordHash', 'password') ?? 'password_hash',
    user_active: has('is_active', 'isActive', 'active') ?? 'is_active',
    // documents
    doc_id: has('id', 'doc_id', 'document_id', 'documentId') ?? 'id',
    doc_title: has('title', 'doc_title', 'document_title', 'documentTitle') ?? 'title',
    doc_desc: has('description', 'doc_description', 'document_description', 'documentDescription') ?? 'description',
    doc_type: has('file_type', 'fileType', 'type') ?? 'file_type',
    doc_key: has('file_key', 'fileKey', 'key') ?? 'file_key',
    doc_orig: has('original_name', 'originalName', 'filename', 'file_name') ?? 'original_name',
    doc_mime: has('mime_type', 'mimeType', 'content_type') ?? 'mime_type',
    doc_size: has('file_size', 'fileSize', 'size_bytes', 'size') ?? 'file_size',
    doc_uploaded_by: has('uploaded_by', 'uploadedBy', 'owner_id', 'ownerId', 'user_id', 'userId') ?? 'uploaded_by',
    doc_uploaded_at: has('uploaded_at', 'uploadedAt', 'created_at', 'createdAt') ?? 'uploaded_at',
    doc_downloads: has('downloads', 'download_count', 'downloadCount') ?? 'downloads',
    doc_public: has('is_public', 'isPublic', 'public') ?? 'is_public',
  };

  colCache.set(key, map);
  return map;
}

async function ensureInit(db: D1Database) {
  // Safe: creates tables if missing; does not overwrite existing.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      file_type TEXT NOT NULL,
      file_key TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      downloads INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS document_shares (
      document_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(document_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

async function logActivity(c: any, action: string, details?: string) {
  const user = c.get('user') as JwtPayload | undefined;
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? '';
  const ua = c.req.header('User-Agent') ?? '';
  const uid = user?.sub ? Number(user.sub) : null;

  // Use whichever activity table exists (or created via init-db)
  const activityTable = (await pickTable(c.env.DB, ['activity', 'activities'])) ?? 'activity';
  await c.env.DB.prepare(
    `INSERT INTO ${activityTable} (user_id, action, details, ip, user_agent) VALUES (?, ?, ?, ?, ?)`
  ).bind(uid, action, details ?? null, ip, ua).run();
}

/* ------------------------------- endpoints ------------------------------- */

app.get('/api/init-db', async (c) => {
  await ensureInit(c.env.DB);

  // Optional: seed an admin if none exists (non-destructive)
  const usersTable = (await pickTable(c.env.DB, ['users'])) ?? 'users';
  const cols = await tableCols(c.env.DB, usersTable);

  const count = await c.env.DB.prepare(`SELECT COUNT(1) as n FROM ${usersTable}`).all();
  const n = Number((count.results as any[])[0]?.n ?? 0);

  if (n === 0) {
    const adminEmail = 'admin@telosa.dev';
    const adminPass = 'admin123';
    const passHash = await sha256Hex(adminPass);
    await c.env.DB.prepare(
      `INSERT INTO ${usersTable} (${cols.user_email}, ${cols.user_name}, ${cols.user_role}, ${cols.user_pass}, ${cols.user_active})
       VALUES (?, ?, ?, ?, 1)`
    ).bind(adminEmail, 'Admin User', 'admin', passHash).run();
  }

  return json(c, 200, { success: true });
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email ?? '').trim();
  const password = String(body?.password ?? '');

  if (!email || !password) return json(c, 400, { success: false, error: 'Missing email/password' });

  const usersTable = (await pickTable(c.env.DB, ['users'])) ?? 'users';
  const cols = await tableCols(c.env.DB, usersTable);

  const row = await c.env.DB.prepare(
    `SELECT * FROM ${usersTable} WHERE lower(${cols.user_email}) = lower(?) LIMIT 1`
  ).bind(email).first();

  if (!row) return json(c, 401, { success: false, error: 'Invalid credentials' });

  const storedHash = String((row as any)[cols.user_pass] ?? '');
  const activeVal = (row as any)[cols.user_active];
  const isActive = activeVal === undefined ? 1 : Number(activeVal);

  if (!isActive) return json(c, 403, { success: false, error: 'Account disabled' });

  const passHash = await sha256Hex(password);
  if (!storedHash || storedHash !== passHash) return json(c, 401, { success: false, error: 'Invalid credentials' });

  const roleRaw = String((row as any)[cols.user_role] ?? 'member').toLowerCase();
  const role = (roleRaw === 'admin') ? 'admin' : 'member';

  const payload: Omit<JwtPayload, 'iat'> = {
    sub: String((row as any)[cols.user_id]),
    email: String((row as any)[cols.user_email]),
    name: String((row as any)[cols.user_name]),
    role,
    exp: nowSec() + 60 * 60 * 24 * 7, // 7 days
  };

  const token = await signJwt(payload, c.env.JWT_SECRET);

  // Critical fix: set HttpOnly cookie so PDFs can be opened directly (no blob auth fetch)
  c.header('Set-Cookie', setCookie('telosa_token', token, { maxAge: 60 * 60 * 24 * 7, httpOnly: true, secure: true, sameSite: 'Lax', path: '/' }));

  await logActivity(c, 'login', `email=${email}`);

  return json(c, 200, {
    success: true,
    token,
    user: { id: payload.sub, email: payload.email, name: payload.name, role: payload.role },
  });
});

app.post('/api/auth/logout', async (c) => {
  c.header('Set-Cookie', setCookie('telosa_token', '', { maxAge: 0, httpOnly: true, secure: true, sameSite: 'Lax', path: '/' }));
  await logActivity(c, 'logout');
  return json(c, 200, { success: true });
});

function parseRange(rangeHeader: string | null, totalSize: number) {
  if (!rangeHeader) return null;
  const m = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader.trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : (totalSize - 1);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start < 0 || end < start || start >= totalSize) return null;
  return { start, end };
}

async function canAccessDocument(c: any, docId: number) {
  const user = c.get('user') as JwtPayload;
  const isAdmin = user.role === 'admin';

  const docsTable = (await pickTable(c.env.DB, ['documents'])) ?? 'documents';
  const sharesTable = await pickTable(c.env.DB, ['document_shares', 'documentShares', 'shares']) ?? 'document_shares';
  const cols = await tableCols(c.env.DB, docsTable);

  const doc = await c.env.DB.prepare(
    `SELECT * FROM ${docsTable} WHERE ${cols.doc_id} = ? LIMIT 1`
  ).bind(docId).first();

  if (!doc) return { ok: false as const, doc: null };

  if (isAdmin) return { ok: true as const, doc };

  const isPublic = Number((doc as any)[cols.doc_public] ?? 0) === 1;
  const ownerId = Number((doc as any)[cols.doc_uploaded_by] ?? -1);
  if (isPublic || ownerId === Number(user.sub)) return { ok: true as const, doc };

  // Shared?
  const shared = await c.env.DB.prepare(
    `SELECT 1 FROM ${sharesTable} WHERE document_id = ? AND user_id = ? LIMIT 1`
  ).bind(docId, Number(user.sub)).first();

  if (shared) return { ok: true as const, doc };
  return { ok: false as const, doc };
}

app.get('/api/documents', async (c) => {
  const user = c.get('user') as JwtPayload;
  const isAdmin = user.role === 'admin';

  const docsTable = (await pickTable(c.env.DB, ['documents'])) ?? 'documents';
  const sharesTable = await pickTable(c.env.DB, ['document_shares', 'documentShares', 'shares']) ?? 'document_shares';
  const cols = await tableCols(c.env.DB, docsTable);

  let sql = `SELECT * FROM ${docsTable}`;
  const binds: any[] = [];

  if (!isAdmin) {
    sql += ` WHERE (${cols.doc_public} = 1) OR (${cols.doc_uploaded_by} = ?) OR (${cols.doc_id} IN (SELECT document_id FROM ${sharesTable} WHERE user_id = ?))`;
    binds.push(Number(user.sub), Number(user.sub));
  }

  sql += ` ORDER BY ${cols.doc_uploaded_at} DESC`;

  const r = await c.env.DB.prepare(sql).bind(...binds).all();
  return json(c, 200, { documents: r.results ?? [] });
});

app.get('/api/documents/:id/view', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return json(c, 400, { success: false, error: 'Bad id' });

  const access = await canAccessDocument(c, id);
  if (!access.doc) return json(c, 404, { success: false, error: 'Not found' });
  if (!access.ok) return json(c, 403, { success: false, error: 'Forbidden' });

  const docsTable = (await pickTable(c.env.DB, ['documents'])) ?? 'documents';
  const cols = await tableCols(c.env.DB, docsTable);

  const key = String((access.doc as any)[cols.doc_key]);
  const filename = String((access.doc as any)[cols.doc_orig] ?? `document-${id}.pdf`);
  const mime = String((access.doc as any)[cols.doc_mime] ?? 'application/pdf');

  const obj = await c.env.BUCKET.get(key);
  if (!obj) return json(c, 404, { success: false, error: 'File missing' });

  const totalSize = obj.size;
  const range = parseRange(c.req.header('Range') ?? null, totalSize);

  const headers = new Headers();
  headers.set('Content-Type', mime);
  headers.set('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=0, must-revalidate');

  // IMPORTANT: Range support => fast render + reliable seek on Chrome/Safari/Firefox/iPad
  if (range) {
    const len = range.end - range.start + 1;
    const partial = await c.env.BUCKET.get(key, { range: { offset: range.start, length: len } });
    if (!partial?.body) return json(c, 500, { success: false, error: 'Range read failed' });

    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${totalSize}`);
    headers.set('Content-Length', String(len));

    return new Response(partial.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(totalSize));
  await logActivity(c, 'view_document', `document_id=${id}`);
  return new Response(obj.body, { status: 200, headers });
});

app.get('/api/documents/:id/download', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return json(c, 400, { success: false, error: 'Bad id' });

  const access = await canAccessDocument(c, id);
  if (!access.doc) return json(c, 404, { success: false, error: 'Not found' });
  if (!access.ok) return json(c, 403, { success: false, error: 'Forbidden' });

  const docsTable = (await pickTable(c.env.DB, ['documents'])) ?? 'documents';
  const cols = await tableCols(c.env.DB, docsTable);

  const key = String((access.doc as any)[cols.doc_key]);
  const filename = String((access.doc as any)[cols.doc_orig] ?? `document-${id}`);
  const mime = String((access.doc as any)[cols.doc_mime] ?? 'application/octet-stream');

  const obj = await c.env.BUCKET.get(key);
  if (!obj) return json(c, 404, { success: false, error: 'File missing' });

  const headers = new Headers();
  headers.set('Content-Type', mime);
  headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=0, must-revalidate');

  // Support range on downloads too
  const totalSize = obj.size;
  const range = parseRange(c.req.header('Range') ?? null, totalSize);
  if (range) {
    const len = range.end - range.start + 1;
    const partial = await c.env.BUCKET.get(key, { range: { offset: range.start, length: len } });
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${totalSize}`);
    headers.set('Content-Length', String(len));
    await logActivity(c, 'download_document', `document_id=${id} range=${range.start}-${range.end}`);
    return new Response(partial?.body ?? null, { status: 206, headers });
  }

  headers.set('Content-Length', String(totalSize));
  await logActivity(c, 'download_document', `document_id=${id}`);
  return new Response(obj.body, { status: 200, headers });
});

export default app;
