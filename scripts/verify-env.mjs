/**
 * Pre-deploy environment verification for the MentorLagbe server.
 *
 * Usage (from the server directory):
 *   node scripts/verify-env.mjs
 *
 * Loads .env through dotenv, then reports each variable as PRESENT or MISSING.
 * Only key names and status are printed - never values.
 * Exit code is 1 only when a REQUIRED variable is missing, otherwise 0.
 */

import dotenv from "dotenv";

dotenv.config({ quiet: true });

const REQUIRED = [
  "MONGODB_URI",
  "JWT_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
];

const RECOMMENDED = [
  "CLIENT_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "IMGBB_API_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
];

const OPTIONAL = ["PORT", "JWT_EXPIRES_IN", "ADMIN_NAME", "NODE_ENV"];

const STRIPE_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const IMGBB_KEY = "IMGBB_API_KEY";

function isPresent(key) {
  return (
    Object.prototype.hasOwnProperty.call(process.env, key) &&
    String(process.env[key]).trim().length > 0
  );
}

function report(title, keys) {
  console.log(`${title}:`);
  for (const key of keys) {
    console.log(`  ${key}: ${isPresent(key) ? "PRESENT" : "MISSING"}`);
  }
  console.log("");
}

report("REQUIRED", REQUIRED);
report("RECOMMENDED", RECOMMENDED);
report("OPTIONAL", OPTIONAL);

const isProduction =
  String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const clientUrl = String(process.env.CLIENT_URL || "").trim();

if (
  isProduction &&
  /(^|\/\/)(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(clientUrl)
) {
  console.warn(
    "WARNING: CLIENT_URL points to localhost while NODE_ENV=production. " +
      "Set CLIENT_URL to the deployed client origin."
  );
}

if (STRIPE_KEYS.some((key) => !isPresent(key))) {
  console.warn(
    "WARNING: Stripe configuration is incomplete; payment endpoints will return 503."
  );
}

if (!isPresent(IMGBB_KEY)) {
  console.warn(
    "WARNING: IMGBB_API_KEY is missing; /api/upload/image will return 503."
  );
}

const missingRequired = REQUIRED.filter((key) => !isPresent(key));

if (missingRequired.length > 0) {
  console.error(
    `FAIL: ${missingRequired.length} required environment variable(s) missing: ` +
      missingRequired.join(", ")
  );
  process.exit(1);
}

console.log("OK: all required environment variables are present.");
