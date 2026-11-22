import express from "express";
import { handleStripeWebhook } from "../controllers/paymentController.js";

const router = express.Router();

// Stripe needs the untouched raw body to verify the signature, so this route
// is mounted before express.json() in index.js.
router.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

export default router;
