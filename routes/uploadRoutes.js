import express from "express";
import multer from "multer";
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

// Keep the client-supplied name from influencing the ImgBB form: drop any path
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

const requireImgBB = (req, res, next) => {
  if (!process.env.IMGBB_API_KEY) {
    return res.status(503).json({
      success: false,
      message: "ImgBB is not configured. Please set IMGBB_API_KEY.",
    });
  }

  return next();
};

// Upload an image file directly to ImgBB and return the hosted URL.
router.post(
  "/image",
  verifyToken,
  requireImgBB,
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

      const form = new FormData();
      form.append("key", process.env.IMGBB_API_KEY);
      form.append("image", req.file.buffer.toString("base64"));
      form.append("name", `${Date.now()}-${sanitizeUploadName(req.file.originalname)}`);

      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: form,
        // Generous timeout: image uploads on mobile links can take a while.
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        return res.status(502).json({
          success: false,
          message: "Image host rejected the upload",
        });
      }

      let result;
      try {
        result = await response.json();
      } catch {
        return res.status(502).json({
          success: false,
          message: "Image host returned an invalid response",
        });
      }

      if (!result.success || !result.data?.url) {
        const upstreamMessage =
          typeof result.error?.message === "string" ? result.error.message : "";
        console.error("ImgBB rejected upload:", upstreamMessage || JSON.stringify(result.error || {}));
        return res.status(502).json({
          success: false,
          message: upstreamMessage
            ? `Image host rejected the upload: ${upstreamMessage}`
            : "Image upload failed. Please try another image.",
        });
      }

      return res.status(200).json({
        success: true,
        imageUrl: result.data.url,
        deleteUrl: result.data.delete_url,
      });
    } catch (error) {
      console.error("ImgBB Upload Error:", error.message);

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
