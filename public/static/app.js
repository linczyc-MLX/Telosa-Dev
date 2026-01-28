// API Base URL
const API_BASE = '/api'

// Token storage
let authToken = localStorage.getItem('authToken')
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null')

// Setup axios interceptor
function setupAxiosInterceptor() {
  axios.interceptors.request.use(config => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })
}

// Initialize interceptor
setupAxiosInterceptor()

// ============================================
// State Management
// ============================================
const state = {
  view: authToken ? 'dashboard' : 'login',
  documents: [],
  users: [],
  activities: [],
  selectedDocument: null
}

// ============================================
// API Functions
// ============================================
const api = {
  async login(email, password) {
    const response = await axios.post(`${API_BASE}/auth/login`, { email, password })
    authToken = response.data.token
    currentUser = response.data.user
    localStorage.setItem('authToken', authToken)
    localStorage.setItem('currentUser', JSON.stringify(currentUser))
    return response.data
  },

  async register(email, password, name) {
    const response = await axios.post(`${API_BASE}/auth/register`, { email, password, name })
    return response.data
  },

  async logout() {
    authToken = null
    currentUser = null
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
  },

  async getDocuments() {
    const response = await axios.get(`${API_BASE}/documents`)
    return response.data.documents
  },

  async uploadDocument(formData) {
    const response = await axios.post(`${API_BASE}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  async downloadDocument(id) {
    const response = await axios.get(`${API_BASE}/documents/${id}/download`, {
      responseType: 'blob'
    })
    return response
  },

  getViewUrl(id) {
    return `${API_BASE}/documents/${id}/view`
  },

  async deleteDocument(id) {
    const response = await axios.delete(`${API_BASE}/documents/${id}`)
    return response.data
  },

  async shareDocument(documentId, userId) {
    const response = await axios.post(`${API_BASE}/documents/${documentId}/share`, { userId })
    return response.data
  },

  async getUsers() {
    const response = await axios.get(`${API_BASE}/users`)
    return response.data.users
  },

  async createUser(email, password, name, role) {
    const response = await axios.post(`${API_BASE}/users`, { email, password, name, role })
    return response.data
  },

  async updateUser(id, updates) {
    const response = await axios.put(`${API_BASE}/users/${id}`, updates)
    return response.data
  },

  async deleteUser(id) {
    const response = await axios.delete(`${API_BASE}/users/${id}`)
    return response.data
  },

  async getActivities() {
    const response = await axios.get(`${API_BASE}/activity`)
    return response.data.activities
  }
}

// ============================================
// UI Components
// ============================================
function renderNavbar() {
  if (!currentUser) return ''
  
  return `
    <nav class="bg-blue-600 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 py-3">
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-2">
            <i class="fas fa-folder-open text-2xl"></i>
            <h1 class="text-xl font-bold">Telosa P4P Document Repository</h1>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm">
              <i class="fas fa-user"></i> ${currentUser.name}
              ${currentUser.role === 'admin' ? '<span class="ml-2 px-2 py-1 bg-yellow-500 text-xs rounded">Admin</span>' : ''}
            </span>
            <button onclick="handleLogout()" class="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded">
              <i class="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  `
}

function renderSidebar() {
  if (!currentUser) return ''
  
  const menuItems = [
    { id: 'dashboard', icon: 'fa-home', label: 'Dashboard' },
    { id: 'documents', icon: 'fa-file-alt', label: 'Documents' },
    { id: 'upload', icon: 'fa-upload', label: 'Upload' },
    { id: 'activity', icon: 'fa-history', label: 'Activity Log' }
  ]

  if (currentUser.role === 'admin') {
    menuItems.push({ id: 'users', icon: 'fa-users', label: 'Users' })
  }

  return `
    <div class="w-64 bg-white shadow-lg min-h-screen">
      <div class="p-4">
        ${menuItems.map(item => `
          <button 
            onclick="changeView('${item.id}')" 
            class="w-full text-left px-4 py-3 mb-2 rounded-lg hover:bg-blue-50 ${state.view === item.id ? 'bg-blue-100 text-blue-600 font-semibold' : 'text-gray-700'}"
          >
            <i class="fas ${item.icon} mr-3"></i>${item.label}
          </button>
        `).join('')}
      </div>
    </div>
  `
}

function renderLogin() {
  return `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
      <div class="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div class="text-center mb-6">
          <i class="fas fa-folder-open text-6xl text-blue-600 mb-4"></i>
          <h2 class="text-3xl font-bold text-gray-800">Telosa P4P</h2>
          <p class="text-gray-600 mt-2">Strategic Planning Document Repository</p>
        </div>
        
        <form id="loginForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">User</label>
            <input 
              type="text" 
              id="loginEmail" 
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your.email@telosap4p.com"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              id="loginPassword" 
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            <i class="fas fa-sign-in-alt mr-2"></i>Login
          </button>
        </form>

        <div class="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
          <p class="font-semibold text-blue-800 mb-2">Demo Credentials:</p>
          <p class="text-gray-700">Admin: admin@telosap4p.com / admin123</p>
          <p class="text-gray-700">Member: member@telosap4p.com / admin123</p>
        </div>
      </div>
    </div>
  `
}

function renderDashboard() {
  return `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">
        <i class="fas fa-home mr-2"></i>Dashboard
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 text-sm">Total Documents</p>
              <p class="text-3xl font-bold text-blue-600" id="totalDocs">0</p>
            </div>
            <i class="fas fa-file-alt text-4xl text-blue-300"></i>
          </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 text-sm">Reports</p>
              <p class="text-3xl font-bold text-green-600" id="totalReports">0</p>
            </div>
            <i class="fas fa-chart-line text-4xl text-green-300"></i>
          </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 text-sm">Spreadsheets</p>
              <p class="text-3xl font-bold text-purple-600" id="totalSheets">0</p>
            </div>
            <i class="fas fa-table text-4xl text-purple-300"></i>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-4">Recent Documents</h3>
        <div id="recentDocuments">Loading...</div>
      </div>
    </div>
  `
}

function renderDocuments() {
  return `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-file-alt mr-2"></i>Documents
        </h2>
        <button 
          onclick="changeView('upload')" 
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <i class="fas fa-upload mr-2"></i>Upload New
        </button>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="p-4 border-b">
          <input 
            type="text" 
            id="searchDocs" 
            placeholder="Search documents..." 
            class="w-full px-4 py-2 border rounded-lg"
            oninput="filterDocuments()"
          />
        </div>
        <div id="documentsList">Loading...</div>
      </div>
    </div>
  `
}

function renderUpload() {
  return `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">
        <i class="fas fa-upload mr-2"></i>Upload Document
      </h2>

      <div class="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form id="uploadForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input 
              type="text" 
              id="uploadTitle" 
              required
              class="w-full px-4 py-2 border rounded-lg"
              placeholder="Document title"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              id="uploadDescription" 
              rows="3"
              class="w-full px-4 py-2 border rounded-lg"
              placeholder="Brief description of the document"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">File Type</label>
            <select 
              id="uploadFileType" 
              class="w-full px-4 py-2 border rounded-lg"
            >
              <option value="report">Report</option>
              <option value="spreadsheet">Spreadsheet</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label class="flex items-center space-x-2">
              <input type="checkbox" id="uploadIsPublic" class="rounded" />
              <span class="text-sm text-gray-700">Make public to all users</span>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input 
              type="file" 
              id="uploadFile" 
              required
              class="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div class="flex space-x-4">
            <button 
              type="submit" 
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <i class="fas fa-upload mr-2"></i>Upload
            </button>
            <button 
              type="button" 
              onclick="changeView('documents')"
              class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  `
}

function renderActivity() {
  return `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">
        <i class="fas fa-history mr-2"></i>Activity Log
      </h2>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div id="activityList">Loading...</div>
      </div>
    </div>
  `
}

function renderUsers() {
  return `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">
        <i class="fas fa-users mr-2"></i>Users Management
      </h2>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div id="usersList">Loading...</div>
      </div>
    </div>
  `
}

// ============================================
// Event Handlers
// ============================================
async function handleLogin(e) {
  e.preventDefault()
  
  const email = document.getElementById('loginEmail').value
  const password = document.getElementById('loginPassword').value

  try {
    await api.login(email, password)
    state.view = 'dashboard'
    render()
  } catch (error) {
    alert(error.response?.data?.error || 'Login failed')
  }
}

async function handleLogout() {
  await api.logout()
  state.view = 'login'
  render()
}

async function handleUpload(e) {
  e.preventDefault()
  
  const formData = new FormData()
  formData.append('title', document.getElementById('uploadTitle').value)
  formData.append('description', document.getElementById('uploadDescription').value)
  formData.append('fileType', document.getElementById('uploadFileType').value)
  formData.append('isPublic', document.getElementById('uploadIsPublic').checked)
  formData.append('file', document.getElementById('uploadFile').files[0])

  try {
    await api.uploadDocument(formData)
    alert('Document uploaded successfully!')
    changeView('documents')
  } catch (error) {
    alert(error.response?.data?.error || 'Upload failed')
  }
}

async function handleDownload(id, filename) {
  try {
    const response = await api.downloadDocument(id)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    alert(error.response?.data?.error || 'Download failed')
  }
}

async function handleView(id) {
  try {
    // Create a temporary link that opens in a new window
    // The axios interceptor will automatically add the Authorization header
    const response = await axios.get(`${API_BASE}/documents/${id}/view`, {
      responseType: 'blob'
    })
    
    // Create a blob URL and open it in a new window
    const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank')
    
    // Clean up the blob URL after a delay
    setTimeout(() => window.URL.revokeObjectURL(url), 100)
  } catch (error) {
    alert(error.response?.data?.error || 'View failed')
  }
}

async function handleDelete(id) {
  if (!confirm('Are you sure you want to delete this document?')) return

  try {
    await api.deleteDocument(id)
    alert('Document deleted successfully!')
    loadDocuments()
  } catch (error) {
    alert(error.response?.data?.error || 'Delete failed')
  }
}

async function handleShare(documentId) {
  // Show modal for sharing
  const modal = document.createElement('div')
  modal.id = 'shareModal'
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h2 class="text-2xl font-bold mb-4">Share Document</h2>
      <p class="text-gray-600 mb-4">Enter the email address of the user you want to share this document with:</p>
      <form onsubmit="submitShare(event, ${documentId})" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">User Email</label>
          <input 
            type="email" 
            id="shareEmail" 
            required 
            placeholder="user@telosap4p.com"
            class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
          >
        </div>
        <div class="text-sm text-gray-500">
          <p>Subject: <span class="font-medium">Forwarded from the Telosa P4P Workgroup</span></p>
        </div>
        <div class="flex space-x-3">
          <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            <i class="fas fa-share mr-2"></i>Share
          </button>
          <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(modal)
}

async function submitShare(event, documentId) {
  event.preventDefault()
  
  const email = document.getElementById('shareEmail').value

  try {
    // Look up user by email via share endpoint
    // The backend will handle finding the user
    const response = await axios.post(`${API_BASE}/documents/${documentId}/share-by-email`, { 
      email: email 
    })
    
    if (response.data.success) {
      alert('Document shared successfully! User will be notified.')
      closeModal()
      await loadDocuments() // Refresh the list
    }
  } catch (error) {
    if (error.response?.status === 404) {
      alert(`No user found with email: ${email}`)
    } else {
      alert(error.response?.data?.error || 'Share failed')
    }
  }
}

// ============================================
// User Management Functions
// ============================================
function showAddUserModal() {
  const modal = document.createElement('div')
  modal.id = 'userModal'
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h2 class="text-2xl font-bold mb-4">Add New User</h2>
      <form onsubmit="handleCreateUser(event)" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" id="userName" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" id="userEmail" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" id="userPassword" required minlength="6" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select id="userRole" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="flex space-x-3">
          <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Create User
          </button>
          <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(modal)
}

function showEditUserModal(userId) {
  const user = state.users.find(u => u.id === userId)
  if (!user) return

  const modal = document.createElement('div')
  modal.id = 'userModal'
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h2 class="text-2xl font-bold mb-4">Edit User</h2>
      <form onsubmit="handleUpdateUser(event, ${userId})" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" id="userName" value="${user.name}" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" id="userEmail" value="${user.email}" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep current)</label>
          <input type="password" id="userPassword" minlength="6" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select id="userRole" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
            <option value="member" ${user.role === 'member' ? 'selected' : ''}>Member</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="flex space-x-3">
          <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Update User
          </button>
          <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(modal)
}

async function handleCreateUser(event) {
  event.preventDefault()
  
  const name = document.getElementById('userName').value
  const email = document.getElementById('userEmail').value
  const password = document.getElementById('userPassword').value
  const role = document.getElementById('userRole').value

  try {
    await api.createUser(email, password, name, role)
    alert('User created successfully!')
    closeModal()
    loadUsers()
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to create user')
  }
}

async function handleUpdateUser(event, userId) {
  event.preventDefault()
  
  const name = document.getElementById('userName').value
  const email = document.getElementById('userEmail').value
  const password = document.getElementById('userPassword').value
  const role = document.getElementById('userRole').value

  const updates = { name, email, role }
  if (password) {
    updates.password = password
  }

  try {
    await api.updateUser(userId, updates)
    alert('User updated successfully!')
    closeModal()
    loadUsers()
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to update user')
  }
}

async function handleDeleteUser(userId, userEmail) {
  if (!confirm(`Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`)) return

  try {
    await api.deleteUser(userId)
    alert('User deleted successfully!')
    loadUsers()
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to delete user')
  }
}

function closeModal() {
  // Remove any modal (userModal or shareModal)
  const userModal = document.getElementById('userModal')
  const shareModal = document.getElementById('shareModal')
  if (userModal) userModal.remove()
  if (shareModal) shareModal.remove()
}

// ============================================
// Data Loading Functions
// ============================================
async function loadDocuments() {
  try {
    state.documents = await api.getDocuments()
    renderDocumentsList()
    updateDashboardStats()
  } catch (error) {
    console.error('Failed to load documents:', error)
  }
}

async function loadUsers() {
  try {
    state.users = await api.getUsers()
    renderUsersList()
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

async function loadActivities() {
  try {
    state.activities = await api.getActivities()
    renderActivitiesList()
  } catch (error) {
    console.error('Failed to load activities:', error)
  }
}

function renderDocumentsList() {
  const container = document.getElementById('documentsList')
  if (!container) return

  if (state.documents.length === 0) {
    container.innerHTML = '<p class="p-4 text-gray-500">No documents found</p>'
    return
  }

  const searchTerm = document.getElementById('searchDocs')?.value.toLowerCase() || ''
  const filteredDocs = state.documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm) ||
    doc.description?.toLowerCase().includes(searchTerm) ||
    doc.filename.toLowerCase().includes(searchTerm)
  )

  container.innerHTML = `
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded By</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Downloads</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        ${filteredDocs.map(doc => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4">
              <div>
                <p class="font-medium text-gray-900">${doc.title}</p>
                <p class="text-sm text-gray-500">${doc.filename}</p>
              </div>
            </td>
            <td class="px-6 py-4">
              <span class="px-2 py-1 text-xs rounded ${
                doc.file_type === 'report' ? 'bg-green-100 text-green-800' :
                doc.file_type === 'spreadsheet' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }">
                ${doc.file_type}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">${doc.uploader_name}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${new Date(doc.uploaded_at).toLocaleDateString()}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${doc.download_count}</td>
            <td class="px-6 py-4 text-sm space-x-2">
              <button 
                onclick="handleView(${doc.id})"
                class="text-purple-600 hover:text-purple-800"
                title="View"
              >
                <i class="fas fa-eye"></i>
              </button>
              <button 
                onclick="handleDownload(${doc.id}, '${doc.filename}')"
                class="text-blue-600 hover:text-blue-800"
                title="Download"
              >
                <i class="fas fa-download"></i>
              </button>
              <button 
                onclick="handleShare(${doc.id})"
                class="text-green-600 hover:text-green-800"
                title="Share"
              >
                <i class="fas fa-share"></i>
              </button>
              ${currentUser.role === 'admin' ? `
                <button 
                  onclick="handleDelete(${doc.id})"
                  class="text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

function renderUsersList() {
  const container = document.getElementById('usersList')
  if (!container) return

  container.innerHTML = `
    <div class="mb-4">
      <button onclick="showAddUserModal()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        <i class="fas fa-user-plus mr-2"></i>Add User
      </button>
    </div>
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        ${state.users.map(user => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900">${user.id}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${user.name}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${user.email}</td>
            <td class="px-6 py-4">
              <span class="px-2 py-1 text-xs rounded ${
                user.role === 'admin' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
              }">
                ${user.role}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              ${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
            </td>
            <td class="px-6 py-4 text-sm space-x-2">
              <button onclick="showEditUserModal(${user.id})" class="text-blue-600 hover:text-blue-800">
                <i class="fas fa-edit"></i> Edit
              </button>
              ${user.id !== currentUser.id ? `
                <button onclick="handleDeleteUser(${user.id}, '${user.email}')" class="text-red-600 hover:text-red-800">
                  <i class="fas fa-trash"></i> Delete
                </button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

function renderActivitiesList() {
  const container = document.getElementById('activityList')
  if (!container) return

  container.innerHTML = `
    <div class="p-4 space-y-3">
      ${state.activities.map(activity => `
        <div class="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded">
          <i class="fas ${
            activity.action === 'upload' ? 'fa-upload text-green-500' :
            activity.action === 'download' ? 'fa-download text-blue-500' :
            activity.action === 'delete' ? 'fa-trash text-red-500' :
            activity.action === 'share' ? 'fa-share text-purple-500' :
            'fa-sign-in-alt text-gray-500'
          } mt-1"></i>
          <div class="flex-1">
            <p class="text-sm text-gray-900">
              <span class="font-medium">${activity.user_name}</span> 
              ${activity.action}
              ${activity.document_title ? `"${activity.document_title}"` : ''}
            </p>
            <p class="text-xs text-gray-500">${new Date(activity.created_at).toLocaleString()}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function updateDashboardStats() {
  const totalDocs = document.getElementById('totalDocs')
  const totalReports = document.getElementById('totalReports')
  const totalSheets = document.getElementById('totalSheets')
  const recentDocs = document.getElementById('recentDocuments')

  if (totalDocs) totalDocs.textContent = state.documents.length
  if (totalReports) totalReports.textContent = state.documents.filter(d => d.file_type === 'report').length
  if (totalSheets) totalSheets.textContent = state.documents.filter(d => d.file_type === 'spreadsheet').length
  
  if (recentDocs) {
    const recent = state.documents.slice(0, 5)
    recentDocs.innerHTML = recent.length > 0 ? `
      <div class="space-y-2">
        ${recent.map(doc => `
          <div class="flex items-center justify-between p-3 hover:bg-gray-50 rounded">
            <div>
              <p class="font-medium text-gray-900">${doc.title}</p>
              <p class="text-sm text-gray-500">${doc.uploader_name} • ${new Date(doc.uploaded_at).toLocaleDateString()}</p>
            </div>
            <div class="flex space-x-2">
              <button 
                onclick="handleView(${doc.id})"
                class="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                <i class="fas fa-eye mr-1"></i>View
              </button>
              <button 
                onclick="handleDownload(${doc.id}, '${doc.filename}')"
                class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <i class="fas fa-download mr-1"></i>Download
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-gray-500">No documents yet</p>'
  }
}

function filterDocuments() {
  renderDocumentsList()
}

// ============================================
// View Management
// ============================================
function changeView(view) {
  state.view = view
  render()
}

function render() {
  const app = document.getElementById('app')
  
  if (state.view === 'login') {
    app.innerHTML = renderLogin()
    document.getElementById('loginForm').addEventListener('submit', handleLogin)
    return
  }

  app.innerHTML = `
    ${renderNavbar()}
    <div class="flex">
      ${renderSidebar()}
      <div class="flex-1 bg-gray-50 min-h-screen">
        ${
          state.view === 'dashboard' ? renderDashboard() :
          state.view === 'documents' ? renderDocuments() :
          state.view === 'upload' ? renderUpload() :
          state.view === 'activity' ? renderActivity() :
          state.view === 'users' ? renderUsers() :
          renderDashboard()
        }
      </div>
    </div>
  `

  // Attach event listeners
  if (state.view === 'upload') {
    document.getElementById('uploadForm')?.addEventListener('submit', handleUpload)
  }

  // Load data for current view
  if (state.view === 'dashboard' || state.view === 'documents') {
    loadDocuments()
  } else if (state.view === 'users') {
    loadUsers()
  } else if (state.view === 'activity') {
    loadActivities()
  }
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  render()
})
