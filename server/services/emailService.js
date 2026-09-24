require("dotenv").config();
const { Resend } = require("resend");
const nodemailer = require("nodemailer");

let resendClient = null;
if (process.env.RESEND_API_KEY) {
  try {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  } catch (err) {
    console.warn("[EmailService] Failed to initialize Resend client:", err.message);
  }
}

/**
 * Configure Nodemailer transport if SMTP variables are set in environment
 */
const getSmtpTransporter = () => {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

/**
 * Send an email using SMTP (Nodemailer) or Resend API, with robust error detection
 * and development console fallback.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML email body content
 * @param {object} meta - Optional metadata such as { otp, type }
 * @returns {Promise<{success: boolean, provider: string, id?: string, isSandboxRestriction?: boolean, error?: string}>}
 */
const sendEmail = async (to, subject, html, meta = {}) => {
  const otpCode = meta.otp || (subject.match(/\b\d{6}\b/) ? subject.match(/\b\d{6}\b/)[0] : null);

  // 1. Check if SMTP / Nodemailer is configured
  const smtpTransporter = getSmtpTransporter();
  if (smtpTransporter) {
    try {
      const fromAddress = process.env.SMTP_FROM || `"AudioLens" <${process.env.SMTP_USER}>`;
      const info = await smtpTransporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });
      console.log(`[EmailService] Email sent via SMTP to ${to} (MessageId: ${info.messageId})`);
      return { success: true, provider: "smtp", id: info.messageId };
    } catch (smtpErr) {
      console.error("[EmailService SMTP Error]:", smtpErr.message);
      // Fall through to Resend if available
    }
  }

  // 2. Try Resend if configured
  if (resendClient && process.env.RESEND_API_KEY) {
    try {
      const sender = process.env.EMAIL_USER || "onboarding@resend.dev";
      const from = sender.includes("<") ? sender : `"AudioLens" <${sender}>`;

      const result = await resendClient.emails.send({
        from,
        to,
        subject,
        html,
      });

      if (result.error) {
        console.error("[EmailService Resend Error]:", result.error);
        const errMsg = result.error.message || "";
        const isSandbox =
          result.error.statusCode === 403 ||
          errMsg.includes("testing emails to your own email address") ||
          errMsg.includes("domain");

        if (isSandbox) {
          console.warn("\n=======================================================");
          console.warn("⚠️  [EMAIL NOTICE - RESEND SANDBOX RESTRICTION]");
          console.warn(`Resend account is currently in test mode with unverified domain (${sender}).`);
          console.warn(`It can only send to the account owner's email.`);
          if (otpCode) {
            console.warn(`🔑 [DEV OTP CODE FOR ${to}]: ${otpCode}`);
          }
          console.warn("To send to any email address:");
          console.warn("  • Verify a domain at https://resend.com/domains and set EMAIL_USER=noreply@yourdomain.com");
          console.warn("  • OR configure SMTP_USER & SMTP_PASS in server/.env to use Gmail/Nodemailer");
          console.warn("=======================================================\n");

          return {
            success: false,
            provider: "resend",
            isSandboxRestriction: true,
            error: errMsg,
            otp: otpCode,
          };
        }

        return {
          success: false,
          provider: "resend",
          error: errMsg,
          otp: otpCode,
        };
      }

      console.log(`[EmailService] Email successfully sent via Resend to ${to} (ID: ${result.data?.id})`);
      return { success: true, provider: "resend", id: result.data?.id };
    } catch (resendCatchErr) {
      console.error("[EmailService Resend Exception]:", resendCatchErr.message);
    }
  }

  // 3. Fallback for Local Development / Offline Testing
  console.log("\n=======================================================");
  console.log("📨 [MOCK EMAIL SERVICE / DEV FALLBACK]");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  if (otpCode) {
    console.log(`OTP:     ${otpCode}`);
  }
  console.log("=======================================================\n");

  return {
    success: true,
    provider: "dev_fallback",
    otp: otpCode,
  };
};

module.exports = { sendEmail };