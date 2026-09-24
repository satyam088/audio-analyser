const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const axios = require("axios");
const { sendEmail } = require("../services/emailService");

const {
  registrationOtpEmail,
  forgotPasswordOtpEmail,
  welcomeEmail,
} = require("../services/emailTemplates");


const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

////////////////////////////////////////////
// POST /api/auth/register
// Step 1: Create unverified user + send OTP
////////////////////////////////////////////

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, mobileNumber } = req.body;

    // Check if verified user exists
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    if (existingUser && !existingUser.isVerified) {
      // Update the existing unverified user
      existingUser.name = name;
      existingUser.password = hashedPassword;
      existingUser.mobileNumber = mobileNumber;
      existingUser.otp = otp;
      existingUser.otpExpiry = otpExpiry;
      await existingUser.save();
    } else {
      // Create new unverified user
      await User.create({
        name,
        email,
        password: hashedPassword,
        mobileNumber,
        otp,
        otpExpiry,
        isVerified: false,
      });
    }

    // Send OTP email
    const emailContent = registrationOtpEmail(name, otp);
    const emailResult = await sendEmail(email, emailContent.subject, emailContent.html, {
      otp,
      type: "registration",
    });

    const responsePayload = {
      message: "OTP sent to your email. Please verify to complete registration.",
      email,
    };

    if (emailResult && emailResult.isSandboxRestriction) {
      responsePayload.warning = "Email delivery to external inbox restricted by Resend sandbox domain.";
      if (process.env.NODE_ENV !== "production") {
        responsePayload.devOtp = otp;
      }
    } else if (emailResult && emailResult.provider === "dev_fallback") {
      if (process.env.NODE_ENV !== "production") {
        responsePayload.devOtp = otp;
      }
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/verify-otp
// Step 2: Verify OTP and activate account
// ════════════════════════════════════════════
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Account already verified" });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Activate account
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // Send welcome email
    const emailContent = welcomeEmail(user.name);
    sendEmail(email, emailContent.subject, emailContent.html).catch(() => { });

    res.json({
      user,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/resend-otp
// Resend OTP for pending registration
// ════════════════════════════════════════════
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Account already verified" });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const emailContent = registrationOtpEmail(user.name, otp);
    const emailResult = await sendEmail(email, emailContent.subject, emailContent.html, {
      otp,
      type: "resend_otp",
    });

    const responsePayload = { message: "New OTP sent to your email." };
    if (emailResult && (emailResult.isSandboxRestriction || emailResult.provider === "dev_fallback")) {
      if (process.env.NODE_ENV !== "production") {
        responsePayload.devOtp = otp;
      }
    }

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/login
// Login (only verified users)
// ════════════════════════════════════════════

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email first",
        needsVerification: true,
        email,
      });
    }

    // Google-only users can't login with password
    if (!user.password) {
      return res.status(400).json({
        message: "This account uses Google Sign-In. Please login with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({
      user,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/forgot-password
// Send OTP to reset password
// ════════════════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email, isVerified: true });
    if (!user) {
      return res.status(400).json({ message: "No account found with this email" });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const emailContent = forgotPasswordOtpEmail(user.name, otp);
    const emailResult = await sendEmail(email, emailContent.subject, emailContent.html, {
      otp,
      type: "forgot_password",
    });

    const responsePayload = { message: "Password reset OTP sent to your email.", email };
    if (emailResult && (emailResult.isSandboxRestriction || emailResult.provider === "dev_fallback")) {
      if (process.env.NODE_ENV !== "production") {
        responsePayload.devOtp = otp;
      }
    }

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/reset-password
// Verify OTP + set new password
// ════════════════════════════════════════════

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.json({ message: "Password reset successfully. You can now login." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/google
// Google OAuth login/signup
// ════════════════════════════════════════════

exports.googleAuth = async (req, res) => {
  try {
    const { credential, accessToken } = req.body;

    let googleId, email, name, email_verified;

    if (accessToken) {
      // Verify using access token (from useGoogleLogin hook)
      const response = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      googleId = response.data.sub;
      email = response.data.email;
      name = response.data.name;
      email_verified = response.data.email_verified;
    } else if (credential) {
      // Verify using ID token (from Google One Tap)
      const response = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
      );
      googleId = response.data.sub;
      email = response.data.email;
      name = response.data.name;
      email_verified = response.data.email_verified === "true" || response.data.email_verified === true;
    } else {
      return res.status(400).json({ message: "No Google credential provided" });
    }

    if (!email_verified) {
      return res.status(400).json({ message: "Google email not verified" });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Link Google ID if not linked yet
      if (!user.googleId) {
        user.googleId = googleId;
        user.isVerified = true;
        await user.save();
      }
    } else {
      // Create new user via Google
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        googleId,
        isVerified: true,
        mobileNumber: "",
      });
    }

    res.json({
      user,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    console.error("Google auth error:", error.response?.data || error.message);
    res.status(400).json({ message: "Google authentication failed" });
  }
};
