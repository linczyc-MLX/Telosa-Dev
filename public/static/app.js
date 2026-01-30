/* Telosa P4P Document Repository - Frontend
   Key change: PDF viewing no longer uses blob: URLs.
   Instead we request a short-lived signed URL from:
     GET /api/documents/:id/view-link
   and open that URL directly in a new tab.
*/

(() => {
  const root = document.getElementById('app') || document.body;

  const LS_TOKEN = 'telosa_token';
  const LS_USER = 'telosa_user';

  function getToken() { return localStorage.getItem(LS_TOKEN) || ''; }
  function setToken(t) { localStorage.setItem(LS_TOKEN, t); }
  function clearAuth() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch { return null; }
  }
  function setUser(u) { localStorage.setItem(LS_USER, JSON.stringify(u)); }

  async function apiFetch(path, opts = {}) {
    const headers = new Headers(opts.headers || {});
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(path, { ...opts, headers });
    return res;
  }

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return n;
  }

  function renderLogin() {
    root.innerHTML = '';
    const card = el('div', { class: 'min-h-screen flex items-center justify-center p-6' }, [
      el('div', { class: 'w-full max-w-md bg-white shadow rounded-2xl p-6 border border-slate-200' }, [
        el('div', { class: 'text-xl font-semibold text-slate-800 mb-2' }, ['Telosa P4P Document Repository']),
        el('div', { class: 'text-sm text-slate-500 mb-6' }, ['Sign in to continue']),
        el('label', { class: 'text-sm text-slate-600' }, ['Email']),
        el('input', { id: 'email', class: 'w-full mt-1 mb-4 p-3 border rounded-lg', type: 'email', placeholder: 'admin@telosap4p.com' }),
        el('label', { class: 'text-sm text-slate-600' }, ['Password']),
        el('input', { id: 'password', class: 'w-full mt-1 mb-4 p-3 border rounded-lg', type: 'password', placeholder: 'admin123' }),
        el('button', { id: 'loginBtn', class: 'w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700' }, ['Login']),
        el('div', { id: 'msg', class: 'mt-4 text-sm text-red-600 hidden' }, [''])
      ])
    ]);
    root.appendChild(card);

    document.getElementById('loginBtn').addEventListener('click', async () => {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const msg = document.getElementById('msg');
      msg.classList.add('hidden');

      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        msg.textContent = data.error || 'Login failed';
        msg.classList.remove('hidden');
        return;
      }

      setToken(data.token);
      setUser(data.user);
      renderApp();
    });
  }

  function layoutShell() {
    const user = getUser() || {};
    const container = el('div', { class: 'min-h-screen bg-slate-50' });

    const top = el('div', { class: 'bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow' }, [
      el('div', { class: 'flex items-center gap-3 font-semibold' }, [
        el('i', { class: 'fa-solid fa-folder-open' }),
        el('span', {}, ['Telosa P4P Document Repository'])
      ]),
      el('div', { class: 'flex items-center gap-3 text-sm' }, [
        el('span', { class: 'opacity-90' }, [user.name || user.email || 'User']),
        el('span', { class: 'bg-yellow-400 text-black px-2 py-1 rounded-md font-semibold' }, [String(user.role || '').toUpperCase()]),
        el('button', { id: 'logoutBtn', class: 'bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg' }, [
          el('i', { class: 'fa-solid fa-right-from-bracket mr-2' }),
          'Logout'
        ])
      ])
    ]);

    const body = el('div', { class: 'flex' });

    const nav = el('div', { class: 'w-64 p-4' }, [
      el('div', { class: 'bg-white rounded-2xl border border-slate-200 shadow-sm p-3' }, [
        navBtn('Dashboard', 'dashboard', 'fa-solid fa-house'),
        navBtn('Documents', 'documents', 'fa-solid fa-file-lines', true),
        navBtn('Upload', 'upload', 'fa-solid fa-upload'),
        navBtn('Activity Log', 'activity', 'fa-solid fa-list'),
        (user.role === 'admin') ? navBtn('Users', 'users', 'fa-solid fa-users') : el('div')
      ])
    ]);

    const main = el('div', { class: 'flex-1 p-6' });
    const content = el('div', { id: 'content' });
    main.appendChild(content);

    body.appendChild(nav);
    body.appendChild(main);

    container.appendChild(top);
    container.appendChild(body);

    container.querySelector('#logoutBtn').addEventListener('click', () => {
      clearAuth();
      renderLogin();
    });

    return container;
  }

  function navBtn(label, id, icon, active = false) {
    const b = el('button', {
      class:
        'w-full text-left px-3 py-2 rounded-xl mb-2 flex items-center gap-3 ' +
        (active ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700')
    }, [
      el('i', { class: icon }),
      el('span', {}, [label])
    ]);
    b.dataset.page = id;
    return b;
  }

  function setPageActive(container, page) {
    container.querySelectorAll('button[data-page]').forEach(btn => {
      const isActive = btn.dataset.page === page;
      btn.className =
        'w-full text-left px-3 py-2 rounded-xl mb-2 flex items-center gap-3 ' +
        (isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700');
    });
  }

  async function openSignedLink(docId, mode) {
    const endpoint = mode === 'download'
      ? `/api/documents/${docId}/download-link`
      : `/api/documents/${docId}/view-link`;

    const res = await apiFetch(endpoint, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.url) {
      alert(data.error || 'Unable to open document');
      return;
    }

    // Open directly to HTTPS URL (no blob) => most reliable across browsers/devices.
    const win = window.open(data.url, '_blank', 'noopener');
    if (!win) {
      // popup blocked -> fall back to same-tab navigation
      window.location.href = data.url;
    }
  }

  async function loadDocuments() {
    const res = await apiFetch('/api/documents', { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load documents');
    return data.documents || [];
  }

  function renderDashboard(container, docs) {
    const content = container.querySelector('#content');
    const total = docs.length;
    const reports = docs.filter(d => d.file_type === 'report').length;
    const sheets = docs.filter(d => d.file_type === 'spreadsheet').length;

    content.innerHTML = '';
    content.appendChild(el('div', { class: 'text-2xl font-semibold text-slate-800 mb-4' }, ['Dashboard']));

    const grid = el('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
      statCard('Total Documents', total),
      statCard('Reports', reports),
      statCard('Spreadsheets', sheets),
    ]);

    content.appendChild(grid);
  }

  function statCard(label, value) {
    return el('div', { class: 'bg-white rounded-2xl border border-slate-200 shadow-sm p-5' }, [
      el('div', { class: 'text-sm text-slate-500' }, [label]),
      el('div', { class: 'mt-2 text-3xl font-semibold text-slate-800' }, [String(value)])
    ]);
  }

  function renderDocuments(container, docs) {
    const content = container.querySelector('#content');
    content.innerHTML = '';

    const header = el('div', { class: 'flex items-center justify-between mb-4' }, [
      el('div', { class: 'text-2xl font-semibold text-slate-800' }, ['Documents']),
      el('button', { id: 'refreshBtn', class: 'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700' }, [
        el('i', { class: 'fa-solid fa-rotate mr-2' }),
        'Refresh'
      ])
    ]);

    const search = el('input', { id: 'search', class: 'w-full p-3 border rounded-lg mb-4', placeholder: 'Search documents...' });

    const table = el('div', { class: 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden' });
    const t = el('table', { class: 'w-full text-sm' });
    const thead = el('thead', { class: 'bg-slate-50 text-slate-600' }, [
      el('tr', {}, [
        th('Title'),
        th('Type'),
        th('Uploaded By'),
        th('Date'),
        th('Downloads'),
        th('Actions')
      ])
    ]);
    const tbody = el('tbody', { id: 'docsBody' });

    t.appendChild(thead);
    t.appendChild(tbody);
    table.appendChild(t);

    content.appendChild(header);
    content.appendChild(search);
    content.appendChild(table);

    function drawRows(filterText = '') {
      tbody.innerHTML = '';
      const f = filterText.toLowerCase();
      docs
        .filter(d => !f || String(d.title || '').toLowerCase().includes(f) || String(d.filename || '').toLowerCase().includes(f))
        .forEach(d => {
          const tr = el('tr', { class: 'border-t' });
          tr.appendChild(tdTitle(d));
          tr.appendChild(tdType(d));
          tr.appendChild(td(String(d.uploaded_by_name || '—')));
          tr.appendChild(td(formatDate(d.uploaded_at)));
          tr.appendChild(td(String(d.download_count || 0)));

          const actions = el('td', { class: 'px-4 py-3 text-right whitespace-nowrap' }, [
            actionIcon('fa-eye', 'View', async () => openSignedLink(d.id, 'view')),
            actionIcon('fa-download', 'Download', async () => openSignedLink(d.id, 'download')),
          ]);

          tr.appendChild(actions);
          tbody.appendChild(tr);
        });
    }

    drawRows('');

    document.getElementById('search').addEventListener('input', (e) => drawRows(e.target.value));
    document.getElementById('refreshBtn').addEventListener('click', async () => {
      await navigate(container, 'documents');
    });
  }

  function th(text) {
    return el('th', { class: 'text-left px-4 py-3 font-semibold' }, [text]);
  }

  function td(text) {
    return el('td', { class: 'px-4 py-3' }, [text]);
  }

  function tdTitle(d) {
    const title = el('div', { class: 'font-semibold text-slate-800' }, [String(d.title || 'Untitled')]);
    const sub = el('div', { class: 'text-xs text-slate-500 mt-1' }, [String(d.filename || '')]);
    return el('td', { class: 'px-4 py-3' }, [title, sub]);
  }

  function tdType(d) {
    const label = String(d.file_type || 'other');
    const chipClass =
      label === 'report' ? 'bg-green-100 text-green-800' :
      label === 'spreadsheet' ? 'bg-purple-100 text-purple-800' :
      'bg-slate-100 text-slate-800';

    return el('td', { class: 'px-4 py-3' }, [
      el('span', { class: `inline-block px-2 py-1 rounded-md text-xs font-semibold ${chipClass}` }, [label])
    ]);
  }

  function actionIcon(icon, title, onClick) {
    const b = el('button', { class: 'ml-2 text-slate-600 hover:text-blue-700', title }, [
      el('i', { class: `fa-solid ${icon}` })
    ]);
    b.addEventListener('click', onClick);
    return b;
  }

  function formatDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return d.toLocaleDateString();
  }

  async function renderUpload(container) {
    const content = container.querySelector('#content');
    content.innerHTML = '';
    content.appendChild(el('div', { class: 'text-2xl font-semibold text-slate-800 mb-4' }, ['Upload']));

    const card = el('div', { class: 'bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl' }, [
      el('label', { class: 'text-sm text-slate-600' }, ['Title']),
      el('input', { id: 'upTitle', class: 'w-full mt-1 mb-4 p-3 border rounded-lg', placeholder: 'Document title' }),
      el('label', { class: 'text-sm text-slate-600' }, ['Description']),
      el('textarea', { id: 'upDesc', class: 'w-full mt-1 mb-4 p-3 border rounded-lg', rows: '3', placeholder: 'Optional description' }),
      el('label', { class: 'text-sm text-slate-600' }, ['Type']),
      el('select', { id: 'upType', class: 'w-full mt-1 mb-4 p-3 border rounded-lg' }, [
        el('option', { value: 'report' }, ['report']),
        el('option', { value: 'spreadsheet' }, ['spreadsheet']),
        el('option', { value: 'other' }, ['other']),
      ]),
      el('label', { class: 'text-sm text-slate-600' }, ['File']),
      el('input', { id: 'upFile', class: 'w-full mt-1 mb-4 p-3 border rounded-lg', type: 'file' }),
      el('label', { class: 'inline-flex items-center gap-2 text-sm text-slate-600 mb-4' }, [
        el('input', { id: 'upPublic', type: 'checkbox', class: 'scale-110' }),
        el('span', {}, ['Public document'])
      ]),
      el('button', { id: 'upBtn', class: 'bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-semibold' }, [
        el('i', { class: 'fa-solid fa-upload mr-2' }),
        'Upload'
      ]),
      el('div', { id: 'upMsg', class: 'mt-4 text-sm hidden' }, [''])
    ]);

    content.appendChild(card);

    document.getElementById('upBtn').addEventListener('click', async () => {
      const file = document.getElementById('upFile').files[0];
      const msg = document.getElementById('upMsg');
      msg.classList.add('hidden');

      if (!file) {
        msg.textContent = 'Choose a file first.';
        msg.className = 'mt-4 text-sm text-red-600';
        msg.classList.remove('hidden');
        return;
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', document.getElementById('upTitle').value.trim() || file.name);
      fd.append('description', document.getElementById('upDesc').value.trim());
      fd.append('fileType', document.getElementById('upType').value);
      fd.append('isPublic', document.getElementById('upPublic').checked ? '1' : '0');

      const token = getToken();
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        msg.textContent = data.error || 'Upload failed';
        msg.className = 'mt-4 text-sm text-red-600';
        msg.classList.remove('hidden');
        return;
      }

      msg.textContent = 'Upload complete.';
      msg.className = 'mt-4 text-sm text-green-700';
      msg.classList.remove('hidden');

      // go back to documents
      await navigate(container, 'documents');
    });
  }

  async function renderActivity(container) {
    const content = container.querySelector('#content');
    content.innerHTML = '';
    content.appendChild(el('div', { class: 'text-2xl font-semibold text-slate-800 mb-4' }, ['Activity Log']));

    const res = await apiFetch('/api/activity', { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      content.appendChild(el('div', { class: 'text-red-600' }, [data.error || 'Failed to load activity']));
      return;
    }

    const rows = data.activities || [];
    const box = el('div', { class: 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden' });
    const t = el('table', { class: 'w-full text-sm' });
    t.appendChild(el('thead', { class: 'bg-slate-50 text-slate-600' }, [
      el('tr', {}, [
        th('When'),
        th('Action'),
        th('Document'),
        th('Details')
      ])
    ]));

    const tb = el('tbody', {});
    rows.forEach(r => {
      const tr = el('tr', { class: 'border-t' });
      tr.appendChild(td(formatDateTime(r.created_at)));
      tr.appendChild(td(String(r.action || '')));
      tr.appendChild(td(r.document_id ? String(r.document_id) : '—'));
      tr.appendChild(td(String(r.details || '—')));
      tb.appendChild(tr);
    });

    t.appendChild(tb);
    box.appendChild(t);
    content.appendChild(box);
  }

  function formatDateTime(s) {
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return d.toLocaleString();
  }

  async function renderUsers(container) {
    const content = container.querySelector('#content');
    content.innerHTML = '';
    content.appendChild(el('div', { class: 'text-2xl font-semibold text-slate-800 mb-4' }, ['Users']));

    const res = await apiFetch('/api/users', { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      content.appendChild(el('div', { class: 'text-red-600' }, [data.error || 'Failed to load users']));
      return;
    }

    const users = data.users || [];
    const box = el('div', { class: 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden' });
    const t = el('table', { class: 'w-full text-sm' });
    t.appendChild(el('thead', { class: 'bg-slate-50 text-slate-600' }, [
      el('tr', {}, [
        th('Name'),
        th('Email'),
        th('Role'),
        th('Created'),
        th('Last Login')
      ])
    ]));

    const tb = el('tbody', {});
    users.forEach(u => {
      const tr = el('tr', { class: 'border-t' });
      tr.appendChild(td(String(u.name || '—')));
      tr.appendChild(td(String(u.email || '—')));
      tr.appendChild(td(String(u.role || '—')));
      tr.appendChild(td(formatDate(u.created_at)));
      tr.appendChild(td(formatDateTime(u.last_login)));
      tb.appendChild(tr);
    });

    t.appendChild(tb);
    box.appendChild(t);
    content.appendChild(box);
  }

  async function navigate(container, page) {
    setPageActive(container, page);

    if (page === 'dashboard') {
      const docs = await loadDocuments();
      renderDashboard(container, docs);
    } else if (page === 'documents') {
      const docs = await loadDocuments();
      renderDocuments(container, docs);
    } else if (page === 'upload') {
      await renderUpload(container);
    } else if (page === 'activity') {
      await renderActivity(container);
    } else if (page === 'users') {
      await renderUsers(container);
    } else {
      const docs = await loadDocuments();
      renderDocuments(container, docs);
    }
  }

  function renderApp() {
    root.innerHTML = '';
    const container = layoutShell();
    root.appendChild(container);

    container.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const page = btn.dataset.page;
        await navigate(container, page);
      });
    });

    // default landing
    navigate(container, 'documents').catch(err => {
      console.error(err);
      alert('Session expired. Please login again.');
      clearAuth();
      renderLogin();
    });
  }

  // Boot
  if (!getToken()) renderLogin();
  else renderApp();
})();
