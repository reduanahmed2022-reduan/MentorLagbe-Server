
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

  console.log("MongoDB connected successfully!");

  return database;
}

export function getDB() {
  if (!database) {
    throw new Error("Database is not connected yet");
  }

  return database;
}
