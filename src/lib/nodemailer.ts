import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/server/http";

// ─── Transporter (singleton pattern) ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465, // implicit TLS on 465, STARTTLS otherwise
  requireTLS: Number(process.env.SMTP_PORT) !== 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Email Templates ──────────────────────────────────────────────────────────
function buildOTPEmail(code: string, title: string, subtitle: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: 'Inter', sans-serif; background: #0b0c10; color: #f1f5f9; padding: 40px; margin: 0;">
        <div style="max-width: 480px; margin: auto; background: #11131a; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 40px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-flex; width: 48px; height: 48px; background: linear-gradient(135deg, #10b981, #06b6d4); border-radius: 14px; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white;">C</div>
            <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.3px; margin: 16px 0 4px;">${title}</h1>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">${subtitle}</p>
          </div>
          <div style="background: #0b0c10; border: 1px solid rgba(255,255,255,0.04); border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="color: #64748b; font-size: 12px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
            <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #10b981;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">This code expires in <strong style="color: #94a3b8;">10 minutes</strong>. Do not share it with anyone.</p>
        </div>
      </body>
    </html>
  `;
}

function buildNotificationEmail(title: string, subtitle: string, actionText: string, actionUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: 'Inter', sans-serif; background: #0b0c10; color: #f1f5f9; padding: 40px; margin: 0;">
        <div style="max-width: 480px; margin: auto; background: #11131a; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 40px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-flex; width: 48px; height: 48px; background: linear-gradient(135deg, #10b981, #06b6d4); border-radius: 14px; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white;">C</div>
            <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.3px; margin: 16px 0 4px;">${title}</h1>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">${subtitle}</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${actionUrl}" style="display: inline-block; background: #10b981; color: #0b0c10; padding: 14px 28px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 14px;">${actionText}</a>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0; line-height: 1.6;">If the button doesn't work, copy this link: <br/> <a href="${actionUrl}" style="color: #10b981; text-decoration: none;">${actionUrl}</a></p>
        </div>
      </body>
    </html>
  `;
}

/** Strips control characters (header injection) and caps length. */
function sanitizeName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60) || "Someone";
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function sendOTPEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: `"Chatly" <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} is your Chatly verification code`,
    html: buildOTPEmail(code, "Verify your account", "Enter this code to activate your Chatly account."),
  });
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: `"Chatly" <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} — Chatly password reset`,
    html: buildOTPEmail(code, "Reset your password", "Use this code to reset your Chatly account password."),
  });
}

export async function sendRequestEmail(to: string, fromName: string): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/chat`;
  fromName = sanitizeName(fromName);
  await transporter.sendMail({
    from: `"Chatly" <${process.env.SMTP_USER}>`,
    to,
    subject: `${fromName} sent you a message request`,
    html: buildNotificationEmail(
      "New Chat Request",
      `${escapeHtml(fromName)} wants to start a conversation with you on Chatly.`,
      "View Request",
      url
    ),
  });
}

export async function sendRejectionEmail(to: string, fromName: string): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/chat`;
  fromName = sanitizeName(fromName);
  await transporter.sendMail({
    from: `"Chatly" <${process.env.SMTP_USER}>`,
    to,
    subject: `Update on your message to ${fromName}`,
    html: buildNotificationEmail(
      "Message Request Declined",
      `${escapeHtml(fromName)} has declined your connection request.`,
      "Open Chatly",
      url
    ),
  });
}
