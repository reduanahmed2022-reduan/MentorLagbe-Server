
import express from "express";

import {
  getMyBookmarks,
  checkBookmark,
  addBookmark,
  removeBookmark,
} from "../controllers/bookmarkController.js";

import { verifyToken, verifyStudent } from "../middleware/authMiddleware.js";

const router = express.Router();

// Student Only: List my bookmarks
router.get(
  "/",
  verifyToken,
  verifyStudent,
  getMyBookmarks
);

// Student Only: Check one tuition. Keep before any future /:tuitionId GET route.
router.get(
  "/check/:tuitionId",
  verifyToken,
  verifyStudent,
  checkBookmark
);

// Student Only: Bookmark an approved, active tuition
router.post(
  "/",
  verifyToken,
  verifyStudent,
  addBookmark
);

// Student Only: Remove one bookmark
router.delete(
  "/:tuitionId",
  verifyToken,
  verifyStudent,
  removeBookmark
);

export default router;
