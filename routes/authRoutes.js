
import express from "express";
import { registerUser } from "../controllers/authController.js";

const router = express.Router();

// Student and Tutor Registration
router.post("/register", registerUser);

export default router;
