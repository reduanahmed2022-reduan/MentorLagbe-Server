
import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const router = express.Router();

// GET: Get all tutors
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const tutors = await db
      .collection("tutors")
      .find()
      .toArray();

    const formattedTutors = tutors.map((tutor) => ({
      ...tutor,
      id: tutor._id.toString(),
      _id: undefined,
    }));

    res.status(200).json({
      success: true,
      total: formattedTutors.length,
      tutors: formattedTutors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch tutors",
    });
  }
});

//POST route
router.post("/", async (req, res) => {
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
router.put("/:id", async (req, res) => {
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

export default router;
