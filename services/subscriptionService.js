import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { PRO_PLANS } from "../config/stripe.js";

/**
 * Records a paid Stripe session in `payments` and upgrades the matching user
 * to the Pro plan. Safe to call more than once for the same session (webhook
 * plus the success-page verification both call it).
 */
export async function activateSubscription(session) {
  // A subscription checkout is either paid or needs no payment (e.g. trial).
  if (!["paid", "no_payment_required"].includes(session.payment_status)) {
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

  const paidAmount = session.amount_total ?? plan.amount;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || "";

  if (
    paidAmount !== plan.amount ||
    (session.currency || "").toLowerCase() !== plan.currency
  ) {
    return { activated: false, reason: "invalid_amount" };
  }

  const payment = {
    userEmail: user.email,
    userName: user.name,
    userRole: signedRole,
    planName: metadata.planName || plan.name,
    amount: paidAmount / 100,
    currency: (session.currency || "usd").toUpperCase(),
    transactionId:
      subscriptionId ||
      (typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id),
    stripeSessionId: session.id,
    stripeSubscriptionId: subscriptionId,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  const markPro = () =>
    users.updateOne(
      { _id: user._id },
      {
        $set: {
          plan: "pro",
          stripeSubscriptionId: subscriptionId || user.stripeSubscriptionId || "",
          updatedAt: new Date(),
        },
      }
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

/**
 * Record a renewal invoice (`invoice.paid`) in the same payments collection.
 * Invoice IDs are unique, so renewals are idempotent like checkout sessions.
 */
export async function recordRenewalPayment(invoice) {
  if (invoice.paid !== true) {
    return { recorded: false, reason: "invoice_not_paid" };
  }

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id || "";

  if (!subscriptionId) {
    return { recorded: false, reason: "subscription_not_found" };
  }

  const db = getDB();
  const users = db.collection("users");
  const payments = db.collection("payments");

  const user = await users.findOne({ stripeSubscriptionId: subscriptionId }, {
    projection: { password: 0 },
  });

  if (!user) {
    return { recorded: false, reason: "user_not_found" };
  }

  const plan = PRO_PLANS[user.role];
  if (!plan) {
    return { recorded: false, reason: "invalid_plan" };
  }

  const payment = {
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    planName: plan.name,
    amount: (invoice.amount_paid || 0) / 100,
    currency: (invoice.currency || "usd").toUpperCase(),
    transactionId:
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id || invoice.id,
    stripeSessionId: invoice.id,
    stripeSubscriptionId: subscriptionId,
    paymentStatus: "paid",
    paidAt: new Date((invoice.created || Date.now() / 1000) * 1000),
  };

  const claim = await payments.updateOne(
    { stripeSessionId: invoice.id },
    { $setOnInsert: payment },
    { upsert: true }
  );

  if (claim.upsertedCount === 0) {
    return { recorded: false, reason: "already_recorded" };
  }

  return { recorded: true, payment };
}

/** Return the user to the Free plan when a Stripe subscription is canceled. */
export async function deactivateSubscription(subscription) {
  const subscriptionId = subscription?.id;
  if (!subscriptionId) {
    return { deactivated: false, reason: "subscription_not_found" };
  }

  const db = getDB();
  const users = db.collection("users");
  const user = await users.findOne({ stripeSubscriptionId: subscriptionId });

  if (!user) {
    return { deactivated: false, reason: "user_not_found" };
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: { plan: "free", updatedAt: new Date() },
      $unset: { stripeSubscriptionId: "" },
    }
  );

  return { deactivated: true };
}
