
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
