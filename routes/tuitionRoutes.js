
import express from "express";

import { createTuition } from "../controllers/tuitionController.js";

import {
  verifyToken,
  authorizeRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Tutor Only: Create Tuition
router.post(
  "/",
  verifyToken,
  authorizeRole("tutor"),
  createTuition
);

export default router;
