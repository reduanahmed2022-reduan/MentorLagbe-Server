
import express from "express";
import {
  registerUser,
  loginUser,
} from "../controllers/authController.js";

const router = express.Router();

// Student and Tutor Registration
router.post("/register", registerUser);

// Student and Tutor Login
router.post("/login", loginUser);

export default router;
