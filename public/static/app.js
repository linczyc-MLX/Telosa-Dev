/* Telosa P4P Document Repository - Frontend App
 * Served from: GET /static/app.js
 * API base: /api (Cloudflare Pages Functions / Workers)
 *
 * Key reliability fix:
 * - PDF viewing opens a new tab immediately with a loading UI,
 * - then fetches the PDF blob with Authorization header,
 * - then injects into an iframe, and DOES NOT revoke the blob URL early.
 */
(() => {
  "use strict";

  // -----------------------------
  // Config + Storage Keys
  // -----------------------------
  const API_BASE = "/api";

  // These keys are intentionally simple and stable.
  // If your prior app used different keys, this file remains self-consistent
  // and does NOT change any backend authentication logic.
  const STORAGE = {
    token: "telosa_token",
    user: "telosa_user",
  };

  // -----------------------------
  // State
  // -----------------------------
  let state = {
    token: loadToken(),
    user: loadUser(),
    route: "documents", // dashboard | documents | upload | activity | users
    documents: [],
    users: [],
    activity: [],
    search: "",
  };

  // -----------------------------
  // Utilities
  // -----------------------------
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(isoOrEpoch) {
    try {
      const d = new Date(isoOrEpoch);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      return "";
    }
  }

  function isPdf(filename, fileType) {
    const n = String(filename || "").toLowerCase();
    const t = String(fileType || "").toLowerCase();
    return n.endsWith(".pdf") || t === "pdf" || t === "report";
  }

  function toast(msg, kind = "info") {
    const host = ensureToastHost();
    const node = document.createElement("div");
    node.className =
      "pointer-events-auto mb-2 w-full max-w-sm rounded-lg border bg-white p-3 shadow " +
      (kind === "error" ? "border-red-200" : kind === "success" ? "border-green-200" : "border-slate-200");
    node.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="mt-0.5 h-2.5 w-2.5 rounded-full ${
          kind === "error" ? "bg-red-500" : kind === "success" ? "bg-green-500" : "bg-blue-500"
        }"></div>
        <div class="text-sm text-slate-800">${escapeHtml(msg)}</div>
        <button class="ml-auto text-slate-400 hover:text-slate-700" aria-label="Close">✕</button>
      </div>
    `;
    node.querySelector("button").addEventListener("click", () => node.remove());
    host.appendChild(node);
    setTimeout(() => node.remove(), 4500);
  }

  function ensureToastHost() {
    let host = $("#__toast_host");
    if (!host) {
      host = document.createElement("div");
      host.id = "__toast_host";
      host.className = "fixed right-4 top-4 z-[9999] flex w-[22rem] max-w-[90vw] flex-col";
      document.body.appendChild(host);
    }
    return host;
  }

  function authHeaders(extra = {}) {
    if (!state.token) return extra;
    return { ...extra, Authorization: `Bearer ${state.token}` };
  }

  async function apiFetch(path, options = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: authHeaders(options.headers || {}),
    });

    // Hard auth failure -> force logout to avoid “half logged-in” states
    if (res.status === 401) {
      hardLogout();
      throw new Error("Unauthorized (session expired). Please log in again.");
    }
    return res;
  }

  async function apiJson(path, options = {}) {
    const res = await apiFetch(path, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.error || data?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function apiBlob(path, options = {}) {
    const res = await apiFetch(path, options);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed (${res.status})`);
    }
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const ct = res.headers.get("content-type") || "";
    return { blob, contentDisposition: cd, contentType: ct };
  }

  function parseFilenameFromContentDisposition(cd) {
    // Handles: inline; filename="abc.pdf"
    const m = /filename\*?=(?:UTF-8'')?("?)([^";]+)\1/i.exec(cd || "");
    if (!m) return "";
    try {
      return decodeURIComponent(m[2]);
    } catch {
      return m[2];
    }
  }

  function saveToken(token) {
    state.token = token || "";
    if (token) localStorage.setItem(STORAGE.token, token);
    else localStorage.removeItem(STORAGE.token);
  }

  function loadToken() {
    return localStorage.getItem(STORAGE.token) || "";
  }

  function saveUser(user) {
    state.user = user || null;
    if (user) localStorage.setItem(STORAGE.user, JSON.stringify(user));
    else localStorage.removeItem(STORAGE.user);
  }

  function loadUser() {
    try {
      const raw = localStorage.getItem(STORAGE.user);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function hardLogout() {
    saveToken("");
    saveUser(null);
    state.route = "documents";
    render();
  }

  function setRoute(route) {
    state.route = route;
    render();
  }

  function roleLabel(user) {
    const r = String(user?.role || user?.userRole || user?.type || "").toLowerCase();
    if (r.includes("admin")) return "Admin";
    return "Member";
  }

  function isAdmin(user) {
    return roleLabel(user) === "Admin";
  }

  // -----------------------------
  // PDF Viewer Reliability Fix
  // -----------------------------
  function writePdfShell(win, titleText) {
    const safeTitle = escapeHtml(titleText || "Document");
    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    html, body { height: 100%; margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .bar { display:flex; align-items:center; gap:12px; padding:10px 12px; border-bottom: 1px solid #e5e7eb; }
    .dot { width:10px; height:10px; border-radius:999px; background:#3b82f6; }
    .muted { color:#64748b; font-size: 13px; }
    .btn { display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px; text-decoration:none; color:#0f172a; }
    .btn:hover { background:#f8fafc; }
    .wrap { height: calc(100% - 52px); }
    #frame { width:100%; height:100%; border:0; display:none; }
    #loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:10px; }
    .spinner { width:32px; height:32px; border-radius:999px; border: 3px solid #e5e7eb; border-top-color:#3b82f6; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error { display:none; padding: 16px; color:#b91c1c; }
    code { background:#f1f5f9; padding:2px 6px; border-radius:6px; }
  </style>
</head>
<body>
  <div class="bar">
    <div class="dot"></div>
    <div style="font-weight:600;">${safeTitle}</div>
    <div class="muted" id="status">Loading PDF…</div>
    <div style="margin-left:auto; display:flex; gap:8px;">
      <a class="btn" id="openLink" href="#" target="_blank" rel="noopener noreferrer" style="display:none;">Open</a>
      <a class="btn" id="downloadLink" href="#" download style="display:none;">Download</a>
    </div>
  </div>
  <div class="wrap">
    <div id="loading">
      <div class="spinner"></div>
      <div class="muted">Please wait while the document loads.</div>
      <div class="muted" style="max-width:720px; text-align:center;">
        If your browser doesn’t support inline PDF viewing, use <b>Open</b> or <b>Download</b> once they appear.
      </div>
    </div>
    <div id="error"></div>
    <iframe id="frame" title="PDF Viewer"></iframe>
  </div>
</body>
</html>`);
    win.document.close();
  }

  async function viewDocumentPdf(doc) {
    // Open the window FIRST so the user sees a loading UI immediately.
    const title = doc?.title || doc?.originalName || "Document";
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      toast("Popup blocked. Please allow popups for this site to view PDFs.", "error");
      return;
    }

    writePdfShell(win, title);

    // Fetch PDF blob using Authorization header (required by your API). :contentReference[oaicite:1]{index=1}
    try {
      const { blob, contentDisposition, contentType } = await apiBlob(`/documents/${doc.id}/view`, {
        method: "GET",
      });

      const filename = parseFilenameFromContentDisposition(contentDisposition) || `${title}.pdf`;
      const finalBlob = blob.type ? blob : new Blob([blob], { type: contentType || "application/pdf" });

      const blobUrl = URL.createObjectURL(finalBlob);

      // Populate viewer
      const statusEl = win.document.getElementById("status");
      const frame = win.document.getElementById("frame");
      const loading = win.document.getElementById("loading");
      const openLink = win.document.getElementById("openLink");
      const downloadLink = win.document.getElementById("downloadLink");

      if (statusEl) statusEl.textContent = "Loaded";
      if (openLink) {
        openLink.href = blobUrl;
        openLink.style.display = "inline-flex";
      }
      if (downloadLink) {
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        downloadLink.style.display = "inline-flex";
      }

      if (frame) {
        frame.src = blobUrl;
        frame.style.display = "block";
      }
      if (loading) loading.style.display = "none";

      // CRITICAL: Do NOT revoke the blob URL immediately.
      // Revoke only when tab closes (best), plus a long safety timeout.
      win.addEventListener("beforeunload", () => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      });

      // Safety cleanup after 30 minutes (prevents memory leaks without breaking slow PDF viewers)
      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 30 * 60 * 1000);
    } catch (err) {
      const msg = err?.message || String(err);
      const statusEl = win.document.getElementById("status");
      const loading = win.document.getElementById("loading");
      const errorEl = win.document.getElementById("error");
      if (statusEl) statusEl.textContent = "Failed";
      if (loading) loading.style.display = "none";
      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.innerHTML =
          `Failed to load PDF.<br><br><code>${escapeHtml(msg)}</code><br><br>` +
          `If you keep seeing this, your session may have expired—log out and log back in.`;
      }
    }
  }

  // -----------------------------
  // Data loaders
  // -----------------------------
  async function loadDocuments() {
    const data = await apiJson("/documents", { method: "GET" });
    const docs = data?.documents || data?.data || [];
    // Normalize a few common shapes
    state.documents = docs.map((d) => ({
      id: d.id ?? d.documentId ?? d.docId,
      title: d.title ?? d.name ?? d.fileName ?? "Untitled",
      fileType: d.fileType ?? d.type ?? "",
      uploadedBy: d.uploadedByName ?? d.uploadedBy ?? d.ownerName ?? "",
      date: d.createdAt ?? d.uploadedAt ?? d.date ?? "",
      downloads: d.downloads ?? d.downloadCount ?? 0,
      originalName: d.originalName ?? d.fileName ?? "",
      isPublic: d.isPublic ?? d.public ?? false,
    })).filter((d) => d.id != null);
  }

  async function loadUsersIfAdmin() {
    if (!isAdmin(state.user)) {
      state.users = [];
      return;
    }
    try {
      const data = await apiJson("/users", { method: "GET" });
      state.users = data?.users || data?.data || [];
    } catch {
      // Optional endpoint; don’t break UI if not present
      state.users = [];
    }
  }

  async function loadActivityIfAdmin() {
    // Some builds expose /api/activity; if absent, UI shows a friendly message.
    try {
      const data = await apiJson("/activity", { method: "GET" });
      state.activity = data?.activity || data?.logs || data?.data || [];
    } catch {
      state.activity = [];
    }
  }

  // -----------------------------
  // Actions
  // -----------------------------
  async function doLogin(email, password) {
    const data = await apiJson("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!data?.success || !data?.token) {
      throw new Error(data?.error || "Login failed.");
    }
    saveToken(data.token);
    saveUser(data.user || null);

    toast("Login successful.", "success");

    // Prime data
    await Promise.allSettled([loadDocuments(), loadUsersIfAdmin(), loadActivityIfAdmin()]);
    render();
  }

  async function doUpload(form) {
    const fd = new FormData(form);
    const res = await apiFetch("/documents/upload", {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || data?.message || `Upload failed (${res.status})`);
    }
    toast("Upload complete.", "success");
    await loadDocuments();
    setRoute("documents");
  }

  async function doDelete(doc) {
    if (!confirm(`Delete "${doc.title}"?\n\nThis cannot be undone.`)) return;
    await apiJson(`/documents/${doc.id}`, { method: "DELETE" });
    toast("Document deleted.", "success");
    await loadDocuments();
    render();
  }

  async function doDownload(doc) {
    try {
      const { blob, contentDisposition, contentType } = await apiBlob(`/documents/${doc.id}/download`, {
        method: "GET",
      });
      const filename = parseFilenameFromContentDisposition(contentDisposition) || (doc.originalName || `${doc.title}`);
      const finalBlob = blob.type ? blob : new Blob([blob], { type: contentType || "application/octet-stream" });
      const url = URL.createObjectURL(finalBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Safe revoke after download click
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
      }, 60 * 1000);
    } catch (e) {
      toast(e?.message || "Download failed.", "error");
    }
  }

  async function doShare(doc) {
    if (!isAdmin(state.user)) {
      toast("Only admins can share documents.", "error");
      return;
    }
    await loadUsersIfAdmin();
    if (!state.users.length) {
      toast("No users found (or /api/users not available).", "error");
      return;
    }

    const userOptions = state.users
      .map((u) => {
        const id = u.id ?? u.userId;
        const name = u.name ?? u.fullName ?? u.email ?? `User ${id}`;
        const email = u.email ? ` (${u.email})` : "";
        return `<option value="${escapeHtml(id)}">${escapeHtml(name)}${escapeHtml(email)}</option>`;
      })
      .join("");

    const modal = document.createElement("div");
    modal.className =
      "fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4";
    modal.innerHTML = `
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow">
        <div class="mb-2 text-lg font-semibold text-slate-900">Share Document</div>
        <div class="mb-4 text-sm text-slate-600">${escapeHtml(doc.title)}</div>
        <label class="mb-2 block text-sm font-medium text-slate-800">Select user</label>
        <select id="shareUser" class="w-full rounded-lg border border-slate-200 p-2">
          ${userOptions}
        </select>
        <div class="mt-5 flex justify-end gap-2">
          <button id="cancel" class="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button id="ok" class="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Share</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.querySelector("#cancel").addEventListener("click", close);

    modal.querySelector("#ok").addEventListener("click", async () => {
      const userId = modal.querySelector("#shareUser").value;
      try {
        await apiJson(`/documents/${doc.id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        toast("Shared successfully.", "success");
        close();
      } catch (e) {
        toast(e?.message || "Share failed.", "error");
      }
    });
  }

  // -----------------------------
  // Render: Login
  // -----------------------------
  function renderLogin() {
    document.body.className = "bg-slate-50";
    document.body.innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow">
          <div class="mb-1 text-xl font-semibold text-slate-900">Telosa P4P Document Repository</div>
          <div class="mb-5 text-sm text-slate-600">Secure access required</div>

          <!-- Confidentiality notice -->
          <div class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div class="font-semibold">Confidentiality Notice</div>
            <div class="mt-1">
              This system contains confidential and proprietary Telosa P4P materials.
              Access is restricted to authorized users only. All activity may be logged.
            </div>
          </div>

          <form id="loginForm" class="space-y-3">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-800">Email</label>
              <input name="email" type="email" required class="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-800">Password</label>
              <input name="password" type="password" required class="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <button type="submit" class="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">
              Sign In
            </button>
          </form>

          <div id="loginErr" class="mt-3 hidden rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700"></div>
        </div>
      </div>
    `;

    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#loginErr");
      err.classList.add("hidden");
      err.textContent = "";

      const fd = new FormData(e.target);
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");

      try {
        await doLogin(email, password);
      } catch (ex) {
        err.textContent = ex?.message || "Login failed.";
        err.classList.remove("hidden");
      }
    });
  }

  // -----------------------------
  // Render: Shell Layout
  // -----------------------------
  function navItem(label, route, icon = "•") {
    const active = state.route === route;
    return `
      <button data-route="${route}"
        class="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
          active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
        }">
        <span class="w-5 text-center">${icon}</span>
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderShell(contentHtml) {
    document.body.className = "bg-slate-50";
    const userName = state.user?.name || state.user?.fullName || state.user?.email || "User";
    const badge = roleLabel(state.user);

    document.body.innerHTML = `
      <div class="min-h-screen">
        <!-- Top bar -->
        <div class="bg-blue-600 text-white">
          <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div class="flex items-center gap-2 font-semibold">
              <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">📁</span>
              <span>Telosa P4P Document Repository</span>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <span class="opacity-90">${escapeHtml(userName)}</span>
              <span class="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-slate-900">${escapeHtml(
                badge
              )}</span>
              <button id="logoutBtn" class="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25">Logout</button>
            </div>
          </div>
        </div>

        <div class="mx-auto flex max-w-7xl gap-4 px-4 py-4">
          <!-- Sidebar -->
          <aside class="w-60 shrink-0">
            <div class="rounded-xl bg-white p-3 shadow-sm">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Menu</div>
              <div class="space-y-1" id="nav">
                ${navItem("Dashboard", "dashboard", "🏠")}
                ${navItem("Documents", "documents", "📄")}
                ${navItem("Upload", "upload", "⬆️")}
                ${navItem("Activity Log", "activity", "🧾")}
                ${isAdmin(state.user) ? navItem("Users", "users", "👥") : ""}
              </div>
            </div>
          </aside>

          <!-- Main -->
          <main class="flex-1">
            <div class="rounded-xl bg-white p-4 shadow-sm">
              ${contentHtml}
            </div>
          </main>
        </div>
      </div>
    `;

    $("#logoutBtn").addEventListener("click", () => {
      hardLogout();
    });

    $("#nav").addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-route]");
      if (!btn) return;
      const route = btn.getAttribute("data-route");
      if (route) {
        state.route = route;
        // Lazy load optional data
        if (route === "documents") await refreshDocumentsSafe();
        if (route === "users") await refreshUsersSafe();
        if (route === "activity") await refreshActivitySafe();
        render();
      }
    });
  }

  // -----------------------------
  // Pages
  // -----------------------------
  function pageDashboard() {
    const docCount = state.documents.length;
    const pdfCount = state.documents.filter((d) => isPdf(d.originalName || d.title, d.fileType)).length;

    return `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Dashboard</div>
          <div class="text-sm text-slate-600">Overview of repository activity</div>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 p-4">
          <div class="text-sm text-slate-600">Documents</div>
          <div class="mt-1 text-2xl font-semibold text-slate-900">${docCount}</div>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <div class="text-sm text-slate-600">PDF / Reports</div>
          <div class="mt-1 text-2xl font-semibold text-slate-900">${pdfCount}</div>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <div class="text-sm text-slate-600">Role</div>
          <div class="mt-1 text-2xl font-semibold text-slate-900">${escapeHtml(roleLabel(state.user))}</div>
        </div>
      </div>

      <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Tip: PDF viewing now opens a loading screen immediately and keeps the blob URL alive until the tab closes,
        improving reliability across Chrome/Safari/Firefox and iPad.
      </div>
    `;
  }

  function pageDocuments() {
    const rows = filteredDocuments().map((d) => {
      const typeLabel = d.fileType ? escapeHtml(d.fileType) : (isPdf(d.originalName || d.title, d.fileType) ? "report" : "file");
      return `
        <tr class="border-t border-slate-100">
          <td class="py-3 pr-3">
            <div class="font-medium text-slate-900">${escapeHtml(d.title)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(d.originalName || "")}</div>
          </td>
          <td class="py-3 pr-3">
            <span class="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">${typeLabel}</span>
          </td>
          <td class="py-3 pr-3 text-sm text-slate-700">${escapeHtml(d.uploadedBy || "")}</td>
          <td class="py-3 pr-3 text-sm text-slate-700">${escapeHtml(formatDate(d.date))}</td>
          <td class="py-3 pr-3 text-sm text-slate-700">${escapeHtml(String(d.downloads ?? 0))}</td>
          <td class="py-3 text-sm">
            <div class="flex items-center gap-2">
              <button class="action-btn rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50"
                data-action="view" data-id="${escapeHtml(d.id)}" title="View">👁️</button>
              <button class="action-btn rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50"
                data-action="download" data-id="${escapeHtml(d.id)}" title="Download">⬇️</button>
              ${isAdmin(state.user) ? `
                <button class="action-btn rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50"
                  data-action="share" data-id="${escapeHtml(d.id)}" title="Share">🤝</button>
              ` : ""}
              ${isAdmin(state.user) ? `
                <button class="action-btn rounded-lg border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                  data-action="delete" data-id="${escapeHtml(d.id)}" title="Delete">🗑️</button>
              ` : ""}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Documents</div>
          <div class="text-sm text-slate-600">Search, view, download and manage documents</div>
        </div>
        <button id="uploadNewBtn" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Upload New</button>
      </div>

      <div class="mt-4">
        <input id="searchBox" value="${escapeHtml(state.search)}"
          placeholder="Search documents..."
          class="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="pb-2 pr-3">Title</th>
              <th class="pb-2 pr-3">Type</th>
              <th class="pb-2 pr-3">Uploaded By</th>
              <th class="pb-2 pr-3">Date</th>
              <th class="pb-2 pr-3">Downloads</th>
              <th class="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody id="docTbody">
            ${rows || `<tr><td class="py-6 text-sm text-slate-600" colspan="6">No documents found.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function pageUpload() {
    return `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Upload</div>
          <div class="text-sm text-slate-600">Add a new report or spreadsheet</div>
        </div>
      </div>

      <form id="uploadForm" class="mt-4 space-y-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-800">Title</label>
          <input name="title" required class="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-800">Description (optional)</label>
          <textarea name="description" rows="3" class="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"></textarea>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-800">File Type</label>
            <select name="fileType" class="w-full rounded-lg border border-slate-200 p-2">
              <option value="report">report</option>
              <option value="spreadsheet">spreadsheet</option>
              <option value="other">other</option>
            </select>
          </div>

          <div class="flex items-end gap-2">
            <label class="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" name="isPublic" class="h-4 w-4" />
              Public document
            </label>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-800">File</label>
          <input type="file" name="file" required class="w-full rounded-lg border border-slate-200 p-2" />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancelUpload" class="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button type="submit" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Upload</button>
        </div>

        <div id="uploadErr" class="hidden rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700"></div>
      </form>
    `;
  }

  function pageActivity() {
    if (!state.activity.length) {
      return `
        <div>
          <div class="text-xl font-semibold text-slate-900">Activity Log</div>
          <div class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Activity endpoint not available (or no activity yet).
          </div>
        </div>
      `;
    }

    const rows = state.activity.slice(0, 200).map((a) => {
      const when = formatDate(a.createdAt || a.timestamp || a.date || "");
      const who = a.userName || a.email || a.user || "";
      const action = a.action || a.event || "";
      const detail = a.detail || a.description || "";
      return `
        <tr class="border-t border-slate-100">
          <td class="py-2 pr-3 text-sm text-slate-700">${escapeHtml(when)}</td>
          <td class="py-2 pr-3 text-sm text-slate-700">${escapeHtml(who)}</td>
          <td class="py-2 pr-3 text-sm text-slate-900 font-medium">${escapeHtml(action)}</td>
          <td class="py-2 text-sm text-slate-700">${escapeHtml(detail)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="text-xl font-semibold text-slate-900">Activity Log</div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="pb-2 pr-3">Date</th>
              <th class="pb-2 pr-3">User</th>
              <th class="pb-2 pr-3">Action</th>
              <th class="pb-2">Detail</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function pageUsers() {
    if (!isAdmin(state.user)) {
      return `
        <div class="text-sm text-slate-700">
          You do not have access to this page.
        </div>
      `;
    }

    if (!state.users.length) {
      return `
        <div>
          <div class="text-xl font-semibold text-slate-900">Users</div>
          <div class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Users endpoint not available (or no users returned).
          </div>
        </div>
      `;
    }

    const rows = state.users.map((u) => {
      const name = u.name || u.fullName || "";
      const email = u.email || "";
      const role = roleLabel(u);
      return `
        <tr class="border-t border-slate-100">
          <td class="py-2 pr-3 text-sm text-slate-900 font-medium">${escapeHtml(name || email)}</td>
          <td class="py-2 pr-3 text-sm text-slate-700">${escapeHtml(email)}</td>
          <td class="py-2 text-sm text-slate-700">${escapeHtml(role)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="text-xl font-semibold text-slate-900">Users</div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="pb-2 pr-3">Name</th>
              <th class="pb-2 pr-3">Email</th>
              <th class="pb-2">Role</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // -----------------------------
  // Page Helpers
  // -----------------------------
  function filteredDocuments() {
    const q = String(state.search || "").trim().toLowerCase();
    if (!q) return state.documents;
    return state.documents.filter((d) => {
      const hay = `${d.title} ${d.originalName} ${d.fileType} ${d.uploadedBy}`.toLowerCase();
      return hay.includes(q);
    });
  }

  async function refreshDocumentsSafe() {
    try {
      await loadDocuments();
    } catch (e) {
      toast(e?.message || "Failed to load documents.", "error");
    }
  }

  async function refreshUsersSafe() {
    try {
      await loadUsersIfAdmin();
    } catch (e) {
      toast(e?.message || "Failed to load users.", "error");
    }
  }

  async function refreshActivitySafe() {
    try {
      await loadActivityIfAdmin();
    } catch (e) {
      toast(e?.message || "Failed to load activity.", "error");
    }
  }

  // -----------------------------
  // Render Orchestrator
  // -----------------------------
  function render() {
    if (!state.token) {
      renderLogin();
      return;
    }

    const page =
      state.route === "dashboard"
        ? pageDashboard()
        : state.route === "upload"
        ? pageUpload()
        : state.route === "activity"
        ? pageActivity()
        : state.route === "users"
        ? pageUsers()
        : pageDocuments();

    renderShell(page);

    // Bind page-specific handlers
    if (state.route === "documents") {
      $("#uploadNewBtn").addEventListener("click", () => setRoute("upload"));

      const searchBox = $("#searchBox");
      searchBox.addEventListener("input", (e) => {
        state.search = e.target.value || "";
        render();
      });

      $("#docTbody").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const doc = state.documents.find((x) => String(x.id) === String(id));
        if (!doc) return;

        if (action === "view") {
          // PDF viewer reliability fix applies here
          await viewDocumentPdf(doc);
        } else if (action === "download") {
          await doDownload(doc);
        } else if (action === "delete") {
          await doDelete(doc);
        } else if (action === "share") {
          await doShare(doc);
        }
      });
    }

    if (state.route === "upload") {
      $("#cancelUpload").addEventListener("click", () => setRoute("documents"));
      $("#uploadForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = $("#uploadErr");
        err.classList.add("hidden");
        err.textContent = "";
        try {
          await doUpload(e.target);
        } catch (ex) {
          err.textContent = ex?.message || "Upload failed.";
          err.classList.remove("hidden");
        }
      });
    }
  }

  // -----------------------------
  // Boot
  // -----------------------------
  async function boot() {
    // If token exists, preload documents for a fast first render.
    if (state.token) {
      try {
        await Promise.allSettled([loadDocuments(), loadUsersIfAdmin(), loadActivityIfAdmin()]);
      } catch {}
    }
    render();
  }

  boot();
})();
