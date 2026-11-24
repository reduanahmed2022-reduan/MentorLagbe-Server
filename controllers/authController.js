import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";
import { getAuth, isBetterAuthConfigured } from "../config/betterAuth.js";

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields and their types before calling .trim()/.toLowerCase().
    if (![name, email, password, role].every(isNonEmptyString)) {
      return res.status(400).json({
        success: false,
        message: "All fields are required and must be text",
      });
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Validate user role
    const allowedRoles = ["student", "tutor"];

    if (!allowedRoles.includes(role.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Choose student or tutor",
      });
    }

    // Validate password
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters",
      });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existingUser = await usersCollection.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const registeredName = name.trim();
    const registeredRole = role.toLowerCase();
    let userId;

    if (isBetterAuthConfigured()) {
      try {
        const auth = await getAuth();
        const signUp = await auth.api.signUpEmail({
          body: {
            name: registeredName,
            email: normalizedEmail,
            password,
          },
        });

        // A generic duplicate response has no session token. Map it to the
        // same 409 contract the legacy pre-check produces.
        if (!signUp?.user?.id || signUp.token === null) {
          return res.status(409).json({
            success: false,
            message: "Email already registered",
          });
        }

        userId = signUp.user.id;

        // The Mongo adapter stores BetterAuth-generated string ids, while every
        // legacy controller queries `users._id` as an ObjectId. Migrate this one
        // document to an ObjectId and sync the fields the JWT flow still needs.
        const hashedPassword = await bcrypt.hash(password, 12);
        const objectId = new ObjectId(userId);
        const baUser = await usersCollection.findOne({ _id: userId });

        if (baUser) {
          const { _id: _stringId, ...userDoc } = baUser;

          await usersCollection.deleteOne({ _id: userId });
          await usersCollection.insertOne({
            ...userDoc,
            _id: objectId,
            role: registeredRole,
            password: hashedPassword,
            profileImage: "",
            updatedAt: new Date(),
          });
        } else {
          await usersCollection.updateOne(
            { _id: objectId },
            {
              $set: {
                role: registeredRole,
                password: hashedPassword,
                profileImage: "",
                updatedAt: new Date(),
              },
            }
          );
        }
      } catch (error) {
        // BetterAuth throws a 422 APIError for duplicates in this config. Keep
        // the legacy 409 contract even when the pre-check loses a race.
        if (
          error?.status === "UNPROCESSABLE_ENTITY" ||
          error?.statusCode === 422 ||
          /already exists/i.test(error?.message || "")
        ) {
          return res.status(409).json({
            success: false,
            message: "Email already registered",
          });
        }

        // Fall back to the legacy insert when BetterAuth is unavailable.
        console.error("BetterAuth sign-up fallback:", error.message);
        userId = undefined;
      }
    }

    if (!userId) {
      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = {
        name: registeredName,
        email: normalizedEmail,
        password: hashedPassword,
        role: registeredRole,
        createdAt: new Date(),
      };

      const result = await usersCollection.insertOne(newUser);
      userId = result.insertedId.toString();
    }

    // Generate JWT token — payload and options are intentionally unchanged.
    const token = jwt.sign(
      {
        userId: String(userId),
        role: registeredRole,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: String(userId),
        name: registeredName,
        email: normalizedEmail,
        role: registeredRole,
        plan: "free",
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};


export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields and their types.
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required and must be text",
      });
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedEmail = email.trim().toLowerCase();

    let user = null;

    if (isBetterAuthConfigured()) {
      try {
        const auth = await getAuth();
        const signIn = await auth.api.signInEmail({
          body: { email: normalizedEmail, password },
        });

        if (signIn?.user?.id && ObjectId.isValid(signIn.user.id)) {
          user = await usersCollection.findOne({
            _id: new ObjectId(signIn.user.id),
          });
        }
      } catch (error) {
        // Fall back to the legacy bcrypt check below. Seeded users have no
        // persistent account document, so their credentials are synthesized
        // from users.password inside the BetterAuth adapter wrapper.
        const detail = error instanceof Error ? error.message : String(error);
        const expectedCredentialFailure = /invalid|not found|unauthorized|password|email/i.test(detail);
        if (!expectedCredentialFailure) {
          console.error("BetterAuth sign-in fallback:", detail);
        }
      }
    }

    if (!user) {
      // Legacy path (also the fallback when BetterAuth is unavailable).
      user = await usersCollection.findOne({
        email: normalizedEmail,
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        user.password || ""
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan || "free",
        image: user.profileImage || "",
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// Get Logged-in User Profile
export const getMyProfile = async (req, res) => {
  try {
    const db = getDB();

    const user = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.userId) },
      {
        projection: {
          password: 0,
        },
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile",
    });
  }
};


 // Update Logged-in User Profile
export const updateMyProfile = async (req, res) => {
  try {
    const { name, phone, location, profileImage, bio } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (location !== undefined) updateData.location = location;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (bio !== undefined) updateData.bio = bio;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update",
      });
    }

    updateData.updatedAt = new Date();

    const db = getDB();

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.userId) },
      {
        projection: {
          password: 0,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};
