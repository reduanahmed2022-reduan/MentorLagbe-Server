import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

/**
 * Records a paid Stripe session in `payments` and upgrades the matching user
 * to the Pro plan. Safe to call more than once for the same session (webhook
 * plus the success-page verification both call it).
 */
export async function activateSubscription(session) {
  if (session.payment_status !== "paid") {
    return { activated: false, reason: "payment_not_paid" };
  }

  const db = getDB();
  const payments = db.collection("payments");
  const users = db.collection("users");
  const metadata = session.metadata || {};

  const existing = await payments.findOne({ stripeSessionId: session.id });

  if (existing) {
    return { activated: false, reason: "already_recorded", plan: "pro" };
  }

  const userFilter = metadata.userId && ObjectId.isValid(metadata.userId)
    ? { _id: new ObjectId(metadata.userId) }
    : { email: metadata.userEmail || session.customer_details?.email };

  const user = await users.findOne(userFilter, {
    projection: { password: 0 },
  });

  if (!user) {
    return { activated: false, reason: "user_not_found" };
  }

  const payment = {
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    planName: metadata.planName || "Pro Plan",
    amount: (session.amount_total || 0) / 100,
    currency: (session.currency || "usd").toUpperCase(),
    transactionId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id,
    stripeSessionId: session.id,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  await payments.insertOne(payment);

  await users.updateOne(
    { _id: user._id },
    { $set: { plan: "pro", updatedAt: new Date() } }
  );

  return { activated: true, plan: "pro", payment };
}
