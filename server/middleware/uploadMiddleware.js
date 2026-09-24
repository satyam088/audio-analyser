const multer = require("multer");
const path = require("path");

// Memory storage allows direct stream or buffer upload to AWS S3
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow all common audio and video MIME types
  const allowedMime = [
    // Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
    // Video
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
    "video/avi",
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".ogg",
    ".flac",
    ".mp4",
    ".webm",
    ".mov",
    ".mkv",
    ".avi",
  ];

  if (allowedMime.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported media format (${file.mimetype}). Please upload an audio or video file.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  },
  fileFilter,
});

module.exports = upload;
