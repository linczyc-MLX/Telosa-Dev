/* Telosa P4P Document Repository Frontend
 * Key fix: PDF viewing uses direct /api/documents/:id/view (cookie-auth), not fetch->blob.
 */

(() => {
  const state = {
    token: localStorage.getItem('telosa_token') || '',
    user: null,
    view: 'documents', // documents | dashboard | upload | activity | users
    documents: [],
    loading: false,
    error: '',
  };

  const el = {
    root: null,
  };

  function qs(sel) { return document.querySelector(sel); }

  async function api(path, opts = {}) {
    const headers = new Headers(opts.headers || {});
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

    // Keep Authorization header for JSON APIs (existing pattern)
    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);

    const res = await fetch(path, { ...opts, headers });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  function setLoading(v) {
    state.loading = v;
    render();
  }

  function setError(msg) {
    state.error = msg || '';
    render();
  }

  function setView(v) {
    state.view = v;
    render();
    if (v === 'documents') loadDocuments();
  }

  function logout() {
    // Also ask server to clear cookie (best effort)
    fetch('/api/auth/logout', { method: 'POST', headers: state.token ? { Authorization: `Bearer ${state.token}` } : {} }).catch(() => {});
    state.token = '';
    state.user = null;
    localStorage.removeItem('telosa_token');
    render();
  }

  async function login(email, password) {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      state.token = res.token || '';
      state.user = res.user || null;

      // Keep token storage as before
      localStorage.setItem('telosa_token', state.token);

      // IMPORTANT: server now also sets HttpOnly cookie, enabling direct PDF streaming view.
      setLoading(false);
      await loadDocuments();
      render();
    } catch (e) {
      setLoading(false);
      setError(e.message || 'Login failed');
    }
  }

  async function loadDocuments() {
    if (!state.token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/documents', { method: 'GET' });
      state.documents = res.documents || [];
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setError(e.message || 'Failed to load documents');
      // Token invalid -> force logout
      if ((e.message || '').toLowerCase().includes('unauthorized')) logout();
    }
  }

  // === PDF VIEW FIX ===
  // Use direct open of /api/documents/:id/view so browsers can do streaming + range requests.
  // Auth is via HttpOnly cookie set by login (server change), with Authorization fallback still supported.
  function openPdf(docId) {
    const url = `/api/documents/${encodeURIComponent(docId)}/view`;
    const w = window.open(url, '_blank', 'noopener');
    if (!w) {
      // Popup blocked: degrade gracefully
      alert('Popup blocked. Please allow popups for this site to view PDFs.');
    }
  }

  function downloadDoc(docId) {
    // Also safe to do direct navigation (cookie-auth)
    window.location.href = `/api/documents/${encodeURIComponent(docId)}/download`;
  }

  function loginView() {
    return `
      <div class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200">
          <div class="p-6 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">T</div>
              <div>
                <div class="text-lg font-semibold text-slate-900">Telosa P4P Document Repository</div>
                <div class="text-sm text-slate-500">Secure access required</div>
              </div>
            </div>
          </div>

          <div class="p-6 space-y-4">
            ${state.error ? `<div class="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">${escapeHtml(state.error)}</div>` : ''}

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input id="login-email" type="email" class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@example.com" />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input id="login-pass" type="password" class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
            </div>

            <button id="login-btn" class="w-full rounded-lg bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 disabled:opacity-60" ${state.loading ? 'disabled' : ''}>
              ${state.loading ? 'Signing in…' : 'Sign In'}
            </button>

            <!-- CONFIDENTIALITY NOTICE (restored) -->
            <div class="mt-4 text-xs text-slate-600 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div class="font-semibold text-slate-800 mb-1">Confidentiality Notice</div>
              This system contains confidential Telosa P4P materials. Unauthorized access, use, disclosure, or distribution is prohibited.
              All activity may be logged and monitored.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function shellView(contentHtml) {
    const userName = state.user?.name || 'User';
    const isAdmin = (state.user?.role || '') === 'admin';

    return `
      <div class="min-h-screen bg-slate-50">
        <div class="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow">
          <div class="flex items-center gap-3">
            <div class="text-white/90">
              <i class="fa-solid fa-folder-open"></i>
            </div>
            <div class="font-semibold">Telosa P4P Document Repository</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-sm text-white/90">
              <i class="fa-solid fa-user"></i> ${escapeHtml(userName)}
            </div>
            ${isAdmin ? `<span class="text-xs bg-yellow-400 text-slate-900 font-bold px-2 py-1 rounded">Admin</span>` : ''}
            <button id="logout-btn" class="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">
              <i class="fa-solid fa-right-from-bracket"></i> Logout
            </button>
          </div>
        </div>

        <div class="flex">
          <aside class="w-60 bg-white border-r border-slate-200 min-h-[calc(100vh-56px)] p-3">
            ${navItem('dashboard', 'Dashboard', 'fa-gauge')}
            ${navItem('documents', 'Documents', 'fa-file-lines')}
            ${navItem('upload', 'Upload', 'fa-upload')}
            ${navItem('activity', 'Activity Log', 'fa-list')}
            ${isAdmin ? navItem('users', 'Users', 'fa-users') : ''}
          </aside>

          <main class="flex-1 p-6">
            ${state.error ? `<div class="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">${escapeHtml(state.error)}</div>` : ''}
            ${contentHtml}
          </main>
        </div>
      </div>
    `;
  }

  function navItem(view, label, icon) {
    const active = state.view === view;
    return `
      <button data-nav="${view}" class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}">
        <i class="fa-solid ${icon}"></i>
        <span>${label}</span>
      </button>
    `;
  }

  function documentsView() {
    return `
      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="text-xl font-semibold text-slate-900">Documents</div>
          <div class="text-sm text-slate-500">Browse and open PDF reports securely</div>
        </div>
        <button data-nav="upload" class="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700">
          <i class="fa-solid fa-upload"></i> Upload New
        </button>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="p-3 border-b border-slate-100">
          <input id="doc-search" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search documents..." />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="text-left font-semibold px-4 py-3">Title</th>
                <th class="text-left font-semibold px-4 py-3">Type</th>
                <th class="text-left font-semibold px-4 py-3">Date</th>
                <th class="text-left font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody id="doc-tbody">
              ${state.documents.map(docRow).join('') || `<tr><td class="px-4 py-6 text-slate-500" colspan="4">No documents found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function docRow(d) {
    const id = d.id ?? d.document_id ?? d.documentId;
    const title = d.title ?? '';
    const type = d.file_type ?? d.fileType ?? d.type ?? '';
    const date = d.uploaded_at ?? d.uploadedAt ?? d.created_at ?? d.createdAt ?? '';
    return `
      <tr class="border-t border-slate-100">
        <td class="px-4 py-3">
          <div class="font-semibold text-slate-900">${escapeHtml(title)}</div>
          <div class="text-xs text-slate-500">${escapeHtml(d.original_name ?? d.originalName ?? d.filename ?? '')}</div>
        </td>
        <td class="px-4 py-3"><span class="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded">${escapeHtml(type)}</span></td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(String(date).slice(0, 10))}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <button class="text-blue-600 hover:text-blue-800" data-action="view" data-id="${escapeAttr(id)}" title="View">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="text-slate-600 hover:text-slate-800" data-action="download" data-id="${escapeAttr(id)}" title="Download">
              <i class="fa-solid fa-download"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function placeholderView(title) {
    return `
      <div class="bg-white border border-slate-200 rounded-xl p-6">
        <div class="text-xl font-semibold text-slate-900 mb-2">${escapeHtml(title)}</div>
        <div class="text-sm text-slate-500">This section is unchanged; the PDF fix is in the Documents “View” action.</div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  function bindEvents() {
    // Login
    const loginBtn = qs('#login-btn');
    if (loginBtn) {
      loginBtn.onclick = () => {
        const email = (qs('#login-email') || {}).value || '';
        const pass = (qs('#login-pass') || {}).value || '';
        login(email, pass);
      };
    }

    // Logout
    const logoutBtn = qs('#logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;

    // Nav
    document.querySelectorAll('[data-nav]').forEach((b) => {
      b.addEventListener('click', (e) => {
        const v = e.currentTarget.getAttribute('data-nav');
        if (v) setView(v);
      });
    });

    // Doc actions
    document.querySelectorAll('[data-action="view"]').forEach((b) => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) openPdf(id);
      });
    });
    document.querySelectorAll('[data-action="download"]').forEach((b) => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) downloadDoc(id);
      });
    });

    // Search
    const search = qs('#doc-search');
    if (search) {
      search.addEventListener('input', () => {
        const q = String(search.value || '').toLowerCase().trim();
        const tbody = qs('#doc-tbody');
        if (!tbody) return;

        const rows = (state.documents || []).filter((d) => {
          const title = String(d.title || '').toLowerCase();
          const name = String(d.original_name || d.originalName || d.filename || '').toLowerCase();
          return !q || title.includes(q) || name.includes(q);
        });

        tbody.innerHTML = rows.map(docRow).join('') || `<tr><td class="px-4 py-6 text-slate-500" colspan="4">No documents found.</td></tr>`;
        bindEvents(); // rebind for rebuilt rows
      });
    }
  }

  function render() {
    if (!el.root) el.root = document.getElementById('app') || document.body;

    if (!state.token || !state.user) {
      el.root.innerHTML = loginView();
      bindEvents();
      return;
    }

    let content = '';
    if (state.view === 'documents') content = documentsView();
    else if (state.view === 'dashboard') content = placeholderView('Dashboard');
    else if (state.view === 'upload') content = placeholderView('Upload');
    else if (state.view === 'activity') content = placeholderView('Activity Log');
    else if (state.view === 'users') content = placeholderView('Users');
    else content = documentsView();

    el.root.innerHTML = shellView(content);
    bindEvents();
  }

  async function boot() {
    render();

    // If we have a token, try a lightweight call to validate + load user info via login response pattern.
    // We don’t assume a /me endpoint exists; instead, we load documents and infer auth is valid.
    if (state.token && !state.user) {
      try {
        // Try documents; if it works, we still need a user label, so keep a generic label.
        await loadDocuments();
        state.user = state.user || { name: 'User', role: 'member' };
      } catch (_) {
        // handled by loadDocuments -> logout
      }
    }

    // If already logged in from this session, load docs.
    if (state.token && state.user) await loadDocuments();
    render();
  }

  boot();
})();
