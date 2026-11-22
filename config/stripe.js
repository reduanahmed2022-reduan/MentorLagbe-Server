import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Prices are in USD cents, as required by the assignment.
export const PRO_PLANS = {
  tutor: { name: "Pro Tutor Plan", amount: 1500, currency: "usd" },
  student: { name: "Pro Student Plan", amount: 1000, currency: "usd" },
};
