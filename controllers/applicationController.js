
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


// Tutor: Get Applicants for My Tuitions
export const getTutorApplicants = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user information",
      });
    }

    const db = getDB();

    // Find Logged-in Tutor
    const tutor = await db.collection("users").findOne({
      _id: new ObjectId(req.user.userId),
      role: "tutor",
    });

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor account not found",
      });
    }

    // Get Only This Tutor's Applicants
    const applicants = await db
      .collection("applications")
      .find({
        tutorEmail: tutor.email,
      })
      .sort({ appliedAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: applicants.length,
      applicants,
    });
  } catch (error) {
    console.error("Get Tutor Applicants Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve applicants",
    });
  }
};

// Tutor: Accept or Reject Student Application
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate Application ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
    }

    // Validate Application Status
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be accepted or rejected",
      });
    }

    const db = getDB();

    // Find Logged-in Tutor
    const tutor = await db.collection("users").findOne({
      _id: new ObjectId(req.user.userId),
      role: "tutor",
    });

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor account not found",
      });
    }

    // Find Application Belonging to This Tutor
    const application = await db.collection("applications").findOne({
      _id: new ObjectId(id),
      tutorEmail: tutor.email,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found or access denied",
      });
    }

    // Only Pending Applications Can Be Updated
    if (application.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This application has already been reviewed",
      });
    }

    // Update Application Status
    const result = await db.collection("applications").updateOne(
      {
        _id: new ObjectId(id),
        tutorEmail: tutor.email,
        status: "pending",
      },
      {
        $set: {
          status,
          reviewedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Application status could not be updated",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Application ${status} successfully`,
      status,
    });
  } catch (error) {
    console.error("Update Application Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update application status",
    });
  }
};

// Student: Cancel an application while it is still pending
export const cancelApplication = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
    }

    const db = getDB();

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

    const result = await db.collection("applications").deleteOne({
      _id: new ObjectId(id),
      studentEmail: student.email,
      status: "pending",
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending application not found or already reviewed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Application cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel Application Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel application",
    });
  }
};
