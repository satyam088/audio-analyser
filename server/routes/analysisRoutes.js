const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const { optionalAuth, requireAuth } = require("../middleware/authMiddleware");
const {
  createAnalysis,
  getAnalyses,
  getAnalysisById,
  deleteAnalysis,
  askFollowUp,
} = require("../controllers/analysisController");

// Upload audio/video and trigger AI analysis
router.post("/upload", optionalAuth, upload.single("file"), createAnalysis);

// List previous analyses
router.get("/", optionalAuth, getAnalyses);

// Get single analysis details
router.get("/:id", optionalAuth, getAnalysisById);

// Ask follow-up question on an analysis
router.post("/:id/ask", optionalAuth, askFollowUp);

// Delete analysis
router.delete("/:id", optionalAuth, deleteAnalysis);

module.exports = router;
