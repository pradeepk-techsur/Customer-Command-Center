/**
 * Email Service
 * Sends transactional emails for password resets, welcome messages, etc.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// ============================================================================
// Configuration
// ============================================================================

const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "587", 10);
const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@techsur.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ============================================================================
// Email Transporter
// ============================================================================

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.warn("⚠️  Email not configured. Set EMAIL_USER and EMAIL_PASS environment variables.");
      console.warn("⚠️  Emails will be logged to console instead of being sent.");
    }

    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: EMAIL_USER && EMAIL_PASS ? {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      } : undefined,
    });
  }

  return transporter;
}

/**
 * Check if email service is properly configured.
 */
export function isEmailConfigured(): boolean {
  return !!(EMAIL_USER && EMAIL_PASS);
}

// ============================================================================
// Email Templates
// ============================================================================

function passwordResetEmailHtml(resetUrl: string, userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #1A1A1A; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0A0A0A; color: #FBCA5C; padding: 20px; text-align: center; }
        .content { background: #F5F5F2; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #0A0A0A; color: #FBCA5C; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TechSur Mission Control</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello ${userName},</p>
          <p>We received a request to reset your password for TechSur Mission Control.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #B0832A;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>TechSur Mission Control - AOUSC BPA TSO Support Services</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function passwordResetEmailText(resetUrl: string, userName: string): string {
  return `
TechSur Mission Control - Password Reset

Hello ${userName},

We received a request to reset your password for TechSur Mission Control.

To reset your password, visit this link:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
TechSur Mission Control - AOUSC BPA TSO Support Services
This is an automated message, please do not reply.
  `.trim();
}

function welcomeEmailHtml(userName: string, userEmail: string): string {
  const loginUrl = `${FRONTEND_URL}/login`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #1A1A1A; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0A0A0A; color: #FBCA5C; padding: 20px; text-align: center; }
        .content { background: #F5F5F2; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #0A0A0A; color: #FBCA5C; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to TechSur Mission Control</h1>
        </div>
        <div class="content">
          <h2>Account Created Successfully</h2>
          <p>Hello ${userName},</p>
          <p>Your account has been created for TechSur Mission Control.</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p>You can now log in to access your contract information, financial reports, and staffing data.</p>
          <p style="text-align: center;">
            <a href="${loginUrl}" class="button">Log In</a>
          </p>
          <p>If you have any questions or need assistance, please contact your Project Manager.</p>
        </div>
        <div class="footer">
          <p>TechSur Mission Control - AOUSC BPA TSO Support Services</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function welcomeEmailText(userName: string, userEmail: string): string {
  const loginUrl = `${FRONTEND_URL}/login`;
  return `
TechSur Mission Control - Welcome

Hello ${userName},

Your account has been created for TechSur Mission Control.

Email: ${userEmail}

You can now log in to access your contract information, financial reports, and staffing data.

Log in at: ${loginUrl}

If you have any questions or need assistance, please contact your Project Manager.

---
TechSur Mission Control - AOUSC BPA TSO Support Services
This is an automated message, please do not reply.
  `.trim();
}

// ============================================================================
// Email Sending Functions
// ============================================================================

/**
 * Send password reset email.
 * @param email - Recipient email address
 * @param userName - Recipient name
 * @param resetToken - Password reset token
 */
export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Password Reset Request - TechSur Mission Control",
    text: passwordResetEmailText(resetUrl, userName),
    html: passwordResetEmailHtml(resetUrl, userName),
  };

  if (!isEmailConfigured()) {
    console.log("\n📧 [Email Service - DEV MODE]");
    console.log("━".repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log("━".repeat(60));
    console.log(mailOptions.text);
    console.log("━".repeat(60));
    console.log(`Reset URL: ${resetUrl}\n`);
    return;
  }

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error);
    throw new Error("Failed to send password reset email");
  }
}

/**
 * Send welcome email to new user.
 * @param email - Recipient email address
 * @param userName - Recipient name
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<void> {
  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Welcome to TechSur Mission Control",
    text: welcomeEmailText(userName, email),
    html: welcomeEmailHtml(userName, email),
  };

  if (!isEmailConfigured()) {
    console.log("\n📧 [Email Service - DEV MODE]");
    console.log("━".repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log("━".repeat(60));
    console.log(mailOptions.text);
    console.log("━".repeat(60) + "\n");
    return;
  }

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error);
    // Don't throw - welcome email failure shouldn't block registration
  }
}

function magicLinkEmailText(magicLinkUrl: string, expiryMinutes: number): string {
  return `
TechSur Mission Control - Sign-in Link

Click this link to sign in (expires in ${expiryMinutes} minutes):
${magicLinkUrl}

If you didn't request this, you can safely ignore this email.

---
TechSur Mission Control
This is an automated message, please do not reply.
  `.trim();
}

function magicLinkEmailHtml(magicLinkUrl: string, expiryMinutes: number): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0A0A0A; color: #FBCA5C; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #0A0A0A; color: #FBCA5C; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>TechSur Mission Control</h1></div>
        <div class="content">
          <h2>Sign-in Link</h2>
          <p style="text-align: center;"><a href="${magicLinkUrl}" class="button">Sign In</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0066cc;">${magicLinkUrl}</p>
          <p><strong>This link will expire in ${expiryMinutes} minutes.</strong></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div class="footer"><p>TechSur Mission Control — This is an automated message, please do not reply.</p></div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send a single-use magic sign-in link to an approved user's email address.
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLinkUrl: string,
  expiryMinutes: number
): Promise<void> {
  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Your TechSur Mission Control sign-in link",
    text: magicLinkEmailText(magicLinkUrl, expiryMinutes),
    html: magicLinkEmailHtml(magicLinkUrl, expiryMinutes),
  };

  if (!isEmailConfigured()) {
    console.log("\n📧 [Email Service - DEV MODE]");
    console.log("━".repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log("━".repeat(60));
    console.log(mailOptions.text);
    console.log("━".repeat(60) + "\n");
    return;
  }

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Magic-link email sent to ${email}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send magic-link email to ${email}:`, error);
    throw new Error("Failed to send magic-link email");
  }
}

/**
 * Verify email configuration by sending a test email.
 */
export async function verifyEmailConfig(): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  try {
    await getTransporter().verify();
    console.log("✅ Email service is ready");
    return true;
  } catch (error) {
    console.error("❌ Email service verification failed:", error);
    return false;
  }
}
