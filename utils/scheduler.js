/**
 * scheduler.js
 *
 * Runs a membership-expiry notification job every 5 hours.
 * Uses only Node's built-in setInterval — no extra packages needed.
 *
 * For each member whose membership is expiring or expired:
 *   - Notifies the MEMBER on their phone number
 *   - Notifies the OWNER of that centre
 *
 * De-duplication: a notification is only created if one with the same
 * recipientPhone + type + meta.memberId hasn't been sent in the last 5 hours.
 * This prevents spam across multiple server restarts / interval fires.
 *
 * Cleanup: stored notifications older than 24 hours are automatically deleted
 * each time the job runs.
 */

import Member from "../models/Member.js";
import Center from "../models/Center.js";
import Notification from "../models/Notification.js";

const DAY_MS  = 24 * 60 * 60 * 1000;
const HOUR_MS =       60 * 60 * 1000;

// How long before expiry we start alerting (matches EXPIRING_SOON_DAYS in status.js)
const EXPIRING_SOON_DAYS = Number(process.env.EXPIRING_SOON_DAYS || 7);

// Don't re-send the same alert within this window (matches the job interval)
const DEDUP_HOURS = 5;

// Keep notifications for this long; older ones are auto-deleted
const RETENTION_HOURS = 24;

/** Returns true if a similar notification was already sent recently. */
async function alreadySent(recipientPhone, role, type, memberId) {
  const since = new Date(Date.now() - DEDUP_HOURS * HOUR_MS);
  const exists = await Notification.findOne({
    recipientPhone,
    role,
    type,
    "meta.memberId": String(memberId),
    createdAt: { $gte: since },
  }).select("_id").lean();
  return !!exists;
}

/** Create a notification only if not recently sent. */
async function maybeNotify({ recipientPhone, role, type, title, message, meta }) {
  if (await alreadySent(recipientPhone, role, type, meta.memberId)) return;
  await Notification.create({ recipientPhone, role, type, title, message, meta });
}

/** Delete stored notifications older than RETENTION_HOURS. */
async function cleanupOldNotifications() {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * HOUR_MS);
  const result = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
  if (result.deletedCount > 0) {
    console.log(`[scheduler] Cleaned up ${result.deletedCount} notifications older than ${RETENTION_HOURS}h.`);
  }
}

/** Core job — scans all members and emits expiry notifications. */
export async function runExpiryNotifications() {
  try {
    const now = new Date();

    // Fetch all members whose expiry is within EXPIRING_SOON_DAYS ahead
    // or up to 7 days in the past
    const windowStart = new Date(now.getTime() - 7 * DAY_MS);
    const windowEnd   = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS);

    const members = await Member.find({
      expiryDate: { $gte: windowStart, $lte: windowEnd },
    }).lean();

    if (members.length === 0) return;

    // Bulk-fetch centers
    const centerIds = [...new Set(members.map((m) => String(m.center)))];
    const centers   = await Center.find({ _id: { $in: centerIds } }).select("name owner").lean();
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c]));

    // Bulk-fetch owner phones (Owner model has phone)
    // We need the owner's phone — it's on the Owner document.
    // Import Owner inline to avoid circular deps at module load time.
    const { default: Owner } = await import("../models/Owner.js");
    const ownerIds  = [...new Set(centers.map((c) => String(c.owner)))];
    const owners    = await Owner.find({ _id: { $in: ownerIds } }).select("phone").lean();
    const ownerPhoneMap = Object.fromEntries(owners.map((o) => [String(o._id), o.phone]));

    const promises = [];

    for (const m of members) {
      const center     = centerMap[String(m.center)];
      if (!center) continue;
      const venueName  = center.name || "your venue";
      const ownerPhone = ownerPhoneMap[String(center.owner)];

      const daysLeft = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / DAY_MS);
      const isExpired  = daysLeft < 0;
      const isExpiring = !isExpired && daysLeft <= EXPIRING_SOON_DAYS;

      const meta = { memberId: String(m._id), venue: venueName, memberName: m.name };

      if (isExpiring) {
        const dayWord = daysLeft === 1 ? "tomorrow"
                      : daysLeft === 0 ? "today"
                      : `in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;

        // Notify member
        promises.push(maybeNotify({
          recipientPhone: m.phone,
          role:  "member",
          type:  "expiring",
          title: daysLeft <= 2 ? `⚠️ Membership expiring ${dayWord}` : "Membership expiring soon",
          message: `Your ${venueName} membership expires ${dayWord}. Renew to continue.`,
          meta,
        }));

        // Notify owner
        if (ownerPhone) {
          promises.push(maybeNotify({
            recipientPhone: ownerPhone,
            role:  "owner",
            type:  "expiring",
            title: daysLeft <= 2 ? `⚠️ ${m.name} expiring ${dayWord}` : `${m.name} expiring soon`,
            message: `${m.name}'s membership at ${venueName} expires ${dayWord}.`,
            meta,
          }));
        }

      } else if (isExpired) {
        const daysAgo = Math.abs(daysLeft);
        const agoWord = daysAgo === 0 ? "today"
                      : daysAgo === 1 ? "yesterday"
                      : `${daysAgo} days ago`;

        // Notify member
        promises.push(maybeNotify({
          recipientPhone: m.phone,
          role:  "member",
          type:  "expired",
          title: "Membership expired",
          message: `Your ${venueName} membership expired ${agoWord}. Renew to regain access.`,
          meta,
        }));

        // Notify owner
        if (ownerPhone) {
          promises.push(maybeNotify({
            recipientPhone: ownerPhone,
            role:  "owner",
            type:  "expired",
            title: `${m.name} membership expired`,
            message: `${m.name}'s membership at ${venueName} expired ${agoWord}.`,
            meta,
          }));
        }
      }
    }

    await Promise.allSettled(promises);
    console.log(`[scheduler] Expiry notifications processed for ${members.length} members.`);

    // Remove notifications older than 24 hours
    await cleanupOldNotifications();
  } catch (err) {
    console.error("[scheduler] Error in runExpiryNotifications:", err.message);
  }
}

/**
 * Start the recurring scheduler.
 * @param {number} intervalHours - How often to run (default 5 hours)
 */
export function startScheduler(intervalHours = 5) {
  const ms = intervalHours * HOUR_MS;

  // Run once immediately on startup (catches anything missed since last restart)
  runExpiryNotifications();

  // Then repeat every intervalHours
  setInterval(runExpiryNotifications, ms);

  console.log(`[scheduler] Expiry notification job started — runs every ${intervalHours}h.`);
}
