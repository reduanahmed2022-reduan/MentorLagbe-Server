
import express from "express";

import {
  createTuition,
  getAllTuitions,
  getPendingTuitions,
  reviewTuition,
  getMyTuitions,
} from "../controllers/tuitionController.js";

import {
  verifyToken,
  verifyTutor,
  verifyAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Public: Get All Approved Tuitions
router.get("/", getAllTuitions);

// Tutor Only: Create Tuition
router.post(
  "/",
  verifyToken,
  verifyTutor,
  createTuition
);

// Admin Only: Get All Pending Tuitions
router.get(
  "/admin/pending",
  verifyToken,
  verifyAdmin,
  getPendingTuitions
);

// Admin Only: Approve or Reject Tuition
router.patch(
  "/admin/review/:id",
  verifyToken,
  verifyAdmin,
  reviewTuition
);

// Tutor Only: Get My Tuitions
router.get(
  "/my-tuitions",
  verifyToken,
  verifyTutor,
  getMyTuitions
);

export default router;
