import Center from "../models/Center.js";
import Member from "../models/Member.js";
import { withStatus } from "../utils/status.js";
import { consumeOtp } from "../utils/otp.js";
import { notifyEvent } from "../utils/notify.js";

/**
 * Parse a yyyy-mm-dd string as IST midnight (UTC+5:30).
 * Storing as IST midnight means the frontend's toLocaleDateString("en-GB")
 * will always render the correct date regardless of server timezone.
 *
 * e.g. "2026-10-16" → 2026-10-15T18:30:00.000Z (= midnight IST Oct 16)
 */
function parseLocalDate(dateStr) {
  const s = String(dateStr).slice(0, 10); // yyyy-mm-dd
  // IST is UTC+5:30, so midnight IST = UTC prev-day 18:30
  const d = new Date(`${s}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date: " + dateStr);
  return d;
}

async function ensureOwnedCenter(centerId, ownerId, res) {
  const center = await Center.findOne({ _id: centerId, owner: ownerId });
  if (!center) {
    res.status(404);
    throw new Error("Center not found");
  }
  return center;
}

// Strip any status suffixes that may have been accidentally included in a name
// e.g. "Suresh (Expiring)" → "Suresh"
function cleanName(name) {
  return name.replace(/\s*\((expiring|expired|active)\)\s*$/i, "").trim();
}

// POST /api/centers/:centerId/members
export async function createMember(req, res) {
  const center = await ensureOwnedCenter(req.params.centerId, req.owner._id, res);
  const { name: rawName, phone, planDays, startDate, memberType: rawMemberType } = req.body;
  const name = rawName ? cleanName(rawName) : rawName;

  if (!name || !phone) {
    res.status(400);
    throw new Error("name and phone are required");
  }

  const memberType = rawMemberType === "pt" ? "pt" : "regular";
  const planArray = memberType === "pt" ? (center.ptPlans || []) : (center.plans || []);

  const days = Number(planDays);
  const allowed = planArray.map((p) => p.days);
  if (!allowed.includes(days)) {
    res.status(400);
    throw new Error("Please select a valid plan for this centre");
  }

  // Membership starts on the chosen start date (default today) and expires
  // after the plan duration.
  let joinDate;
  if (startDate) {
    try { joinDate = parseLocalDate(startDate); } catch {
      res.status(400); throw new Error("Invalid start date");
    }
  } else {
    joinDate = new Date();
  }
  const expiryDate = new Date(joinDate);
  expiryDate.setDate(expiryDate.getDate() + days);

  const member = await Member.create({
    center: center._id,
    owner: req.owner._id,
    name,
    phone,
    joinDate,
    expiryDate,
    planDays: days,
    memberType,
  }).catch((err) => {
    // Mongo duplicate key on {center, phone, memberType}
    if (err.code === 11000) {
      const label = memberType === "pt" ? "PT membership" : "regular membership";
      res.status(409);
      throw new Error(
        `This phone number already has a ${label} at this centre`
      );
    }
    throw err;
  });

  const memberTypeLabel = memberType === "pt" ? "PT membership" : "membership";

  // Owner activity + member welcome notifications.
  notifyEvent({
    recipientPhone: req.owner.phone,
    role: "owner",
    type: "member_added",
    title: "New member added",
    message: `${member.name} joined ${center.name} on a ${days}-day ${memberTypeLabel}.`,
    meta: { venue: center.name, memberName: member.name },
  });
  notifyEvent({
    recipientPhone: member.phone,
    role: "member",
    type: "welcome",
    title: `Welcome to ${center.name}`,
    message: `Your ${days}-day ${memberTypeLabel} is active. Expires ${expiryDate.toLocaleDateString(
      "en-IN"
    )}.`,
    meta: { venue: center.name },
  });

  res.status(201).json({ member: withStatus(member) });
}

// PUT /api/members/:id
export async function updateMember(req, res) {
  const member = await Member.findOne({ _id: req.params.id, owner: req.owner._id });
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  const { name, phone, planDays, startDate, otp } = req.body;
  const prevPlan = member.planDays;
  const prevName = member.name;
  const prevPhone = member.phone;
  const prevJoin = new Date(member.joinDate).getTime();

  // Changing the plan requires OTP verification.
  const planChanging = planDays !== undefined && Number(planDays) !== prevPlan;
  if (planChanging) {
    await consumeOtp(req.owner.phone, otp);
  }

  if (name !== undefined) member.name = cleanName(name);
  if (phone !== undefined) member.phone = phone;

  // Update the start date if provided.
  if (startDate !== undefined) {
    let d;
    try { d = parseLocalDate(startDate); } catch {
      res.status(400); throw new Error("Invalid start date");
    }
    member.joinDate = d;
  }

  // Recompute expiry from the (possibly new) join date + plan days.
  let centerDoc = null;
  const effectivePlan = planDays !== undefined ? Number(planDays) : member.planDays;
  if (planDays !== undefined) {
    centerDoc = await Center.findById(member.center);
    const effectiveMemberType = req.body.memberType !== undefined
      ? (req.body.memberType === "pt" ? "pt" : "regular")
      : (member.memberType || "regular");
    const planArray = effectiveMemberType === "pt" ? (centerDoc?.ptPlans || []) : (centerDoc?.plans || []);
    const allowed = planArray.map((p) => p.days);
    if (!allowed.includes(Number(planDays))) {
      res.status(400);
      throw new Error("Please select a valid plan for this centre");
    }
    member.planDays = Number(planDays);
  }
  if (req.body.memberType !== undefined) {
    member.memberType = req.body.memberType === "pt" ? "pt" : "regular";
  }
  if (effectivePlan) {
    const expiry = new Date(member.joinDate);
    expiry.setDate(expiry.getDate() + effectivePlan);
    member.expiryDate = expiry;
  }

  await member.save();

  // If the plan changed, record in-app notifications.
  if (planDays !== undefined && Number(planDays) !== prevPlan) {
    if (!centerDoc) centerDoc = await Center.findById(member.center);
    const venueName = centerDoc?.name || "your venue";
    notifyEvent({
      recipientPhone: req.owner.phone,
      role: "owner",
      type: "plan_changed",
      title: "Plan changed",
      message: `${member.name}'s plan at ${venueName} changed to ${member.planDays} days.`,
      meta: { venue: venueName, memberName: member.name },
    });
    notifyEvent({
      recipientPhone: member.phone,
      role: "member",
      type: "plan_changed",
      title: "Your plan changed",
      message: `Your ${venueName} plan is now ${member.planDays} days. Expires ${new Date(
        member.expiryDate
      ).toLocaleDateString("en-IN")}.`,
      meta: { venue: venueName },
    });
  } else {
    // No plan change, but the owner may have edited name / phone / start date.
    const nameChanged = name !== undefined && name !== prevName;
    const phoneChanged = phone !== undefined && phone !== prevPhone;
    const joinChanged =
      startDate !== undefined && new Date(member.joinDate).getTime() !== prevJoin;

    if (nameChanged || phoneChanged || joinChanged) {
      if (!centerDoc) centerDoc = await Center.findById(member.center);
      const venueName = centerDoc?.name || "your venue";

      // Build a short description of what changed.
      const parts = [];
      if (nameChanged) parts.push("name");
      if (phoneChanged) parts.push("phone");
      if (joinChanged) parts.push("start date");
      const changed = parts.join(", ");

      notifyEvent({
        recipientPhone: req.owner.phone,
        role: "owner",
        type: "member_updated",
        title: "Member details updated",
        message: `You updated ${member.name}'s ${changed} at ${venueName}.`,
        meta: { venue: venueName, memberName: member.name },
      });

      // Notify the member on their (possibly new) phone number.
      notifyEvent({
        recipientPhone: member.phone,
        role: "member",
        type: "member_updated",
        title: "Your details were updated",
        message: `Your membership details at ${venueName} were updated (${changed}).`,
        meta: { venue: venueName },
      });

      // If the phone number itself changed, also tell the OLD number so that
      // person knows their membership was reassigned.
      if (phoneChanged && prevPhone && prevPhone !== member.phone) {
        notifyEvent({
          recipientPhone: prevPhone,
          role: "member",
          type: "member_updated",
          title: "Your details were updated",
          message: `Your ${venueName} membership contact number was changed.`,
          meta: { venue: venueName },
        });
      }
    }
  }

  res.json({ member: withStatus(member) });
}

// POST /api/members/:id/renew  -> extend expiry by a plan's days
export async function renewMember(req, res) {
  const member = await Member.findOne({ _id: req.params.id, owner: req.owner._id });
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  const days = Number(req.body.planDays);
  const center = await Center.findById(member.center);
  const planArray = (member.memberType || "regular") === "pt"
    ? (center?.ptPlans || [])
    : (center?.plans || []);
  const allowed = planArray.map((p) => p.days);
  if (!allowed.includes(days)) {
    res.status(400);
    throw new Error("Please select a valid plan for this centre");
  }

  // Always continue from the current expiry date, whether the member is active
  // or expired. This means:
  //   - Active: new plan stacks on top (no days lost)
  //   - Expired: new plan starts from when the old one ended (continuous history)
  //   - Expired + break: owner passes a custom startDate (member took a break)
  let renewalStart;
  if (req.body.startDate) {
    // Owner explicitly chose a new start date (break scenario).
    // Parse as IST midnight so the date matches what the owner selected.
    try { renewalStart = parseLocalDate(req.body.startDate); } catch {
      res.status(400);
      throw new Error("Invalid start date");
    }
  } else {
    // No break — continue from the stored expiry date
    renewalStart = new Date(member.expiryDate);
  }

  const newExpiry = new Date(renewalStart);
  newExpiry.setDate(newExpiry.getDate() + days);

  member.joinDate   = renewalStart;
  member.expiryDate = newExpiry;
  member.planDays   = days;

  await member.save();

  const venueName = center?.name || "your venue";
  notifyEvent({
    recipientPhone: req.owner.phone,
    role: "owner",
    type: "renewed",
    title: "Membership renewed",
    message: `${member.name}'s ${venueName} membership extended by ${days} days.`,
    meta: { venue: venueName, memberName: member.name },
  });
  notifyEvent({
    recipientPhone: member.phone,
    role: "member",
    type: "renewed",
    title: "Membership renewed",
    message: `Your ${venueName} membership was extended by ${days} days. New expiry ${new Date(
      member.expiryDate
    ).toLocaleDateString("en-IN")}.`,
    meta: { venue: venueName },
  });

  res.json({ member: withStatus(member) });
}

// DELETE /api/members/:id  (OTP-verified)
export async function deleteMember(req, res) {
  const member = await Member.findOne({ _id: req.params.id, owner: req.owner._id });
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Require a valid OTP (sent to the owner's phone) before deleting.
  await consumeOtp(req.owner.phone, req.body.otp);

  await member.deleteOne();
  res.json({ message: "Member deleted" });
}
