import Center from "../models/Center.js";
import Member from "../models/Member.js";
import { summarize, withStatus } from "../utils/status.js";
import { consumeOtp } from "../utils/otp.js";
import { notifyEvent } from "../utils/notify.js";

// GET /api/centers  -> all centers for owner, each with member summary
export async function listCenters(req, res) {
  const centers = await Center.find({ owner: req.owner._id }).sort({ createdAt: -1 });

  const result = await Promise.all(
    centers.map(async (center) => {
      const members = await Member.find({ center: center._id }).select("expiryDate");
      return { ...center.toJSON(), summary: summarize(members) };
    })
  );

  res.json({ centers: result });
}

// POST /api/centers
export async function createCenter(req, res) {
  const { name, type, address, pincode, location, capacity } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Center name is required");
  }
  if (pincode && !/^[0-9]{6}$/.test(pincode)) {
    res.status(400);
    throw new Error("Pincode must be a valid 6-digit number");
  }
  const center = await Center.create({
    owner: req.owner._id,
    name,
    type,
    address,
    pincode,
    location,
    capacity,
  });

  notifyEvent({
    recipientPhone: req.owner.phone,
    role: "owner",
    type: "venue_created",
    title: "Venue created",
    message: `You added a new venue: ${center.name}${center.type ? ` (${center.type})` : ""}.`,
    meta: { venue: center.name },
  });

  res.status(201).json({ center });
}

async function findOwnedCenter(centerId, ownerId) {
  const center = await Center.findOne({ _id: centerId, owner: ownerId });
  return center;
}

// GET /api/centers/:id  -> center + members (with status) + summary
export async function getCenter(req, res) {
  const center = await findOwnedCenter(req.params.id, req.owner._id);
  if (!center) {
    res.status(404);
    throw new Error("Center not found");
  }

  const members = await Member.find({ center: center._id }).sort({ expiryDate: 1 });
  const now = new Date();

  res.json({
    center: center.toJSON(),
    members: members.map((m) => withStatus(m, now)),
    summary: summarize(members, now),
  });
}

// PUT /api/centers/:id
export async function updateCenter(req, res) {
  const center = await findOwnedCenter(req.params.id, req.owner._id);
  if (!center) {
    res.status(404);
    throw new Error("Center not found");
  }
  const { name, type, address, pincode, location, capacity } = req.body;
  if (pincode !== undefined && pincode && !/^[0-9]{6}$/.test(pincode)) {
    res.status(400);
    throw new Error("Pincode must be a valid 6-digit number");
  }
  if (name !== undefined) center.name = name;
  if (type !== undefined) center.type = type;
  if (address !== undefined) center.address = address;
  if (pincode !== undefined) center.pincode = pincode;
  if (location !== undefined) center.location = location;
  if (capacity !== undefined) center.capacity = capacity;
  await center.save();
  res.json({ center });
}

// PUT /api/centers/:id/plans  -> replace the centre's custom plans (OTP-verified)
export async function updatePlans(req, res) {
  const center = await findOwnedCenter(req.params.id, req.owner._id);
  if (!center) {
    res.status(404);
    throw new Error("Center not found");
  }

  // Require a valid OTP (sent to the owner's phone) before saving.
  await consumeOtp(req.owner.phone, req.body.otp);

  const incoming = Array.isArray(req.body.plans) ? req.body.plans : [];
  const cleaned = [];
  const seenDays = new Set();

  for (const p of incoming) {
    const days = Number(p.days);
    const price = Number(p.price);
    if (!Number.isInteger(days) || days < 1) {
      res.status(400);
      throw new Error("Each plan needs a valid number of days (1 or more)");
    }
    if (Number.isNaN(price) || price < 0) {
      res.status(400);
      throw new Error("Each plan needs a valid price (0 or more)");
    }
    if (seenDays.has(days)) {
      res.status(400);
      throw new Error(`Duplicate plan: ${days} days appears more than once`);
    }
    seenDays.add(days);
    cleaned.push({ days, price });
  }

  if (cleaned.length === 0) {
    res.status(400);
    throw new Error("Add at least one plan");
  }

  cleaned.sort((a, b) => a.days - b.days);
  center.plans = cleaned;
  await center.save();
  res.json({ center: center.toJSON() });
}

// PUT /api/centers/:id/upi  -> set the venue's UPI ID (OTP-verified).
// Sends a confirmation SMS to the owner.
export async function updateUpi(req, res) {
  const center = await findOwnedCenter(req.params.id, req.owner._id);
  if (!center) {
    res.status(404);
    throw new Error("Center not found");
  }

  const { upiId, otp } = req.body;
  if (!upiId || !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim())) {
    res.status(400);
    throw new Error("Please enter a valid UPI ID (e.g. name@okbank)");
  }

  // Require a valid OTP (sent to the owner's phone).
  await consumeOtp(req.owner.phone, otp);

  center.upiId = upiId.trim();
  await center.save();

  notifyEvent({
    recipientPhone: req.owner.phone,
    role: "owner",
    type: "upi_set",
    title: "UPI ID updated",
    message: `Payment UPI for ${center.name} set to ${center.upiId}.`,
    meta: { venue: center.name },
  });

  res.json({ center: center.toJSON() });
}

// DELETE /api/centers/:id  -> also removes its members
export async function deleteCenter(req, res) {
  const center = await findOwnedCenter(req.params.id, req.owner._id);
  if (!center) {
    res.status(404);
    throw new Error("Center not found");
  }
  await Member.deleteMany({ center: center._id });
  await center.deleteOne();
  res.json({ message: "Center deleted" });
}
