
import express from "express";

import {
  getMyApplications,
  applyToTuition,
  getTutorApplicants,
  updateApplicationStatus,
} from "../controllers/applicationController.js";

import {
  verifyToken,
  verifyStudent,
  verifyTutor,
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

// Tutor Only: Get My Applicants
router.get(
  "/tutor-applicants",
  verifyToken,
  verifyTutor,
  getTutorApplicants
);

// Tutor Only: Update Application Status
router.patch(
  "/:id/status",
  verifyToken,
  verifyTutor,
  updateApplicationStatus
);

export default router;
