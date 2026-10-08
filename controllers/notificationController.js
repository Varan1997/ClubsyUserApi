import Notification from "../models/Notification.js";
import Member from "../models/Member.js";
import Center from "../models/Center.js";
import Owner from "../models/Owner.js";
import { computeStatus } from "../utils/status.js";

function wantRole(req) {
  return req.query.role === "member" ? "member" : "owner";
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Member-role virtual notifications ─────────────────────────────────────
// Build on-the-fly (virtual) notifications for a member's expiring/expired
// memberships. These are not stored — they are computed from current data so
// they always reflect the live state without needing a cron job.
async function computeMemberExpiryNotifs(phone) {
  const members = await Member.find({ phone });
  if (members.length === 0) return [];

  const now = new Date();
  const out = [];
  for (const m of members) {
    const status = computeStatus(m.expiryDate, now);
    if (status === "active") continue;

    const center = await Center.findById(m.center).select("name");
    const venueName = center?.name || "your venue";
    const daysLeft = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / DAY_MS);

    if (status === "expired") {
      const daysAgo = Math.abs(daysLeft);
      out.push({
        _id: `exp-${m._id}`,
        virtual: true,
        role: "member",
        type: "expired",
        title: "Membership expired",
        message:
          daysAgo === 0
            ? `Your ${venueName} membership expired today. Renew to continue.`
            : `Your ${venueName} membership expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago. Renew to continue.`,
        read: false,
        createdAt: m.expiryDate,
        meta: { venue: venueName, memberId: m._id },
      });
    } else {
      // expiring
      out.push({
        _id: `expiring-${m._id}`,
        virtual: true,
        role: "member",
        type: "expiring",
        title: daysLeft <= 2 ? `⚠️ Membership expiring ${daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}` : "Membership expiring soon",
        message:
          daysLeft === 1
            ? `Your ${venueName} membership expires tomorrow! Renew now.`
            : daysLeft === 2
            ? `Your ${venueName} membership expires in 2 days. Time to renew!`
            : `Your ${venueName} membership expires in ${daysLeft} days.`,
        read: false,
        createdAt: now,
        meta: { venue: venueName, memberId: m._id },
      });
    }
  }
  return out;
}

// ── Owner-role virtual notifications ──────────────────────────────────────
// For each of the owner's members compute expiry alerts:
//   • Expiring in exactly 1 day  → urgent alert
//   • Expiring in exactly 2 days → warning alert
//   • Expired exactly 2 days ago → follow-up alert (nudge to renew)
// Only these specific day-windows are surfaced to keep the list focused.
async function computeOwnerExpiryNotifs(ownerId) {
  const now = new Date();
  // Fetch all non-expired (within last 3 days) or expiring-soon members
  const windowStart = new Date(now.getTime() - 3 * DAY_MS); // 3 days ago
  const windowEnd   = new Date(now.getTime() + 3 * DAY_MS); // 3 days ahead

  const members = await Member.find({
    owner: ownerId,
    expiryDate: { $gte: windowStart, $lte: windowEnd },
  });

  if (members.length === 0) return [];

  // Pre-fetch centers in bulk
  const centerIds = [...new Set(members.map((m) => String(m.center)))];
  const centers = await Center.find({ _id: { $in: centerIds } }).select("name");
  const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

  const out = [];

  for (const m of members) {
    const venueName = centerMap[String(m.center)] || "a venue";
    const daysLeft = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / DAY_MS);

    if (daysLeft === 1) {
      // Expiring tomorrow
      out.push({
        _id: `owner-exp1-${m._id}`,
        virtual: true,
        role: "owner",
        type: "expiring",
        title: "⚠️ Expiring tomorrow",
        message: `${m.name} at ${venueName} — membership expires tomorrow. Consider renewing.`,
        read: false,
        createdAt: new Date(now.getTime() - 1000), // just below "now" so it sorts after real-time items
        meta: { venue: venueName, memberName: m.name, memberId: m._id },
      });
    } else if (daysLeft === 2) {
      // Expiring in 2 days
      out.push({
        _id: `owner-exp2-${m._id}`,
        virtual: true,
        role: "owner",
        type: "expiring",
        title: "Expiring in 2 days",
        message: `${m.name} at ${venueName} — membership expires in 2 days.`,
        read: false,
        createdAt: new Date(now.getTime() - 2000),
        meta: { venue: venueName, memberName: m.name, memberId: m._id },
      });
    } else if (daysLeft === -2) {
      // Expired exactly 2 days ago — follow-up nudge
      out.push({
        _id: `owner-expd2-${m._id}`,
        virtual: true,
        role: "owner",
        type: "expired",
        title: "Expired 2 days ago",
        message: `${m.name} at ${venueName} — membership expired 2 days ago. Renew to re-activate.`,
        read: false,
        createdAt: new Date(m.expiryDate),
        meta: { venue: venueName, memberName: m.name, memberId: m._id },
      });
    }
  }

  return out;
}

// GET /api/notifications?role=owner|member
export async function listNotifications(req, res) {
  const role = wantRole(req);
  const phone = req.owner.phone;

  const stored = await Notification.find({ recipientPhone: phone, role })
    .sort({ createdAt: -1 })
    .limit(100);

  let items = stored.map((n) => n.toJSON());

  if (role === "member") {
    const virtual = await computeMemberExpiryNotifs(phone);
    items = [...virtual, ...items].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  } else {
    // owner role — prepend expiry alert virtuals
    const virtual = await computeOwnerExpiryNotifs(req.owner._id);
    items = [...virtual, ...items].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  const unread = items.filter((n) => !n.read).length;
  res.json({ notifications: items, unread });
}

// GET /api/notifications/count?role=owner|member  -> { unread }
export async function unreadCount(req, res) {
  const role = wantRole(req);
  const phone = req.owner.phone;

  let unread = await Notification.countDocuments({
    recipientPhone: phone,
    role,
    read: false,
  });

  if (role === "member") {
    const virtual = await computeMemberExpiryNotifs(phone);
    unread += virtual.length;
  } else {
    const virtual = await computeOwnerExpiryNotifs(req.owner._id);
    unread += virtual.length;
  }

  res.json({ unread });
}

// POST /api/notifications/read  { ids?: [] }  (role in query)
// Marks the given stored notifications read, or all of them when no ids given.
export async function markRead(req, res) {
  const role = wantRole(req);
  const phone = req.owner.phone;
  const ids = Array.isArray(req.body.ids) ? req.body.ids : null;

  const filter = { recipientPhone: phone, role, read: false };
  // Ignore virtual ids (they are not stored and can't be marked read).
  if (ids) filter._id = { $in: ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id)) };

  await Notification.updateMany(filter, { $set: { read: true } });
  res.json({ ok: true });
}

// DELETE /api/notifications/:id  — delete a single stored notification
export async function deleteNotification(req, res) {
  const phone = req.owner.phone;
  const { id } = req.params;

  // Only allow deleting own notifications
  const result = await Notification.deleteOne({ _id: id, recipientPhone: phone });
  if (result.deletedCount === 0) {
    res.status(404);
    throw new Error("Notification not found");
  }
  res.json({ ok: true });
}
