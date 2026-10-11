/**
 * PushSubscription.js
 *
 * Stores Web Push subscription objects per user (owner or member).
 * A single user can have multiple subscriptions (different browsers/devices).
 *
 * The `subscription` field is the raw PushSubscription JSON from the browser:
 * { endpoint, expirationTime, keys: { p256dh, auth } }
 */
import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    // Phone number links subscription to an owner or member
    phone: { type: String, required: true, index: true },

    // "owner" or "member"
    role: { type: String, enum: ["owner", "member"], required: true },

    // The full Web Push subscription object from the browser
    subscription: {
      endpoint: { type: String, required: true },
      expirationTime: { type: Number, default: null },
      keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true },
      },
    },
  },
  { timestamps: true }
);

// One endpoint per user — prevent duplicates
pushSubscriptionSchema.index(
  { phone: 1, "subscription.endpoint": 1 },
  { unique: true }
);

export default mongoose.model("PushSubscription", pushSubscriptionSchema);
