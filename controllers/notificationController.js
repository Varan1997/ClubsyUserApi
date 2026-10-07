import Notification from "../models/Notification.js";
import Member from "../models/Member.js";
import Center from "../models/Center.js";
import { computeStatus } from "../utils/status.js";

function wantRole(req) {
  return req.query.role === "member" ? "member" : "owner";
}

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
    const dayMs = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / dayMs);

    if (status === "expired") {
      out.push({
        _id: `exp-${m._id}`,
        virtual: true,
        role: "member",
        type: "expired",
        title: `Membership expired`,
        message: `Your ${venueName} membership expired ${Math.abs(daysLeft)} day${
          Math.abs(daysLeft) === 1 ? "" : "s"
        } ago. Renew to continue.`,
        read: false,
        createdAt: m.expiryDate,
        meta: { venue: venueName, memberId: m._id },
      });
    } else {
      out.push({
        _id: `expiring-${m._id}`,
        virtual: true,
        role: "member",
        type: "expiring",
        title: `Membership expiring soon`,
        message: `Your ${venueName} membership expires in ${daysLeft} day${
          daysLeft === 1 ? "" : "s"
        }.`,
        read: false,
        createdAt: now,
        meta: { venue: venueName, memberId: m._id },
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
    unread += virtual.length; // virtual items are always "unread"
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
