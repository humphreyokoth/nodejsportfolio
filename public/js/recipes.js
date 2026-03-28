import {
  apiFetch,
  apiBase,
  setAuthToken,
  clearAuthToken,
  missingApiBaseUserMessage,
} from "./api-base.js";

const form = document.getElementById("recipeForm");
const submitBtn = document.getElementById("recipeSubmit");
const statusEl = document.getElementById("recipeStatus");
const listEl = document.getElementById("recipesList");
const authPanel = document.getElementById("recipeAuthPanel");
const plannerPanel = document.getElementById("recipePlannerPanel");
const loginForm = document.getElementById("recipeLoginForm");
const loginUser = document.getElementById("recipeLoginUsername");
const loginPass = document.getElementById("recipeLoginPassword");
const loginBtn = document.getElementById("recipeLoginSubmit");
const logoutBtn = document.getElementById("recipeLogoutBtn");
const exportBtn = document.getElementById("recipeExportXlsx");
const authGreeting = document.getElementById("recipeAuthGreeting");
const loginStatusEl = document.getElementById("recipeLoginStatus");
const tabLoginBtn = document.getElementById("recipeTabLogin");
const tabSignupBtn = document.getElementById("recipeTabSignup");
const loginSection = document.getElementById("recipeLoginSection");
const signupSection = document.getElementById("recipeSignupSection");
const signupForm = document.getElementById("recipeSignupForm");
const signupUser = document.getElementById("recipeSignupUsername");
const signupPass = document.getElementById("recipeSignupPassword");
const signupPass2 = document.getElementById("recipeSignupPassword2");
const signupBtn = document.getElementById("recipeSignupSubmit");
const signupStatusEl = document.getElementById("recipeSignupStatus");
const recipeImageInput = document.getElementById("recipeImage");
const recipeImageUrlInput = document.getElementById("recipeImageUrl");
const recipeClearImageWrap = document.getElementById("recipeClearImageWrap");
const recipeClearImage = document.getElementById("recipeClearImage");
const recipeImagePreview = document.getElementById("recipeImagePreview");
const recipeImagePreviewImg = document.getElementById("recipeImagePreviewImg");

let currentFilter = "all";
let currentEditId = null;
const items = [];
let previewObjectUrl = null;

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#067647";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearImagePreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  if (recipeImagePreview) recipeImagePreview.style.display = "none";
  if (recipeImagePreviewImg) recipeImagePreviewImg.removeAttribute("src");
}

function showImagePreview(src) {
  if (!recipeImagePreview || !recipeImagePreviewImg || !src) return;
  recipeImagePreview.style.display = "block";
  recipeImagePreviewImg.src = src;
}

function safeDisplayImageSrc(item) {
  const u = item.imageUrl;
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) {
    if (/["'<>]/.test(u)) return null;
    return u;
  }
  if (u.startsWith("/uploads/")) {
    return apiBase() + u;
  }
  return null;
}

function mealLabel(mealType) {
  if (mealType === "breakfast") return "Breakfast";
  if (mealType === "lunch") return "Lunch";
  if (mealType === "dinner") return "Dinner";
  return mealType || "Meal";
}

function renderItems() {
  if (!listEl) return;

  const filtered =
    currentFilter === "all" ? items : items.filter((x) => x.mealType === currentFilter);

  if (filtered.length === 0) {
    listEl.innerHTML = `<p style="margin:0; opacity:.85;">No meals yet.</p>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((item) => {
      const title = escapeHtml(item.title);
      const notes = item.notes ? escapeHtml(item.notes) : "";
      const disp = safeDisplayImageSrc(item);
      const imgBlock = disp
        ? `<div style="margin-top:10px;"><img src="${escapeHtml(disp)}" alt="" loading="lazy" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:cover;"></div>`
        : "";
      return `
      <div class="card" style="padding: 14px; margin: 10px 0;">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; opacity:.75;">
              ${mealLabel(item.mealType)}
            </div>
            <div style="font-weight:700; font-size:18px; margin-top:4px;">${title}</div>
            ${notes ? `<div style="margin-top:8px; opacity:.9; white-space:pre-wrap;">${notes}</div>` : ""}
            ${imgBlock}
          </div>
          <div style="display:flex; gap:8px; align-items:flex-start;">
            <button class="btn btn-outline" type="button" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
            <button class="btn btn-outline" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function buildRecipeFormData(mealType, title, notes) {
  const fd = new FormData();
  fd.append("mealType", mealType);
  fd.append("title", title);
  fd.append("notes", notes);
  const file = recipeImageInput?.files?.[0];
  if (file) fd.append("image", file);
  const url = (recipeImageUrlInput?.value || "").trim();
  if (url) fd.append("imageUrl", url);
  if (currentEditId && recipeClearImage?.checked) {
    fd.append("clearImage", "1");
  }
  return fd;
}

function resetRecipeFormFields() {
  clearImagePreview();
  if (recipeImageInput) recipeImageInput.value = "";
  if (recipeImageUrlInput) recipeImageUrlInput.value = "";
  if (recipeClearImage) recipeClearImage.checked = false;
  if (recipeClearImageWrap) recipeClearImageWrap.hidden = true;
}

async function loadRecipes() {
  const res = await apiFetch("/api/recipes");
  if (!res.ok) {
    throw new Error("load failed");
  }
  const data = await res.json();
  items.length = 0;
  for (const r of data.recipes || []) {
    items.push(r);
  }
  renderItems();
}

function showLoggedOut() {
  clearAuthToken();
  if (authPanel) authPanel.hidden = false;
  if (plannerPanel) plannerPanel.hidden = true;
  if (authGreeting) authGreeting.textContent = "";
  items.length = 0;
  if (listEl) listEl.innerHTML = "";
  resetRecipeFormFields();
  currentEditId = null;
  if (submitBtn) submitBtn.textContent = "Add";
}

function showLoggedIn(username) {
  if (authPanel) authPanel.hidden = true;
  if (plannerPanel) plannerPanel.hidden = false;
  if (authGreeting) {
    authGreeting.textContent = username ? `Signed in as ${username}` : "";
  }
}

async function checkSession() {
  const res = await apiFetch("/api/auth/me");
  if (res.ok) {
    const data = await res.json();
    const name = data.user?.username || "";
    showLoggedIn(name);
    await loadRecipes();
    return;
  }
  showLoggedOut();
}

function setAuthTab(showSignup) {
  if (loginSection) loginSection.hidden = !!showSignup;
  if (signupSection) signupSection.hidden = !showSignup;
  if (tabLoginBtn && tabSignupBtn) {
    tabLoginBtn.classList.toggle("btn-primary", !showSignup);
    tabLoginBtn.classList.toggle("btn-outline", !!showSignup);
    tabSignupBtn.classList.toggle("btn-primary", !!showSignup);
    tabSignupBtn.classList.toggle("btn-outline", !showSignup);
    tabLoginBtn.setAttribute("aria-pressed", String(!showSignup));
    tabSignupBtn.setAttribute("aria-pressed", String(!!showSignup));
  }
}

if (tabLoginBtn) {
  tabLoginBtn.addEventListener("click", () => setAuthTab(false));
}
if (tabSignupBtn) {
  tabSignupBtn.addEventListener("click", () => setAuthTab(true));
}

if (signupForm && signupBtn) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = (signupUser?.value || "").trim();
    const password = signupPass?.value || "";
    const password2 = signupPass2?.value || "";
    if (!username || !password) return;
    if (password !== password2) {
      if (signupStatusEl) {
        signupStatusEl.textContent = "Passwords do not match.";
        signupStatusEl.style.color = "#b42318";
      }
      return;
    }
    if (signupStatusEl) {
      signupStatusEl.textContent = "";
      signupStatusEl.style.color = "#b42318";
    }
    signupBtn.disabled = true;
    const prev = signupBtn.textContent;
    signupBtn.textContent = "Creating…";
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (signupStatusEl) {
          signupStatusEl.textContent =
            typeof data.error === "string" ? data.error : "Could not create account.";
          signupStatusEl.style.color = "#b42318";
        }
      } else {
        if (typeof data.token === "string" && data.token) {
          setAuthToken(data.token);
        }
        if (signupPass) signupPass.value = "";
        if (signupPass2) signupPass2.value = "";
        showLoggedIn(data.user?.username || username);
        try {
          await loadRecipes();
        } catch (loadErr) {
          console.error(loadErr);
          setStatus("Signed in but could not load meals. Refresh the page.", true);
        }
      }
    } catch (err) {
      console.error(err);
      if (signupStatusEl) {
        const msg =
          err && (err.name === "TimeoutError" || err.name === "AbortError")
            ? "Request timed out. Try again."
            : "Network error — open DevTools → Network, or confirm Railway API and CORS.";
        signupStatusEl.textContent = msg;
        signupStatusEl.style.color = "#b42318";
      }
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = prev || "Create account";
    }
  });
}

if (loginForm && loginBtn) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = (loginUser?.value || "").trim();
    const password = loginPass?.value || "";
    if (!username || !password) return;
    if (loginStatusEl) {
      loginStatusEl.textContent = "";
      loginStatusEl.style.color = "#b42318";
    }
    loginBtn.disabled = true;
    const prev = loginBtn.textContent;
    loginBtn.textContent = "Signing in…";
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (loginStatusEl) {
          loginStatusEl.textContent =
            typeof data.error === "string" ? data.error : "Login failed.";
          loginStatusEl.style.color = "#b42318";
        }
      } else {
        if (typeof data.token === "string" && data.token) {
          setAuthToken(data.token);
        }
        if (loginPass) loginPass.value = "";
        showLoggedIn(data.user?.username || username);
        try {
          await loadRecipes();
        } catch (loadErr) {
          console.error(loadErr);
          setStatus("Signed in but could not load meals. Refresh the page.", true);
        }
      }
    } catch (err) {
      console.error(err);
      if (loginStatusEl) {
        const msg =
          err && (err.name === "TimeoutError" || err.name === "AbortError")
            ? "Request timed out. Try again."
            : "Network error — confirm API URL and CORS on Railway.";
        loginStatusEl.textContent = msg;
        loginStatusEl.style.color = "#b42318";
      }
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = prev || "Sign in";
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    currentEditId = null;
    if (form) form.reset();
    resetRecipeFormFields();
    if (submitBtn) submitBtn.textContent = "Add";
    showLoggedOut();
  });
}

if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    try {
      exportBtn.disabled = true;
      const res = await apiFetch("/api/recipes/export.xlsx");
      if (!res.ok) {
        setStatus("Could not download Excel file.", true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meals-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Excel report downloaded.", false);
    } catch (err) {
      console.error(err);
      setStatus("Export failed.", true);
    } finally {
      exportBtn.disabled = false;
    }
  });
}

if (recipeImageInput) {
  recipeImageInput.addEventListener("change", () => {
    clearImagePreview();
    const f = recipeImageInput.files?.[0];
    if (!f) return;
    previewObjectUrl = URL.createObjectURL(f);
    showImagePreview(previewObjectUrl);
  });
}

document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.getAttribute("data-filter") || "all";
    renderItems();
  });
});

if (form && submitBtn) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const mealTypeEl = form.querySelector("#mealType");
    const titleEl = form.querySelector("#title");
    const notesEl = form.querySelector("#notes");

    const mealType = (mealTypeEl?.value || "breakfast").trim();
    const title = (titleEl?.value || "").trim();
    const notes = (notesEl?.value || "").trim();

    if (!title) {
      setStatus("Please enter a food title.", true);
      return;
    }

    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    submitBtn.textContent = currentEditId ? "Updating…" : "Saving…";
    setStatus("", false);

    const fd = buildRecipeFormData(mealType, title, notes);

    try {
      if (currentEditId) {
        const res = await apiFetch(`/api/recipes/${currentEditId}`, {
          method: "PATCH",
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(data.error || "Update failed.", true);
          return;
        }
        const r = data.recipe;
        const i = items.findIndex((x) => x.id === currentEditId);
        if (i >= 0 && r) items[i] = r;
        setStatus("Meal updated.", false);
      } else {
        const res = await apiFetch("/api/recipes", {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(data.error || "Save failed.", true);
          return;
        }
        if (data.recipe) items.unshift(data.recipe);
        setStatus("Meal added.", false);
      }

      form.reset();
      resetRecipeFormFields();
      currentEditId = null;
      submitBtn.textContent = "Add";
      renderItems();
    } catch (err) {
      console.error(err);
      setStatus("Request failed. Try again.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = currentEditId ? "Update" : prevText || "Add";
    }
  });
}

async function handleDelete(id) {
  const res = await apiFetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("delete failed");
  const idx = items.findIndex((x) => x.id === id);
  if (idx >= 0) items.splice(idx, 1);
  renderItems();
}

function handleEdit(id) {
  const item = items.find((x) => x.id === id);
  if (!item || !form || !submitBtn) return;

  const mealTypeEl = form.querySelector("#mealType");
  const titleEl = form.querySelector("#title");
  const notesEl = form.querySelector("#notes");

  if (mealTypeEl) mealTypeEl.value = item.mealType || "breakfast";
  if (titleEl) titleEl.value = item.title || "";
  if (notesEl) notesEl.value = item.notes || "";

  clearImagePreview();
  if (recipeImageInput) recipeImageInput.value = "";
  const iu = item.imageUrl || "";
  if (recipeImageUrlInput) {
    recipeImageUrlInput.value = /^https?:\/\//i.test(iu) ? iu : "";
  }
  if (recipeClearImageWrap) recipeClearImageWrap.hidden = !iu;
  if (recipeClearImage) recipeClearImage.checked = false;

  const disp = safeDisplayImageSrc(item);
  if (disp) showImagePreview(disp);

  currentEditId = id;
  submitBtn.textContent = "Update";
  setStatus("Edit the fields above, then click Update.", false);
}

if (listEl) {
  listEl.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-action");
    const id = target.getAttribute("data-id");
    if (!action || !id) return;

    try {
      if (action === "delete") {
        const ok = confirm("Delete this meal?");
        if (!ok) return;
        await handleDelete(id);
      }
      if (action === "edit") {
        handleEdit(id);
      }
    } catch (err) {
      console.error(err);
      setStatus("Action failed. Try again.", true);
    }
  });
}

if (!apiBase() && loginStatusEl) {
  loginStatusEl.textContent = missingApiBaseUserMessage();
  loginStatusEl.style.color = "#b42318";
}

checkSession().catch(() => showLoggedOut());
