const { Resend } = require("resend");

// Resend client — created once, lazily
let resendClient = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

// On Resend free tier (no verified domain), FROM must be onboarding@resend.dev.
// Once you verify a domain at resend.com you can change this to your own address.
const DEFAULT_FROM = "Portfolio <onboarding@resend.dev>";

async function notifyContactForm({ name, email, message, pagePath }) {
  const client = getResend();
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  if (!client || !to) return;

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  await client.emails.send({
    from,
    to,
    reply_to: `${name} <${email}>`,
    subject: `New contact from ${name}`,
    text: [`Name:  ${name}`, `Email: ${email}`, `Page:  ${pagePath || "(contact page)"}`, "", message].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#6c5ce7">New contact message</h2>
        <p><strong>Name:</strong> ${esc(name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
        <p><strong>Page:</strong> ${esc(pagePath || "(contact page)")}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="white-space:pre-wrap;line-height:1.6">${esc(message)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="color:#999;font-size:12px">Hit reply to respond directly to ${esc(name)}.</p>
      </div>
    `,
  });
}

async function sendTestEmail() {
  const client = getResend();
  const to = process.env.CONTACT_NOTIFY_EMAIL;

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not set. Get a free key at resend.com" };
  }
  if (!to) {
    return { ok: false, error: "CONTACT_NOTIFY_EMAIL not set." };
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  try {
    const result = await client.emails.send({
      from,
      to,
      subject: "Portfolio email test ✓",
      text: "This is a test email from your portfolio. If you can read this, email is working!",
    });
    if (result.error) return { ok: false, error: result.error.message || JSON.stringify(result.error) };
    return { ok: true, id: result.data?.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = { notifyContactForm, sendTestEmail };
