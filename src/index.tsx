import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { jwt, sign } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  FILES: R2Bucket
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

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// JWT middleware for protected routes
const authMiddleware = jwt({
  secret: JWT_SECRET,
  alg: 'HS256',
})

// Helper to get user from JWT payload
function getUser(c: any) {
  const payload = c.get('jwtPayload')
  return { id: payload.id, email: payload.email, role: payload.role }
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

// ============================================
// Database Initialization
// ============================================
app.get('/api/init-db', async (c) => {
  try {
    // Drop all tables first to ensure clean state
    await c.env.DB.prepare('DROP TABLE IF EXISTS activity_log').run()
    await c.env.DB.prepare('DROP TABLE IF EXISTS document_access').run()
    await c.env.DB.prepare('DROP TABLE IF EXISTS documents').run()
    await c.env.DB.prepare('DROP TABLE IF EXISTS users').run()

    // Create tables one by one
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'member',
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
        file_key TEXT NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        uploaded_by INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_public INTEGER DEFAULT 0,
        download_count INTEGER DEFAULT 0,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `).run()

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS document_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        granted_by INTEGER NOT NULL,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id),
        UNIQUE(document_id, user_id)
      )
    `).run()

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        document_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
      )
    `).run()

    // Create indexes
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)').run()
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type)').run()
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_document_access_document ON document_access(document_id)').run()
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_document_access_user ON document_access(user_id)').run()
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)').run()
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activity_log_document ON activity_log(document_id)').run()
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)').run()

    // Insert default users
    const adminHash = await hashPassword('admin123')
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).bind(1, 'admin@telosap4p.com', adminHash, 'Admin User', 'admin').run()

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).bind(2, 'member@telosap4p.com', adminHash, 'John Doe', 'member').run()

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).bind(3, 'analyst@telosap4p.com', adminHash, 'Jane Smith', 'member').run()

    return c.json({ success: true, message: 'Database initialized successfully', hash: adminHash })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// ============================================
// API Routes - Authentication
// ============================================
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  
  const passwordHash = await hashPassword(password)
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE email = ? AND password_hash = ?'
  ).bind(email, passwordHash).first()

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
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
  ).bind(email, passwordHash, name, 'member').run()

  return c.json({ success: true, userId: result.meta.last_row_id })
})

// ============================================
// API Routes - Documents
// ============================================
app.get('/api/documents', authMiddleware, async (c) => {
  const user = getUser(c)
  
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
    ORDER BY d.uploaded_at DESC
  `).bind(user.id, user.id, user.role).all()

  return c.json({ documents: documents.results })
})

app.post('/api/documents/upload', authMiddleware, async (c) => {
  try {
    const user = getUser(c)
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
  const user = getUser(c)
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
                    document.has_access > 0 || 
                    user.role === 'admin'

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

app.delete('/api/documents/:id', authMiddleware, async (c) => {
  const user = getUser(c)
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

// ============================================
// API Routes - Document Sharing
// ============================================
app.post('/api/documents/:id/share', authMiddleware, async (c) => {
  const user = getUser(c)
  const documentId = c.req.param('id')
  const { userId } = await c.req.json()

  const document = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ?'
  ).bind(documentId).first()

  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }

  // Only owner or admin can share
  if (document.uploaded_by !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Access denied' }, 403)
  }

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

// ============================================
// API Routes - Users (Admin only)
// ============================================
app.get('/api/users', authMiddleware, async (c) => {
  const user = getUser(c)
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const users = await c.env.DB.prepare(
    'SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at DESC'
  ).all()

  return c.json({ users: users.results })
})

// ============================================
// API Routes - Activity Log
// ============================================
app.get('/api/activity', authMiddleware, async (c) => {
  const user = getUser(c)
  
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

// ============================================
// API Routes - IONOS VPS Database Integration
// ============================================
// Example endpoint to connect to external database
app.post('/api/external/query', authMiddleware, async (c) => {
  const user = getUser(c)
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const { query, params } = await c.req.json()

  // This is where you would connect to your IONOS VPS database
  // You'll need to create an API endpoint on your IONOS server
  // that accepts authenticated requests and executes queries
  
  // Example:
  // const response = await fetch('https://your-ionos-server.com/api/query', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': 'Bearer YOUR_IONOS_API_KEY'
  //   },
  //   body: JSON.stringify({ query, params })
  // })
  
  return c.json({ 
    message: 'External database integration endpoint',
    note: 'Configure your IONOS VPS API endpoint here'
  })
})

// ============================================
// Frontend Routes
// ============================================
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
