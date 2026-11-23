
import express from "express";

import {
  registerUser,
  loginUser,
  getMyProfile,
  updateMyProfile,
} from "../controllers/authController.js";
import {
  googleAuthStatus,
  googleAuthStart,
  googleAuthCallback,
} from "../controllers/googleAuthController.js";

import {
  verifyToken,
  authorizeRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Google OAuth (BetterAuth → legacy JWT bridge)
router.get("/google/status", googleAuthStatus);
// Top-level navigation keeps the SameSite=Lax state cookie first-party.
router.get("/google/start", googleAuthStart);
router.get("/google/callback", googleAuthCallback);

// Student and Tutor Registration
router.post("/register", registerUser);

// Student and Tutor Login
router.post("/login", loginUser);

// Get Logged-in User Profile
router.get("/me", verifyToken, getMyProfile);

// Update Logged-in User Profile
router.put("/me", verifyToken, updateMyProfile);

// Student Only Route
router.get(
  "/student-dashboard",
  verifyToken,
  authorizeRole("student"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to Student Dashboard",
      user: req.user,
    });
  }
);

// Tutor Only Route
router.get(
  "/tutor-dashboard",
  verifyToken,
  authorizeRole("tutor"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to Tutor Dashboard",
      user: req.user,
    });
  }
);

export default router;
