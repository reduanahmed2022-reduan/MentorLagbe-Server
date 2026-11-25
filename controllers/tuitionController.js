
// import { ObjectId } from "mongodb";
// import { getDB } from "../config/db.js";

// // Create Tuition Request (Tutor)
// export const createTuition = async (req, res) => {
//   try {
//     const {
//       title,
//       subject,
//       classLevel,
//       mode,
//       location,
//       monthlyFee,
//       daysPerWeek,
//       description,
//       bannerImage,
//     } = req.body;

//     // Required field validation
//     if (
//       !title?.trim() ||
//       !subject?.trim() ||
//       !classLevel?.trim() ||
//       !mode ||
//       !location?.trim() ||
//       monthlyFee === undefined ||
//       daysPerWeek === undefined ||
//       !description?.trim()
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide all required fields",
//       });
//     }

//     // Validate tuition mode
//     if (!["Online", "Offline"].includes(mode)) {
//       return res.status(400).json({
//         success: false,
//         message: "Mode must be Online or Offline",
//       });
//     }

//     // Validate monthly fee and days per week
//     if (
//       typeof monthlyFee !== "number" ||
//       !Number.isFinite(monthlyFee) ||
//       monthlyFee <= 0 ||
//       !Number.isInteger(daysPerWeek) ||
//       daysPerWeek < 1 ||
//       daysPerWeek > 7
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid monthly fee or days per week",
//       });
//     }

//     const db = getDB();

//     // Find logged-in tutor
//     if (!ObjectId.isValid(req.user.userId)) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid user information",
//       });
//     }

//     const tutor = await db.collection("users").findOne(
//       { _id: new ObjectId(req.user.userId) },
//       {
//         projection: { password: 0 },
//       }
//     );

//     if (!tutor || tutor.role !== "tutor") {
//       return res.status(403).json({
//         success: false,
//         message: "Only registered tutors can create tuition posts",
//       });
//     }

//     // Create tuition document
//     const newTuition = {
//       title: title.trim(),
//       subject: subject.trim(),
//       classLevel: classLevel.trim(),
//       mode,
//       location: location.trim(),
//       monthlyFee,
//       daysPerWeek,
//       description: description.trim(),
//       bannerImage: bannerImage || "",
//       tutorName: tutor.name,
//       tutorEmail: tutor.email,
//       approvalStatus: "pending",
//       isActive: true,
//       createdAt: new Date(),
//     };

//     const result = await db.collection("tuitions").insertOne(newTuition);

//     return res.status(201).json({
//       success: true,
//       message: "Tuition request submitted successfully",
//       tuition: {
//         _id: result.insertedId,
//         ...newTuition,
//       },
//     });
//   } catch (error) {
//     console.error("Create Tuition Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to create tuition request",
//     });
//   }
// };

// // Get All Approved Tuitions (Public)
// export const getAllTuitions = async (req, res) => {
//   try {
//     const db = getDB();

//     const tuitions = await db
//       .collection("tuitions")
//       .find({
//         approvalStatus: "approved",
//         isActive: true,
//       })
//       .sort({ createdAt: -1 })
//       .toArray();

//     return res.status(200).json({
//       success: true,
//       total: tuitions.length,
//       tuitions,
//     });
//   } catch (error) {
//     console.error("Get All Tuitions Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve tuitions",
//     });
//   }
// };

// // Admin: Get All Pending Tuitions
// export const getPendingTuitions = async (req, res) => {
//   try {
//     const db = getDB();

//     const tuitions = await db
//       .collection("tuitions")
//       .find({
//         approvalStatus: "pending",
//       })
//       .sort({ createdAt: -1 })
//       .toArray();

//     return res.status(200).json({
//       success: true,
//       total: tuitions.length,
//       tuitions,
//     });
//   } catch (error) {
//     console.error("Get Pending Tuitions Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve pending tuitions",
//     });
//   }
// };


//  // Admin: Approve or Reject Tuition
// export const reviewTuition = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { approvalStatus } = req.body;

//     // Validate tuition ID
//     if (!ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid tuition ID",
//       });
//     }

//     // Validate approval status
//     if (!["approved", "rejected"].includes(approvalStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: "Status must be approved or rejected",
//       });
//     }

//     const db = getDB();

//     // Update only pending tuition
//     const result = await db.collection("tuitions").updateOne(
//       {
//         _id: new ObjectId(id),
//         approvalStatus: "pending",
//       },
//       {
//         $set: {
//           approvalStatus,
//           isActive: approvalStatus === "approved",
//           reviewedAt: new Date(),
//         },
//       }
//     );

//     if (result.matchedCount === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Pending tuition not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: `Tuition ${approvalStatus} successfully`,
//     });
//   } catch (error) {
//     console.error("Review Tuition Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to review tuition",
//     });
//   }
// };

// // Tutor: Get My Tuitions
// export const getMyTuitions = async (req, res) => {
//   try {
//     if (!ObjectId.isValid(req.user.userId)) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid user information",
//       });
//     }

//     const db = getDB();

//     // Find Logged-in Tutor
//     const tutor = await db.collection("users").findOne({
//       _id: new ObjectId(req.user.userId),
//       role: "tutor",
//     });

//     if (!tutor) {
//       return res.status(404).json({
//         success: false,
//         message: "Tutor account not found",
//       });
//     }

//     // Get All Tuitions Created by This Tutor
//     const tuitions = await db
//       .collection("tuitions")
//       .find({
//         tutorEmail: tutor.email,
//       })
//       .sort({ createdAt: -1 })
//       .toArray();

//     return res.status(200).json({
//       success: true,
//       total: tuitions.length,
//       tuitions,
//     });
//   } catch (error) {
//     console.error("Get My Tuitions Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve your tuitions",
//     });
//   }
// };


//  // Tutor: Update My Tuition
// export const updateMyTuition = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid tuition ID",
//       });
//     }

//     const {
//       title,
//       subject,
//       classLevel,
//       mode,
//       location,
//       monthlyFee,
//       daysPerWeek,
//       description,
//     } = req.body;

//     // Validate Required Fields
//     if (
//       !title?.trim() ||
//       !subject?.trim() ||
//       !classLevel?.trim() ||
//       !["Online", "Offline"].includes(mode) ||
//       !location?.trim() ||
//       !description?.trim()
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide all required tuition information",
//       });
//     }

//     const fee = Number(monthlyFee);
//     const days = Number(daysPerWeek);

//     if (!Number.isFinite(fee) || fee <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Monthly fee must be a positive number",
//       });
//     }

//     if (!Number.isInteger(days) || days < 1 || days > 7) {
//       return res.status(400).json({
//         success: false,
//         message: "Days per week must be between 1 and 7",
//       });
//     }

//     const db = getDB();

//     const tutor = await db.collection("users").findOne({
//       _id: new ObjectId(req.user.userId),
//       role: "tutor",
//     });

//     if (!tutor) {
//       return res.status(404).json({
//         success: false,
//         message: "Tutor account not found",
//       });
//     }

//     // Update Only Own Tuition
//     const result = await db.collection("tuitions").updateOne(
//       {
//         _id: new ObjectId(id),
//         tutorEmail: tutor.email,
//       },
//       {
//         $set: {
//           title: title.trim(),
//           subject: subject.trim(),
//           classLevel: classLevel.trim(),
//           mode,
//           location: location.trim(),
//           monthlyFee: fee,
//           daysPerWeek: days,
//           description: description.trim(),
//           updatedAt: new Date(),
//         },
//       }
//     );

//     if (result.matchedCount === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Tuition not found or access denied",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Tuition updated successfully",
//     });
//   } catch (error) {
//     console.error("Update My Tuition Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to update tuition",
//     });
//   }
// };


// // Tutor Only: Delete My Tuition
// export const deleteMyTuition = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid tuition ID",
//       });
//     }

//     const db = getDB();

//     const tutor = await db.collection("users").findOne({
//       _id: new ObjectId(req.user.userId),
//       role: "tutor",
//     });

//     if (!tutor) {
//       return res.status(404).json({
//         success: false,
//         message: "Tutor not found",
//       });
//     }

//     const tuition = await db.collection("tuitions").findOne({
//       _id: new ObjectId(id),
//       tutorEmail: tutor.email,
//     });

//     if (!tuition) {
//       return res.status(404).json({
//         success: false,
//         message: "Tuition not found or you do not have permission to delete it",
//       });
//     }

//     await db.collection("tuitions").deleteOne({
//       _id: new ObjectId(id),
//       tutorEmail: tutor.email,
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Tuition deleted successfully",
//     });
//   } catch (error) {
//     console.error("Delete tuition error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete tuition",
//     });
//   }
// };




import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const DEFAULT_PUBLIC_LIMIT = 50;

const isText = (value) => typeof value === "string" && value.trim().length > 0;

// Normalize a user-supplied limit into a finite integer in 1..50.
// Arrays (repeated query keys), non-numeric strings, Infinity and empty
// values all fall back to a bounded default so no path can return an
// unbounded result set.
const normalizeLimit = (value, fallback = DEFAULT_LIMIT) => {
  if (Array.isArray(value) || value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "string" && value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
};

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
      ![title, subject, classLevel, mode, location, description].every(isText) ||
      monthlyFee === undefined ||
      daysPerWeek === undefined
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

    // Free tutors may publish at most 2 tuitions; Pro tutors are unlimited.
    if (tutor.plan !== "pro") {
      // Only live listings consume a slot: rejected or closed batches must not
      // block a free tutor from publishing again.
      const existingCount = await db
        .collection("tuitions")
        .countDocuments({
          tutorEmail: tutor.email,
          isActive: true,
          approvalStatus: { $in: ["pending", "approved"] },
        });

      if (existingCount >= 2) {
        return res.status(403).json({
          success: false,
          message:
            "Free tutors can post up to 2 tuitions. Upgrade to Pro for unlimited posts.",
        });
      }
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
      bannerImage: typeof bannerImage === "string" ? bannerImage : "",
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

// Get All Approved Tuitions with Search and Filters (Public)
export const getAllTuitions = async (req, res) => {
  try {
    const db = getDB();

    const {
      search,
      subject,
      classLevel,
      mode,
      location,
      minFee,
      maxFee,
      sort,
      page,
      limit,
    } = req.query;

    // Validate text query parameters
    const textFilters = [search, subject, classLevel, location];

    if (
      textFilters.some(
        (value) => value !== undefined && typeof value !== "string"
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Search and text filters must be strings",
      });
    }

    // Escape special regex characters
    const escapeRegex = (value) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Only approved and active tuitions are public
    const filter = {
      approvalStatus: "approved",
      isActive: true,
    };

    // General Search: title, subject, class level, location
    if (search?.trim()) {
      const searchRegex = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };

      filter.$or = [
        { title: searchRegex },
        { subject: searchRegex },
        { classLevel: searchRegex },
        { location: searchRegex },
      ];
    }

    // Subject Filter. Coding is the canonical platform label, but older
    // listings may still be stored as ICT, so both match the same filter.
    if (subject?.trim()) {
      const requestedSubject = subject.trim();
      const subjectValues =
        requestedSubject.toLowerCase() === "coding"
          ? ["Coding", "ICT", "Programming"]
          : [requestedSubject];

      filter.subject = {
        $in: subjectValues.map(
          (value) => new RegExp(`^${escapeRegex(value)}$`, "i")
        ),
      };
    }

    // Class Level Filter
    if (classLevel?.trim()) {
      filter.classLevel = {
        $regex: `^${escapeRegex(classLevel.trim())}$`,
        $options: "i",
      };
    }

    // Mode Filter
    if (mode !== undefined) {
      if (
        typeof mode !== "string" ||
        !["Online", "Offline"].includes(mode)
      ) {
        return res.status(400).json({
          success: false,
          message: "Mode must be Online or Offline",
        });
      }

      filter.mode = mode;
    }

    // Location Filter
    if (location?.trim()) {
      filter.location = {
        $regex: escapeRegex(location.trim()),
        $options: "i",
      };
    }

    // Monthly Fee Filter
    if (minFee !== undefined || maxFee !== undefined) {
      const minimum = minFee === undefined ? 0 : Number(minFee);
      const maximum = maxFee === undefined ? Infinity : Number(maxFee);

      if (
        !Number.isFinite(minimum) ||
        minimum < 0 ||
        (maxFee !== undefined &&
          (!Number.isFinite(maximum) || maximum < 0)) ||
        minimum > maximum
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid monthly fee range",
        });
      }

      filter.monthlyFee = {};

      if (minFee !== undefined) {
        filter.monthlyFee.$gte = minimum;
      }

      if (maxFee !== undefined) {
        filter.monthlyFee.$lte = maximum;
      }
    }

    // Sorting must happen before pagination, otherwise "fee: low to high"
    // only reorders the current page while cheaper rows stay on later pages.
    const allowedSorts = ["newest", "fee-low", "fee-high"];

    if (sort !== undefined && (typeof sort !== "string" || !allowedSorts.includes(sort))) {
      return res.status(400).json({
        success: false,
        message: "sort must be newest, fee-low or fee-high",
      });
    }

    const sortOption =
      sort === "fee-low"
        ? { monthlyFee: 1, createdAt: -1 }
        : sort === "fee-high"
          ? { monthlyFee: -1, createdAt: -1 }
          : { createdAt: -1 };

    // Optional server-side pagination. Each parameter falls back independently
    // so `?limit=6` (home sections) and `?page=2` both work as expected.
    const hasPagination = page !== undefined || limit !== undefined;

    if (
      (page !== undefined && !Number.isFinite(Number(page))) ||
      (limit !== undefined && !Number.isFinite(Number(limit)))
    ) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be numbers",
      });
    }

    const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
    // Bounded in every case: paginated requests use the normalized page size,
    // while unpaginated public requests get a sane default cap.
    const pageSize = hasPagination
      ? normalizeLimit(limit)
      : DEFAULT_PUBLIC_LIMIT;

    const tuitionsCollection = db.collection("tuitions");
    const total = await tuitionsCollection.countDocuments(filter);

    const query = tuitionsCollection.find(filter).sort(sortOption);

    if (hasPagination) {
      query.skip((pageNumber - 1) * pageSize);
    }
    query.limit(pageSize);

    const tuitions = await query.toArray();

    return res.status(200).json({
      success: true,
      total,
      ...(hasPagination && {
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      }),
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

// Admin/Tutor: Restore a rejected tuition to pending for a fresh review
export const restoreRejectedTuition = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const db = getDB();

    // Tutors may only restore their own rejected batches. Admins may restore any.
    let ownershipFilter = {};

    if (req.user.role === "tutor") {
      if (!ObjectId.isValid(req.user.userId)) {
        return res.status(401).json({
          success: false,
          message: "Invalid user information",
        });
      }

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

      ownershipFilter = { tutorEmail: tutor.email };
    }

    const result = await db.collection("tuitions").updateOne(
      {
        _id: new ObjectId(id),
        approvalStatus: "rejected",
        ...ownershipFilter,
      },
      {
        $set: {
          approvalStatus: "pending",
          isActive: false,
          updatedAt: new Date(),
        },
        $unset: {
          reviewedAt: "",
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Rejected tuition not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tuition restored to pending",
      approvalStatus: "pending",
      isActive: false,
    });
  } catch (error) {
    console.error("Restore Tuition Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to restore tuition",
    });
  }
};

// Tutor: Get My Tuitions
export const getMyTuitions = async (req, res) => {
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

    // Get All Tuitions Created by This Tutor
    const tuitions = await db
      .collection("tuitions")
      .find({
        tutorEmail: tutor.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: tuitions.length,
      tuitions,
    });
  } catch (error) {
    console.error("Get My Tuitions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your tuitions",
    });
  }
};

// Tutor: Update My Tuition
export const updateMyTuition = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

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

    // Validate Required Fields
    if (
      ![title, subject, classLevel, mode, location, description].every(isText) ||
      !["Online", "Offline"].includes(mode)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required tuition information",
      });
    }

    const fee = Number(monthlyFee);
    const days = Number(daysPerWeek);

    if (!Number.isFinite(fee) || fee <= 0) {
      return res.status(400).json({
        success: false,
        message: "Monthly fee must be a positive number",
      });
    }

    if (!Number.isInteger(days) || days < 1 || days > 7) {
      return res.status(400).json({
        success: false,
        message: "Days per week must be between 1 and 7",
      });
    }

    const db = getDB();

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

    // Use the same ownership filter for the read and the write so a tutor can
    // only inspect and modify their own tuition.
    const tuitionFilter = {
      _id: new ObjectId(id),
      tutorEmail: tutor.email,
    };

    const tuition = await db.collection("tuitions").findOne(tuitionFilter);

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found or access denied",
      });
    }

    const updatedValues = {
      title: title.trim(),
      subject: subject.trim(),
      classLevel: classLevel.trim(),
      mode,
      location: location.trim(),
      monthlyFee: fee,
      daysPerWeek: days,
      description: description.trim(),
      ...(bannerImage !== undefined && { bannerImage }),
    };

    // Editing material content of an approved post must send it back through
    // moderation instead of leaving an unreviewed edit live.
    const materialFieldsChanged = Object.entries(updatedValues).some(
      ([field, value]) => String(tuition[field] ?? "") !== String(value)
    );

    const requiresReview =
      materialFieldsChanged && tuition.approvalStatus === "approved";

    const result = await db.collection("tuitions").updateOne(
      tuitionFilter,
      {
        $set: {
          ...updatedValues,
          ...(requiresReview && {
            approvalStatus: "pending",
            isActive: false,
          }),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tuition updated successfully",
    });
  } catch (error) {
    console.error("Update My Tuition Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update tuition",
    });
  }
};

// Tutor Only: Delete My Tuition
export const deleteMyTuition = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const db = getDB();

    const tutor = await db.collection("users").findOne({
      _id: new ObjectId(req.user.userId),
      role: "tutor",
    });

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found",
      });
    }

    const tuition = await db.collection("tuitions").findOne({
      _id: new ObjectId(id),
      tutorEmail: tutor.email,
    });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found or you do not have permission to delete it",
      });
    }

    await db.collection("tuitions").deleteOne({
      _id: new ObjectId(id),
      tutorEmail: tutor.email,
    });

    return res.status(200).json({
      success: true,
      message: "Tuition deleted successfully",
    });
  } catch (error) {
    console.error("Delete tuition error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete tuition",
    });
  }
};


// Get Single Approved Tuition Details (Public)
export const getTuitionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const db = getDB();

    const tuition = await db.collection("tuitions").findOne({
      _id: new ObjectId(id),
      approvalStatus: "approved",
      isActive: true,
    });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found",
      });
    }

    return res.status(200).json({
      success: true,
      tuition,
    });
  } catch (error) {
    console.error("Get Tuition Details Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve tuition details",
    });
  }
};

// Tutor Only: Toggle a tuition between Active and Closed
export const toggleTuitionStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user",
      });
    }

    const db = getDB();

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

    const tuition = await db.collection("tuitions").findOne({
      _id: new ObjectId(id),
      tutorEmail: tutor.email,
    });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found or access denied",
      });
    }

    if (tuition.approvalStatus !== "approved") {
      return res.status(409).json({
        success: false,
        message: "Only approved tuitions can be opened or closed",
      });
    }

    const isActive = !tuition.isActive;

    await db.collection("tuitions").updateOne(
      { _id: tuition._id, tutorEmail: tutor.email, approvalStatus: "approved" },
      { $set: { isActive, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: `Tuition marked as ${isActive ? "Active" : "Closed"}`,
      isActive,
    });
  } catch (error) {
    console.error("Toggle Tuition Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update tuition status",
    });
  }
};

