const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  if (!host) return null;

  if (!transporter) {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
    // port 465 = SSL (secure:true), port 587 = STARTTLS (secure:false)
    const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1" || port === 465;

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: pass || "" } : undefined,
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

async function notifyContactForm({ name, email, message, pagePath }) {
  const to = process.env.CONTACT_NOTIFY_EMAIL || process.env.EMAIL_TO;
  const tx = getTransporter();
  if (!tx || !to) return;

  const senderUser = process.env.SMTP_USER || process.env.EMAIL_USER || "";
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || `"Humphrey Portfolio" <${senderUser}>`;

  await tx.sendMail({
    from,
    to,
    replyTo: `"${name}" <${email}>`,
    subject: `New contact from ${name}`,
    text: [
      `Name:    ${name}`,
      `Email:   ${email}`,
      `Page:    ${pagePath || "(contact page)"}`,
      ``,
      message,
    ].join("\n"),
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Page:</strong> ${pagePath || "(contact page)"}</p>
      <hr/>
      <p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
    `,
  });
}

module.exports = { notifyContactForm, getTransporter };
