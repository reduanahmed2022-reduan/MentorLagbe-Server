
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const MAX_FEEDBACK_LENGTH = 1000;

// Public: reviews for one tuition, plus the aggregate score.
export const getTuitionReviews = async (req, res) => {
  try {
    const { tuitionId } = req.params;

    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const db = getDB();

    // Public reads follow the same visibility rule as the tuition listing:
    // only approved + active batches expose their embedded reviews.
    const tuition = await db
      .collection("tuitions")
      .findOne(
        {
          _id: new ObjectId(tuitionId),
          approvalStatus: "approved",
          isActive: true,
        },
        { projection: { reviews: 1 } }
      );

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found",
      });
    }

    const reviewTime = (review) => {
      const time = Date.parse(review.createdAt);
      return Number.isFinite(time) ? time : 0;
    };

    const reviews = (Array.isArray(tuition.reviews) ? tuition.reviews : [])
      .slice()
      .sort((a, b) => reviewTime(b) - reviewTime(a));

    const total = reviews.length;
    const sum = reviews.reduce((value, review) => value + Number(review.rating || 0), 0);
    const averageRating = total ? Math.round((sum / total) * 10) / 10 : 0;

    return res.status(200).json({
      success: true,
      total,
      averageRating,
      reviews,
    });
  } catch (error) {
    console.error("Get Tuition Reviews Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load reviews",
    });
  }
};

// Student only: only an accepted application may leave one review per tuition.
export const createReview = async (req, res) => {
  try {
    const { tuitionId, rating, feedback } = req.body;

    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number from 1 to 5",
      });
    }

    if (feedback !== undefined && typeof feedback !== "string") {
      return res.status(400).json({
        success: false,
        message: "Feedback must be text",
      });
    }

    const cleanFeedback = String(feedback || "").trim();
    if (cleanFeedback.length > MAX_FEEDBACK_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer`,
      });
    }

    const db = getDB();

    const student = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.userId), role: "student" },
      { projection: { name: 1, email: 1 } }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

    const tuition = await db.collection("tuitions").findOne(
      { _id: new ObjectId(tuitionId), approvalStatus: "approved" },
      { projection: { title: 1, reviews: 1 } }
    );

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Approved tuition not found",
      });
    }

    // Mirror how applications are stored: tuitionId as a string + student email.
    const acceptedApplication = await db.collection("applications").findOne({
      tuitionId,
      studentEmail: student.email,
      status: "accepted",
    });

    if (!acceptedApplication) {
      return res.status(403).json({
        success: false,
        message: "Only students with an accepted application can review this tuition",
      });
    }

    const existingReviews = Array.isArray(tuition.reviews) ? tuition.reviews : [];
    const existingReview = existingReviews.find(
      (item) => item.studentEmail === student.email
    );

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this tuition",
      });
    }

    const review = {
      _id: new ObjectId(),
      tuitionId,
      tuitionTitle: tuition.title,
      studentId: req.user.userId,
      studentName: student.name,
      studentEmail: student.email,
      rating: numericRating,
      feedback: cleanFeedback,
      createdAt: new Date(),
    };

    // The $ne guard keeps the one-review-per-student rule atomic even if two
    // requests arrive at the same time.
    const result = await db.collection("tuitions").updateOne(
      {
        _id: tuition._id,
        "reviews.studentEmail": { $ne: student.email },
      },
      { $push: { reviews: review } }
    );

    if (result.matchedCount === 0) {
      const freshTuition = await db.collection("tuitions").findOne(
        { _id: tuition._id },
        { projection: { reviews: 1 } }
      );

      if (!freshTuition) {
        return res.status(404).json({
          success: false,
          message: "Approved tuition not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "You have already reviewed this tuition",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: { _id: review._id, ...review },
    });
  } catch (error) {
    console.error("Create Review Error:", error.message);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this tuition",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to submit review",
    });
  }
};
