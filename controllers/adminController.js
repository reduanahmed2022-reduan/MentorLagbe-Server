
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Admin: Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const db = getDB();

    const users = await db
      .collection("users")
      .find(
        { role: { $in: ["student", "tutor", "admin"] } },
        {
          projection: {
            name: 1,
            email: 1,
            role: 1,
            plan: 1,
            profileImage: 1,
            phone: 1,
            bio: 1,
            location: 1,
            createdAt: 1,
            updatedAt: 1,
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


// Admin: Change the role of any registered user
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!["student", "tutor", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be student, tutor, or admin",
      });
    }

    const db = getDB();
    const users = db.collection("users");
    const targetId = new ObjectId(id);
    const user = await users.findOne({ _id: targetId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // An admin must not be able to lock themselves out of the admin area.
    // Compare canonical ObjectIds so uppercase hex cannot bypass this guard.
    if (
      targetId.equals(new ObjectId(req.user.userId)) &&
      user.role === "admin" &&
      role !== "admin"
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own admin role",
      });
    }

    const isAdminDemotion = user.role === "admin" && role !== "admin";

    // Count admins excluding the target: only demote if >= 1 other admin remains.
    // Update pipelines cannot read sibling docs, so this re-check + the CAS filter
    // below is the strongest available guard; mutual concurrent demotions can still race.
    if (isAdminDemotion) {
      const remainingAdmins = await users.countDocuments({
        role: "admin",
        _id: { $ne: targetId },
      });

      if (remainingAdmins < 1) {
        return res.status(400).json({
          success: false,
          message: "At least one admin must remain",
        });
      }
    }

    if (user.role === role) {
      return res.status(200).json({
        success: true,
        message: `User already has the ${role} role`,
        user: {
          _id: user._id.toString(),
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role,
        },
      });
    }

    // CAS: a demotion only applies if the user is still an admin.
    const updateFilter = isAdminDemotion
      ? { _id: targetId, role: "admin" }
      : { _id: targetId };

    const result = await users.updateOne(updateFilter, {
      $set: { role, updatedAt: new Date() },
    });

    if (isAdminDemotion && result.matchedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one admin must remain",
      });
    }

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role,
      },
    });
  } catch (error) {
    console.error("Update User Role Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user role",
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
    const applicationsCollection = db.collection("applications");
    const paymentsCollection = db.collection("payments");

    const [
      totalUsers,
      totalStudents,
      totalTutors,
      totalTuitions,
      pendingTuitions,
      approvedTuitions,
      rejectedTuitions,
      totalApplications,
      acceptedApplications,
      pendingApplications,
      rejectedApplications,
      revenue,
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
      applicationsCollection.countDocuments(),
      applicationsCollection.countDocuments({ status: "accepted" }),
      applicationsCollection.countDocuments({ status: "pending" }),
      applicationsCollection.countDocuments({ status: "rejected" }),
      paymentsCollection
        .aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray(),
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
        totalApplications,
        totalApplied: totalApplications,
        acceptedApplications,
        pendingApplications,
        rejectedApplications,
        totalRevenue: revenue[0]?.total ?? 0,
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


 // Admin: Get All Transactions
export const getAllTransactions = async (req, res) => {
  try {
    const db = getDB();

    const transactions = await db
      .collection("payments")
      .find({})
      .sort({ paidAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Get All Transactions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions",
    });
  }
};


