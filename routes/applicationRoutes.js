
import express from "express";

import {
  getMyApplications,
  applyToTuition,
} from "../controllers/applicationController.js";

import {
  verifyToken,
  verifyStudent,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Student Only: Get My Applications
router.get(
  "/my-applications",
  verifyToken,
  verifyStudent,
  getMyApplications
);

// Student Only: Apply to Tuition
router.post(
  "/",
  verifyToken,
  verifyStudent,
  applyToTuition
);

export default router;
