
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Create Tuition Request
export const createTuition = async (req, res) => {
  try {
    const {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      description,
      bannerImage,
    } = req.body;

    // Required field validation
    if (
      !title ||
      !subject ||
      !classLevel ||
      !mode ||
      !location ||
      monthlyFee === undefined ||
      daysPerWeek === undefined ||
      !description
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Validate tuition mode
    if (!["Online", "Offline"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Mode must be Online or Offline",
      });
    }

    // Validate fee and days
    if (
      !Number.isFinite(monthlyFee) ||
      monthlyFee <= 0 ||
      !Number.isInteger(daysPerWeek) ||
      daysPerWeek < 1 ||
      daysPerWeek > 7
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid monthly fee or days per week",
      });
    }

    const db = getDB();

    // Get logged-in tutor information
    const tutor = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.userId) },
      {
        projection: {
          password: 0,
        },
      }
    );

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found",
      });
    }

    // Create tuition document
    const newTuition = {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      description,
      bannerImage: bannerImage || "",
      tutorName: tutor.name,
      tutorEmail: tutor.email,
      approvalStatus: "pending",
      isActive: true,
      createdAt: new Date(),
    };

    const result = await db.collection("tuitions").insertOne(newTuition);

    res.status(201).json({
      success: true,
      message: "Tuition request submitted successfully",
      tuition: {
        _id: result.insertedId,
        ...newTuition,
      },
    });
  } catch (error) {
    console.error("Create Tuition Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create tuition request",
    });
  }
};
