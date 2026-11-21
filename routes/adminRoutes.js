
import express from "express";

import { getAllUsers } from "../controllers/adminController.js";

import {
  verifyToken,
  verifyAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin Only: Get All Users
router.get(
  "/users",
  verifyToken,
  verifyAdmin,
  getAllUsers
);

export default router;
