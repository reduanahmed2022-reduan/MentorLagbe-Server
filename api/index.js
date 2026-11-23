import { app, ensureReady } from "../index.js";

/**
 * Vercel serverless entry point. Express itself is not started here; each
 * invocation guarantees the database and BetterAuth handler are ready before
 * handing the request to the app.
 */
export default async function handler(req, res) {
  try {
    await ensureReady();
  } catch (error) {
    console.error("Serverless initialization failed:", error.message);

    return res.status(503).json({
      success: false,
      status: "DATABASE_UNAVAILABLE",
      message: "Database connection is not available",
    });
  }

  return app(req, res);
}
