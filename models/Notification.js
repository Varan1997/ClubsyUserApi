import mongoose from "mongoose";

// A single activity/notification entry, delivered to a phone number in a role.
// The same person can be both an "owner" (their venues) and a "member"
// (memberships tied to their phone), so notifications are keyed by phone + role.
const notificationSchema = new mongoose.Schema(
  {
    recipientPhone: { type: String, required: true, index: true },
    role: { type: String, enum: ["owner", "member"], required: true, index: true },
    // e.g. "member_added", "plan_changed", "renewed", "venue_created",
    // "upi_set", "checkin", "checkin_self"
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    read: { type: Boolean, default: false },
    // Free-form context (venue name, member name, etc.) for future linking.
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

// Fast lookup of a person's feed, newest first.
notificationSchema.index({ recipientPhone: 1, role: 1, createdAt: -1 });

notificationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model("Notification", notificationSchema);
