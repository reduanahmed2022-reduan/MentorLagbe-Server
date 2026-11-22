import express from "express";
import {
  createCheckoutSession,
  verifyCheckoutSession,
} from "../controllers/paymentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/checkout", verifyToken, createCheckoutSession);
router.post("/verify", verifyToken, verifyCheckoutSession);

export default router;
