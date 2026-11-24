
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Free students may keep two applications waiting for review at a time.
const FREE_STUDENT_APPLY_LIMIT = 2;

/**
 * Tutor ownership can be stale on legacy application snapshots (for example a
 * changed email). Build an OR filter that accepts both the email snapshot and
 * any tuition currently owned by this tutor.
 */
async function getTutorApplicationOwnership(db, tutorEmail) {
  const ownedTuitions = await db
    .collection("tuitions")
    .find({ tutorEmail }, { projection: { _id: 1 } })
    .toArray();

  const tuitionIds = ownedTuitions.flatMap((tuition) => [
    tuition._id.toString(),
    tuition._id,
  ]);

  return [
    { tutorEmail },
    ...(tuitionIds.length ? [{ tuitionId: { $in: tuitionIds } }] : []),
  ];
}

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
    const { tuitionId, preferredSchedule, studentNote, studentPhone } = req.body;

    // Validate Tuition ID
    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    if (typeof preferredSchedule !== "string" || !preferredSchedule.trim()) {
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

    // Free students can keep two applications waiting for review at a time.
    // Accepted/rejected rows are not pending, so they do not consume a slot.
    if (student.plan !== "pro") {
      const pendingCount = await db.collection("applications").countDocuments({
        studentEmail: student.email,
        status: "pending",
      });

      if (pendingCount >= FREE_STUDENT_APPLY_LIMIT) {
        return res.status(403).json({
          success: false,
          message: "Free plan allows up to 2 pending applications at a time",
        });
      }
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
      studentPhone:
        typeof studentPhone === "string" ? studentPhone.trim() : student.phone || "",
      preferredSchedule: preferredSchedule.trim(),
      studentNote: typeof studentNote === "string" ? studentNote.trim() : "",
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

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already applied to this tuition",
      });
    }

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

    // Get applications for this tutor, including rows whose tutorEmail snapshot
    // is stale but whose tuition is still owned by this account.
    const ownership = await getTutorApplicationOwnership(db, tutor.email);

    const applicants = await db
      .collection("applications")
      .find({ $or: ownership })
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

    // Find Application Belonging to This Tutor (with stale-snapshot fallback)
    const ownership = await getTutorApplicationOwnership(db, tutor.email);

    const application = await db.collection("applications").findOne({
      _id: new ObjectId(id),
      $or: ownership,
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
        status: "pending",
        $or: ownership,
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

    const application = await db.collection("applications").findOne({
      _id: new ObjectId(id),
      studentEmail: student.email,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending applications can be cancelled",
      });
    }

    await db.collection("applications").deleteOne({ _id: application._id });

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

// Restore a rejected application to pending so it can be reviewed again.
// Students can restore their own rows; tutors/admins can restore rows they manage.
export const restoreRejectedApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferredSchedule, studentNote, studentPhone } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
    }

    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user information",
      });
    }

    const db = getDB();
    const role = req.user.role;
    let ownershipFilter = {};
    let student = null;

    if (role === "student") {
      student = await db.collection("users").findOne({
        _id: new ObjectId(req.user.userId),
        role: "student",
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student account not found",
        });
      }

      ownershipFilter = { studentEmail: student.email };
    } else if (role === "tutor") {
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

      ownershipFilter = {
        $or: await getTutorApplicationOwnership(db, tutor.email),
      };
    }

    // Admins intentionally get no ownership filter.
    const application = await db.collection("applications").findOne({
      _id: new ObjectId(id),
      ...ownershipFilter,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found or access denied",
      });
    }

    if (application.status !== "rejected") {
      return res.status(409).json({
        success: false,
        message: "Only rejected applications can be restored",
      });
    }

    // Plan limits apply only when a student restores their own application.
    if (student && student.plan !== "pro") {
      const pendingCount = await db.collection("applications").countDocuments({
        studentEmail: student.email,
        status: "pending",
      });

      if (pendingCount >= FREE_STUDENT_APPLY_LIMIT) {
        return res.status(403).json({
          success: false,
          message: "Free plan allows up to 2 pending applications at a time",
        });
      }
    }

    const restoredAt = new Date();
    const restoredFields = {
      status: "pending",
      restoredAt,
    };

    // Let a student refresh their apply details while restoring.
    if (typeof preferredSchedule === "string" && preferredSchedule.trim()) {
      restoredFields.preferredSchedule = preferredSchedule.trim();
    }
    if (typeof studentNote === "string") {
      restoredFields.studentNote = studentNote.trim();
    }
    if (typeof studentPhone === "string" && studentPhone.trim()) {
      restoredFields.studentPhone = studentPhone.trim();
    }

    const result = await db.collection("applications").updateOne(
      {
        _id: new ObjectId(id),
        status: "rejected",
        ...ownershipFilter,
      },
      {
        $set: restoredFields,
        $unset: {
          reviewedAt: "",
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Application status could not be restored",
      });
    }

    const restoredApplication = {
      ...application,
      ...restoredFields,
    };
    delete restoredApplication.reviewedAt;

    return res.status(200).json({
      success: true,
      message: "Application restored to pending",
      status: "pending",
      application: restoredApplication,
    });
  } catch (error) {
    console.error("Restore Application Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to restore application",
    });
  }
};
