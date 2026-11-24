import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { PRO_PLANS } from "../config/stripe.js";

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

  const userFilter =
    metadata.userId && ObjectId.isValid(metadata.userId)
      ? { _id: new ObjectId(metadata.userId) }
      : { email: metadata.userEmail || session.customer_details?.email };

  const user = await users.findOne(userFilter, {
    projection: { password: 0 },
  });

  if (!user) {
    return { activated: false, reason: "user_not_found" };
  }

  // Validate against the role/plan signed into Stripe metadata at checkout.
  // The user's current role may have changed before the webhook arrives, and a
  // missing signed plan must never silently skip amount validation.
  const signedRole = metadata.userRole || user.role;
  const plan = PRO_PLANS[signedRole];

  if (!plan || (metadata.planName && metadata.planName !== plan.name)) {
    return { activated: false, reason: "invalid_plan" };
  }

  if (
    session.amount_total !== plan.amount ||
    (session.currency || "").toLowerCase() !== plan.currency
  ) {
    return { activated: false, reason: "invalid_amount" };
  }

  const payment = {
    userEmail: user.email,
    userName: user.name,
    userRole: signedRole,
    planName: metadata.planName || plan.name,
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

  const markPro = () =>
    users.updateOne(
      { _id: user._id },
      { $set: { plan: "pro", updatedAt: new Date() } }
    );

  try {
    // The unique index on stripeSessionId makes this claim atomic, so the
    // webhook and the success page can never insert the same payment twice.
    const claim = await payments.updateOne(
      { stripeSessionId: session.id },
      { $setOnInsert: payment },
      { upsert: true }
    );

    if (claim.upsertedCount === 0) {
      // Still heal the user record in case a previous run failed after insert.
      await markPro();

      return { activated: false, reason: "already_recorded", plan: "pro" };
    }
  } catch (error) {
    if (error.code === 11000) {
      await markPro();

      return { activated: false, reason: "already_recorded", plan: "pro" };
    }

    throw error;
  }

  await markPro();

  return { activated: true, plan: "pro", payment };
}
