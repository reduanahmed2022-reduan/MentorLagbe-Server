import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed"));
    }

    return callback(null, true);
  },
});

// Upload an image file directly to ImgBB and return the hosted URL.
router.post("/image", verifyToken, upload.single("image"), async (req, res) => {
  try {
    if (!process.env.IMGBB_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "ImgBB is not configured. Please set IMGBB_API_KEY.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please provide an image file in the 'image' field",
      });
    }

    const form = new FormData();
    form.append("key", process.env.IMGBB_API_KEY);
    form.append("image", Buffer.from(req.file.buffer).toString("base64"));
    form.append("name", `${Date.now()}-${req.file.originalname}`);

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: form,
    });
    const result = await response.json();

    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: result.error?.message || "ImgBB upload failed",
      });
    }

    return res.status(200).json({
      success: true,
      imageUrl: result.data.url,
      deleteUrl: result.data.delete_url,
    });
  } catch (error) {
    console.error("ImgBB Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload image",
    });
  }
});

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
