
import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

 const DEFAULT_LIMIT = 12;
 const MAX_LIMIT = 50;

 // Normalize a user-supplied limit into a finite integer in 1..50.
 // Repeated query keys yield arrays, and values like "abc"/Infinity yield
 // NaN/Infinity. Those must fall back to a bounded default rather than
 // skipping the cap and returning an unbounded result set.
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

 // GET: Search, filter and sort tutors
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const {
      search,
      subject,
      location,
      mode,
      minRate,
      maxRate,
      sort,
      limit,
    } = req.query;

    const query = {};

    // Free-text search across the fields shown on tutor cards.
    if (search && String(search).trim()) {
      const term = escapeRegex(String(search).trim());

      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { subject: { $regex: term, $options: "i" } },
        { qualification: { $regex: term, $options: "i" } },
      ];
    }

    // Exact subject filter from the dropdown.
    if (subject) {
      query.subject = {
        $regex: `^${escapeRegex(String(subject))}$`,
        $options: "i",
      };
    }

    // Filter by location
    if (location) {
      query.location = {
        $regex: escapeRegex(String(location)),
        $options: "i",
      };
    }

    // Filter by teaching mode
    if (mode) {
      query.mode = {
        $regex: escapeRegex(String(mode)),
        $options: "i",
      };
    }

    // Filter by hourly rate
    if (minRate !== undefined || maxRate !== undefined) {
      query.hourlyRate = {};

      if (minRate !== undefined) {
        query.hourlyRate.$gte = Number(minRate);
      }

      if (maxRate !== undefined) {
        query.hourlyRate.$lte = Number(maxRate);
      }
    }

    // Sorting
    let sortOption = {};

    if (sort === "price-low") {
      sortOption = { hourlyRate: 1 };
    } else if (sort === "price-high") {
      sortOption = { hourlyRate: -1 };
    } else if (sort === "rating") {
      sortOption = { rating: -1 };
    } else {
      sortOption = { createdAt: -1 };
    }

    const tutorsCollection = db.collection("tutors");
    const total = await tutorsCollection.countDocuments(query);

    let cursor = tutorsCollection.find(query).sort(sortOption);

    if (limit !== undefined) {
      cursor = cursor.limit(normalizeLimit(limit));
    }

    const tutors = await cursor.toArray();

    const formattedTutors = tutors.map((tutor) => ({
      ...tutor,
      id: tutor._id.toString(),
      _id: undefined,
    }));

    res.status(200).json({
      success: true,
      total,
      tutors: formattedTutors,
    });
  } catch (error) {
    console.error("Fetch tutors error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch tutors",
    });
  }
});

//POST route
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const {
            name,
            subject,
            qualification,
            location,
            experience,
            rating,
            reviews,
            hourlyRate,
            mode,
            image,
            verified,
            bio,
        } = req.body;

        if (
            !name ||
            !subject ||
            !qualification ||
            !location ||
            experience === undefined ||
            hourlyRate === undefined ||
            !mode
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required tutor information",
            });
        }

        const newTutor = {
            name: name.trim(),
            subject: subject.trim(),
            qualification: qualification.trim(),
            location: location.trim(),
            experience: Number(experience),
            rating: Number(rating) || 0,
            reviews: Number(reviews) || 0,
            hourlyRate: Number(hourlyRate),
            mode,
            image: image || "",
            verified: Boolean(verified),
            bio: bio || "",
            createdAt: new Date(),
        };

        const db = getDB();

        const result = await db
            .collection("tutors")
            .insertOne(newTutor);

        res.status(201).json({
            success: true,
            message: "Tutor added successfully",
            tutor: {
                ...newTutor,
                id: result.insertedId.toString(),
            },
        });
    } catch (error) {
        console.error("Add tutor error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add tutor",
        });
    }
});


// PUT: Update tutor by ID
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tutor ID",
      });
    }

    const {
      name,
      subject,
      qualification,
      location,
      experience,
      rating,
      reviews,
      hourlyRate,
      mode,
      image,
      verified,
      bio,
    } = req.body;

    const updatedData = {};

    if (name !== undefined) updatedData.name = name.trim();
    if (subject !== undefined) updatedData.subject = subject.trim();
    if (qualification !== undefined) updatedData.qualification = qualification.trim();
    if (location !== undefined) updatedData.location = location.trim();
    if (experience !== undefined) updatedData.experience = Number(experience);
    if (rating !== undefined) updatedData.rating = Number(rating);
    if (reviews !== undefined) updatedData.reviews = Number(reviews);
    if (hourlyRate !== undefined) updatedData.hourlyRate = Number(hourlyRate);
    if (mode !== undefined) updatedData.mode = mode;
    if (image !== undefined) updatedData.image = image;
    if (verified !== undefined) updatedData.verified = Boolean(verified);
    if (bio !== undefined) updatedData.bio = bio;

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update",
      });
    }

    updatedData.updatedAt = new Date();

    const db = getDB();

    const result = await db.collection("tutors").updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found",
      });
    }

    const updatedTutor = await db.collection("tutors").findOne({
      _id: new ObjectId(id),
    });

    res.status(200).json({
      success: true,
      message: "Tutor updated successfully",
      tutor: {
        ...updatedTutor,
        id: updatedTutor._id.toString(),
        _id: undefined,
      },
    });
  } catch (error) {
    console.error("Update tutor error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update tutor",
    });
  }
});



// GET: Get single tutor by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tutor ID",
      });
    }

    const db = getDB();

    const tutor = await db.collection("tutors").findOne({
      _id: new ObjectId(id),
    });

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found",
      });
    }

    res.status(200).json({
      success: true,
      tutor: {
        ...tutor,
        id: tutor._id.toString(),
        _id: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch tutor",
    });
  }
});



// DELETE: Delete tutor by ID
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tutor ID",
      });
    }

    const db = getDB();

    const result = await db.collection("tutors").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tutor deleted successfully",
    });
  } catch (error) {
    console.error("Delete tutor error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete tutor",
    });
  }
});



export default router;
