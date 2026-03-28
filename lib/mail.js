const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  if (!host) {
    return null;
  }
  if (!transporter) {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1",
      auth: user ? { user, pass: pass || "" } : undefined,
    });
  }
  return transporter;
}

async function notifyContactForm({ name, email, message, pagePath }) {
  const to = process.env.CONTACT_NOTIFY_EMAIL || process.env.EMAIL_TO;
  const tx = getTransporter();
  if (!tx || !to) {
    return;
  }
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    userFromEnv() ||
    `Portfolio <${to}>`;

  await tx.sendMail({
    from,
    to,
    replyTo: email,
    subject: `Contact form: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nPage: ${pagePath || "(unknown)"}\n\n${message}`,
  });
}

function userFromEnv() {
  const u = process.env.SMTP_USER || process.env.EMAIL_USER;
  return u || null;
}

module.exports = { notifyContactForm, getTransporter };
