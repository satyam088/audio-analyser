const Analysis = require("../models/Analysis");
const { uploadMediaFile } = require("../services/s3Service");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";

/**
 * Upload Audio or Video and run AI analysis pipeline (Whisper + Gemini)
 * POST /api/analyses/upload
 */
exports.createAnalysis = async (req, res) => {
  try {
    if (!req.file && !req.body.fileUrl) {
      return res.status(400).json({ message: "Please provide an audio or video file or file URL." });
    }

    let fileUrl = req.body.fileUrl;
    let originalName = req.body.title || "Uploaded Recording";
    let mimeType = "audio/mpeg";
    let fileSize = 0;
    let s3Key = null;
    let localPath = null;

    if (req.file) {
      originalName = req.file.originalname;
      mimeType = req.file.mimetype;
      fileSize = req.file.size;

      // Upload to AWS S3 (or fallback to local uploads/ if AWS keys are not configured yet)
      const uploadResult = await uploadMediaFile(
        req.file.buffer,
        originalName,
        mimeType
      );
      fileUrl = uploadResult.fileUrl;
      s3Key = uploadResult.key;
      localPath = uploadResult.localPath || null;
    }

    const isVideo = mimeType.startsWith("video/") ||
      [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(
        path.extname(originalName).toLowerCase()
      );
    const mediaType = isVideo ? "video" : "audio";

    // Clean title for display
    const rawTitle = req.body.title || path.basename(originalName, path.extname(originalName));
    const title = rawTitle
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Create DB record with pending / processing status
    const analysis = new Analysis({
      user: req.user ? req.user._id : null,
      title,
      originalFileName: originalName,
      fileUrl,
      s3Key,
      mediaType,
      mimeType,
      fileSize,
      status: "processing",
    });

    await analysis.save();

    // Call Python backend to run transcription and Gemini AI analysis
    try {
      console.log(`[Node Server] Calling Python backend at ${PYTHON_BACKEND_URL}/api/v1/process`);
      const pyResponse = await axios.post(
        `${PYTHON_BACKEND_URL}/api/v1/process`,
        {
          file_url: fileUrl,
          local_path: localPath,
          title: title,
        },
        { timeout: 300000 } // 5 minute timeout for long audio/video files
      );

      const data = pyResponse.data;

      // Update analysis with results from Python backend
      analysis.status = "completed";
      analysis.transcript = data.text || "";
      analysis.detectedLanguage = data.detected_language || "en";
      analysis.languageProbability = data.language_probability || 1.0;
      analysis.duration = data.duration_seconds || 0;
      analysis.segments = (data.segments || []).map((seg, idx) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
        speaker: seg.speaker || `Speaker ${Math.floor(idx / 3) + 1}`,
      }));

      if (data.summary) {
        analysis.summary = {
          overview: data.summary.overview || "",
          keyPoints: data.summary.keyPoints || [],
          actionItems: data.summary.actionItems || [],
          sentiment: data.summary.sentiment || {
            label: "Positive",
            confidence: 0.85,
            explanation: "Constructive conversational tone with actionable deliverables.",
          },
          keywords: data.summary.keywords || [],
          chapters: data.summary.chapters || [],
        };
      }

      await analysis.save();
      return res.status(201).json({
        message: "Audio/Video analysis completed successfully",
        analysis,
      });
    } catch (pyErr) {
      console.error("[Node Server] Python backend processing error:", pyErr.response?.data || pyErr.message);

      // Save failed status but keep record
      analysis.status = "failed";
      analysis.errorMessage =
        pyErr.response?.data?.detail || pyErr.message || "Failed to process audio with Python AI service";
      await analysis.save();

      return res.status(500).json({
        message: "Transcription or AI analysis failed",
        error: analysis.errorMessage,
        analysisId: analysis._id,
      });
    }
  } catch (err) {
    console.error("[Node Server] Error in createAnalysis:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * Get all analyses (filtered by user if authenticated, or recent analyses)
 * GET /api/analyses
 */
exports.getAnalyses = async (req, res) => {
  try {
    const query = req.user ? { user: req.user._id } : {};
    const analyses = await Analysis.find(query)
      .sort({ createdAt: -1 })
      .select("-transcript -segments -chatHistory")
      .limit(50);

    return res.json({ analyses });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Get single analysis with full details
 * GET /api/analyses/:id
 */
exports.getAnalysisById = async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }
    return res.json({ analysis });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Delete analysis
 * DELETE /api/analyses/:id
 */
exports.deleteAnalysis = async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    // If user is authenticated, check ownership
    if (req.user && analysis.user && analysis.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to delete this analysis" });
    }

    // Best-effort cleanup of local file if stored locally
    if (analysis.fileUrl && analysis.fileUrl.includes("/uploads/")) {
      const filename = path.basename(analysis.fileUrl);
      const localFilePath = path.join(__dirname, "..", "uploads", filename);
      if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (e) {
          console.warn("Could not delete local file:", e.message);
        }
      }
    }

    await Analysis.findByIdAndDelete(req.params.id);
    return res.json({ message: "Analysis deleted successfully", id: req.params.id });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Ask follow-up question based on audio/video content (Gemini Q&A)
 * POST /api/analyses/:id/ask
 */
exports.askFollowUp = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ message: "Question is required." });
    }

    const analysis = await Analysis.findById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    // Call Python backend to get Gemini answer
    try {
      console.log(`[Node Server] Calling Python chat endpoint for question: "${question.trim()}"`);
      const response = await axios.post(
        `${PYTHON_BACKEND_URL}/api/v1/chat`,
        {
          question: question.trim(),
          transcript: analysis.transcript || "",
          summary: analysis.summary || {},
          history: (analysis.chatHistory || []).map((m) => ({
            role: m.role,
            message: m.message,
          })),
        },
        { timeout: 60000 }
      );

      const aiAnswer = response.data.answer || "No response generated.";

      // Record in chat history
      analysis.chatHistory.push(
        { role: "user", message: question.trim() },
        { role: "assistant", message: aiAnswer }
      );
      await analysis.save();

      return res.json({
        question: question.trim(),
        answer: aiAnswer,
        chatHistory: analysis.chatHistory,
      });
    } catch (pyErr) {
      console.error("[Node Server] Gemini Q&A error:", pyErr.response?.data || pyErr.message);
      return res.status(500).json({
        message: "Failed to get AI answer",
        detail: pyErr.response?.data?.detail || pyErr.message,
      });
    }
  } catch (err) {
    console.error("[Node Server] Error in askFollowUp:", err);
    return res.status(500).json({ message: err.message });
  }
};
