
import express from "express";

import {
  registerUser,
  loginUser,
} from "../controllers/authController.js";

import {
  verifyToken,
  authorizeRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Student and Tutor Registration
router.post("/register", registerUser);

// Student and Tutor Login
router.post("/login", loginUser);

// Protected Profile Route
router.get("/me", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "User authenticated successfully",
    user: req.user,
  });
});

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
