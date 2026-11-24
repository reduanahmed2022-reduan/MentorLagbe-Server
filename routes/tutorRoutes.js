
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

  // Tutor profiles are top-level fields on `users` documents with role:"tutor".
  // Pick only the public catalog fields so the password hash and unrelated
  // account data never leak into the existing flat tutor response shape.
  const PUBLIC_TUTOR_FIELDS = [
    "name",
    "email",
    "userId",
    "subject",
    "qualification",
    "location",
    "experience",
    "rating",
    "reviews",
    "hourlyRate",
    "mode",
    "image",
    "verified",
    "bio",
    "createdAt",
    "updatedAt",
  ];

  const formatTutor = (tutor) => {
    const formatted = {};

    for (const field of PUBLIC_TUTOR_FIELDS) {
      if (tutor[field] !== undefined) {
        formatted[field] = tutor[field];
      }
    }

    formatted.id = tutor._id.toString();

    return formatted;
  };

  const TUTOR_PROFILE_FIELDS = [
    "subject",
    "qualification",
    "location",
    "experience",
    "rating",
    "reviews",
    "hourlyRate",
    "mode",
    "image",
    "verified",
    "bio",
    "userId",
  ];

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

      const query = { role: "tutor" };

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

      const tutorsCollection = db.collection("users");
      const total = await tutorsCollection.countDocuments(query);

      let cursor = tutorsCollection.find(query).sort(sortOption);

      if (limit !== undefined) {
        cursor = cursor.limit(normalizeLimit(limit));
      }

      const tutors = await cursor.toArray();

      const formattedTutors = tutors.map(formatTutor);

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
              email,
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
              !email ||
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

          const normalizedEmail = String(email).trim().toLowerCase();

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
          };

          const db = getDB();
          const users = db.collection("users");

          // Upsert the tutor profile onto an existing user account (or create
          // that user if the admin is adding a brand-new tutor). Never writes
          // to a separate tutors collection.
          await users.updateOne(
              { email: normalizedEmail },
              {
                  $set: {
                      ...newTutor,
                      email: normalizedEmail,
                      role: "tutor",
                      updatedAt: new Date(),
                  },
                  $setOnInsert: { createdAt: new Date() },
              },
              { upsert: true }
          );

          const savedTutor = await users.findOne({ email: normalizedEmail });

          res.status(201).json({
              success: true,
              message: "Tutor added successfully",
              tutor: formatTutor(savedTutor),
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

      const result = await db.collection("users").updateOne(
        { _id: new ObjectId(id), role: "tutor" },
        { $set: updatedData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Tutor not found",
        });
      }

      const updatedTutor = await db.collection("users").findOne({
        _id: new ObjectId(id),
        role: "tutor",
      });

      res.status(200).json({
        success: true,
        message: "Tutor updated successfully",
        tutor: formatTutor(updatedTutor),
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

      const tutor = await db.collection("users").findOne({
        _id: new ObjectId(id),
        role: "tutor",
      });

      if (!tutor) {
        return res.status(404).json({
          success: false,
          message: "Tutor not found",
        });
      }

      res.status(200).json({
        success: true,
        tutor: formatTutor(tutor),
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

      // Clear the public tutor profile instead of deleting the account: the
      // same user document may own tuitions, payments and BetterAuth records,
      // and removing it would break those references.
      const unsetTutorFields = {};

      for (const field of TUTOR_PROFILE_FIELDS) {
        unsetTutorFields[field] = "";
      }

      const result = await db.collection("users").updateOne(
        { _id: new ObjectId(id), role: "tutor" },
        {
          $unset: unsetTutorFields,
          $set: { updatedAt: new Date() },
        }
      );

      if (result.matchedCount === 0) {
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
