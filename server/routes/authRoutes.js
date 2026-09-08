const express = require("express");
const {
    registerUser,
    loginUser,
    verifyOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    googleAuth,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/google", googleAuth);

module.exports = router;
