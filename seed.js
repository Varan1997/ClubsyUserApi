/**
 * Seed script — adds 20 dummy members to the first center found for the first owner.
 * Distribution: 10 active, 5 expiring soon (within 7 days), 5 expired.
 *
 * Usage: node seed.js [ownerPhone]
 */

import "dotenv/config";
import mongoose from "mongoose";
import Owner from "./models/Owner.js";
import Center from "./models/Center.js";
import Member from "./models/Member.js";

const NAMES = [
  "Aarav Sharma",   "Priya Patel",    "Rohan Mehta",    "Sneha Iyer",     "Karan Verma",
  "Ananya Nair",    "Vikram Singh",   "Deepika Reddy",  "Amit Kumar",     "Pooja Gupta",
  "Siddharth Joshi","Neha Pillai",    "Rahul Das",      "Kavya Menon",    "Arjun Rao",
  "Riya Chopra",    "Manish Tiwari",  "Shruti Agarwal", "Nikhil Bose",    "Swati Shah",
];

const PHONES = [
  "9900000001","9900000002","9900000003","9900000004","9900000005",
  "9900000006","9900000007","9900000008","9900000009","9900000010",
  "9900000011","9900000012","9900000013","9900000014","9900000015",
  "9900000016","9900000017","9900000018","9900000019","9900000020",
];

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function seed(ownerPhone) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected:", process.env.MONGO_URI);

  const owner = ownerPhone
    ? await Owner.findOne({ phone: ownerPhone })
    : await Owner.findOne().sort({ createdAt: 1 });

  if (!owner) {
    console.error("No owner found. Log in to the app first.");
    process.exit(1);
  }
  console.log(`Owner : ${owner.name} (${owner.phone})`);

  const center = await Center.findOne({ owner: owner._id }).sort({ createdAt: 1 });
  if (!center) {
    console.error("No center found. Create a venue in the app first.");
    process.exit(1);
  }
  console.log(`Center: ${center.name} (${center.type})`);

  // Remove previous dummy members
  const removed = await Member.deleteMany({ center: center._id, phone: { $in: PHONES } });
  if (removed.deletedCount > 0) console.log(`Removed ${removed.deletedCount} old dummy members.`);

  // ── Build members ─────────────────────────────────────────────────────────
  // Index 0-9   → 10 ACTIVE   (expiry 15, 25, 35 … 105 days from now — beyond 7-day window)
  // Index 10-14 → 5  EXPIRING (expiry 1, 2, 3, 4, 5 days from now — within 7-day window)
  // Index 15-19 → 5  EXPIRED  (expiry 1, 2, 3, 4, 5 days ago)

  const members = NAMES.map((name, i) => {
    let planDays, expiryOffset;

    if (i < 10) {
      planDays    = 90;
      expiryOffset = 15 + i * 10; // 15 … 105  (all > 7, so "active")
    } else if (i < 15) {
      planDays    = 30;
      expiryOffset = i - 9;        // 1, 2, 3, 4, 5  (≤ 7, so "expiring")
    } else {
      planDays    = 30;
      expiryOffset = -(i - 14);    // -1, -2, -3, -4, -5  (past, so "expired")
    }

    const expiryDate = daysFromNow(expiryOffset);
    const joinDate   = daysFromNow(expiryOffset - planDays);

    return {
      center:     center._id,
      owner:      owner._id,
      name,
      phone:      PHONES[i],
      joinDate,
      expiryDate,
      planDays,
      memberType: i >= 18 ? "pt" : "regular",
    };
  });

  await Member.insertMany(members);

  const now = new Date();
  const active   = members.filter(m => { const d = Math.ceil((m.expiryDate - now) / 86400000); return d > 7; });
  const expiring = members.filter(m => { const d = Math.ceil((m.expiryDate - now) / 86400000); return d >= 0 && d <= 7; });
  const expired  = members.filter(m => m.expiryDate < now);

  console.log(`\n✅ Inserted ${members.length} dummy members:`);
  console.log(`   Active:        ${active.length}`);
  console.log(`   Expiring soon: ${expiring.length}`);
  console.log(`   Expired:       ${expired.length}`);
  console.log(`   PT members:    ${members.filter(m => m.memberType === "pt").length}`);

  await mongoose.disconnect();
  console.log("\nDone. Refresh your dashboard.");
}

const phone = process.argv[2];
seed(phone).catch(err => { console.error("Seed failed:", err.message); process.exit(1); });
