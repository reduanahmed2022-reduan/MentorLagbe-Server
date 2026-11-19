
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import tutorRoutes from "./routes/tutorRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
}));

app.use(express.json());

// Tutor API
app.use("/api/tutors", tutorRoutes);

// Home route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MentorLagbe API is running successfully!",
  });
});

// Health route
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
  });
});

// Start server after database connection
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`MentorLagbe server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
}

startServer();
