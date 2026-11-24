
import express from "express";
import {
  getTuitionReviews,
  createReview,
} from "../controllers/reviewController.js";
import { verifyToken, verifyStudent } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public: anyone browsing a tuition can read its reviews.
router.get("/tuition/:tuitionId", getTuitionReviews);

// Student Only: submit a review after an accepted application.
router.post("/", verifyToken, verifyStudent, createReview);

export default router;
