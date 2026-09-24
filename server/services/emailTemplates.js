/**
 * Email Templates for AudioLens Authentication & Notifications
 */

const emailBaseLayout = (header, content) => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${header}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #20233d;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e5eaef;">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #1f233d 0%, #3d2f5a 100%); padding: 32px 30px; text-align: center;">
                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px;">
                  <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; background: #eee7ff; color: #6958a9; border-radius: 8px; font-size: 16px; font-weight: bold; text-align: center;">◉</span>
                  <span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; vertical-align: middle; margin-left: 8px;">AudioLens</span>
                </div>
                <h1 style="margin: 8px 0 0 0; color: #e9e5f5; font-size: 18px; font-weight: 500;">
                  ${header}
                </h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 36px 32px; color: #34384d; font-size: 15px; line-height: 1.65;">
                ${content}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #edf2f7; text-align: center; color: #8a92a3; font-size: 12px; line-height: 1.5;">
                <p style="margin: 0 0 4px 0;">This email was sent by <strong>AudioLens AI Audio Intelligence</strong>.</p>
                <p style="margin: 0;">If you did not request this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

/**
 * Registration OTP Email Template
 */
const registrationOtpEmail = (name, otp) => {
  const safeName = name ? String(name).trim() : "there";
  const header = "Verify Your Email Address";
  const content = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeName}</strong>,</p>
    <p>Thank you for signing up for <strong>AudioLens</strong>. To complete your registration and activate your account, please enter the 6-digit verification code below:</p>

    <div style="margin: 28px 0; text-align: center;">
      <div style="display: inline-block; padding: 14px 32px; background: #f3effe; border: 2px dashed #9573dc; border-radius: 10px; font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #5a3ea0;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #7a8294; margin-top: 10px;">This code will expire in <strong>10 minutes</strong>.</p>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-bottom: 0;">
      Once verified, you'll be able to transcribe recordings, generate Gemini executive summaries, extract actionable insights, and chat with your audio files.
    </p>
  `;

  return {
    subject: `Your AudioLens Verification Code: ${otp}`,
    html: emailBaseLayout(header, content),
  };
};

/**
 * Forgot Password OTP Email Template
 */
const forgotPasswordOtpEmail = (name, otp) => {
  const safeName = name ? String(name).trim() : "there";
  const header = "Reset Your Password";
  const content = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeName}</strong>,</p>
    <p>We received a request to reset your AudioLens account password. Enter this verification code to proceed:</p>

    <div style="margin: 28px 0; text-align: center;">
      <div style="display: inline-block; padding: 14px 32px; background: #fff1f2; border: 2px dashed #f43f5e; border-radius: 10px; font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #be123c;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #7a8294; margin-top: 10px;">This code will expire in <strong>10 minutes</strong>.</p>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-bottom: 0;">
      If you did not request a password reset, please ignore this email or reach out to support if you have security concerns.
    </p>
  `;

  return {
    subject: `AudioLens Password Reset Code: ${otp}`,
    html: emailBaseLayout(header, content),
  };
};

/**
 * Welcome Email Template (Post verification)
 */
const welcomeEmail = (name) => {
  const safeName = name ? String(name).trim() : "there";
  const header = "Welcome to AudioLens!";
  const content = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeName}</strong>,</p>
    <p>Your email address has been successfully verified, and your AudioLens account is now active.</p>

    <div style="background: #f8fafc; border-left: 4px solid #856cc1; padding: 16px 20px; border-radius: 6px; margin: 24px 0;">
      <strong style="color: #20233d; display: block; margin-bottom: 8px;">What you can do with AudioLens:</strong>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
        <li>Upload audio/video files (MP3, WAV, MP4, FLAC, MOV)</li>
        <li>Transcribe speech with high-accuracy Whisper AI</li>
        <li>Extract Google Gemini executive summaries and action items</li>
        <li>Ask interactive follow-up questions about your recordings</li>
      </ul>
    </div>

    <p style="font-size: 14px; margin-bottom: 0;">
      Ready to analyze your first recording? Open your workspace and get started!
    </p>
  `;

  return {
    subject: "Welcome to AudioLens — Your account is active!",
    html: emailBaseLayout(header, content),
  };
};

module.exports = {
  emailBaseLayout,
  registrationOtpEmail,
  forgotPasswordOtpEmail,
  welcomeEmail,
};
