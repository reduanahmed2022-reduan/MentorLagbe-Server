import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing from .env file");
}

// Keep the documented (intentionally misspelled) database name in one place so
// the BetterAuth MongoDB adapter is guaranteed to share this exact pool/DB.
export const DB_NAME = "MantorLagbe";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/** Safe before connectDB(): creating a Db handle performs no I/O. */
export function getClient() {
  return client;
}

let database;
let connecting;

export async function connectDB() {
  if (database) return database;
  if (connecting) return connecting;

  connecting = (async () => {
    await client.connect();

    const db = client.db(DB_NAME);
    await db.command({ ping: 1 });

    // Keep hot queries fast and enforce the data rules the controllers assume.
    // Critical unique indexes must never fail silently: concurrency rules
    // (one application per student, one row per Stripe session, one email per
    // user) depend on them.
    const indexes = [
      { name: "users.email", critical: true, build: () => db.collection("users").createIndex({ email: 1 }, { unique: true }) },
      { name: "tuitions.approvalStatus/createdAt", build: () => db.collection("tuitions").createIndex({ approvalStatus: 1, createdAt: -1 }) },
      { name: "tuitions.tutorEmail/createdAt", build: () => db.collection("tuitions").createIndex({ tutorEmail: 1, createdAt: -1 }) },
      { name: "applications.tuitionId/studentEmail", critical: true, build: () => db.collection("applications").createIndex({ tuitionId: 1, studentEmail: 1 }, { unique: true }) },
      { name: "applications.studentEmail/appliedAt", build: () => db.collection("applications").createIndex({ studentEmail: 1, appliedAt: -1 }) },
      { name: "applications.tutorEmail/appliedAt", build: () => db.collection("applications").createIndex({ tutorEmail: 1, appliedAt: -1 }) },
      { name: "payments.stripeSessionId", critical: true, build: () => db.collection("payments").createIndex({ stripeSessionId: 1 }, { unique: true }) },
      { name: "payments.paidAt", build: () => db.collection("payments").createIndex({ paidAt: -1 }) },
    ];

    const failures = [];

    await Promise.all(
      indexes.map(async (index) => {
        try {
          await index.build();
        } catch (error) {
          if (index.critical) failures.push(`${index.name}: ${error.message}`);
          else console.warn(`Index setup warning for ${index.name}: ${error.message}`);
        }
      })
    );

    if (failures.length) {
      throw new Error(`Critical unique index setup failed (${failures.join("; ")})`);
    }

    // Publish only after connect + ping + index setup succeeded, so /health
    // and every controller see the same, fully prepared database handle.
    database = db;
    console.log("MongoDB connected successfully!");
    return database;
  })();

  try {
    return await connecting;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  } finally {
    connecting = undefined;
  }
}

export function getDB() {
  if (!database) {
    throw new Error("Database is not connected yet");
  }

  return database;
}

export async function closeDB() {
  try {
    await client.close();
  } finally {
    database = undefined;
    connecting = undefined;
  }
}
