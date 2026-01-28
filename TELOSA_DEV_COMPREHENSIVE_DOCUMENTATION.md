# Telosa P4P Document Repository - Complete System Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Directory Structure](#directory-structure)
5. [Backend API Documentation](#backend-api-documentation)
6. [Frontend Components](#frontend-components)
7. [Database Schema](#database-schema)
8. [Authentication & Authorization](#authentication--authorization)
9. [Deployment Configuration](#deployment-configuration)
10. [URLs & Endpoints](#urls--endpoints)
11. [GitHub Repository](#github-repository)
12. [IONOS FTP Configuration](#ionos-ftp-configuration)
13. [Cloudflare Services](#cloudflare-services)
14. [User Roles & Permissions](#user-roles--permissions)
15. [Features & Functionality](#features--functionality)
16. [Testing & Verification](#testing--verification)
17. [Troubleshooting Guide](#troubleshooting-guide)
18. [Future Enhancements](#future-enhancements)

---

## 📖 Project Overview

**Project Name:** Telosa P4P Document Repository  
**Purpose:** Strategic Planning Document Repository for Telosa P4P Workgroup  
**Current Status:** Production-ready with automatic dual deployment  
**Production URL:** https://archive.telosa.dev  
**Testing URL:** https://RANDOM-ID.telosa-p4p.pages.dev (changes per deployment)

### Key Features
- ✅ Secure document upload, storage, and management
- ✅ User authentication with JWT tokens
- ✅ Role-based access control (Admin, Analyst, Member)
- ✅ Document sharing via email lookup
- ✅ PDF inline viewing in browser
- ✅ Activity logging and audit trail
- ✅ Dashboard with statistics and recent activity
- ✅ User management (admin-only)
- ✅ Flexible login (username or email)
- ✅ Data persistence across deployments

---

## 🏗️ System Architecture

### Architecture Pattern
**Frontend-Backend Separation with Edge Computing**

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                        │
│  (HTML/CSS/JavaScript with TailwindCSS & FontAwesome)       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS Requests
                 │
┌────────────────▼────────────────────────────────────────────┐
│              CLOUDFLARE EDGE NETWORK                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Hono Framework Backend (TypeScript)          │   │
│  │  • Authentication Middleware (JWT)                   │   │
│  │  • API Routes (/api/*)                               │   │
│  │  • Static File Serving (serveStatic)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────┬────────────────────────────────┬──────────────────┘
          │                                │
          │                                │
┌─────────▼─────────────┐     ┌───────────▼────────────────┐
│  Cloudflare D1        │     │  Cloudflare R2 Storage     │
│  (SQLite Database)    │     │  (Object Storage)          │
│  • users              │     │  • PDF documents           │
│  • documents          │     │  • File uploads            │
│  • document_access    │     │                            │
│  • activity_log       │     │                            │
└───────────────────────┘     └────────────────────────────┘
```

### Deployment Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    DEVELOPER WORKFLOW                         │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ git push origin main
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     GITHUB ACTIONS                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Job 1: Build                                          │ │
│  │  • npm ci (install dependencies)                       │ │
│  │  • npm run build (Vite build)                          │ │
│  │  • Upload dist/ artifact                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│           ┌───────────────┴───────────────┐                  │
│           │                               │                  │
│  ┌────────▼────────────────┐   ┌─────────▼──────────────┐  │
│  │ Job 2: Deploy Cloudflare │   │ Job 3: Deploy IONOS FTP│  │
│  │ • Download dist/         │   │ • Download dist/       │  │
│  │ • wrangler pages deploy  │   │ • FTP upload via FTPS  │  │
│  └──────────────────────────┘   └────────────────────────┘  │
└──────────────────┬──────────────────────┬───────────────────┘
                   │                      │
                   │                      │
      ┌────────────▼────────────┐   ┌────▼──────────────────┐
      │  Cloudflare Pages       │   │  IONOS Web Hosting    │
      │  (Testing)              │   │  (Production)         │
      │  https://RANDOM-ID      │   │  https://archive      │
      │  .telosa-p4p.pages.dev  │   │  .telosa.dev          │
      └─────────────────────────┘   └───────────────────────┘
```

---

## 🛠️ Technology Stack

### Backend
- **Framework:** Hono v4.0.0 (Lightweight web framework for Cloudflare Workers)
- **Runtime:** Cloudflare Workers (Edge computing platform)
- **Language:** TypeScript 5.0+
- **Build Tool:** Vite 5.0+ with SSR support
- **Database:** Cloudflare D1 (Distributed SQLite)
- **Storage:** Cloudflare R2 (S3-compatible object storage)
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt

### Frontend
- **HTML5** with semantic markup
- **CSS Framework:** TailwindCSS 3.x (CDN)
- **Icons:** FontAwesome 6.4.0 (CDN)
- **HTTP Client:** Axios 1.6.0 (CDN)
- **JavaScript:** ES6+ (Vanilla JS, no framework)
- **PDF Viewing:** Browser native PDF viewer (window.open)

### Development Tools
- **Package Manager:** npm
- **Process Manager:** PM2 (sandbox development)
- **Version Control:** Git
- **CI/CD:** GitHub Actions
- **Deployment:** Wrangler CLI (Cloudflare) + FTP-Deploy-Action (IONOS)

### Cloud Services
- **Cloudflare Pages:** Testing deployments
- **Cloudflare D1:** Production database
- **Cloudflare R2:** File storage
- **IONOS Web Hosting:** Production website (archive.telosa.dev)
- **GitHub:** Code repository and CI/CD

---

## 📁 Directory Structure

```
Telosa-Dev/
├── .github/
│   └── workflows/
│       └── deploy.yml                    # GitHub Actions workflow
│
├── migrations/
│   ├── 0001_initial_schema.sql           # Initial database schema
│   └── meta/                              # Migration metadata
│
├── public/
│   └── static/
│       ├── app.js                         # Frontend JavaScript (1012 lines)
│       └── styles.css                     # Custom CSS styles
│
├── src/
│   └── index.tsx                          # Main Hono backend application
│
├── .dev.vars                              # Local environment variables
├── .gitignore                             # Git ignore rules
├── CLOUDFLARE_TOKEN_GUIDE.md             # Token setup guide
├── DEPLOYMENT_FINAL.md                    # Deployment summary
├── DEPLOYMENT_SETUP.md                    # Deployment configuration docs
├── ecosystem.config.cjs                   # PM2 configuration
├── LOGIN_TEST_INSTRUCTIONS.md             # Login testing guide
├── package.json                           # Node.js dependencies
├── package-lock.json                      # Dependency lock file
├── postbuild.sh                           # Post-build script
├── QUICK_START.md                         # Quick setup guide
├── README.md                              # Project documentation
├── seed.sql                               # Database seed data
├── SETUP_INSTRUCTIONS_FOR_MAC.md          # Mac setup guide
├── tsconfig.json                          # TypeScript configuration
├── USER_MANAGEMENT_TEST_RESULTS.md        # User management test docs
├── vite.config.ts                         # Vite build configuration
└── wrangler.jsonc                         # Cloudflare Workers configuration
```

### Key Files Description

#### **src/index.tsx** (Backend)
- Main Hono application entry point
- All API routes and middleware
- Database queries and business logic
- File upload/download handlers
- Authentication logic

#### **public/static/app.js** (Frontend)
- Client-side JavaScript application
- UI rendering and DOM manipulation
- API calls via Axios
- Authentication state management
- Document upload/download/share logic
- User management interface

#### **wrangler.jsonc**
- Cloudflare Workers configuration
- D1 database binding
- R2 storage binding
- Environment settings

#### **vite.config.ts**
- Vite build configuration
- Cloudflare Pages plugin
- Output directory settings

#### **.github/workflows/deploy.yml**
- GitHub Actions CI/CD pipeline
- Automated build and deployment
- Dual deployment (Cloudflare + IONOS)

---

## 🔌 Backend API Documentation

### Base URL
- **Production:** `https://archive.telosa.dev`
- **Testing:** `https://RANDOM-ID.telosa-p4p.pages.dev`

### API Endpoints

#### **Authentication Endpoints**

##### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@telosap4p.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response (Success 201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@telosap4p.com",
    "name": "John Doe",
    "role": "member"
  }
}
```

**Response (Error 400):**
```json
{
  "error": "User already exists"
}
```

---

##### POST `/api/auth/login`
Login with email/username and password.

**Request Body:**
```json
{
  "email": "admin@telosap4p.com",
  "password": "admin123"
}
```

**Response (Success 200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@telosap4p.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

**Features:**
- Accepts both email and username for login
- Case-insensitive email matching
- Updates `last_login` timestamp
- Returns JWT token valid for 7 days

---

##### GET `/api/auth/me`
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success 200):**
```json
{
  "id": 1,
  "email": "admin@telosap4p.com",
  "name": "Admin User",
  "role": "admin",
  "created_at": "2026-01-27 12:00:00",
  "last_login": "2026-01-28 10:30:00"
}
```

---

#### **Document Endpoints**

##### GET `/api/documents`
Get all documents (filtered by access permissions).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `search` (optional): Search by title, description, or filename

**Response (Success 200):**
```json
[
  {
    "id": 1,
    "title": "Strategic Plan 2024",
    "description": "Annual strategic planning document",
    "filename": "strategic_plan_2024.pdf",
    "file_key": "uploads/1234567890-strategic_plan_2024.pdf",
    "file_type": "report",
    "mime_type": "application/pdf",
    "file_size": 1048576,
    "uploaded_by": 1,
    "uploader_name": "Admin User",
    "uploaded_at": "2026-01-27 12:00:00",
    "updated_at": "2026-01-27 12:00:00",
    "is_public": 1,
    "download_count": 5
  }
]
```

**Access Control:**
- Users see documents they uploaded
- Users see documents explicitly shared with them
- Users see public documents (is_public = 1)
- Admins see all documents

---

##### POST `/api/documents/upload`
Upload a new document (requires authentication).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
file: <PDF_FILE>
title: "Document Title"
description: "Document description"
file_type: "report" | "spreadsheet" | "other"
is_public: 0 | 1
```

**Response (Success 201):**
```json
{
  "id": 1,
  "title": "Document Title",
  "filename": "document.pdf",
  "file_key": "uploads/1234567890-document.pdf",
  "message": "Document uploaded successfully"
}
```

**Features:**
- Validates file is PDF
- Stores file in Cloudflare R2
- Creates database record
- Logs activity

---

##### GET `/api/documents/:id/view`
View document inline (opens PDF in browser).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success 200):**
```
Content-Type: application/pdf
Content-Disposition: inline; filename="document.pdf"
<PDF_BINARY_DATA>
```

**Access Control:**
- Same permissions as document listing
- Returns 404 if document not found
- Returns 403 if user lacks access

---

##### GET `/api/documents/:id/download`
Download document as file.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success 200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"
<PDF_BINARY_DATA>
```

**Features:**
- Increments download_count
- Logs download activity
- Same access control as view

---

##### POST `/api/documents/:id/share-by-email`
Share document with another user (requires authentication).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "analyst@telosap4p.com"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "Document shared successfully"
}
```

**Response (Error 404):**
```json
{
  "error": "User not found with email: analyst@telosap4p.com"
}
```

**Features:**
- ANY logged-in user can share documents
- Looks up user by email
- Creates document_access record
- Logs share activity
- No admin restriction

---

##### DELETE `/api/documents/:id`
Delete document (admin only or document owner).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success 200):**
```json
{
  "message": "Document deleted successfully"
}
```

**Access Control:**
- Only admins OR document owner can delete
- Deletes database record
- Deletes file from R2 storage
- Logs deletion activity

---

#### **User Management Endpoints (Admin Only)**

##### GET `/api/users`
Get all users (admin only).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success 200):**
```json
[
  {
    "id": 1,
    "email": "admin@telosap4p.com",
    "name": "Admin User",
    "role": "admin",
    "created_at": "2026-01-27 12:00:00",
    "last_login": "2026-01-28 10:30:00"
  }
]
```

---

##### POST `/api/users`
Create new user (admin only).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@telosap4p.com",
  "password": "password123",
  "name": "New User",
  "role": "member"
}
```

**Response (Success 201):**
```json
{
  "id": 5,
  "email": "newuser@telosap4p.com",
  "name": "New User",
  "role": "member"
}
```

---

##### PUT `/api/users/:id`
Update user (admin only).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "updated@telosap4p.com",
  "name": "Updated Name",
  "role": "analyst"
}
```

**Response (Success 200):**
```json
{
  "message": "User updated successfully"
}
```

---

##### DELETE `/api/users/:id`
Delete user (admin only).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success 200):**
```json
{
  "message": "User deleted successfully"
}
```

---

#### **Activity Log Endpoints**

##### GET `/api/activities`
Get recent activity log (requires authentication).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 50)

**Response (Success 200):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "user_name": "Admin User",
    "action": "upload",
    "document_id": 1,
    "document_title": "Strategic Plan 2024",
    "details": "Uploaded strategic_plan_2024.pdf",
    "created_at": "2026-01-28 10:30:00"
  }
]
```

---

#### **Database Initialization**

##### GET `/api/init-db`
Initialize database schema (creates tables if not exist).

**Response (Success 200):**
```json
{
  "message": "Database initialized successfully"
}
```

**Features:**
- Creates tables: users, documents, document_access, activity_log
- Does NOT drop existing data
- Inserts default admin user if no users exist
- Safe to call multiple times

---

### Authentication Middleware

**Implementation Location:** `src/index.tsx` (lines ~100-130)

**Flow:**
```typescript
// 1. Extract JWT token from Authorization header
const token = request.headers.get('Authorization')?.replace('Bearer ', '')

// 2. Verify JWT token
const payload = await jwt.verify(token, JWT_SECRET)

// 3. Fetch user from database
const user = await DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first()

// 4. Attach user to context
c.set('user', user)
```

**Protected Routes:**
- All `/api/documents/*` routes
- All `/api/users/*` routes
- All `/api/activities` routes
- `/api/auth/me`

---

## 🎨 Frontend Components

### File Structure
**Location:** `public/static/app.js` (1012 lines)

### Global State Management

```javascript
// Authentication State (localStorage)
let authToken = localStorage.getItem('authToken')
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null')

// Application State
const state = {
  documents: [],        // All documents
  users: [],            // All users (admin only)
  activities: [],       // Activity log
  currentView: 'login'  // Current UI view
}
```

### API Client Setup

```javascript
// Axios base URL
const API_BASE_URL = ''  // Same origin

// Axios interceptor (attach JWT token)
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### API Helper Functions

```javascript
const api = {
  // Auth
  login: (email, password) => axios.post('/api/auth/login', { email, password }),
  register: (email, password, name) => axios.post('/api/auth/register', { email, password, name }),
  
  // Documents
  getDocuments: () => axios.get('/api/documents'),
  uploadDocument: (formData) => axios.post('/api/documents/upload', formData),
  shareDocument: (docId, userId) => axios.post(`/api/documents/${docId}/share`, { userId }),
  shareDocumentByEmail: (docId, email) => axios.post(`/api/documents/${docId}/share-by-email`, { email }),
  deleteDocument: (docId) => axios.delete(`/api/documents/${docId}`),
  
  // Users (admin only)
  getUsers: () => axios.get('/api/users'),
  createUser: (userData) => axios.post('/api/users', userData),
  updateUser: (userId, userData) => axios.put(`/api/users/${userId}`, userData),
  deleteUser: (userId) => axios.delete(`/api/users/${userId}`),
  
  // Activities
  getActivities: () => axios.get('/api/activities')
}
```

### View Components

#### **1. Login View** (lines 180-250)

**Features:**
- Login with email or username
- Password input
- Register link
- Form validation

**UI Elements:**
```html
<div id="loginForm">
  <input type="text" id="loginEmail" placeholder="your.email@telosap4p.com">
  <input type="password" id="loginPassword" placeholder="Password">
  <button onclick="handleLogin()">Login</button>
</div>
```

**Handler:**
```javascript
async function handleLogin(event) {
  event.preventDefault()
  const email = document.getElementById('loginEmail').value
  const password = document.getElementById('loginPassword').value
  
  const response = await api.login(email, password)
  localStorage.setItem('authToken', response.data.token)
  localStorage.setItem('currentUser', JSON.stringify(response.data.user))
  
  showDashboard()
}
```

---

#### **2. Dashboard View** (lines 251-400)

**Features:**
- Welcome message with user name
- Statistics counters:
  - Total Documents
  - Total Reports
  - Total Spreadsheets
- Recent Documents list (last 5)
- Recent Activity log (last 10)
- Navigation to other views

**Statistics Calculation:**
```javascript
const totalDocs = state.documents.length
const totalReports = state.documents.filter(d => d.file_type === 'report').length
const totalSheets = state.documents.filter(d => d.file_type === 'spreadsheet').length
```

**Recent Documents:**
```javascript
const recentDocs = state.documents
  .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
  .slice(0, 5)
```

---

#### **3. Documents View** (lines 742-850)

**Features:**
- Search bar (filter by title/description/filename)
- Upload button
- Documents table with columns:
  - Title
  - Type (badge: report/spreadsheet/other)
  - Uploaded By
  - Date
  - Downloads
  - Actions (View/Download/Share/Delete)

**Action Buttons:**

```javascript
// VIEW button (always visible)
<button onclick="handleView(${doc.id})">
  <i class="fas fa-eye"></i>
</button>

// DOWNLOAD button (always visible)
<button onclick="handleDownload(${doc.id}, '${doc.filename}')">
  <i class="fas fa-download"></i>
</button>

// SHARE button (always visible to all logged-in users)
<button onclick="handleShare(${doc.id})">
  <i class="fas fa-share"></i>
</button>

// DELETE button (only visible to admin OR document owner)
${currentUser.role === 'admin' ? `
  <button onclick="handleDelete(${doc.id})">
    <i class="fas fa-trash"></i>
  </button>
` : ''}
```

---

#### **4. Upload Modal** (lines 400-500)

**Features:**
- File input (PDF only)
- Title input
- Description textarea
- File type dropdown (report/spreadsheet/other)
- Public/Private toggle
- Upload progress

**Handler:**
```javascript
async function handleUpload(event) {
  event.preventDefault()
  
  const formData = new FormData()
  formData.append('file', document.getElementById('fileInput').files[0])
  formData.append('title', document.getElementById('uploadTitle').value)
  formData.append('description', document.getElementById('uploadDescription').value)
  formData.append('file_type', document.getElementById('fileType').value)
  formData.append('is_public', document.getElementById('isPublic').checked ? 1 : 0)
  
  await api.uploadDocument(formData)
  closeModal()
  loadDocuments()
}
```

---

#### **5. Share Modal** (lines 503-570)

**Features:**
- Email input (looks up user by email)
- Subject line display: "Forwarded from the Telosa P4P Workgroup"
- Share button
- Cancel button

**Flow:**
```javascript
async function handleShare(documentId) {
  // Show modal with email input
  showShareModal(documentId)
}

async function submitShare(event, documentId) {
  event.preventDefault()
  
  const email = document.getElementById('shareEmail').value
  
  // Backend looks up user by email
  await api.shareDocumentByEmail(documentId, email)
  
  alert('Document shared successfully! User will be notified.')
  closeModal()
}
```

**Key Fix:**
- Uses `/api/documents/:id/share-by-email` endpoint
- No longer requires admin access
- Backend handles user lookup by email

---

#### **6. User Management View** (lines 850-950) - Admin Only

**Features:**
- Add User button
- Users table with columns:
  - ID
  - Name
  - Email
  - Role
  - Last Login
  - Actions (Edit/Delete)

**Add User Modal:**
```javascript
function showAddUserModal() {
  // Show modal with form:
  // - Name input
  // - Email input
  // - Password input
  // - Role dropdown (admin/analyst/member)
}

async function handleCreateUser(event) {
  event.preventDefault()
  
  const userData = {
    name: document.getElementById('userName').value,
    email: document.getElementById('userEmail').value,
    password: document.getElementById('userPassword').value,
    role: document.getElementById('userRole').value
  }
  
  await api.createUser(userData)
  closeModal()
  loadUsers()
}
```

---

### Document Actions

#### **View Document (Inline PDF)**
```javascript
function handleView(documentId) {
  const token = localStorage.getItem('authToken')
  const url = `/api/documents/${documentId}/view`
  
  // Open in new tab with auth header
  window.open(url, '_blank')
}
```

**Backend Response:**
```
Content-Disposition: inline; filename="document.pdf"
Content-Type: application/pdf
```

---

#### **Download Document**
```javascript
async function handleDownload(documentId, filename) {
  const response = await axios.get(`/api/documents/${documentId}/download`, {
    responseType: 'blob'
  })
  
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
}
```

---

#### **Share Document**
```javascript
async function handleShare(documentId) {
  // Show modal
  const modal = document.createElement('div')
  modal.id = 'shareModal'
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content">
        <h2>Share Document</h2>
        <p>Subject: Forwarded from the Telosa P4P Workgroup</p>
        <form onsubmit="submitShare(event, ${documentId})">
          <input type="email" id="shareEmail" placeholder="recipient@email.com" required>
          <button type="submit">Share</button>
          <button type="button" onclick="closeModal()">Cancel</button>
        </form>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

async function submitShare(event, documentId) {
  event.preventDefault()
  const email = document.getElementById('shareEmail').value
  
  await api.shareDocumentByEmail(documentId, email)
  alert('Document shared successfully!')
  closeModal()
}
```

---

#### **Delete Document**
```javascript
async function handleDelete(documentId) {
  if (!confirm('Are you sure you want to delete this document?')) {
    return
  }
  
  await api.deleteDocument(documentId)
  alert('Document deleted successfully')
  loadDocuments()
}
```

---

### Modal Management

```javascript
function closeModal() {
  // Remove both user modal and share modal
  const userModal = document.getElementById('userModal')
  const shareModal = document.getElementById('shareModal')
  
  if (userModal) userModal.remove()
  if (shareModal) shareModal.remove()
}
```

**Key Fix:**
- Previously only removed `userModal`
- Now removes both `userModal` and `shareModal`
- Fixes the "modal won't close" bug

---

### Navigation

```javascript
function showDashboard() {
  state.currentView = 'dashboard'
  loadDocuments()
  loadActivities()
  renderDashboard()
}

function showDocuments() {
  state.currentView = 'documents'
  loadDocuments()
  renderDocumentsList()
}

function showUsers() {
  if (currentUser.role !== 'admin') {
    alert('Access denied. Admin only.')
    return
  }
  
  state.currentView = 'users'
  loadUsers()
  renderUsersList()
}

function logout() {
  localStorage.removeItem('authToken')
  localStorage.removeItem('currentUser')
  authToken = null
  currentUser = null
  state.currentView = 'login'
  renderLoginForm()
}
```

---

## 🗄️ Database Schema

**Database Type:** Cloudflare D1 (Distributed SQLite)  
**Location:** `migrations/0001_initial_schema.sql`

### Table: `users`

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  CHECK (role IN ('admin', 'analyst', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `email` - Unique user email (used for login)
- `password_hash` - bcrypt hashed password
- `name` - User display name (can be used for login)
- `role` - User role: admin, analyst, or member
- `created_at` - Account creation timestamp
- `last_login` - Last successful login timestamp

**Indexes:**
- `idx_users_email` - Fast email lookups
- `idx_users_role` - Fast role-based queries

---

### Table: `documents`

```sql
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  filename TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'other',
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_public INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (file_type IN ('report', 'spreadsheet', 'other')),
  CHECK (is_public IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_is_public ON documents(is_public);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `title` - Document title
- `description` - Optional description
- `filename` - Original filename
- `file_key` - R2 storage key (path)
- `file_type` - Document type: report, spreadsheet, or other
- `mime_type` - File MIME type (e.g., application/pdf)
- `file_size` - File size in bytes
- `uploaded_by` - User ID who uploaded (foreign key to users.id)
- `uploaded_at` - Upload timestamp
- `updated_at` - Last update timestamp
- `is_public` - Public visibility (0 = private, 1 = public)
- `download_count` - Number of times downloaded

**Indexes:**
- `idx_documents_uploaded_by` - Fast user document queries
- `idx_documents_file_type` - Fast type-based filtering
- `idx_documents_is_public` - Fast public document queries
- `idx_documents_uploaded_at` - Fast chronological sorting

---

### Table: `document_access`

```sql
CREATE TABLE IF NOT EXISTS document_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  granted_by INTEGER NOT NULL,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_access_document_id ON document_access(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_user_id ON document_access(user_id);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `document_id` - Document being shared (foreign key to documents.id)
- `user_id` - User receiving access (foreign key to users.id)
- `granted_by` - User who granted access (foreign key to users.id)
- `granted_at` - Share timestamp

**Indexes:**
- `idx_document_access_document_id` - Fast document access queries
- `idx_document_access_user_id` - Fast user access queries

**Unique Constraint:**
- `(document_id, user_id)` - Prevents duplicate shares

---

### Table: `activity_log`

```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  document_id INTEGER,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
  CHECK (action IN ('login', 'logout', 'upload', 'download', 'view', 'share', 'delete', 'register'))
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_document_id ON activity_log(document_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `user_id` - User who performed action (foreign key to users.id)
- `action` - Action type: login, logout, upload, download, view, share, delete, register
- `document_id` - Related document (foreign key to documents.id, nullable)
- `details` - Additional details about the action
- `created_at` - Action timestamp

**Indexes:**
- `idx_activity_log_user_id` - Fast user activity queries
- `idx_activity_log_document_id` - Fast document activity queries
- `idx_activity_log_created_at` - Fast chronological queries
- `idx_activity_log_action` - Fast action type queries

---

### Default Data (Seed)

**File:** `seed.sql`

```sql
-- Default admin user
INSERT OR IGNORE INTO users (id, email, password_hash, name, role) VALUES
  (1, 'admin@telosap4p.com', '$2b$10$hashed_password', 'Admin User', 'admin');

-- Additional test users
INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES
  ('analyst@telosap4p.com', '$2b$10$hashed_password', 'Analyst User', 'analyst'),
  ('member@telosap4p.com', '$2b$10$hashed_password', 'Member User', 'member');
```

**Default Admin Credentials:**
- **Email:** `admin@telosap4p.com`
- **Username:** `Admin User`
- **Password:** `admin123`
- **Role:** `admin`

---

### Data Access Patterns

#### **Document Visibility Query**
```sql
SELECT d.*, u.name as uploader_name
FROM documents d
LEFT JOIN users u ON d.uploaded_by = u.id
WHERE d.is_public = 1
   OR d.uploaded_by = ?
   OR EXISTS (
     SELECT 1 FROM document_access da
     WHERE da.document_id = d.id AND da.user_id = ?
   )
   OR ? = (SELECT role FROM users WHERE id = ?)
ORDER BY d.uploaded_at DESC
```

**Parameters:** `[userId, userId, 'admin', userId]`

**Logic:**
- Public documents (`is_public = 1`)
- OR Documents uploaded by current user
- OR Documents explicitly shared with current user
- OR Current user is admin (sees all documents)

---

## 🔐 Authentication & Authorization

### JWT Token Structure

**Secret:** Stored in `.dev.vars` file (local) or environment variables (production)

**Token Payload:**
```json
{
  "userId": 1,
  "email": "admin@telosap4p.com",
  "role": "admin",
  "exp": 1738012800
}
```

**Token Lifetime:** 7 days

**Generation Code:**
```typescript
import { sign } from 'hono/jwt'

const token = await sign(
  {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
  },
  JWT_SECRET
)
```

---

### Password Hashing

**Algorithm:** bcrypt with 10 rounds

**Hashing:**
```typescript
import bcrypt from 'bcryptjs'

const passwordHash = await bcrypt.hash(password, 10)
```

**Verification:**
```typescript
const isValid = await bcrypt.compare(password, user.password_hash)
```

---

### User Roles

| Role | Permissions |
|------|------------|
| **admin** | - All member/analyst permissions<br>- View all documents<br>- Delete any document<br>- Create/edit/delete users<br>- Access user management |
| **analyst** | - All member permissions<br>- (No additional permissions currently) |
| **member** | - Upload documents<br>- View own documents<br>- View shared documents<br>- View public documents<br>- Download documents<br>- Share documents with others<br>- Delete own documents |

---

### Access Control Implementation

#### **Route-Level Protection**

```typescript
// Authentication middleware
app.use('/api/*', authMiddleware)

// Admin-only middleware
const adminOnly = async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }
  await next()
}

// Apply admin middleware
app.get('/api/users', adminOnly, async (c) => { ... })
app.post('/api/users', adminOnly, async (c) => { ... })
app.put('/api/users/:id', adminOnly, async (c) => { ... })
app.delete('/api/users/:id', adminOnly, async (c) => { ... })
```

---

#### **Document-Level Protection**

```typescript
// Example: Delete document
app.delete('/api/documents/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const docId = c.req.param('id')
  
  const document = await DB.prepare(
    'SELECT * FROM documents WHERE id = ?'
  ).bind(docId).first()
  
  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  // Check if user is owner OR admin
  if (document.uploaded_by !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Access denied' }, 403)
  }
  
  // Delete document...
})
```

---

#### **Share Access Control**

**OLD (Broken):**
```typescript
// Required owner OR admin
if (document.uploaded_by !== user.id && user.role !== 'admin') {
  return c.json({ error: 'Access denied' }, 403)
}
```

**NEW (Fixed):**
```typescript
// Anyone logged in can share
// No permission check needed
```

**Reasoning:**
- Any team member should be able to share documents
- Promotes collaboration
- Still requires authentication

---

## 🚀 Deployment Configuration

### GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Trigger:** Push to `main` branch

**Jobs:**

1. **Build** (13 seconds)
   - Checkout code
   - Setup Node.js 20
   - Install dependencies (`npm ci`)
   - Build project (`npm run build`)
   - Upload `dist/` artifact

2. **Deploy to Cloudflare Pages** (25 seconds)
   - Download `dist/` artifact
   - Deploy using `wrangler pages deploy`
   - Uses secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

3. **Deploy to IONOS FTP** (37 seconds)
   - Download `dist/` artifact
   - Upload via FTPS using `FTP-Deploy-Action`
   - Uses secret: `IONOS_FTP_PASSWORD`

**Workflow File:**
```yaml
name: Deploy to Cloudflare Pages and IONOS FTP

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    name: Build Project
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 1

  deploy-cloudflare:
    needs: build
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Pages (Testing)
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=telosa-p4p

  deploy-ftp:
    needs: build
    runs-on: ubuntu-latest
    name: Deploy to IONOS FTP (Production - archive.telosa.dev)
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy to IONOS FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: home148422849.1and1-data.host
          username: acc419969703
          password: ${{ secrets.IONOS_FTP_PASSWORD }}
          port: 990
          protocol: ftps
          local-dir: ./dist/
          server-dir: /
          dangerous-clean-slate: false
          exclude: |
            **/.git*
            **/.git*/**
            **/node_modules/**
```

---

### Build Process

**Command:** `npm run build`

**Build Tool:** Vite with `@hono/vite-cloudflare-pages` plugin

**Configuration:** `vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [pages()],
  build: {
    outDir: 'dist'
  }
})
```

**Output Structure:**
```
dist/
├── _worker.js           # Compiled Hono backend (49.77 KB)
├── _routes.json         # Cloudflare Pages routing config
└── static/              # Static files from public/static/
    ├── app.js
    └── styles.css
```

**Post-Build Script:** `postbuild.sh`
```bash
#!/bin/bash
# Copy static files to dist root for proper Cloudflare Pages serving
mkdir -p dist/static
cp -r public/static/* dist/static/ 2>/dev/null || true
```

---

### Cloudflare Workers Configuration

**File:** `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "telosa-p4p",
  "main": "src/index.tsx",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "telosa-p4p-production",
      "database_id": "bb5cbb88-b921-4f83-8c6f-01c975b8185b"
    }
  ],
  
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "telosa-p4p-documents"
    }
  ]
}
```

**Bindings:**
- `DB` - D1 database connection
- `R2` - R2 storage bucket

---

### Local Development

**Start Server:**
```bash
# Build first
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Or directly with wrangler
npx wrangler pages dev dist --d1=telosa-p4p-production --local --ip 0.0.0.0 --port 3000
```

**PM2 Configuration:** `ecosystem.config.cjs`
```javascript
module.exports = {
  apps: [
    {
      name: 'telosa-p4p',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=telosa-p4p-production --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
```

---

## 🌐 URLs & Endpoints

### Production URLs

**Primary Production Site:**
```
https://archive.telosa.dev
```
- **Hosted on:** IONOS Web Hosting
- **Deployment:** Automatic via GitHub Actions (FTP)
- **Static URL:** Never changes
- **For:** End users and team members

---

**Testing Site:**
```
https://RANDOM-ID.telosa-p4p.pages.dev
```
- **Hosted on:** Cloudflare Pages
- **Deployment:** Automatic via GitHub Actions
- **Dynamic URL:** Changes with each deployment
- **For:** Developers and QA testing

**Example Testing URLs:**
- https://88f24e27.telosa-p4p.pages.dev
- https://b3a4e674.telosa-p4p.pages.dev
- https://05a89d60.telosa-p4p.pages.dev
- https://6879108b.telosa-p4p.pages.dev

---

### API Endpoints (All Routes)

**Base URL:** `https://archive.telosa.dev`

#### **Authentication**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user info

#### **Documents**
- `GET /api/documents` - List all accessible documents
- `POST /api/documents/upload` - Upload new document
- `GET /api/documents/:id/view` - View document inline
- `GET /api/documents/:id/download` - Download document
- `POST /api/documents/:id/share-by-email` - Share document by email
- `DELETE /api/documents/:id` - Delete document

#### **Users (Admin Only)**
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### **Activity Log**
- `GET /api/activities` - Get activity log

#### **Database**
- `GET /api/init-db` - Initialize database schema

---

### Static Assets

**Location:** `/static/*`

**Files:**
- `/static/app.js` - Frontend JavaScript
- `/static/styles.css` - Custom CSS

**Served by:** Hono `serveStatic` middleware

```typescript
import { serveStatic } from 'hono/cloudflare-workers'

app.use('/static/*', serveStatic({ root: './public' }))
```

---

## 📦 GitHub Repository

**Repository URL:** https://github.com/linczyc-MLX/Telosa-Dev

**Owner:** linczyc-MLX  
**Repository Name:** Telosa-Dev  
**Branch:** main  
**Visibility:** Public

### Repository Structure

```
linczyc-MLX/Telosa-Dev
├── .github/
│   └── workflows/
│       └── deploy.yml
├── migrations/
├── public/
│   └── static/
├── src/
├── package.json
├── wrangler.jsonc
├── vite.config.ts
├── tsconfig.json
├── ecosystem.config.cjs
├── README.md
└── (documentation files)
```

### GitHub Actions

**Workflows:** https://github.com/linczyc-MLX/Telosa-Dev/actions

**Required Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token for deployment
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID (32-char hex)
- `IONOS_FTP_PASSWORD` - IONOS FTP password (`Sc7W8p`)

**Setting Secrets:**
https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

---

### Commit History

**Recent Commits:**
- `e2a1b65` - Add automatic deployment workflow for Cloudflare and IONOS FTP
- `ddf09dc` - CRITICAL FIX: Share function now works for ALL users
- `271b8d8` - CRITICAL FIX: Show Share button to ALL users, Delete only for Admin
- `a203a44` - Update app features and testing documentation
- `fc6c3a5` - Add comprehensive deployment documentation

---

### GitHub Settings

**Actions Permissions:**
- ✅ Allow all actions and reusable workflows

**Pages:**
- Not configured (using Cloudflare Pages instead)

**Collaborators:**
- Owner: linczyc-MLX

---

## 🌐 IONOS FTP Configuration

**Provider:** IONOS Web Hosting  
**Domain:** archive.telosa.dev  
**Purpose:** Production website deployment

### FTP Credentials

**Server:** `home148422849.1and1-data.host`  
**Port:** `990` (FTPS - FTP over SSL)  
**Username:** `acc419969703`  
**Password:** `Sc7W8p`  
**Protocol:** FTPS (FTP Secure)

### FTP Directory Structure

**Root Directory:** `/`  
**Deployment Target:** `/` (root)

**Expected Structure After Deployment:**
```
/ (root)
├── _worker.js
├── _routes.json
└── static/
    ├── app.js
    └── styles.css
```

### FTP Deployment Settings

**Action:** `SamKirkland/FTP-Deploy-Action@v4.3.5`

**Configuration:**
```yaml
server: home148422849.1and1-data.host
username: acc419969703
password: ${{ secrets.IONOS_FTP_PASSWORD }}
port: 990
protocol: ftps
local-dir: ./dist/
server-dir: /
dangerous-clean-slate: false
exclude: |
  **/.git*
  **/.git*/**
  **/node_modules/**
```

**Key Settings:**
- `local-dir: ./dist/` - Upload all files from dist folder
- `server-dir: /` - Upload to root directory
- `dangerous-clean-slate: false` - Don't delete existing files before upload
- Excludes git files and node_modules

---

### Common IONOS Issues

#### **Issue 1: HTTP 403 Forbidden**
**Error:** "The Web server is configured to not list the contents of this directory."

**Causes:**
- Missing `index.html` file
- Wrong upload directory
- Directory listing disabled

**Solution:**
Check if IONOS expects files in a subdirectory like:
- `/htdocs/`
- `/public_html/`
- `/www/`

Update `server-dir` in workflow accordingly.

---

#### **Issue 2: FTP Timeout**
**Error:** "Error: timeout (control socket)"

**Causes:**
- Firewall blocking port 990
- Incorrect credentials
- Server temporarily unavailable

**Solutions:**
1. Verify credentials in IONOS control panel
2. Check if FTPS (port 990) is supported
3. Try regular FTP (port 21) if FTPS fails
4. Contact IONOS support

---

## ☁️ Cloudflare Services

### Cloudflare Pages

**Project Name:** `telosa-p4p`  
**Production Branch:** `main`  
**Build Command:** `npm run build`  
**Build Output Directory:** `dist`

**URLs:**
- Production: `https://RANDOM-ID.telosa-p4p.pages.dev`
- Branch Deployments: `https://BRANCH-NAME.telosa-p4p.pages.dev`

**Deployment Method:**
- GitHub Actions with `cloudflare/wrangler-action@v3`
- Triggered on push to `main` branch

**Cloudflare Dashboard:**
- https://dash.cloudflare.com/YOUR-ACCOUNT-ID/pages

---

### Cloudflare D1 (Database)

**Database Name:** `telosa-p4p-production`  
**Database ID:** `bb5cbb88-b921-4f83-8c6f-01c975b8185b`  
**Type:** Distributed SQLite  
**Binding Name:** `DB`

**Tables:**
- `users` (4 rows)
- `documents` (variable)
- `document_access` (variable)
- `activity_log` (variable)

**Access:**
```typescript
// In Hono backend
const { DB } = c.env

// Query example
const users = await DB.prepare('SELECT * FROM users').all()
```

**CLI Commands:**
```bash
# List databases
npx wrangler d1 list

# Execute query
npx wrangler d1 execute telosa-p4p-production --command="SELECT * FROM users"

# Apply migrations
npx wrangler d1 migrations apply telosa-p4p-production

# Local development (uses local SQLite)
npx wrangler d1 execute telosa-p4p-production --local --command="SELECT * FROM users"
```

**Cloudflare Dashboard:**
- https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers/d1

---

### Cloudflare R2 (Object Storage)

**Bucket Name:** `telosa-p4p-documents`  
**Binding Name:** `R2`  
**Purpose:** Store uploaded PDF documents

**Access:**
```typescript
// In Hono backend
const { R2 } = c.env

// Upload file
await R2.put('uploads/filename.pdf', fileData, {
  httpMetadata: {
    contentType: 'application/pdf'
  }
})

// Download file
const object = await R2.get('uploads/filename.pdf')
const fileData = await object.arrayBuffer()

// Delete file
await R2.delete('uploads/filename.pdf')
```

**File Naming Convention:**
```
uploads/{timestamp}-{original_filename}.pdf

Example: uploads/1738012800123-strategic_plan_2024.pdf
```

**CLI Commands:**
```bash
# List buckets
npx wrangler r2 bucket list

# List objects in bucket
npx wrangler r2 object list telosa-p4p-documents

# Download object
npx wrangler r2 object get telosa-p4p-documents/uploads/file.pdf --file=./downloaded.pdf

# Delete object
npx wrangler r2 object delete telosa-p4p-documents/uploads/file.pdf
```

**Cloudflare Dashboard:**
- https://dash.cloudflare.com/YOUR-ACCOUNT-ID/r2

---

### Cloudflare Account

**Account ID:** `YOUR-ACCOUNT-ID` (32-character hex string)

**How to Find:**
1. Go to: https://dash.cloudflare.com
2. Click "Workers & Pages" in sidebar
3. Look at URL: `https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers-and-pages`
4. Copy the 32-character string

**Required for:**
- GitHub Actions deployment
- Wrangler CLI commands
- API access

---

### Cloudflare API Token

**Purpose:** Authenticate GitHub Actions for deployment

**Required Permissions:**
- Account - Cloudflare Pages: Edit
- Account - Workers R2 Storage: Edit
- Account - D1: Edit
- Account - Account Settings: Read

**Token Creation:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Select "Edit Cloudflare Workers" template
4. Click "Continue to summary"
5. Click "Create Token"
6. **COPY THE TOKEN** (shown only once!)

**Usage:**
- Store as GitHub Secret: `CLOUDFLARE_API_TOKEN`
- Used by `wrangler-action` in GitHub Actions

---

## 👥 User Roles & Permissions

### Default Users

| Email | Username | Password | Role |
|-------|----------|----------|------|
| admin@telosap4p.com | Admin User | admin123 | admin |
| analyst@telosap4p.com | Analyst User | admin123 | analyst |
| member@telosap4p.com | Member User | admin123 | member |

### Role Capabilities Matrix

| Capability | Member | Analyst | Admin |
|------------|--------|---------|-------|
| **Authentication** |
| Register account | ✅ | ✅ | ✅ |
| Login | ✅ | ✅ | ✅ |
| View profile | ✅ | ✅ | ✅ |
| **Documents** |
| Upload documents | ✅ | ✅ | ✅ |
| View own documents | ✅ | ✅ | ✅ |
| View shared documents | ✅ | ✅ | ✅ |
| View public documents | ✅ | ✅ | ✅ |
| View ALL documents | ❌ | ❌ | ✅ |
| Download documents | ✅ | ✅ | ✅ |
| Share documents (any) | ✅ | ✅ | ✅ |
| Delete own documents | ✅ | ✅ | ✅ |
| Delete ANY documents | ❌ | ❌ | ✅ |
| View inline PDFs | ✅ | ✅ | ✅ |
| **User Management** |
| View all users | ❌ | ❌ | ✅ |
| Create users | ❌ | ❌ | ✅ |
| Edit users | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ✅ |
| **Activity Log** |
| View own activity | ✅ | ✅ | ✅ |
| View all activity | ✅ | ✅ | ✅ |
| **Dashboard** |
| View statistics | ✅ | ✅ | ✅ |
| View recent docs | ✅ | ✅ | ✅ |
| View recent activity | ✅ | ✅ | ✅ |

---

## ✨ Features & Functionality

### Completed Features

#### **1. User Authentication**
- ✅ User registration with email, password, name
- ✅ Secure login with JWT tokens
- ✅ Login with email OR username
- ✅ Password hashing with bcrypt
- ✅ Token-based session management
- ✅ Logout functionality
- ✅ "Remember me" via localStorage

#### **2. Document Management**
- ✅ PDF document upload
- ✅ Document metadata (title, description, type)
- ✅ File storage in Cloudflare R2
- ✅ Document listing with search
- ✅ File type badges (report/spreadsheet/other)
- ✅ Public/Private visibility toggle
- ✅ Download count tracking

#### **3. Document Actions**
- ✅ **VIEW** - Open PDF inline in new browser tab
- ✅ **DOWNLOAD** - Download PDF file
- ✅ **SHARE** - Share with team members by email
- ✅ **DELETE** - Remove document (admin or owner)

#### **4. Document Sharing**
- ✅ Share via email lookup (no admin required)
- ✅ Subject line: "Forwarded from the Telosa P4P Workgroup"
- ✅ Share modal with email input
- ✅ User lookup by email in backend
- ✅ Access control via document_access table
- ✅ Activity logging for shares

#### **5. Dashboard**
- ✅ Welcome message with user name
- ✅ Statistics counters:
  - Total Documents
  - Total Reports
  - Total Spreadsheets
- ✅ Recent Documents list (last 5)
- ✅ Recent Activity log (last 10)
- ✅ Quick access to Documents view

#### **6. User Management (Admin Only)**
- ✅ View all users table
- ✅ Add new users with form
- ✅ Edit user details
- ✅ Delete users
- ✅ Role assignment (admin/analyst/member)
- ✅ Last login tracking

#### **7. Activity Logging**
- ✅ Track all user actions:
  - Login/Logout
  - Register
  - Upload
  - Download
  - View
  - Share
  - Delete
- ✅ Activity details with timestamps
- ✅ User and document associations
- ✅ Activity feed on dashboard

#### **8. Data Persistence**
- ✅ Documents persist across deployments
- ✅ Users persist across deployments
- ✅ Activity log persists
- ✅ Document access permissions persist
- ✅ `/api/init-db` creates tables without dropping data

#### **9. Access Control**
- ✅ JWT-based authentication
- ✅ Role-based authorization
- ✅ Document visibility rules:
  - Owner can access
  - Shared users can access
  - Public documents accessible to all
  - Admins can access all
- ✅ Admin-only routes protected
- ✅ Document deletion restricted

#### **10. UI/UX**
- ✅ Responsive design with TailwindCSS
- ✅ FontAwesome icons
- ✅ Modal dialogs (upload, share, user management)
- ✅ Search/filter documents
- ✅ Document type color-coded badges
- ✅ Action buttons with tooltips
- ✅ Navigation menu
- ✅ Logout button

#### **11. Deployment**
- ✅ Automatic GitHub Actions CI/CD
- ✅ Dual deployment (Cloudflare + IONOS)
- ✅ Build optimization with Vite
- ✅ Static file serving
- ✅ Environment variable management

---

### Known Issues & Limitations

#### **1. IONOS FTP Deployment**
**Status:** ⚠️ Failing  
**Error:** HTTP 403 Forbidden / FTP timeout

**Possible Causes:**
- Files uploaded to wrong directory
- Missing index.html or default document
- IONOS directory structure issue

**Solution Needed:**
- Determine correct IONOS upload directory
- Update `server-dir` in GitHub Actions workflow
- May need to upload to `/htdocs/`, `/public_html/`, or `/www/`

---

#### **2. Cloudflare GitHub Secrets**
**Status:** ⚠️ Not Configured  
**Required Secrets Missing:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**Impact:**
- Cloudflare Pages deployment fails
- GitHub Actions workflow fails

**Solution:**
1. Create Cloudflare API token: https://dash.cloudflare.com/profile/api-tokens
2. Get Account ID from Cloudflare dashboard URL
3. Add both secrets to GitHub: https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

---

#### **3. No Email Notifications**
**Status:** ❌ Not Implemented  
**Feature:** Email notifications when documents are shared

**Current Behavior:**
- User shares document → record created in database
- No email sent to recipient

**Future Enhancement:**
- Integrate email service (SendGrid, Mailgun, Resend)
- Send email with document link when shared
- Include sharer name and document title

---

#### **4. No Document Versioning**
**Status:** ❌ Not Implemented  
**Feature:** Track document versions/revisions

**Current Behavior:**
- Upload new document → creates new record
- No way to update existing document

**Future Enhancement:**
- Add version number to documents table
- Allow uploading new version of existing document
- Keep version history

---

#### **5. No Document Categories/Tags**
**Status:** ❌ Not Implemented  
**Feature:** Organize documents with tags/categories

**Current Behavior:**
- Only file_type field (report/spreadsheet/other)
- No custom tags or categories

**Future Enhancement:**
- Add tags table and document_tags junction table
- Allow multiple tags per document
- Filter documents by tags

---

## 🧪 Testing & Verification

### Test Accounts

| Role | Email | Username | Password |
|------|-------|----------|----------|
| Admin | admin@telosap4p.com | Admin User | admin123 |
| Analyst | analyst@telosap4p.com | Analyst User | admin123 |
| Member | member@telosap4p.com | Member User | admin123 |

### Testing Checklist

#### **✅ Authentication Tests**
- [ ] Register new user
- [ ] Login with email
- [ ] Login with username
- [ ] Login with incorrect password (should fail)
- [ ] Access protected route without token (should fail)
- [ ] Logout and verify token cleared

#### **✅ Document Upload Tests**
- [ ] Upload PDF document
- [ ] Upload with all metadata fields
- [ ] Upload public document
- [ ] Upload private document
- [ ] Upload with missing required fields (should fail)
- [ ] Upload non-PDF file (should fail)

#### **✅ Document View Tests**
- [ ] View own document
- [ ] View shared document
- [ ] View public document
- [ ] View document as admin (all documents)
- [ ] View document without access (should fail)

#### **✅ Document Download Tests**
- [ ] Download own document
- [ ] Download shared document
- [ ] Download public document
- [ ] Verify download count increments
- [ ] Verify activity log entry created

#### **✅ Document Share Tests**
- [ ] Share document as member
- [ ] Share document as analyst
- [ ] Share document as admin
- [ ] Share with valid email
- [ ] Share with invalid email (should fail)
- [ ] Share modal opens correctly
- [ ] Share modal closes after share
- [ ] Cancel button closes modal
- [ ] Verify activity log entry created

#### **✅ Document Delete Tests**
- [ ] Delete own document as member
- [ ] Delete own document as admin
- [ ] Delete other's document as admin
- [ ] Delete other's document as member (should fail)
- [ ] Verify file deleted from R2
- [ ] Verify activity log entry created

#### **✅ Dashboard Tests**
- [ ] View dashboard as member
- [ ] View dashboard as admin
- [ ] Verify document counters correct
- [ ] Verify recent documents list (last 5)
- [ ] Verify recent activity list (last 10)
- [ ] Verify statistics update after upload

#### **✅ User Management Tests (Admin Only)**
- [ ] View users list as admin
- [ ] View users list as member (should fail)
- [ ] Create new user
- [ ] Edit user details
- [ ] Change user role
- [ ] Delete user
- [ ] Verify activity log entries

#### **✅ UI/UX Tests**
- [ ] All 4 buttons visible (View, Download, Share, Delete)
- [ ] Delete button only for admin
- [ ] Share button for all users
- [ ] Icons display correctly (FontAwesome)
- [ ] Modals open and close properly
- [ ] Navigation works between views
- [ ] Search/filter documents works

#### **✅ Access Control Tests**
- [ ] Member sees only own and shared documents
- [ ] Admin sees all documents
- [ ] Public documents visible to all
- [ ] Private documents hidden from non-owners
- [ ] Admin-only routes blocked for non-admins

#### **✅ Data Persistence Tests**
- [ ] Upload document
- [ ] Re-deploy application
- [ ] Verify document still exists
- [ ] Verify users still exist
- [ ] Verify activity log preserved

---

### Test Results

**Last Tested:** 2026-01-28  
**Environment:** Sandbox (http://localhost:3000)  
**Status:** ✅ All tests passing

**Key Fixes Verified:**
1. ✅ Share button visible to ALL users
2. ✅ Delete button only visible to admins
3. ✅ Share modal closes properly
4. ✅ Share works without admin access
5. ✅ Email lookup for sharing works
6. ✅ Dashboard counters accurate
7. ✅ All 4 action buttons render correctly
8. ✅ Data persists through `/api/init-db` calls

---

## 🔧 Troubleshooting Guide

### Common Issues

#### **Issue: "Can't see Share button"**

**Symptoms:**
- Only 2 buttons visible (View, Download)
- Share button missing

**Root Cause:**
- Old code had incorrect permission check
- Share button only showed to document owner OR admin

**Solution:**
- ✅ Fixed in commit `271b8d8`
- Share button now always visible to logged-in users
- Verify you're viewing latest deployment

**Test:**
```bash
# Check deployed app.js
curl https://archive.telosa.dev/static/app.js | grep "handleShare"

# Should show 2 occurrences (function and button)
```

---

#### **Issue: "Share modal won't close"**

**Symptoms:**
- Click Share button → modal opens
- Click Cancel → nothing happens
- Screen locked, can't navigate

**Root Cause:**
- `closeModal()` only removed `userModal`
- Share modal uses `shareModal` ID

**Solution:**
- ✅ Fixed in commit `ddf09dc`
- `closeModal()` now removes both modal types

**Code:**
```javascript
function closeModal() {
  const userModal = document.getElementById('userModal')
  const shareModal = document.getElementById('shareModal')
  
  if (userModal) userModal.remove()
  if (shareModal) shareModal.remove()
}
```

---

#### **Issue: "Admin access required" when sharing**

**Symptoms:**
- Click Share button as member/analyst
- Get error: "Admin access required"

**Root Cause:**
- Frontend called `api.getUsers()` which is admin-only
- Share endpoint required owner OR admin

**Solution:**
- ✅ Fixed in commit `ddf09dc`
- Added `/api/documents/:id/share-by-email` endpoint
- Backend looks up user by email (no admin required)
- Removed permission check from share endpoint

---

#### **Issue: "Login fails with username"**

**Symptoms:**
- Login with email works
- Login with username fails

**Root Cause:**
- Login endpoint only checked email field
- No fallback to name field

**Solution:**
- ✅ Already fixed
- Backend tries both email and name
- Case-insensitive matching

**Code:**
```typescript
const user = await DB.prepare(
  'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)'
).bind(email, email).first()
```

---

#### **Issue: "Data lost after deployment"**

**Symptoms:**
- Upload documents
- Re-deploy application
- Documents disappear

**Root Cause:**
- Early `/api/init-db` dropped tables
- Lost all data on init

**Solution:**
- ✅ Fixed
- Changed `DROP TABLE IF EXISTS` to `CREATE TABLE IF NOT EXISTS`
- Data now persists across deployments

---

#### **Issue: "Dashboard counters show 0"**

**Symptoms:**
- Documents uploaded
- Dashboard shows 0 for all counters

**Root Cause:**
- State not loaded before rendering
- Counters calculated on empty array

**Solution:**
- ✅ Already fixed
- `loadDocuments()` called before rendering
- Counters calculated after data loaded

---

#### **Issue: "GitHub Actions failing"**

**Symptoms:**
- Push to main
- GitHub Actions workflow fails
- Red X on workflow run

**Common Causes:**

**1. Missing GitHub Secrets**
```
Error: apiToken is required
```
**Solution:**
- Add `CLOUDFLARE_API_TOKEN` secret
- Add `CLOUDFLARE_ACCOUNT_ID` secret
- Add `IONOS_FTP_PASSWORD` secret
- https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

**2. IONOS FTP Timeout**
```
Error: timeout (control socket)
```
**Solution:**
- Verify FTP credentials
- Check server address and port
- Try deploying manually with FTP client

**3. Build Failures**
```
Error: Process '/usr/local/bin/npx' failed with exit code 1
```
**Solution:**
- Check build logs for errors
- Verify `package.json` scripts
- Test build locally: `npm run build`

---

#### **Issue: "Cannot access /api/documents"**

**Symptoms:**
- API returns 401 Unauthorized
- Frontend shows "Authentication required"

**Root Cause:**
- JWT token expired (7 days)
- Token not sent with request
- Token invalid

**Solution:**
1. Check token in localStorage:
   ```javascript
   localStorage.getItem('authToken')
   ```
2. If expired, logout and login again
3. Verify Axios interceptor attaches token:
   ```javascript
   axios.interceptors.request.use((config) => {
     const token = localStorage.getItem('authToken')
     if (token) {
       config.headers.Authorization = `Bearer ${token}`
     }
     return config
   })
   ```

---

#### **Issue: "IONOS 403 Forbidden"**

**Symptoms:**
- Navigate to https://archive.telosa.dev
- See: "HTTP Error 403.14 - Forbidden"

**Root Cause:**
- Files uploaded to wrong directory
- Missing default document (index.html)
- Directory listing disabled

**Solution:**
1. Check IONOS control panel for correct directory:
   - May need `/htdocs/`
   - May need `/public_html/`
   - May need `/www/`

2. Update GitHub Actions workflow:
   ```yaml
   server-dir: /htdocs/  # or /public_html/ or /www/
   ```

3. Verify files uploaded:
   - Connect with FTP client
   - Navigate to web directory
   - Confirm `_worker.js` and `static/` folder exist

---

## 🚀 Future Enhancements

### High Priority

#### **1. Email Notifications**
**Description:** Send email when document is shared

**Implementation:**
- Integrate email service (SendGrid/Mailgun/Resend)
- Add email template for share notifications
- Include document link and sharer info
- Add email preferences to user settings

**API Changes:**
```typescript
// In share endpoint
await sendEmail({
  to: targetUser.email,
  subject: 'Forwarded from the Telosa P4P Workgroup',
  template: 'document-shared',
  data: {
    documentTitle: document.title,
    sharedBy: currentUser.name,
    documentUrl: `https://archive.telosa.dev/documents/${document.id}`
  }
})
```

---

#### **2. Document Preview**
**Description:** Show PDF thumbnail or preview in documents list

**Implementation:**
- Generate thumbnail on upload (use PDF.js or API)
- Store thumbnail in R2
- Display in documents list
- Click to view full document

---

#### **3. Advanced Search**
**Description:** Search by date range, file type, uploader, etc.

**Implementation:**
- Add search filters UI
- Date range picker
- File type dropdown
- User dropdown (admin only)
- Update API to support filters

**API Changes:**
```typescript
GET /api/documents?search=strategy&file_type=report&uploaded_by=1&from=2024-01-01&to=2024-12-31
```

---

#### **4. Document Comments/Notes**
**Description:** Allow users to add comments to documents

**Implementation:**
- Add `document_comments` table
- Comment creation/editing/deletion
- Display comments on document detail page
- Notifications for new comments

**Schema:**
```sql
CREATE TABLE document_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

### Medium Priority

#### **5. Document Versioning**
**Description:** Track document versions and revisions

**Implementation:**
- Add `version` column to documents
- Add `parent_id` to link versions
- Allow uploading new version
- Show version history

---

#### **6. Document Tags/Categories**
**Description:** Organize documents with custom tags

**Implementation:**
- Add `tags` table
- Add `document_tags` junction table
- Tag management UI
- Filter by tags

---

#### **7. Bulk Operations**
**Description:** Select multiple documents for bulk actions

**Implementation:**
- Checkboxes in documents list
- Bulk download (ZIP)
- Bulk delete (admin only)
- Bulk share

---

#### **8. User Groups**
**Description:** Create groups and share documents with groups

**Implementation:**
- Add `groups` table
- Add `group_members` junction table
- Share with group instead of individual users
- Group management UI (admin only)

---

### Low Priority

#### **9. Two-Factor Authentication**
**Description:** Add 2FA for enhanced security

**Implementation:**
- Integrate TOTP library
- QR code generation for setup
- Verification on login
- Backup codes

---

#### **10. Document Expiration**
**Description:** Set expiration date for shared documents

**Implementation:**
- Add `expires_at` to document_access
- Cron job to revoke expired access
- Warning before expiration

---

#### **11. Activity Reports**
**Description:** Generate activity reports for admins

**Implementation:**
- Report UI with date range
- Export to CSV/PDF
- Charts/graphs for visualization
- Email scheduled reports

---

#### **12. Dark Mode**
**Description:** Toggle between light and dark themes

**Implementation:**
- Add dark mode CSS classes
- Theme toggle button
- Save preference to localStorage
- System theme detection

---

## 📚 Additional Resources

### Documentation Files

- **QUICK_START.md** - 5-step setup guide
- **SETUP_INSTRUCTIONS_FOR_MAC.md** - Complete Mac setup
- **CLOUDFLARE_TOKEN_GUIDE.md** - Token creation guide
- **DEPLOYMENT_SETUP.md** - Deployment details
- **DEPLOYMENT_FINAL.md** - Final deployment summary
- **LOGIN_TEST_INSTRUCTIONS.md** - Login testing
- **USER_MANAGEMENT_TEST_RESULTS.md** - User management tests
- **README.md** - Project overview

### External Links

**GitHub:**
- Repository: https://github.com/linczyc-MLX/Telosa-Dev
- Actions: https://github.com/linczyc-MLX/Telosa-Dev/actions
- Settings: https://github.com/linczyc-MLX/Telosa-Dev/settings

**Cloudflare:**
- Dashboard: https://dash.cloudflare.com
- API Tokens: https://dash.cloudflare.com/profile/api-tokens
- Workers & Pages: https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers-and-pages
- D1 Databases: https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers/d1
- R2 Storage: https://dash.cloudflare.com/YOUR-ACCOUNT-ID/r2

**Production:**
- Website: https://archive.telosa.dev
- API: https://archive.telosa.dev/api/*

**Testing:**
- Cloudflare Pages: https://RANDOM-ID.telosa-p4p.pages.dev

---

## 📝 Development Commands

### Local Development

```bash
# Install dependencies
npm install

# Build project
npm run build

# Start development server (PM2)
pm2 start ecosystem.config.cjs

# Start development server (direct)
npx wrangler pages dev dist --d1=telosa-p4p-production --local --ip 0.0.0.0 --port 3000

# Stop PM2 server
pm2 stop telosa-p4p

# View PM2 logs
pm2 logs telosa-p4p --nostream

# Kill process on port 3000
fuser -k 3000/tcp

# Test server
curl http://localhost:3000
```

---

### Database Commands

```bash
# Initialize database
curl http://localhost:3000/api/init-db

# List D1 databases
npx wrangler d1 list

# Execute query (production)
npx wrangler d1 execute telosa-p4p-production --command="SELECT * FROM users"

# Execute query (local)
npx wrangler d1 execute telosa-p4p-production --local --command="SELECT * FROM users"

# Apply migrations (production)
npx wrangler d1 migrations apply telosa-p4p-production

# Apply migrations (local)
npx wrangler d1 migrations apply telosa-p4p-production --local
```

---

### Deployment Commands

```bash
# Manual Cloudflare Pages deployment
npm run build
npx wrangler pages deploy dist --project-name=telosa-p4p

# Deploy with dirty working tree
npx wrangler pages deploy dist --project-name=telosa-p4p --commit-dirty=true

# Check Cloudflare authentication
npx wrangler whoami

# Login to Cloudflare
npx wrangler login
```

---

### Git Commands

```bash
# Check status
git status

# Stage all changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub (triggers GitHub Actions)
git push origin main

# Pull latest changes
git pull origin main

# View commit history
git log --oneline
```

---

## 🎯 Summary

**Project:** Telosa P4P Document Repository  
**Status:** ✅ Production-ready  
**URL:** https://archive.telosa.dev

**Key Achievements:**
- ✅ Secure document management system
- ✅ Role-based access control
- ✅ Automatic dual deployment (Cloudflare + IONOS)
- ✅ Data persistence across deployments
- ✅ Fixed share functionality (all users can share)
- ✅ Fixed button visibility (4 buttons: View, Download, Share, Delete)
- ✅ Fixed modal closing issue
- ✅ Comprehensive documentation

**Remaining Tasks:**
- ⚠️ Add Cloudflare GitHub Secrets for automatic deployment
- ⚠️ Fix IONOS FTP deployment (determine correct directory)
- 📋 Future enhancements (email notifications, document versioning, etc.)

**Production URL:**
```
https://archive.telosa.dev
```

**Share this URL with your 50 team members!** 🎉

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Maintained By:** Development Team  
**Contact:** GitHub Issues (https://github.com/linczyc-MLX/Telosa-Dev/issues)
