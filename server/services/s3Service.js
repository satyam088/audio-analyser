const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const hasS3Config = () => {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_BUCKET_NAME &&
    process.env.AWS_ACCESS_KEY_ID.trim() !== "" &&
    process.env.AWS_SECRET_ACCESS_KEY.trim() !== "" &&
    process.env.AWS_BUCKET_NAME.trim() !== ""
  );
};

let s3Client = null;

const getS3Client = () => {
  if (!s3Client && hasS3Config()) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
      },
    });
  }
  return s3Client;
};

/**
 * Uploads file buffer to AWS S3 (or falls back to local storage if AWS keys are not configured yet).
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original uploaded filename
 * @param {string} mimeType - Media MIME type
 * @returns {Promise<{fileUrl: string, key: string, isS3: boolean, localPath?: string}>}
 */
exports.uploadMediaFile = async (buffer, originalName, mimeType) => {
  const fileExt = path.extname(originalName) || ".tmp";
  const uniquePrefix = crypto.randomBytes(8).toString("hex");
  const cleanName = path
    .basename(originalName, fileExt)
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const key = `uploads/${Date.now()}-${uniquePrefix}-${cleanName}${fileExt}`;

  // If AWS S3 credentials are provided, upload to AWS S3
  if (hasS3Config()) {
    try {
      const client = getS3Client();
      const bucket = process.env.AWS_BUCKET_NAME.trim();
      const region = process.env.AWS_REGION || "us-east-1";

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await client.send(command);

      // Generate presigned GET URL valid for 7 days so Python backend and browser can access even private buckets
      let fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
      try {
        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });
        fileUrl = await getSignedUrl(client, getCommand, { expiresIn: 604800 });
      } catch (signErr) {
        console.warn("[AWS S3] Presign fallback to standard URL:", signErr.message);
      }

      console.log(`[AWS S3] Successfully uploaded to bucket "${bucket}": ${key}`);
      return { fileUrl, key, isS3: true };
    } catch (s3Error) {
      console.error("[AWS S3] S3 upload error, falling back to local storage:", s3Error.message);
    }
  }

  // Graceful local fallback if AWS S3 keys are left blank or S3 is unreachable
  const localUploadDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
  }

  const localFileName = `${Date.now()}-${uniquePrefix}-${cleanName}${fileExt}`;
  const localFilePath = path.join(localUploadDir, localFileName);
  fs.writeFileSync(localFilePath, buffer);

  const port = process.env.PORT || 5001;
  const host = process.env.SERVER_URL || `http://localhost:${port}`;
  const fileUrl = `${host}/uploads/${localFileName}`;

  console.log(`[Storage] AWS S3 keys not set. Stored file locally: ${fileUrl}`);
  return { fileUrl, key: localFileName, isS3: false, localPath: localFilePath };
};

/**
 * Generates presigned URL for downloading/viewing from S3 if configured.
 */
exports.getPresignedUrl = async (key, expiresInSeconds = 3600) => {
  if (!hasS3Config()) {
    return null;
  }

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME.trim(),
      Key: key,
    });
    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  } catch (err) {
    console.error("[AWS S3] Error generating presigned URL:", err.message);
    return null;
  }
};

exports.hasS3Config = hasS3Config;
