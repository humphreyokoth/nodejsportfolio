import { apiFetch, apiBase, missingApiBaseUserMessage } from "./api-base.js";

const form = document.getElementById("contactForm");
const btn = document.getElementById("contactSubmit");
const statusEl = document.getElementById("formStatus");

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#067647";
}

if (!apiBase() && statusEl) {
  setStatus(missingApiBaseUserMessage(), true);
}

if (form && btn) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!apiBase()) {
      setStatus(missingApiBaseUserMessage(), true);
      return;
    }

    const name = (form.querySelector("#name")?.value || "").trim();
    const email = (form.querySelector("#email")?.value || "").trim();
    const message = (form.querySelector("#message")?.value || "").trim();

    if (!name || !email || !message) {
      setStatus("Please fill in all fields.", true);
      return;
    }

    btn.disabled = true;
    const prevText = btn.textContent;
    btn.textContent = "Sending...";
    setStatus("", false);

    try {
      const res = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          message,
          userAgent: navigator.userAgent || null,
          page: location.pathname,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data.error === "string" ? data.error : "Failed to send. Please try again.";
        setStatus(msg, true);
        btn.textContent = prevText || "Send Message";
        return;
      }

      form.reset();
      btn.textContent = "Sent!";
      setStatus("Message sent successfully.", false);
      setTimeout(() => {
        btn.textContent = prevText || "Send Message";
      }, 2000);
    } catch (err) {
      console.error(err);
      btn.textContent = prevText || "Send Message";
      const net =
        err && (err.name === "TimeoutError" || err.name === "AbortError")
          ? "Request timed out. Check Railway API and your connection."
          : "Network error — confirm the API URL and CORS on Railway.";
      setStatus(net, true);
    } finally {
      btn.disabled = false;
    }
  });
}
