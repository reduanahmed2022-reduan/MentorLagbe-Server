import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";
import {
  getAuth,
  isBetterAuthConfigured,
  isGoogleAuthConfigured,
} from "../config/betterAuth.js";
import { CLIENT_URL } from "../config/stripe.js";

const ALLOWED_ROLES = new Set(["student", "tutor"]);
const KNOWN_ROLES = new Set(["student", "tutor", "admin"]);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redirectToClient(res, fragment) {
  const callback = `${String(CLIENT_URL).replace(/\/+$/, "")}/auth/google/callback`;
  const query = new URLSearchParams(fragment).toString();
  return res.redirect(302, `${callback}#${query}`);
}

/** Public availability flag; never exposes any Google key material. */
export const googleAuthStatus = (_req, res) => {
  return res.status(200).json({
    success: true,
    enabled: isGoogleAuthConfigured(),
  });
};

/**
 * Convert the BetterAuth session created by Google into the legacy JWT session
 * contract. Role from sign-up is applied only to brand-new users; existing
 * users (including admins) keep their stored role.
 */
async function normalizeGoogleUser(baUser, requestedRole) {
  const email = String(baUser?.email || "").trim().toLowerCase();

  if (!email) return null;

  const users = getDB().collection("users");
  const baId = String(baUser.id || "");
  const baObjectId = ObjectId.isValid(baId) ? new ObjectId(baId) : null;
  const emailRegex = new RegExp(`^${escapeRegex(email)}$`, "i");

  let existing = await users.findOne({ email: { $regex: emailRegex } });

  if (!existing && baObjectId) {
    existing = await users.findOne({ _id: baObjectId });
  }

  const storedRole = KNOWN_ROLES.has(existing?.role) ? existing.role : null;
  const role = storedRole || (ALLOWED_ROLES.has(requestedRole) ? requestedRole : "student");
  const base = {
    name:
      String(baUser.name || existing?.name || email.split("@")[0]).trim() ||
      "MentorLagbe User",
    email,
    role,
    plan: existing?.plan === "pro" ? "pro" : "free",
    profileImage:
      existing?.profileImage || baUser.image || baUser.profileImage || "",
    updatedAt: new Date(),
  };

  // Older BetterAuth configs stored string `_id`s. Legacy JWT middleware needs
  // a real ObjectId, so migrate that single document before issuing a token.
  if (existing && typeof existing._id === "string") {
    const oldId = existing._id;
    const newId = ObjectId.isValid(oldId) ? new ObjectId(oldId) : new ObjectId();
    const { _id: _oldId, ...doc } = existing;

    try {
      await users.deleteOne({ _id: oldId });
      await users.insertOne({
        ...doc,
        ...base,
        _id: newId,
        createdAt: existing.createdAt || new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        existing = await users.findOne({ email: { $regex: emailRegex } });
        if (existing) {
          return {
            ...base,
            id: existing._id.toString(),
            role: KNOWN_ROLES.has(existing.role) ? existing.role : base.role,
          };
        }
      }
      throw error;
    }

    return { ...base, id: newId.toString() };
  }

  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: base });
    return { ...base, id: existing._id.toString() };
  }

  const newId = baObjectId || new ObjectId();

  try {
    await users.insertOne({
      _id: newId,
      ...base,
      createdAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const raced = await users.findOne({ email: { $regex: emailRegex } });
      if (raced) {
        return {
          ...base,
          id: raced._id.toString(),
          role: KNOWN_ROLES.has(raced.role) ? raced.role : base.role,
        };
      }
    }
    throw error;
  }

  return { ...base, id: newId.toString() };
}

export const googleAuthCallback = async (req, res) => {
  try {
    if (!isBetterAuthConfigured() || !isGoogleAuthConfigured()) {
      return redirectToClient(res, { error: "unavailable" });
    }

    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    const baUser = session?.user;

    if (!baUser?.email) {
      return redirectToClient(res, { error: "session_missing" });
    }

    const requestedRole =
      typeof req.query.role === "string" ? req.query.role.toLowerCase() : "";
    const user = await normalizeGoogleUser(baUser, requestedRole);

    if (!user) {
      return redirectToClient(res, { error: "account_failed" });
    }

    const token = jwt.sign(
      { userId: String(user.id), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const publicUser = {
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      image: user.profileImage || "",
    };

    return redirectToClient(res, {
      token,
      user: JSON.stringify(publicUser),
    });
  } catch (error) {
    console.error("Google auth callback error:", error.message);
    return redirectToClient(res, { error: "unexpected" });
  }
};
