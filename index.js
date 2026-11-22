
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { closeDB, connectDB, getDB } from "./config/db.js";
import { CLIENT_ORIGINS, CLIENT_URL } from "./config/stripe.js";
import tutorRoutes from "./routes/tutorRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import tuitionRoutes from "./routes/tuitionRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { toNodeHandler } from "better-auth/node";
import {
  BETTER_AUTH_BASE_PATH,
  getAuth,
  isBetterAuthConfigured,
} from "./config/betterAuth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// The BetterAuth instance needs a connected DB, so its handler is installed in
// startServer() before listen(). No request can arrive before that point.
let betterAuthHandler = null;

// Middleware
const allowedOrigins = CLIENT_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no Origin header) and every configured client.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Stripe webhook must receive the raw body for signature verification.
app.use("/api/payments", webhookRoutes);

// BetterAuth is isolated on /api/better-auth; the legacy JWT router below is
// untouched. Mount before express.json() so the node handler sees the raw
// stream, and before the /api 404 catch-all. No req.url rewriting: better-call
// reconstructs the URL from req.baseUrl + req.originalUrl.
app.use(BETTER_AUTH_BASE_PATH, (req, res, next) => {
  if (!betterAuthHandler) return next();
  return betterAuthHandler(req, res);
});

app.use(express.json());

// API Routes
app.use("/api/tutors", tutorRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tuitions", tuitionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/upload", uploadRoutes);

// Home route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MentorLagbe API is running successfully!",
  });
});

// Health route (also confirms the database is still reachable)
app.get("/health", async (req, res) => {
  try {
    await getDB().command({ ping: 1 });

    return res.status(200).json({
      success: true,
      status: "OK",
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: "DATABASE_UNAVAILABLE",
    });
  }
});

// Unknown API routes should return JSON instead of an HTML 404 page.
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handler (CORS, malformed JSON, unexpected errors).
app.use((error, req, res, next) => {
  // BetterAuth streams its responses; never try to write a second response.
  if (res.headersSent) return next(error);

  console.error("Request Error:", error.message);

  if (error.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed by CORS",
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Payload too large",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong on the server",
  });
});

// Start server after database connection
async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env file");
    }

    if (isBetterAuthConfigured() && !process.env.BETTER_AUTH_URL) {
      console.warn("Warning: BETTER_AUTH_URL is not set; using the local API origin.");
    }
    if (!isBetterAuthConfigured()) {
      console.warn("Warning: BETTER_AUTH_SECRET is not set; /api/better-auth is disabled.");
    }

    if (process.env.NODE_ENV === "production") {
      for (const key of [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "IMGBB_API_KEY",
      ]) {
        if (!process.env[key]) {
          console.warn(`Warning: ${key} is not set; related features will return 503.`);
        }
      }

      if (CLIENT_URL.startsWith("http://localhost")) {
        console.warn("Warning: CLIENT_URL still points to localhost; CORS and Stripe redirects will fail in production.");
      }
    }

    await connectDB();

    if (isBetterAuthConfigured()) {
      betterAuthHandler = toNodeHandler(await getAuth());
      console.log(`BetterAuth mounted at ${BETTER_AUTH_BASE_PATH}`);
    }

    const server = app.listen(PORT, () => {
      console.log(`MentorLagbe server running on port ${PORT}`);
    });

    let shuttingDown = false;

    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;

      console.log(`${signal} received. Closing server...`);

      server.close(async (error) => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
          console.error("Server close error:", error.message);
        }

        try {
          await closeDB();
        } catch (closeError) {
          console.error("Failed to close database cleanly:", closeError.message);
        } finally {
          process.exit(0);
        }
      });
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
