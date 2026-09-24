const mongoose = require("mongoose");

const segmentSchema = new mongoose.Schema({
  start: {
    type: Number,
    required: true,
  },
  end: {
    type: Number,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  speaker: {
    type: String,
    default: "Speaker 1",
  },
});

const chapterSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  start: { type: String, default: "00:00" },
  description: { type: String, default: "" },
});

const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const analysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    s3Key: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ["audio", "video"],
      default: "audio",
    },
    mimeType: {
      type: String,
      default: "audio/mpeg",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    errorMessage: {
      type: String,
      default: null,
    },
    detectedLanguage: {
      type: String,
      default: "en",
    },
    languageProbability: {
      type: Number,
      default: 1.0,
    },
    transcript: {
      type: String,
      default: "",
    },
    segments: [segmentSchema],
    summary: {
      overview: { type: String, default: "" },
      keyPoints: [{ type: String }],
      actionItems: [{ type: String }],
      sentiment: {
        label: { type: String, default: "Neutral" },
        confidence: { type: Number, default: 0.8 },
        explanation: { type: String, default: "" },
      },
      keywords: [{ type: String }],
      chapters: [chapterSchema],
    },
    chatHistory: [chatMessageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Analysis", analysisSchema);
