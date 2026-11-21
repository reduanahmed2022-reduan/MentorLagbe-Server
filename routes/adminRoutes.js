
import express from "express";

import { getAllUsers, getAllAdminTuitions, } from "../controllers/adminController.js";

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

// Admin Only: Get All Tuitions
router.get(
  "/tuitions",
  verifyToken,
  verifyAdmin,
  getAllAdminTuitions
);

export default router;
