
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Create Tuition Request (Tutor)
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
      !title?.trim() ||
      !subject?.trim() ||
      !classLevel?.trim() ||
      !mode ||
      !location?.trim() ||
      monthlyFee === undefined ||
      daysPerWeek === undefined ||
      !description?.trim()
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

    // Validate monthly fee and days per week
    if (
      typeof monthlyFee !== "number" ||
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

    // Find logged-in tutor
    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user information",
      });
    }

    const tutor = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.userId) },
      {
        projection: { password: 0 },
      }
    );

    if (!tutor || tutor.role !== "tutor") {
      return res.status(403).json({
        success: false,
        message: "Only registered tutors can create tuition posts",
      });
    }

    // Create tuition document
    const newTuition = {
      title: title.trim(),
      subject: subject.trim(),
      classLevel: classLevel.trim(),
      mode,
      location: location.trim(),
      monthlyFee,
      daysPerWeek,
      description: description.trim(),
      bannerImage: bannerImage || "",
      tutorName: tutor.name,
      tutorEmail: tutor.email,
      approvalStatus: "pending",
      isActive: true,
      createdAt: new Date(),
    };

    const result = await db.collection("tuitions").insertOne(newTuition);

    return res.status(201).json({
      success: true,
      message: "Tuition request submitted successfully",
      tuition: {
        _id: result.insertedId,
        ...newTuition,
      },
    });
  } catch (error) {
    console.error("Create Tuition Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create tuition request",
    });
  }
};

// Get All Approved Tuitions (Public)
export const getAllTuitions = async (req, res) => {
  try {
    const db = getDB();

    const tuitions = await db
      .collection("tuitions")
      .find({
        approvalStatus: "approved",
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: tuitions.length,
      tuitions,
    });
  } catch (error) {
    console.error("Get All Tuitions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve tuitions",
    });
  }
};

// Admin: Get All Pending Tuitions
export const getPendingTuitions = async (req, res) => {
  try {
    const db = getDB();

    const tuitions = await db
      .collection("tuitions")
      .find({
        approvalStatus: "pending",
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: tuitions.length,
      tuitions,
    });
  } catch (error) {
    console.error("Get Pending Tuitions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve pending tuitions",
    });
  }
};


 // Admin: Approve or Reject Tuition
export const reviewTuition = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    // Validate tuition ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    // Validate approval status
    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const db = getDB();

    // Update only pending tuition
    const result = await db.collection("tuitions").updateOne(
      {
        _id: new ObjectId(id),
        approvalStatus: "pending",
      },
      {
        $set: {
          approvalStatus,
          isActive: approvalStatus === "approved",
          reviewedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending tuition not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Tuition ${approvalStatus} successfully`,
    });
  } catch (error) {
    console.error("Review Tuition Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to review tuition",
    });
  }
};
