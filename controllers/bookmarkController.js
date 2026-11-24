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

// Bookmarks are embedded in the student's `users` document. Only tuitions that
// are currently approved + active count toward the visible list and the free
// plan's slot budget; closed or unapproved batches stay saved but consume no slot.
async function getVisibleBookmarks(db, student) {
  const bookmarks = Array.isArray(student.bookmarks) ? student.bookmarks : [];

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

  const bookmarkTime = (bookmark) => {
    const time = Date.parse(bookmark.bookmarkedAt);
    return Number.isFinite(time) ? time : 0;
  };

  return bookmarks
    .slice()
    .sort((a, b) => bookmarkTime(b) - bookmarkTime(a))
    .map((bookmark) => ({
      ...bookmark,
      tuition: tuitionById.get(bookmark.tuitionId) || null,
    }))
    .filter((bookmark) => bookmark.tuition);
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

    // A closed or unapproved batch is not shown, but its bookmark is kept so it
    // reappears if the tutor reopens it after a fresh approval.
    const visibleBookmarks = await getVisibleBookmarks(db, student);

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

    const bookmarks = Array.isArray(student.bookmarks) ? student.bookmarks : [];
    const normalizedId = String(tuitionId).toLowerCase();
    const bookmark = bookmarks.find(
      (item) => String(item.tuitionId).toLowerCase() === normalizedId
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

    const bookmark = {
      _id: new ObjectId(),
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

    const existingBookmark = (Array.isArray(student.bookmarks) ? student.bookmarks : [])
      .find((item) => item.tuitionId === bookmark.tuitionId);

    if (existingBookmark) {
      return res.status(409).json({
        success: false,
        message: "Tuition is already bookmarked",
      });
    }

    if (student.plan !== "pro") {
      // Bug fix: count only bookmarks whose tuition is still approved + active.
      // Stale or closed batches must not consume one of the five free slots.
      const count = (await getVisibleBookmarks(db, student)).length;

      if (count >= FREE_STUDENT_BOOKMARK_LIMIT) {
        return res.status(403).json({
          success: false,
          message: "Free plan allows up to 5 bookmarks",
        });
      }
    }

    // The $ne guard makes the duplicate check atomic per user, so concurrent
    // requests cannot push two bookmarks for the same tuition.
    const result = await db.collection("users").updateOne(
      {
        _id: student._id,
        role: "student",
        "bookmarks.tuitionId": { $ne: bookmark.tuitionId },
      },
      { $push: { bookmarks: bookmark } }
    );

    if (result.matchedCount === 0) {
      const freshStudent = await db.collection("users").findOne(
        { _id: student._id, role: "student" },
        { projection: { bookmarks: 1 } }
      );

      if (!freshStudent) {
        return res.status(404).json({
          success: false,
          message: "Student account not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Tuition is already bookmarked",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Tuition bookmarked successfully",
      bookmarkId: bookmark._id,
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

    const normalizedId = String(tuitionId).toLowerCase();
    const result = await db.collection("users").updateOne(
      { _id: student._id, role: "student" },
      { $pull: { bookmarks: { tuitionId: { $in: [tuitionId, normalizedId] } } } }
    );

    if (result.modifiedCount === 0) {
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
