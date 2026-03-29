import { apiFetch, clearAuthToken, apiBase } from "./api-base.js?v=4";

const authWall   = document.getElementById("authWall");
const dashContent = document.getElementById("dashContent");
const dashGreeting = document.getElementById("dashGreeting");
const dashLogoutBtn = document.getElementById("dashLogoutBtn");
const msgList    = document.getElementById("msgList");
const pagination = document.getElementById("pagination");
const statTotal  = document.getElementById("statTotal");
const statPage   = document.getElementById("statPage");

let currentPage = 1;
let totalPages  = 1;

// ── Auth check ──────────────────────────────────────────────────
async function init() {
  try {
    const res = await apiFetch("/api/auth/me");
    if (!res.ok) { showAuthWall(); return; }
    const data = await res.json();
    dashGreeting.textContent = `Welcome back, ${data.user?.username || "admin"}`;
    authWall.style.display   = "none";
    dashContent.style.display = "block";
    await loadMessages(1);
  } catch {
    showAuthWall();
  }
}

function showAuthWall() {
  authWall.style.display   = "block";
  dashContent.style.display = "none";
}

// ── Load messages ────────────────────────────────────────────────
async function loadMessages(page) {
  currentPage = page;
  statPage.textContent = page;
  msgList.innerHTML = `<div class="loading-row">Loading…</div>`;
  pagination.innerHTML = "";

  try {
    const res = await apiFetch(`/api/messages?page=${page}`);
    if (!res.ok) {
      msgList.innerHTML = `<div class="loading-row" style="color:#b42318;">Failed to load messages.</div>`;
      return;
    }
    const data = await res.json();
    totalPages = data.pages || 1;
    statTotal.textContent = data.total ?? "—";
    renderMessages(data.messages || []);
    renderPagination(data.total, data.pages);
  } catch (err) {
    msgList.innerHTML = `<div class="loading-row" style="color:#b42318;">Network error. Is the API running?</div>`;
    console.error(err);
  }
}

// ── Render messages ──────────────────────────────────────────────
function renderMessages(messages) {
  if (messages.length === 0) {
    msgList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No messages yet. Share your contact page and they'll appear here.</p>
      </div>`;
    return;
  }

  msgList.innerHTML = messages.map((m) => {
    const date = new Date(m.created_at).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const safeName    = escHtml(m.name);
    const safeEmail   = escHtml(m.email);
    const safeMsg     = escHtml(m.message);
    const safePage    = m.page_path ? escHtml(m.page_path) : "";

    return `
    <div class="msg-card" data-id="${m.id}">
      <div class="msg-meta">
        <div>
          <div class="msg-sender">${safeName}</div>
          <a class="msg-email" href="mailto:${safeEmail}?subject=Re: your message">${safeEmail}</a>
          ${safePage ? `<div class="msg-page">From: ${safePage}</div>` : ""}
        </div>
        <div class="msg-date">${date}</div>
      </div>
      <div class="msg-body">${safeMsg}</div>
      <div class="msg-actions">
        <a class="btn-reply" href="mailto:${safeEmail}?subject=Re: your message&body=Hi ${encodeURIComponent(m.name)},%0A%0A">Reply via email</a>
        <button class="btn-delete" data-delete="${m.id}">Delete</button>
      </div>
    </div>`;
  }).join("");
}

// ── Pagination ───────────────────────────────────────────────────
function renderPagination(total, pages) {
  if (pages <= 1) { pagination.innerHTML = ""; return; }

  let html = "";
  if (currentPage > 1) {
    html += `<button class="page-btn" data-page="${currentPage - 1}">← Prev</button>`;
  }
  for (let p = 1; p <= pages; p++) {
    html += `<button class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`;
  }
  if (currentPage < pages) {
    html += `<button class="page-btn" data-page="${currentPage + 1}">Next →</button>`;
  }
  pagination.innerHTML = html;
}

// ── Event delegation ─────────────────────────────────────────────
msgList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-delete]");
  if (!btn) return;
  const id = btn.getAttribute("data-delete");
  if (!confirm("Delete this message? This cannot be undone.")) return;
  btn.disabled = true;
  btn.textContent = "Deleting…";
  try {
    const res = await apiFetch(`/api/messages/${id}`, { method: "DELETE" });
    if (res.ok) {
      const card = msgList.querySelector(`[data-id="${id}"]`);
      if (card) {
        card.style.opacity = "0";
        card.style.transition = "opacity .3s";
        setTimeout(() => { loadMessages(currentPage); }, 300);
      }
    } else {
      btn.disabled = false;
      btn.textContent = "Delete";
      alert("Could not delete. Try again.");
    }
  } catch {
    btn.disabled = false;
    btn.textContent = "Delete";
    alert("Network error.");
  }
});

pagination.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  if (!btn) return;
  const p = Number(btn.getAttribute("data-page"));
  if (p && p !== currentPage) loadMessages(p);
});

dashLogoutBtn.addEventListener("click", async () => {
  await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  clearAuthToken();
  window.location.href = "/";
});

// ── Helpers ──────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

init();
