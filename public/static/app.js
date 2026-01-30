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
    })).filter((d) => d.i
