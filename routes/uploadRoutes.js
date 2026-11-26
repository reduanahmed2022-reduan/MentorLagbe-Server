import express from "express";
import multer from "multer";
import { createHash } from "crypto";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype?.startsWith("image/")) {
      return callback(new Error("Only image files are allowed"));
    }

    return callback(null, true);
  },
});

// Never trust the client-supplied MIME type alone: check real file signatures.
const hasImageSignature = (buffer) => {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true; // JPEG
  }

  if (
    buffer.length > 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return true; // PNG
  }

  if (buffer.length > 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return true; // GIF
  }

  if (buffer.length < 16 || buffer.toString("ascii", 0, 4) !== "RIFF") {
    return false;
  }

  const webpChunk = buffer.toString("ascii", 12, 16);

  return (
    buffer.toString("ascii", 8, 12) === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(webpChunk)
  ); // WebP
};

// Keep the client-supplied name from influencing the upload form: drop path
// components and unsafe characters, and bound its length before use.
const sanitizeUploadName = (originalName) => {
  const base = String(originalName ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "") || "image";

  const maxLength = 80;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const extension = /\.[A-Za-z0-9_-]{1,10}$/.exec(cleaned)?.[0] ?? "";
  const stem = extension ? cleaned.slice(0, -extension.length) : cleaned;

  return `${stem.slice(0, maxLength - extension.length)}${extension}`;
};

const cloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET);

const requireUploadProvider = (req, res, next) => {
  if (!process.env.IMGBB_API_KEY && !cloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message:
        "Image upload is not configured. Set IMGBB_API_KEY or CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET.",
    });
  }

  return next();
};

const timeoutSignal = () => AbortSignal.timeout(45000);

/** Primary provider: ImgBB. Throws with a readable reason on any failure. */
async function uploadToImgBB(file) {
  const form = new FormData();
  form.append("key", process.env.IMGBB_API_KEY);
  form.append("image", file.buffer.toString("base64"));
  form.append("name", `${Date.now()}-${sanitizeUploadName(file.originalname)}`);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    const upstreamText = await response.text().catch(() => "");
    const fingerprint = createHash("sha256")
      .update(process.env.IMGBB_API_KEY || "")
      .digest("hex")
      .slice(0, 8);
    const detail = upstreamText.trim().slice(0, 160);
    console.error("ImgBB HTTP error:", response.status, "key=" + fingerprint, upstreamText.slice(0, 500));

    const error = new Error(
      detail
        ? `Image host returned ${response.status} (key=${fingerprint}): ${detail}`
        : `Image host returned ${response.status} (key=${fingerprint})`
    );
    error.status = response.status;
    throw error;
  }

  const result = await response.json().catch(() => ({}));

  if (!result.success || !result.data?.url) {
    const detail = typeof result.error?.message === "string" ? result.error.message : "";
    console.error("ImgBB rejected upload:", detail || JSON.stringify(result.error || {}));
    const error = new Error(detail ? `Image host rejected the upload: ${detail}` : "Image upload failed");
    error.status = 502;
    throw error;
  }

  return { url: result.data.url, deleteUrl: result.data.delete_url || "" };
}

/**
 * Fallback provider: Cloudinary unsigned upload. The assignment allows
 * ImgBB or Cloudinary, so a blocked ImgBB host never breaks the feature.
 */
async function uploadToCloudinary(file) {
  if (!cloudinaryConfigured()) return null;

  const form = new FormData();
  form.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype || "image/jpeg" }),
    sanitizeUploadName(file.originalname)
  );
  form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);
  // Each deployment gets its own Cloudinary folder; Cloudinary creates it
  // automatically on the first upload.
  form.append("folder", process.env.CLOUDINARY_FOLDER || "mentorlagbe");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: form, signal: timeoutSignal() }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.secure_url) {
    const error = new Error(
      result.error?.message || `Cloudinary returned ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return { url: result.secure_url, deleteUrl: "" };
}

// Upload an image file and return the hosted URL (ImgBB, then Cloudinary).
router.post(
  "/image",
  verifyToken,
  requireUploadProvider,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please provide an image file in the 'image' field",
        });
      }

      if (!hasImageSignature(req.file.buffer)) {
        return res.status(400).json({
          success: false,
          message: "Only JPG, PNG, GIF or WEBP images are allowed",
        });
      }

      let hosted = null;
      let imgbbError = "";

      if (process.env.IMGBB_API_KEY) {
        try {
          hosted = await uploadToImgBB(req.file);
        } catch (error) {
          imgbbError = error.message;
          console.error("ImgBB upload failed:", error.message);
        }
      }

      if (!hosted && cloudinaryConfigured()) {
        try {
          hosted = await uploadToCloudinary(req.file);
        } catch (error) {
          console.error("Cloudinary fallback failed:", error.message);
          imgbbError = `${imgbbError ? `${imgbbError} ` : ""}Cloudinary fallback: ${error.message}`;
        }
      }

      if (!hosted) {
        return res.status(502).json({
          success: false,
          message:
            imgbbError ||
            "Image upload failed. Configure IMGBB_API_KEY or Cloudinary upload settings.",
        });
      }

      return res.status(200).json({
        success: true,
        imageUrl: hosted.url,
        deleteUrl: hosted.deleteUrl,
      });
    } catch (error) {
      console.error("Image Upload Error:", error.message);

      if (error.name === "TimeoutError" || error.name === "AbortError") {
        return res.status(504).json({
          success: false,
          message: "Image host did not respond in time. Please try again.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to upload image",
      });
    }
  }
);

// Surface multer errors as JSON instead of Express' default HTML error page.
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Image must be smaller than 5MB"
          : error.message,
    });
  }

  if (error.message === "Only image files are allowed") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
});

export default router;
