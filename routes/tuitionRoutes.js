
import express from "express";

import {
  createTuition,
  getAllTuitions,
  getPendingTuitions,
  reviewTuition,
  getMyTuitions,
  updateMyTuition,
  deleteMyTuition,
  getTuitionById,
  toggleTuitionStatus,
  restoreRejectedTuition,
} from "../controllers/tuitionController.js";

import {
  verifyToken,
  verifyTutor,
  verifyAdmin,
  authorizeRole,
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

// Admin or Tutor: Restore a rejected tuition back to pending
router.patch(
  "/:id/restore",
  verifyToken,
  authorizeRole("admin", "tutor"),
  restoreRejectedTuition
);

// Tutor Only: Get My Tuitions
router.get(
  "/my-tuitions",
  verifyToken,
  verifyTutor,
  getMyTuitions
);

// Public: Get Single Tuition Details (kept after static routes to avoid shadowing)
router.get("/:id", getTuitionById);

// Tutor Only: Update My Tuition
router.patch(
  "/:id",
  verifyToken,
  verifyTutor,
  updateMyTuition
);

// Tutor Only: Toggle Active / Closed status
router.patch(
  "/:id/status",
  verifyToken,
  verifyTutor,
  toggleTuitionStatus
);

// Tutor Only: Delete My Tuition
router.delete(
  "/:id",
  verifyToken,
  verifyTutor,
  deleteMyTuition
);

export default router;
