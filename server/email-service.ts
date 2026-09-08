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
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Contract Transparency Portal</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello ${userName},</p>
          <p>We received a request to reset your password for the Contract Transparency Portal.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0066cc;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>Contract Transparency Portal - AOUSC BPA TSO Support Services</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function passwordResetEmailText(resetUrl: string, userName: string): string {
  return `
Contract Transparency Portal - Password Reset

Hello ${userName},

We received a request to reset your password for the Contract Transparency Portal.

To reset your password, visit this link:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
Contract Transparency Portal - AOUSC BPA TSO Support Services
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
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Contract Transparency Portal</h1>
        </div>
        <div class="content">
          <h2>Account Created Successfully</h2>
          <p>Hello ${userName},</p>
          <p>Your account has been created for the Contract Transparency Portal.</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p>You can now log in to access your contract information, financial reports, and staffing data.</p>
          <p style="text-align: center;">
            <a href="${loginUrl}" class="button">Log In</a>
          </p>
          <p>If you have any questions or need assistance, please contact your Project Manager.</p>
        </div>
        <div class="footer">
          <p>Contract Transparency Portal - AOUSC BPA TSO Support Services</p>
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
Contract Transparency Portal - Welcome

Hello ${userName},

Your account has been created for the Contract Transparency Portal.

Email: ${userEmail}

You can now log in to access your contract information, financial reports, and staffing data.

Log in at: ${loginUrl}

If you have any questions or need assistance, please contact your Project Manager.

---
Contract Transparency Portal - AOUSC BPA TSO Support Services
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
    subject: "Password Reset Request - Contract Transparency Portal",
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
    subject: "Welcome to Contract Transparency Portal",
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
