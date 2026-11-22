
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Verify JWT Token
export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    const bearer = /^Bearer\s+([^\s]+)$/i.exec((authHeader || "").trim());
    if (!bearer) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided",
      });
    }

    const token = bearer[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (!decoded?.userId || !ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Check User Role against the database so token role changes take effect immediately.
export const authorizeRole = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    try {
      const user = await getDB()
        .collection("users")
        .findOne(
          { _id: new ObjectId(req.user.userId) },
          { projection: { role: 1 } }
        );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User account no longer exists",
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource",
        });
      }

      // Keep downstream handlers aligned with the live role.
      req.user.role = user.role;

      return next();
    } catch (error) {
      console.error("Authorize Role Error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not verify access rights",
      });
    }
  };
};

// Student Only
export const verifyStudent = authorizeRole("student");

// Tutor Only
export const verifyTutor = authorizeRole("tutor");

// Admin Only
export const verifyAdmin = authorizeRole("admin");
