const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const axios = require("axios");

// Load environment variables
dotenv.config();

const connectDB = require("./config/connectDB");
const authRoutes = require("./routes/authRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const { hasS3Config } = require("./services/s3Service");

const app = express();

// Ensure local uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Enable CORS for frontend clients
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing with generous limits for audio/video metadata
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Static file serving: Uploads directory & Client Frontend
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(path.join(__dirname, "../client")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/analyses", analysisRoutes);

// Health check endpoint verifying both Node and Python servers
app.get("/api/health", async (req, res) => {
  const pythonUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
  let pythonStatus = { online: false, detail: "Unreachable" };

  try {
    const pyRes = await axios.get(`${pythonUrl}/api/v1/health`, { timeout: 3000 });
    pythonStatus = { online: true, data: pyRes.data };
  } catch (err) {
    pythonStatus = { online: false, error: err.message };
  }

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    nodeBackend: {
      port: process.env.PORT || 5001,
      s3Configured: hasS3Config(),
    },
    pythonBackend: pythonStatus,
  });
});

// Fallback to client index.html for root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// Global 404 handler for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: `API endpoint ${req.originalUrl} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.stack || err.message);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected server error occurred",
  });
});

const PORT = process.env.PORT || 5001;

// Start server and initialize MongoDB connection
app.listen(PORT, async () => {
  console.log(`\n========================================`);
  console.log(`🚀 AudioLens Node Backend running on port ${PORT}`);
  console.log(`📁 Uploads served at: http://localhost:${PORT}/uploads`);
  console.log(`🌐 Frontend served at: http://localhost:${PORT}`);
  console.log(`🐍 Python AI service expected at: ${process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000"}`);
  console.log(`☁️  AWS S3 configured: ${hasS3Config() ? "YES" : "NO (using local fallback)"}`);
  console.log(`========================================\n`);

  try {
    await connectDB();
  } catch (dbErr) {
    console.error("MongoDB initial connection notice:", dbErr.message);
  }
});