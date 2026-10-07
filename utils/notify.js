import Notification from "../models/Notification.js";

// Create an in-app notification. Fire-and-forget: never let a notification
// write break the main request. Callers may await or ignore the promise.
export async function notifyEvent({ recipientPhone, role, type, title, message = "", meta = {} }) {
  if (!recipientPhone || !role || !type || !title) return null;
  try {
    return await Notification.create({
      recipientPhone: String(recipientPhone).trim(),
      role,
      type,
      title,
      message,
      meta,
    });
  } catch (e) {
    console.error("notifyEvent failed:", e.message);
    return null;
  }
}
