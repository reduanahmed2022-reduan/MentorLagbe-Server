
import express from "express";

import {
  getAllUsers,
  getAllAdminTuitions,
  getAdminStats,
  getAllTransactions,
} from "../controllers/adminController.js";

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
  getAllUsers,
 getAllTransactions,
);

// Admin Only: Get All Tuitions
router.get(
  "/tuitions",
  verifyToken,
  verifyAdmin,
  getAllAdminTuitions
);

// Admin Only: Dashboard Statistics
router.get(
  "/stats",
  verifyToken,
  verifyAdmin,
  getAdminStats
);

// Admin Only: Get All Transactions
router.get(
  "/transactions",
  verifyToken,
  verifyAdmin,
  getAllTransactions
);

export default router;
