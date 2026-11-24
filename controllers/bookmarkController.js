import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Free students can save five tuition batches; Pro students are unlimited.
const FREE_STUDENT_BOOKMARK_LIMIT = 5;

async function findStudent(db, req) {
  if (!ObjectId.isValid(req.user.userId)) return null;

  return db.collection("users").findOne({
    _id: new ObjectId(req.user.userId),
    role: "student",
  });
}

// Student: List my bookmarks (only batches still visible to students)
export const getMyBookmarks = async (req, res) => {
  try {
    const db = getDB();
    const student = await findStudent(db, req);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

    const bookmarks = await db
      .collection("bookmarks")
      .find({ studentEmail: student.email })
      .sort({ bookmarkedAt: -1 })
      .toArray();

    const validIds = bookmarks
      .filter((bookmark) => ObjectId.isValid(bookmark.tuitionId))
      .map((bookmark) => new ObjectId(bookmark.tuitionId));

    const liveTuitions = validIds.length
      ? await db
          .collection("tuitions")
          .find({
            _id: { $in: validIds },
            approvalStatus: "approved",
            isActive: true,
          })
          .toArray()
      : [];

    const tuitionById = new Map(
      liveTuitions.map((tuition) => [tuition._id.toString(), tuition])
    );

    // A closed or unapproved batch is not shown, but its bookmark is kept so it
    // reappears if the tutor reopens it after a fresh approval.
    const visibleBookmarks = bookmarks
      .map((bookmark) => ({
        ...bookmark,
        tuition: tuitionById.get(bookmark.tuitionId) || null,
      }))
      .filter((bookmark) => bookmark.tuition);

    return res.status(200).json({
      success: true,
      total: visibleBookmarks.length,
      bookmarks: visibleBookmarks,
    });
  } catch (error) {
    console.error("Get Bookmarks Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bookmarks",
    });
  }
};

// Student: Check whether one tuition is bookmarked
export const checkBookmark = async (req, res) => {
  try {
    const { tuitionId } = req.params;

    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const db = getDB();
    const student = await findStudent(db, req);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

    const bookmark = await db.collection("bookmarks").findOne(
      {
        tuitionId,
        studentEmail: student.email,
      },
      { projection: { _id: 1 } }
    );

    return res.status(200).json({
      success: true,
      isBookmarked: Boolean(bookmark),
    });
  } catch (error) {
    console.error("Check Bookmark Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check bookmark",
    });
  }
};

// Student: Bookmark an approved, active tuition
export const addBookmark = async (req, res) => {
  try {
    const { tuitionId } = req.body;

    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const db = getDB();
    const student = await findStudent(db, req);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

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

    const existingBookmark = await db.collection("bookmarks").findOne({
      tuitionId: tuition._id.toString(),
      studentEmail: student.email,
    });

    if (existingBookmark) {
      return res.status(409).json({
        success: false,
        message: "Tuition is already bookmarked",
      });
    }

    if (student.plan !== "pro") {
      const count = await db.collection("bookmarks").countDocuments({
        studentEmail: student.email,
      });

      if (count >= FREE_STUDENT_BOOKMARK_LIMIT) {
        return res.status(403).json({
          success: false,
          message: "Free plan allows up to 5 bookmarks",
        });
      }
    }

    const bookmark = {
      tuitionId: tuition._id.toString(),
      tuitionTitle: tuition.title,
      subject: tuition.subject,
      classLevel: tuition.classLevel,
      monthlyFee: tuition.monthlyFee,
      tutorEmail: tuition.tutorEmail,
      studentName: student.name,
      studentEmail: student.email,
      bookmarkedAt: new Date(),
    };

    const result = await db.collection("bookmarks").insertOne(bookmark);

    return res.status(201).json({
      success: true,
      message: "Tuition bookmarked successfully",
      bookmarkId: result.insertedId,
      bookmark,
    });
  } catch (error) {
    console.error("Add Bookmark Error:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Tuition is already bookmarked",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add bookmark",
    });
  }
};

// Student: Remove one bookmark
export const removeBookmark = async (req, res) => {
  try {
    const { tuitionId } = req.params;

    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const db = getDB();
    const student = await findStudent(db, req);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      });
    }

    const result = await db.collection("bookmarks").deleteOne({
      tuitionId,
      studentEmail: student.email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bookmark removed successfully",
    });
  } catch (error) {
    console.error("Remove Bookmark Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove bookmark",
    });
  }
};
