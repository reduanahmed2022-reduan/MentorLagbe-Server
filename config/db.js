
import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing from .env file");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let database;

export async function connectDB() {
  if (database) {
    return database;
  }

  await client.connect();

  database = client.db("MantorLagbe");

  await database.command({ ping: 1 });

  // Keep hot queries fast and enforce the data rules the controllers assume.
  try {
    await Promise.all([
      database.collection("users").createIndex({ email: 1 }, { unique: true }),
      database.collection("tuitions").createIndex({ approvalStatus: 1, createdAt: -1 }),
      database.collection("tuitions").createIndex({ tutorEmail: 1, createdAt: -1 }),
      database
        .collection("applications")
        .createIndex({ tuitionId: 1, studentEmail: 1 }, { unique: true }),
      database.collection("applications").createIndex({ studentEmail: 1, appliedAt: -1 }),
      database.collection("applications").createIndex({ tutorEmail: 1, appliedAt: -1 }),
      database.collection("payments").createIndex({ stripeSessionId: 1 }, { unique: true }),
      database.collection("payments").createIndex({ paidAt: -1 }),
    ]);
  } catch (error) {
    // A pre-existing duplicate should not stop the API from booting.
    console.warn("Index setup warning:", error.message);
  }

  console.log("MongoDB connected successfully!");

  return database;
}

export function getDB() {
  if (!database) {
    throw new Error("Database is not connected yet");
  }

  return database;
}

export async function closeDB() {
  if (database) {
    await client.close();
    database = undefined;
  }
}
