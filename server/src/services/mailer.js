// Sends the two transactional emails (email OTP, password reset) through
// Brevo's HTTPS API. HTTPS is used instead of SMTP because Render's free
// tier blocks SMTP ports.
//
// Without Brevo configured, the email is logged to the console instead,
// so both flows still work in local development.
import { env } from "../config/env.js";

async function send({ to, subject, html, devFallbackLabel, devFallbackValue }) {
  if (!env.brevo.apiKey || !env.brevo.fromAddress) {
    console.warn(
      `[mailer] Brevo not configured (BREVO_API_KEY/BREVO_FROM_ADDRESS missing) — not sending "${subject}" to ${to}.\n` +
        `[mailer] ${devFallbackLabel}: ${devFallbackValue}`,
    );
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": env.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: { name: env.brevo.fromName, email: env.brevo.fromAddress },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      // Brevo's message (unverified sender, bad key, daily cap) is more useful than the status.
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Brevo responded ${res.status}`);
    }
  } catch (err) {
    // A failed send must not fail the request; log it and print the value instead.
    console.error(
      `[mailer] Brevo send failed for "${subject}" to ${to}:`,
      err.message,
    );
    console.warn(`[mailer] ${devFallbackLabel}: ${devFallbackValue}`);
  }
}

export async function sendOtpEmail(to, code) {
  await send({
    to,
    subject: "Verify your email — Escrit",
    html: `
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    `,
    devFallbackLabel: "OTP code",
    devFallbackValue: code,
  });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  await send({
    to,
    subject: "Reset your password — Escrit",
    html: `
      <p>Someone requested a password reset for this account.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a> (expires in 30 minutes).</p>
      <p>If you didn't request this, you can ignore this email — your password won't change.</p>
    `,
    devFallbackLabel: "Reset URL",
    devFallbackValue: resetUrl,
  });
}
