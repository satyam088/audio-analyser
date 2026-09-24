const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Strict auth middleware - requires valid token
exports.requireAuth = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required. Please log in." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password -otp");

    if (!user) {
      return res.status(401).json({ message: "User not found or token invalid." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

// Optional auth middleware - populates req.user if token is present, but doesn't block guests
exports.optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password -otp");
        if (user) {
          req.user = user;
        }
      } catch (e) {
        // Token invalid or expired, continue as guest
      }
    }
    next();
  } catch (err) {
    next();
  }
};
