
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Student: Get My Applications
export const getMyApplications = async (req, res) => {
  try {
    // Validate Student ID
    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user information",
      });
    }

    const db = getDB();

    // Find Logged-in Student
    const user = await db.collection("users").findOne({
      _id: new ObjectId(req.user.userId),
      role: "student",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

    // Get Only Logged-in Student's Applications
    const applications = await db
      .collection("applications")
      .find({
        studentEmail: user.email,
      })
      .sort({ appliedAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: applications.length,
      applications,
    });
  } catch (error) {
    console.error("Get My Applications Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve applications",
    });
  }
};


// Student: Apply to an Approved Tuition
export const applyToTuition = async (req, res) => {
  try {
    const { tuitionId, preferredSchedule, studentNote } = req.body;

    // Validate Tuition ID
    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    if (!preferredSchedule || !preferredSchedule.trim()) {
      return res.status(400).json({
        success: false,
        message: "Preferred schedule is required",
      });
    }

    const db = getDB();

    // Find Logged-in Student
    const student = await db.collection("users").findOne({
      _id: new ObjectId(req.user.userId),
      role: "student",
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

    // Find Approved and Active Tuition
    const tuition = await db.collection("tuitions").findOne({
      _id: new ObjectId(tuitionId),
      approvalStatus: "approved",
      isActive: true,
    });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Approved tuition not found",
      });
    }

    // Prevent Duplicate Applications
    const existingApplication = await db.collection("applications").findOne({
      tuitionId: tuition._id.toString(),
      studentEmail: student.email,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already applied to this tuition",
      });
    }

    // Create Application
    const application = {
      tuitionId: tuition._id.toString(),
      tuitionTitle: tuition.title,
      subject: tuition.subject,
      monthlyFee: tuition.monthlyFee,
      tutorEmail: tuition.tutorEmail,
      studentName: student.name,
      studentEmail: student.email,
      studentPhone: student.phone || "",
      preferredSchedule: preferredSchedule.trim(),
      studentNote: studentNote?.trim() || "",
      status: "pending",
      appliedAt: new Date(),
    };

    const result = await db.collection("applications").insertOne(application);

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      applicationId: result.insertedId,
      application,
    });
  } catch (error) {
    console.error("Apply to Tuition Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit application",
    });
  }
};
