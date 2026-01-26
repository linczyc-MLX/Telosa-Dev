# Telosa P4P - Strategic Planning Document Repository

A secure, cloud-based document repository system for the Telosa P4P strategic planning and analysis work group. Built with Hono framework and deployed on Cloudflare Pages with edge computing capabilities.

## Project Overview

**Goal**: Provide a centralized, secure platform for sharing and managing strategic planning documents, reports, and spreadsheets within the Telosa P4P work group.

**Tech Stack**:
- **Backend**: Hono (lightweight web framework for Cloudflare Workers)
- **Frontend**: Vanilla JavaScript with TailwindCSS and Font Awesome
- **Database**: Cloudflare D1 (SQLite) for metadata and user management
- **Storage**: Cloudflare R2 (S3-compatible) for document files
- **Authentication**: JWT-based secure login system
- **Deployment**: Cloudflare Pages (global edge network)

## Features

### ✅ Currently Completed Features

1. **Secure Authentication System**
   - JWT-based authentication
   - Password hashing with SHA-256
   - Role-based access control (Admin/Member)
   - Secure session management

2. **User Management**
   - User registration and login
   - Admin and member roles
   - User profile management
   - Activity tracking

3. **Document Repository**
   - Upload reports and spreadsheets
   - Download documents securely
   - Document categorization (Reports, Spreadsheets, Other)
   - File metadata management
   - Download tracking

4. **Access Control**
   - Public/Private document settings
   - Selective sharing with specific users
   - Admin override capabilities
   - Document ownership tracking

5. **Activity Logging**
   - Track all user actions (upload, download, delete, share, login)
   - Admin activity dashboard
   - User-specific activity history

6. **Responsive UI**
   - Modern, clean interface with TailwindCSS
   - Dashboard with statistics
   - Document search and filtering
   - Mobile-responsive design

## Functional Entry URIs

### Public Endpoints
- **GET /** - Main application UI
- **GET /static/app.js** - Frontend JavaScript application
- **GET /api/init-db** - Initialize database (first-time setup only)

### Authentication Endpoints
- **POST /api/auth/login** - User login
  - Body: `{ "email": "user@example.com", "password": "password" }`
  - Returns: `{ "success": true, "token": "jwt-token", "user": {...} }`

- **POST /api/auth/register** - User registration
  - Body: `{ "email": "user@example.com", "password": "password", "name": "Full Name" }`
  - Returns: `{ "success": true, "userId": 1 }`

### Document Management Endpoints (Requires Authentication)
- **GET /api/documents** - List all accessible documents
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ "documents": [...] }`

- **POST /api/documents/upload** - Upload new document
  - Headers: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
  - Body: FormData with `file`, `title`, `description`, `fileType`, `isPublic`
  - Returns: `{ "success": true, "documentId": 1, "fileKey": "..." }`

- **GET /api/documents/:id/download** - Download document
  - Headers: `Authorization: Bearer <token>`
  - Returns: File binary with appropriate content-type

- **DELETE /api/documents/:id** - Delete document (owner/admin only)
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ "success": true }`

### Sharing Endpoints (Requires Authentication)
- **POST /api/documents/:id/share** - Share document with user
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "userId": 2 }`
  - Returns: `{ "success": true }`

### Admin Endpoints (Requires Admin Role)
- **GET /api/users** - List all users
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ "users": [...] }`

### Activity Endpoints (Requires Authentication)
- **GET /api/activity** - Get activity log
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ "activities": [...] }`

### External Database Integration
- **POST /api/external/query** - Connect to IONOS VPS database (Admin only)
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "query": "SQL query", "params": [] }`
  - Note: Requires IONOS API endpoint configuration

## Data Architecture

### Data Models

1. **Users Table**
   - id (INTEGER, PRIMARY KEY)
   - email (TEXT, UNIQUE)
   - password_hash (TEXT)
   - name (TEXT)
   - role (TEXT: 'admin' or 'member')
   - created_at (DATETIME)
   - last_login (DATETIME)

2. **Documents Table**
   - id (INTEGER, PRIMARY KEY)
   - title (TEXT)
   - description (TEXT)
   - filename (TEXT)
   - file_key (TEXT) - R2 storage key
   - file_type (TEXT: 'report', 'spreadsheet', 'other')
   - mime_type (TEXT)
   - file_size (INTEGER)
   - uploaded_by (INTEGER, FOREIGN KEY)
   - uploaded_at (DATETIME)
   - updated_at (DATETIME)
   - is_public (INTEGER: 0 or 1)
   - download_count (INTEGER)

3. **Document Access Table**
   - id (INTEGER, PRIMARY KEY)
   - document_id (INTEGER, FOREIGN KEY)
   - user_id (INTEGER, FOREIGN KEY)
   - granted_by (INTEGER, FOREIGN KEY)
   - granted_at (DATETIME)

4. **Activity Log Table**
   - id (INTEGER, PRIMARY KEY)
   - user_id (INTEGER, FOREIGN KEY)
   - action (TEXT)
   - document_id (INTEGER, FOREIGN KEY)
   - details (TEXT)
   - ip_address (TEXT)
   - created_at (DATETIME)

### Storage Services

- **Cloudflare D1**: SQLite-based database for storing user accounts, document metadata, access control, and activity logs
- **Cloudflare R2**: S3-compatible object storage for storing actual document files
- **IONOS VPS Database**: External database (to be configured) for additional data sources

### Data Flow

1. **Document Upload**: File → R2 Storage, Metadata → D1 Database
2. **Document Access**: Check permissions in D1 → Retrieve file from R2 → Serve to user
3. **Activity Tracking**: All actions logged to D1 activity_log table
4. **External Data**: API endpoints connect to IONOS VPS via HTTP/REST

## Demo Credentials

- **Admin Account**: 
  - Email: admin@telosap4p.com
  - Password: admin123

- **Member Account**: 
  - Email: member@telosap4p.com
  - Password: admin123

- **Analyst Account**: 
  - Email: analyst@telosap4p.com
  - Password: admin123

**⚠️ IMPORTANT: Change these passwords in production!**

## Local Development Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd webapp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Initialize the database:
```bash
# The database will be auto-created on first run
# After starting the server, visit: http://localhost:3000/api/init-db
```

5. Start local development server:
```bash
npm run dev:sandbox
# Or using PM2:
pm2 start ecosystem.config.cjs
```

6. Access the application:
```bash
# Local: http://localhost:3000
```

### Available Scripts

- `npm run build` - Build the application
- `npm run dev:sandbox` - Start local development server with D1 and R2
- `npm run clean-port` - Kill any process using port 3000
- `npm run db:reset` - Reset local database (delete and recreate)

## Cloudflare Deployment

### Prerequisites
1. Cloudflare account
2. Cloudflare API token with appropriate permissions
3. Wrangler CLI configured

### Deployment Steps

1. **Setup Cloudflare API Key**:
```bash
# Configure your Cloudflare API token
export CLOUDFLARE_API_TOKEN=your-api-token
```

2. **Create D1 Database**:
```bash
npx wrangler d1 create telosa-p4p-production
# Copy the database_id and update wrangler.jsonc
```

3. **Create R2 Bucket**:
```bash
npx wrangler r2 bucket create telosa-p4p-files
```

4. **Update wrangler.jsonc**:
```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "telosa-p4p-production",
    "database_id": "your-database-id-here"
  }]
}
```

5. **Run Database Migrations**:
```bash
npx wrangler d1 migrations apply telosa-p4p-production
```

6. **Deploy to Cloudflare Pages**:
```bash
npm run deploy
# Or manually:
npm run build
npx wrangler pages deploy dist --project-name telosa-p4p
```

7. **Initialize Production Database**:
Visit: `https://your-deployment.pages.dev/api/init-db`

## IONOS VPS Database Integration

To connect to your IONOS VPS database, you need to create an API endpoint on your IONOS server that accepts authenticated requests and executes database queries. 

### Setup Instructions

1. **Create API Endpoint on IONOS Server** (e.g., using Express.js):
```javascript
// Example Node.js API on IONOS VPS
app.post('/api/query', authenticateToken, async (req, res) => {
  const { query, params } = req.body;
  // Execute query on your database
  const result = await db.query(query, params);
  res.json({ data: result });
});
```

2. **Update Cloudflare Worker** (`src/index.tsx`):
```typescript
app.post('/api/external/query', authMiddleware, async (c) => {
  const { query, params } = await c.req.json()
  
  const response = await fetch('https://your-ionos-server.com/api/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_IONOS_API_KEY'
    },
    body: JSON.stringify({ query, params })
  })
  
  const data = await response.json()
  return c.json(data)
})
```

3. **Set Environment Variables**:
```bash
npx wrangler pages secret put IONOS_API_KEY --project-name telosa-p4p
npx wrangler pages secret put IONOS_API_URL --project-name telosa-p4p
```

## Security Considerations

1. **Password Security**: 
   - Currently using SHA-256 for password hashing
   - Consider upgrading to bcrypt for production

2. **JWT Secret**: 
   - Change the JWT secret in production
   - Store as environment variable

3. **CORS Configuration**: 
   - Review CORS settings for production use
   - Restrict allowed origins

4. **API Rate Limiting**: 
   - Implement rate limiting for authentication endpoints
   - Add request throttling

5. **File Upload Validation**: 
   - Validate file types and sizes
   - Implement virus scanning

## Features Not Yet Implemented

1. **Advanced Search**:
   - Full-text search across document content
   - Advanced filtering options
   - Tag-based organization

2. **Version Control**:
   - Document versioning
   - Revision history
   - Rollback capabilities

3. **Collaboration Features**:
   - Comments on documents
   - Real-time notifications
   - Team workspaces

4. **Enhanced Security**:
   - Two-factor authentication (2FA)
   - Single Sign-On (SSO) integration
   - Audit trail exports

5. **Analytics Dashboard**:
   - Usage statistics
   - Document insights
   - User engagement metrics

6. **Email Notifications**:
   - Document share notifications
   - Activity alerts
   - Weekly digests

7. **Bulk Operations**:
   - Bulk upload
   - Batch sharing
   - Mass deletion

8. **Mobile App**:
   - Native iOS/Android apps
   - Offline access
   - Push notifications

## Recommended Next Steps

1. **Security Hardening**:
   - Implement bcrypt for password hashing
   - Add rate limiting middleware
   - Set up proper CORS policies
   - Enable HTTPS only

2. **Database Setup**:
   - Run database migrations on production
   - Configure backup strategy
   - Set up database monitoring

3. **IONOS Integration**:
   - Create REST API on IONOS VPS
   - Configure secure authentication
   - Test data synchronization

4. **User Testing**:
   - Invite team members for beta testing
   - Gather feedback on UX
   - Identify missing features

5. **Documentation**:
   - Create user guides
   - Write API documentation
   - Document deployment procedures

6. **Monitoring & Logging**:
   - Set up error tracking (e.g., Sentry)
   - Configure performance monitoring
   - Implement log aggregation

## URLs

### Development
- **Local Sandbox**: http://localhost:3000
- **Public Sandbox URL**: https://3000-i563he16vbrn1f9bozub2-d0b9e1e2.sandbox.novita.ai

### Production (To be deployed)
- **Cloudflare Pages**: Will be available at https://telosa-p4p.pages.dev
- **Custom Domain**: Can be configured after deployment

## Support & Maintenance

- **Platform**: Cloudflare Pages/Workers
- **Status**: ✅ Active (Development)
- **Last Updated**: January 26, 2026
- **Maintained By**: Development Team

## License

Proprietary - Telosa P4P Strategic Planning Work Group

## Contact

For questions or support regarding this application, please contact the Telosa P4P administration team.

---

**Note**: This is a development version. Ensure all security recommendations are implemented before deploying to production.
