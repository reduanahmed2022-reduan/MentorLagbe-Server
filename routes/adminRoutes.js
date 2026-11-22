
import express from "express";

import {
  getAllUsers,
  updateUserRole,
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
router.get("/users", verifyToken, verifyAdmin, getAllUsers);

// Admin Only: Change a user's role
router.patch(
  "/users/:id/role",
  verifyToken,
  verifyAdmin,
  updateUserRole
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
