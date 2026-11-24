import { ObjectId } from "mongodb";
import { CLIENT_URL, PRO_PLANS, stripe } from "../config/stripe.js";
import { getDB } from "../config/db.js";
import {
  activateSubscription,
  deactivateSubscription,
  recordRenewalPayment,
} from "../services/subscriptionService.js";

const stripeUnavailable = (res) =>
  res.status(503).json({
    success: false,
    message: "Stripe is not configured. Please set STRIPE_SECRET_KEY.",
  });

// Create a Stripe Checkout session for the logged-in Tutor or Student.
export const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return stripeUnavailable(res);
    }

    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user information",
      });
    }

    const user = await getDB()
      .collection("users")
      .findOne(
        { _id: new ObjectId(req.user.userId) },
        { projection: { password: 0 } }
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = PRO_PLANS[user.role];

    if (!plan) {
      return res.status(403).json({
        success: false,
        message: "Only tutors and students can purchase the Pro plan",
      });
    }

    if (user.plan === "pro") {
      return res.status(400).json({
        success: false,
        message: "Your Pro plan is already active",
      });
    }

    const subscriptionMetadata = {
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      planName: plan.name,
    };

    const session = await stripe.checkout.sessions.create({
      // Real recurring subscription (not a one-time payment).
      mode: "subscription",
      customer_email: user.email,
      client_reference_id: user._id.toString(),
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            unit_amount: plan.amount,
            recurring: { interval: plan.interval || "month" },
            product_data: {
              name: plan.name,
              description: "MentorLagbe Pro Plan — monthly subscription",
            },
          },
          quantity: 1,
        },
      ],
      metadata: subscriptionMetadata,
      subscription_data: { metadata: subscriptionMetadata },
      success_url: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/payment/cancel`,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Create Checkout Session Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create Stripe checkout session",
    });
  }
};

// Verify a session after the browser returns from Stripe Checkout.
export const verifyCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return stripeUnavailable(res);
    }

    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        success: false,
        message: "sessionId is required",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "This payment does not belong to you",
      });
    }

    const result = await activateSubscription(session);

    if (result.reason === "user_not_found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: result.activated || result.reason === "already_recorded",
      plan: result.plan || "free",
      message:
        result.reason === "payment_not_paid"
          ? "Payment is not completed yet"
          : result.reason === "invalid_amount"
            ? "Payment amount did not match the selected plan"
            : result.reason === "invalid_plan"
              ? "Plan could not be verified"
              : result.activated || result.reason === "already_recorded"
                ? "Your Pro plan is active"
                : "We could not activate your Pro plan",
    });
  } catch (error) {
    console.error("Verify Checkout Session Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
    });
  }
};

// Stripe webhook: raw body is parsed by the dedicated route in index.js.
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({
      success: false,
      message: "Stripe webhook is not configured",
    });
  }

  if (!signature) {
    return res.status(400).json({
      success: false,
      message: "Missing Stripe signature",
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe Webhook Signature Error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Invalid webhook signature",
    });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    try {
      const result = await activateSubscription(event.data.object);
      console.log("Stripe subscription sync:", result);
    } catch (error) {
      console.error("Stripe Webhook Sync Error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to sync payment",
      });
    }
  }

  // Monthly renewals arrive as invoice.paid events (not checkout sessions).
  if (event.type === "invoice.paid") {
    try {
      const result = await recordRenewalPayment(event.data.object);
      console.log("Stripe renewal sync:", result);
    } catch (error) {
      console.error("Stripe Renewal Sync Error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to record renewal payment",
      });
    }
  }

  // A canceled subscription returns the account to the Free plan.
  if (event.type === "customer.subscription.deleted") {
    try {
      const result = await deactivateSubscription(event.data.object);
      console.log("Stripe subscription cancellation:", result);
    } catch (error) {
      console.error("Stripe Cancellation Sync Error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to sync subscription cancellation",
      });
    }
  }

  return res.status(200).json({ received: true });
};
