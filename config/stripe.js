import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// CORS accepts multiple origins, but Stripe redirects must be a single URL.
const configuredOrigins = [
  ...new Set(
    (process.env.CLIENT_URL || "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  ),
];

export const CLIENT_ORIGINS = configuredOrigins.length
  ? configuredOrigins
  : ["http://localhost:3000"];
// Stripe redirects need a single URL. Prefer the deployed HTTPS origin so
// payment success/cancel land on the live client instead of localhost.
// CORS still accepts all configured origins.
export const CLIENT_URL =
  process.env.NODE_ENV === "production"
    ? CLIENT_ORIGINS.find((origin) => !origin.startsWith("http://localhost")) ||
      CLIENT_ORIGINS[0]
    : CLIENT_ORIGINS[0];

// Prices are in USD cents, as required by the assignment.
export const PRO_PLANS = {
  tutor: { name: "Pro Tutor Plan", amount: 1500, currency: "usd" },
  student: { name: "Pro Student Plan", amount: 1000, currency: "usd" },
};
