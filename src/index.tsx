import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  FILES: R2Bucket
  POSTMARK_SERVER_TOKEN?: string
  POSTMARK_FROM_EMAIL?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// JWT Secret (In production, use environment variable)
const JWT_SECRET = 'telosa-p4p-secret-key-change-in-production'

// Enable CORS with proper configuration
app.use('/api/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}))

// Serve app.js and style.css with redirects (for Vite build)
app.get('/static/app.js', async (c) => {
  return c.redirect('/app.js', 301)
})
app.get('/static/style.css', async (c) => {
  return c.redirect('/style.css', 301)
})

// JWT middleware for protected routes
const authMiddleware = jwt({
  secret: JWT_SECRET,
  alg: 'HS256',
})

// Helper to get user from JWT payload (then refresh from DB so role/flags changes apply immediately)
async function getUser(c: any) {
  const payload = c.get('jwtPayload')
  if (!payload?.id) return null

  try {
    const dbUser: any = await c.env.DB.prepare(
      'SELECT id, email, name, role, can_view_all, force_password_reset FROM users WHERE id = ?'
    ).bind(payload.id).first()

    if (!dbUser) {
      // Fallback to token payload if DB lookup fails (should be rare)
      return {
        id: payload.id,
        email: payload.email,
        name: payload.email,
        role: payload.role,
        can_view_all: 0,
        force_password_reset: 0
      }
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      can_view_all: dbUser.can_view_all === 1,
      force_password_reset: dbUser.force_password_reset === 1
    }
  } catch (err) {
    console.error('Failed to refresh user from DB:', err)
    return {
      id: payload.id,
      email: payload.email,
      name: payload.email,
      role: payload.role,
      can_view_all: 0,
      force_password_reset: 0
    }
  }
}

// Simple password hashing (In production, use bcrypt)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ==================================================
// Database Initialization
// ==================================================
app.get('/api/init-db', async (c) => {
  try {
    // Determine whether this is a brand-new DB
    const usersTable: any = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).first()
    const isFreshDb = !usersTable

    // Helper: add columns safely (SQLite has no IF NOT EXISTS for columns)
    const ensureColumn = async (table: string, column: string, definition: string) => {
      try {
        await c.env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
      } catch (_) {
        // Ignore "duplicate column name" errors
      }
    }

    // Core tables (idempotent)
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        can_view_all INTEGER NOT NULL DEFAULT 0,
        force_password_reset INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `).run()

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        is_public INTEGER DEFAULT 0,
        uploaded_by INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        download_count INTEGER DEFAULT 0,
        r2_key TEXT NOT NULL,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `).run()

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS document_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        user_id INTEGER,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        granted_by INTEGER,
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (granted_by) REFERENCES users(id),
        UNIQUE(document_id, user_id)
      )
    `).run()

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        document_id INTEGER,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (document_id) REFERENCES documents(id)
      )
    `).run()

    // Invite / password-set tokens (used for first-time access + password reset)
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS user_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL DEFAULT 'invite', -- 'invite' | 'reset'
        expires_at DATETIME NOT NULL,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `).run()

    // If this DB existed before these features, add missing columns safely
    await ensureColumn('users', 'can_view_all', 'INTEGER NOT NULL DEFAULT 0')
    await ensureColumn('users', 'force_password_reset', 'INTEGER NOT NULL DEFAULT 0')

    // Seed demo users only on a brand-new DB (or if empty)
    const userCountRow: any = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first()
    const userCount = Number(userCountRow?.count || 0)

    if (isFreshDb || userCount === 0) {
      const adminPasswordHash = await hashPassword('admin123')
      const memberPasswordHash = await hashPassword('admin123')

      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO users (email, password_hash, name, role)
        VALUES (?, ?, ?, ?)
      `).bind('admin@telosap4p.com', adminPasswordHash, 'Admin User', 'admin').run()

      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO users (email, password_hash, name, role)
        VALUES (?, ?, ?, ?)
      `).bind('member@telosap4p.com', memberPasswordHash, 'Member User', 'member').run()
    }

    return c.json({
      success: true,
      message: isFreshDb ? 'Database initialized successfully' : 'Database verified/updated successfully'
    })
  } catch (error) {
    console.error('Database init error:', error)
    return c.json({ error: 'Database initialization failed' }, 500)
  }
})


// ==================================================
// API Routes – Authentication
// ==================================================
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()

  const passwordHash = await hashPassword(password)
  // Search by email OR name to allow flexible login
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE (email = ? OR name = ?) AND password_hash = ?'
  ).bind(email, email, passwordHash).first()

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // Update last login
  await c.env.DB.prepare(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(user.id).run()

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'login', `User logged in from ${c.req.header('cf-connecting-ip') || 'unknown'}`).run()

  // Create JWT token
  const token = await sign({
    id: user.id,
    email: user.email,
    role: user.role
  }, JWT_SECRET, 'HS256')

  return c.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
})

app.post('/api/auth/register', async (c) => {
  const { email, password, name } = await c.req.json()

  // Check if user already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first()

  if (existing) {
    return c.json({ error: 'Email already registered' }, 400)
  }

  const passwordHash = await hashPassword(password)

  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, role, can_view_all) VALUES (?, ?, ?, ?, ?)'
  ).bind(email, passwordHash, name, 'member').run()

  return c.json({ success: true, userId: result.meta.last_row_id })
})


// Set password via invite/reset token
app.post('/api/auth/set-password', async (c) => {
  try {
    const { token, password } = await c.req.json()

    const cleanToken = (token || '').toString().trim()
    const newPassword = (password || '').toString()

    if (!cleanToken) return c.json({ error: 'Token is required' }, 400)
    if (newPassword.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

    const row: any = await c.env.DB.prepare(`
      SELECT ui.id as invite_id, ui.user_id, ui.expires_at, ui.used_at, u.email
      FROM user_invites ui
      JOIN users u ON u.id = ui.user_id
      WHERE ui.token = ?
    `).bind(cleanToken).first()

    if (!row) return c.json({ error: 'Invalid or expired link' }, 400)
    if (row.used_at) return c.json({ error: 'This link has already been used' }, 400)

    const expiresAt = new Date(row.expires_at)
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return c.json({ error: 'This link has expired' }, 400)
    }

    const passwordHash = await hashPassword(newPassword)

    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, force_password_reset = 0 WHERE id = ?'
    ).bind(passwordHash, row.user_id).run()

    await c.env.DB.prepare(
      "UPDATE user_invites SET used_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(row.invite_id).run()

    // Log activity
    await c.env.DB.prepare(`
      INSERT INTO activity_log (user_id, action, document_id, details, ip_address, user_agent)
      VALUES (?, ?, NULL, ?, ?, ?)
    `).bind(
      row.user_id,
      'set_password',
      JSON.stringify({ via: 'invite_token' }),
      c.req.header('CF-Connecting-IP') || '',
      c.req.header('User-Agent') || ''
    ).run()

    return c.json({ success: true })
  } catch (error) {
    console.error('Set password error:', error)
    return c.json({ error: 'Failed to set password' }, 500)
  }
})


// ==================================================
// API Routes – Documents
// ==================================================
app.get('/api/documents', authMiddleware, async (c) => {
  const user = await getUser(c)

  // Get all documents the user can access
  const documents = await c.env.DB.prepare(`
    SELECT DISTINCT d.*, u.name as uploader_name
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    LEFT JOIN document_access da ON d.id = da.document_id
    WHERE d.is_public = 1
       OR d.uploaded_by = ?
       OR da.user_id = ?
       OR ? = 'admin'
       OR ? = 1
    ORDER BY d.uploaded_at DESC
  `).bind(user.id, user.id, user.role, user.can_view_all ? 1 : 0).all()

  return c.json({ documents: documents.results })
})

app.post('/api/documents/upload', authMiddleware, async (c) => {
  try {
    const user = await getUser(c)
    const formData = await c.req.formData()

    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const fileType = formData.get('fileType') as string
    const isPublic = formData.get('isPublic') === 'true'

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Generate unique file key
    const fileKey = `uploads/${Date.now()}-${file.name}`

    // Upload to R2
    await c.env.FILES.put(fileKey, file.stream(), {
      httpMetadata: {
        contentType: file.type
      }
    })

    // Save metadata to database
    const result = await c.env.DB.prepare(`
      INSERT INTO documents (title, description, filename, file_key, file_type, mime_type, file_size, uploaded_by, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      title || file.name,
      description || '',
      file.name,
      fileKey,
      fileType || 'other',
      file.type,
      file.size,
      user.id,
      isPublic ? 1 : 0
    ).run()

    // Log activity
    await c.env.DB.prepare(
      'INSERT INTO activity_log (user_id, action, document_id, details) VALUES (?, ?, ?, ?)'
    ).bind(user.id, 'upload', result.meta.last_row_id, `Uploaded ${file.name}`).run()

    return c.json({
      success: true,
      documentId: result.meta.last_row_id,
      fileKey: fileKey
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return c.json({ error: error.message || 'Upload failed' }, 500)
  }
})

app.get('/api/documents/:id/download', authMiddleware, async (c) => {
  const user = await getUser(c)
  const documentId = c.req.param('id')

  // Check access permissions
  const document = await c.env.DB.prepare(`
    SELECT d.*,
           (SELECT COUNT(*) FROM document_access WHERE document_id = d.id AND user_id = ?) as has_access
    FROM documents d
    WHERE d.id = ?
  `).bind(user.id, documentId).first()

  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }

  // Check if user has access
  const canAccess = document.is_public === 1 ||
                    document.uploaded_by === user.id ||
                    \1                    user.role === 'admin' ||
                    user.can_view_all

  if (!canAccess) {
    return c.json({ error: 'Access denied' }, 403)
  }

  // Get file from R2
  const file = await c.env.FILES.get(document.file_key as string)
  if (!file) {
    return c.json({ error: 'File not found in storage' }, 404)
  }

  // Update download count
  await c.env.DB.prepare(
    'UPDATE documents SET download_count = download_count + 1 WHERE id = ?'
  ).bind(documentId).run()

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, document_id, details) VALUES (?, ?, ?, ?)'
  ).bind(user.id, 'download', documentId, `Downloaded ${document.filename}`).run()

  return new Response(file.body, {
    headers: {
      'Content-Type': document.mime_type as string || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${document.filename}"`,
      'Content-Length': file.size.toString()
    }
  })
})

app.get('/api/documents/:id/view', authMiddleware, async (c) => {
  const user = await getUser(c)
  const documentId = c.req.param('id')

  // Check access permissions
  const document = await c.env.DB.prepare(`
    SELECT d.*,
           (SELECT COUNT(*) FROM document_access WHERE document_id = d.id AND user_id = ?) as has_access
    FROM documents d
    WHERE d.id = ?
  `).bind(user.id, documentId).first()

  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }

  // Check if user has access
  const canAccess = document.is_public === 1 ||
                    document.uploaded_by === user.id ||
                    \1                    user.role === 'admin' ||
                    user.can_view_all

  if (!canAccess) {
    return c.json({ error: 'Access denied' }, 403)
  }

  // Get file from R2
  const file = await c.env.FILES.get(document.file_key as string)
  if (!file) {
    return c.json({ error: 'File not found in storage' }, 404)
  }

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, document_id, details) VALUES (?, ?, ?, ?)'
  ).bind(user.id, 'view', documentId, `Viewed ${document.filename}`).run()

  // Return file with inline content disposition to display in browser
  return new Response(file.body, {
    headers: {
      'Content-Type': document.mime_type as string || 'application/pdf',
      'Content-Disposition': `inline; filename="${document.filename}"`,
      'Content-Length': file.size.toString()
    }
  })
})

app.delete('/api/documents/:id', authMiddleware, async (c) => {
  const user = await getUser(c)
  const documentId = c.req.param('id')

  const document = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ?'
  ).bind(documentId).first()

  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }

  // Only owner or admin can delete
  if (document.uploaded_by !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Access denied' }, 403)
  }

  // Delete from R2
  await c.env.FILES.delete(document.file_key as string)

  // Delete from database
  await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(documentId).run()

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'delete', `Deleted ${document.filename}`).run()

  return c.json({ success: true })
})

// ==================================================
// API Routes – Document Sharing
// ==================================================

// Share by user ID (any authenticated user can share)
app.post('/api/documents/:id/share', authMiddleware, async (c) => {
  const user = await getUser(c)
  const documentId = c.req.param('id')
  const { userId } = await c.req.json()

  const document = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ?'
  ).bind(documentId).first()

  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }

  // Anyone can share documents — no access check needed

  // Grant access
  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO document_access (document_id, user_id, granted_by) VALUES (?, ?, ?)'
  ).bind(documentId, userId, user.id).run()

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, document_id, details) VALUES (?, ?, ?, ?)'
  ).bind(user.id, 'share', documentId, `Shared with user ${userId}`).run()

  return c.json({ success: true })
})

// Share document by email (create user if necessary and send Postmark notification)
app.post('/api/documents/:id/share-by-email', authMiddleware, async (c) => {
  try {
    const user: any = await getUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const documentId = c.req.param('id')
    const body = await c.req.json()
    const email = (body?.email || '').toString().trim().toLowerCase()
    const comment = (body?.comment || '').toString().trim()

    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }

    // Get document
    const doc: any = await c.env.DB.prepare(
      'SELECT title, filename, uploaded_by FROM documents WHERE id = ?'
    ).bind(documentId).first()

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404)
    }

    // Look up recipient
    let targetUser: any = await c.env.DB.prepare(
      'SELECT id, email, name, force_password_reset FROM users WHERE email = ?'
    ).bind(email).first()

    let createdNewUser = false
    let inviteLink: string | null = null

    // If not a user, create a "pending" user and force a password set
    if (!targetUser) {
      createdNewUser = true
      const tempPassword = crypto.randomUUID()
      const tempHash = await hashPassword(tempPassword)

      const createResult: any = await c.env.DB.prepare(
        'INSERT INTO users (email, password_hash, name, role, force_password_reset, can_view_all) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(email, tempHash, email.split('@')[0] || 'User', 'member', 1, 0).run()

      const newUserId = createResult.meta.last_row_id
      targetUser = { id: newUserId, email, name: email.split('@')[0] || 'User', force_password_reset: 1 }
    }

    // Grant access (idempotent)
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO document_access (document_id, user_id, granted_by) VALUES (?, ?, ?)'
    ).bind(documentId, targetUser.id, user.id).run()

    // Create an invite token (for new users, or if they are flagged to reset)
    const needsPasswordSet = createdNewUser || targetUser.force_password_reset === 1
    if (needsPasswordSet) {
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      const type = createdNewUser ? 'invite' : 'reset'

      await c.env.DB.prepare(
        'INSERT INTO user_invites (user_id, token, type, expires_at, created_by) VALUES (?, ?, ?, ?, ?)'
      ).bind(targetUser.id, token, type, expiresAt, user.id).run()

      const origin = new URL(c.req.url).origin
      inviteLink = `${origin}/set-password?token=${encodeURIComponent(token)}`
    }

    // Log activity (include comment if provided)
    await c.env.DB.prepare(`
      INSERT INTO activity_log (user_id, action, document_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      'share',
      documentId,
      JSON.stringify({
        sharedWith: email,
        documentTitle: doc.title,
        comment: comment || null,
        invited: !!inviteLink
      }),
      c.req.header('CF-Connecting-IP') || '',
      c.req.header('User-Agent') || ''
    ).run()

    // Send Postmark email (if configured)
    const postmarkToken = c.env.POSTMARK_SERVER_TOKEN
    const fromEmail = c.env.POSTMARK_FROM_EMAIL || 'admin@telosap4p.com'
    const origin = new URL(c.req.url).origin

    if (postmarkToken) {
      const subject = 'A document has been shared with you in the Telosa P4P repository'

      const commentBlock = comment
        ? `

Message from ${user.email}:
${comment}
`
        : ''

      const accessBlock = inviteLink
        ? `

To access the repository, please set your password using this secure link (valid for 7 days):
${inviteLink}
`
        : `

You can log in at ${origin}/ to view the file.
`

      const textBody =
        `Hello,

` +
        `${user.email} has shared a document with you in the Telosa P4P repository.

` +
        `Document Title: ${doc.title}
` +
        commentBlock +
        accessBlock +
        `
– Telosa P4P Document Repository
`

      const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': postmarkToken
        },
        body: JSON.stringify({
          From: fromEmail,
          To: email,
          Subject: subject,
          TextBody: textBody,
          ReplyTo: user.email
        })
      })

      if (!postmarkResponse.ok) {
        const errorText = await postmarkResponse.text()
        console.error('Postmark send failed:', errorText)
      }
    } else {
      console.warn('POSTMARK_SERVER_TOKEN not set; skipping email send')
    }

    return c.json({
      success: true,
      message: inviteLink
        ? `Shared successfully. An invite link was emailed to ${email}.`
        : `Shared successfully. A notification email was sent to ${email}.`
    })
  } catch (error) {
    console.error('Share by email error:', error)
    return c.json({ error: 'Share failed' }, 500)
  }
})


// ==================================================
// API Routes – Users (Admin only)
// ==================================================
app.get('/api/users', authMiddleware, async (c) => {
  const user = await getUser(c)

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const users = await c.env.DB.prepare(
    'SELECT id, email, name, role, can_view_all, force_password_reset, created_at, last_login FROM users ORDER BY created_at DESC'
  ).all()

  return c.json({ users: users.results })
})

// Create new user (Admin only)
app.post('/api/users', authMiddleware, async (c) => {
  const user = await getUser(c)

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const { email, password, name, role, can_view_all } = await c.req.json()

  // Validate required fields
  if (!email || !password || !name) {
    return c.json({ error: 'Email, password, and name are required' }, 400)
  }

  // Check if user already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first()

  if (existing) {
    return c.json({ error: 'Email already registered' }, 400)
  }

  const passwordHash = await hashPassword(password)

  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, role, can_view_all) VALUES (?, ?, ?, ?, ?)'
  ).bind(email, passwordHash, name, role || 'member', can_view_all ? 1 : 0).run()

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'user_create', `Created user ${email}`).run()

  return c.json({ success: true, userId: result.meta.last_row_id })
})

// Update user (Admin only)
app.put('/api/users/:id', authMiddleware, async (c) => {
  const user = await getUser(c)
  const userId = c.req.param('id')

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const { email, name, role, password, can_view_all } = await c.req.json()

  // Check if user exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).first()

  if (!existingUser) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Check if email is already used by another user
  if (email) {
    const emailCheck = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    ).bind(email, userId).first()

    if (emailCheck) {
      return c.json({ error: 'Email already in use' }, 400)
    }
  }

  // Build update query dynamically
  const updates: string[] = []
  const bindings: any[] = []

  if (email) {
    updates.push('email = ?')
    bindings.push(email)
  }
  if (name) {
    updates.push('name = ?')
    bindings.push(name)
  }
  if (role) {
    updates.push('role = ?')
    bindings.push(role)
  }
  if (can_view_all !== undefined) {
    updates.push('can_view_all = ?')
    bindings.push(can_view_all ? 1 : 0)
  }
  if (password) {
    const passwordHash = await hashPassword(password)
    updates.push('password_hash = ?')
    bindings.push(passwordHash)
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  bindings.push(userId)

  await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...bindings).run()

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'user_update', `Updated user ${userId}`).run()

  return c.json({ success: true })
})

// Delete user (Admin only)
app.delete('/api/users/:id', authMiddleware, async (c) => {
  const user = await getUser(c)
  const userId = c.req.param('id')

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  // Prevent admin from deleting themselves
  if (parseInt(userId) === user.id) {
    return c.json({ error: 'Cannot delete your own account' }, 400)
  }

  // Check if user exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE id = ?'
  ).bind(userId).first()

  if (!existingUser) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Delete user (CASCADE will handle related records)
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'user_delete', `Deleted user ${existingUser.email}`).run()

  return c.json({ success: true })
})

// ==================================================
// API Routes – Activity Log
// ==================================================
app.get('/api/activity', authMiddleware, async (c) => {
  const user = await getUser(c)

  let query = 'SELECT al.*, u.name as user_name, d.title as document_title FROM activity_log al LEFT JOIN users u ON al.user_id = u.id LEFT JOIN documents d ON al.document_id = d.id'

  if (user.role === 'admin') {
    query += ' ORDER BY al.created_at DESC LIMIT 100'
  } else {
    query += ' WHERE al.user_id = ? ORDER BY al.created_at DESC LIMIT 50'
  }

  const stmt = user.role === 'admin'
    ? c.env.DB.prepare(query)
    : c.env.DB.prepare(query).bind(user.id)

  const logs = await stmt.all()

  return c.json({ activities: logs.results })
})

// ==================================================
// API Routes – External Database (Placeholder)
// ==================================================
app.post('/api/external/query', authMiddleware, async (c) => {
  const user = await getUser(c)

  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const { query, params } = await c.req.json()

  // Placeholder – connect to your IONOS VPS database here

  return c.json({
    message: 'External database integration endpoint',
    note: 'Configure your IONOS VPS API endpoint here'
  })
})


// Set-password landing page (invite/reset)
app.get('/set-password', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Set Password – Telosa P4P</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#f3f4f6; margin:0; }
    .wrap { max-width: 520px; margin: 64px auto; padding: 0 16px; }
    .card { background:#fff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,.08); padding: 28px; }
    h1 { font-size: 20px; margin: 0 0 6px; color:#111827; }
    p { margin: 0 0 18px; color:#4b5563; line-height: 1.5; }
    label { display:block; font-size: 12px; font-weight: 600; color:#374151; margin: 12px 0 6px; }
    input { width:100%; padding: 10px 12px; border:1px solid #d1d5db; border-radius: 10px; font-size: 14px; }
    input:focus { outline:none; border-color:#3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
    button { width:100%; margin-top: 14px; padding: 10px 12px; border: none; border-radius: 10px; background:#111827; color:#fff; font-weight: 700; cursor:pointer; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .msg { margin-top: 12px; font-size: 13px; }
    .msg.ok { color:#065f46; }
    .msg.err { color:#991b1b; }
    .link { display:block; margin-top: 14px; text-align:center; font-size: 13px; color:#1f2937; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Set your password</h1>
      <p>Create a password to access the Telosa P4P Document Repository.</p>

      <form id="form">
        <label for="pw1">New password</label>
        <input id="pw1" type="password" minlength="8" required placeholder="Minimum 8 characters" />

        <label for="pw2">Confirm password</label>
        <input id="pw2" type="password" minlength="8" required placeholder="Re-enter password" />

        <button id="btn" type="submit">Set password</button>
        <div id="msg" class="msg"></div>
      </form>

      <a class="link" href="/">Return to login</a>
    </div>
  </div>

  <script>
    const params = new URLSearchParams(location.search);
    const token = params.get('token') || '';
    const form = document.getElementById('form');
    const btn = document.getElementById('btn');
    const msg = document.getElementById('msg');

    function setMsg(text, ok) {
      msg.textContent = text;
      msg.className = 'msg ' + (ok ? 'ok' : 'err');
    }

    if (!token) {
      setMsg('Missing token. Please use the link from your email.', false);
      btn.disabled = true;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!token) return;

      const pw1 = document.getElementById('pw1').value;
      const pw2 = document.getElementById('pw2').value;

      if (pw1.length < 8) return setMsg('Password must be at least 8 characters.', false);
      if (pw1 !== pw2) return setMsg('Passwords do not match.', false);

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const res = await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: pw1 })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMsg(data.error || 'Failed to set password.', false);
          btn.disabled = false;
          btn.textContent = 'Set password';
          return;
        }

        setMsg('Password set successfully. You can now log in.', true);
        btn.textContent = 'Done';
      } catch (err) {
        setMsg('Network error. Please try again.', false);
        btn.disabled = false;
        btn.textContent = 'Set password';
      }
    });
  </script>
</body>
</html>`
  return c.html(html)
})


// ==================================================
// Frontend Routes – serve the SPA shell
// ==================================================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telosa P4P - Document Repository</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="app"></div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
