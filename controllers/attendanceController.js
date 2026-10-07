import Attendance from "../models/Attendance.js";
import Center from "../models/Center.js";
import Member from "../models/Member.js";
import Owner from "../models/Owner.js";
import { notifyEvent } from "../utils/notify.js";

// Local day key YYYY-MM-DD
function dayKey(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// POST /api/attend/:venueId
// Marks today's attendance for the logged-in member at this venue.
export async function markAttendance(req, res) {
  const center = await Center.findById(req.params.venueId);
  if (!center) {
    res.status(404);
    throw new Error("Venue not found");
  }

  // The logged-in user is a member if their phone matches a member of this venue.
  const member = await Member.findOne({ center: center._id, phone: req.owner.phone });
  if (!member) {
    res.status(403);
    throw new Error("You are not a member of this venue");
  }

  const today = dayKey();
  const existing = await Attendance.findOne({ member: member._id, day: today });
  if (existing) {
    return res.json({
      alreadyMarked: true,
      venue: center.name,
      memberName: member.name,
      checkInAt: existing.checkInAt,
      day: today,
    });
  }

  const record = await Attendance.create({
    center: center._id,
    member: member._id,
    phone: member.phone,
    day: today,
    checkInAt: new Date(),
  });

  // Notify the member (confirmation) and the venue owner (someone checked in).
  const timeStr = record.checkInAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  notifyEvent({
    recipientPhone: member.phone,
    role: "member",
    type: "checkin_self",
    title: "Checked in",
    message: `You checked in at ${center.name} at ${timeStr}.`,
    meta: { venue: center.name },
  });
  Owner.findById(center.owner)
    .select("phone")
    .then((owner) => {
      if (owner?.phone) {
        notifyEvent({
          recipientPhone: owner.phone,
          role: "owner",
          type: "checkin",
          title: "Member checked in",
          message: `${member.name} checked in at ${center.name} at ${timeStr}.`,
          meta: { venue: center.name, memberName: member.name },
        });
      }
    })
    .catch((e) => console.error("Owner check-in notify failed:", e.message));

  res.status(201).json({
    alreadyMarked: false,
    venue: center.name,
    memberName: member.name,
    checkInAt: record.checkInAt,
    day: today,
  });
}

// GET /api/my/attendance/:memberId
// Returns the attendance days for one of the logged-in user's memberships.
export async function myAttendance(req, res) {
  const member = await Member.findOne({
    _id: req.params.memberId,
    phone: req.owner.phone,
  });
  if (!member) {
    res.status(404);
    throw new Error("Membership not found");
  }

  const records = await Attendance.find({ member: member._id }).select("day checkInAt");
  const days = records.map((r) => r.day);

  res.json({
    days, // ["YYYY-MM-DD", ...]
    joinDate: member.joinDate,
    expiryDate: member.expiryDate,
  });
}

// GET /api/centers/:id/attendance?day=YYYY-MM-DD
// Owner view: who attended this venue on a given day (default today),
// plus a count summary for the last 14 days.
export async function getCenterAttendance(req, res) {
  // Scope to a venue the logged-in owner actually owns.
  const center = await Center.findOne({ _id: req.params.id, owner: req.owner._id });
  if (!center) {
    res.status(404);
    throw new Error("Venue not found");
  }

  const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.day || "") ? req.query.day : dayKey();

  // Attendees for the chosen day, newest check-in first.
  const records = await Attendance.find({ center: center._id, day })
    .sort({ checkInAt: -1 })
    .populate("member", "name phone");

  const attendees = records.map((r) => ({
    memberId: r.member?._id,
    name: r.member?.name || "Unknown member",
    phone: r.member?.phone || r.phone,
    checkInAt: r.checkInAt,
  }));

  // Per-day counts for the last 14 days (for a quick overview).
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const startKey = dayKey(start);
  const recent = await Attendance.find({
    center: center._id,
    day: { $gte: startKey },
  }).select("day");

  const countsByDay = {};
  for (const r of recent) {
    countsByDay[r.day] = (countsByDay[r.day] || 0) + 1;
  }
  const recentDays = Object.keys(countsByDay)
    .sort()
    .reverse()
    .map((d) => ({ day: d, count: countsByDay[d] }));

  res.json({
    venue: center.name,
    day,
    count: attendees.length,
    attendees,
    recentDays,
  });
}
