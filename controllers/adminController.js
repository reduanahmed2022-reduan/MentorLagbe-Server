
import { getDB } from "../config/db.js";

// Admin: Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const db = getDB();

    const users = await db
      .collection("users")
      .find(
        {},
        {
          projection: {
            password: 0,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: users.length,
      users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};


// Admin: Get All Tuitions
export const getAllAdminTuitions = async (req, res) => {
  try {
    const db = getDB();

    const tuitions = await db
      .collection("tuitions")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: tuitions.length,
      tuitions,
    });
  } catch (error) {
    console.error("Get All Admin Tuitions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve all tuitions",
    });
  }
};


// Admin: Get Dashboard Statistics
export const getAdminStats = async (req, res) => {
  try {
    const db = getDB();

    const usersCollection = db.collection("users");
    const tuitionsCollection = db.collection("tuitions");

    const [
      totalUsers,
      totalStudents,
      totalTutors,
      totalTuitions,
      pendingTuitions,
      approvedTuitions,
      rejectedTuitions,
    ] = await Promise.all([
      usersCollection.countDocuments(),
      usersCollection.countDocuments({ role: "student" }),
      usersCollection.countDocuments({ role: "tutor" }),
      tuitionsCollection.countDocuments(),
      tuitionsCollection.countDocuments({
        approvalStatus: "pending",
      }),
      tuitionsCollection.countDocuments({
        approvalStatus: "approved",
      }),
      tuitionsCollection.countDocuments({
        approvalStatus: "rejected",
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalStudents,
        totalTutors,
        totalTuitions,
        pendingTuitions,
        approvedTuitions,
        rejectedTuitions,
      },
    });
  } catch (error) {
    console.error("Admin Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard statistics",
    });
  }
};

