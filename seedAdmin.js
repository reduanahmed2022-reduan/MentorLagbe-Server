
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB, getDB } from "./config/db.js";

const seedAdmin = async () => {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env");
    }

    await connectDB();

    const db = getDB();
    const email = process.env.ADMIN_EMAIL.toLowerCase().trim();

    const existingAdmin = await db.collection("users").findOne({ email });

    if (existingAdmin) {
      if (existingAdmin.role === "admin") {
        console.log("Admin account already exists.");
        return;
      }

      throw new Error(
        "This email already belongs to a non-admin user. Use a new email."
      );
    }

    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD,
      12
    );

    const admin = {
      name: process.env.ADMIN_NAME || "MentorLagbe Admin",
      email,
      password: hashedPassword,
      role: "admin",
      phone: "",
      bio: "",
      plan: "free",
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(admin);

    console.log("Admin account created successfully.");
  } catch (error) {
    console.error("Admin seed failed:", error.message);
  } finally {
    process.exit();
  }
};

seedAdmin();
