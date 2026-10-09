/**
 * fixdup.js — full cleanup:
 * 1. Remove all dummy seed members (phones 9900000001–9900000020)
 * 2. For remaining real members, keep only the LATEST record per (center + phone)
 * 3. Print final count
 */
import "dotenv/config";
import mongoose from "mongoose";
import Member from "./models/Member.js";

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected:", process.env.MONGO_URI);

const before = await Member.countDocuments();
console.log(`Members before: ${before}`);

// Step 1: Remove dummy seed members
const dummyPhones = Array.from({ length: 20 }, (_, i) =>
  `990000${String(i + 1).padStart(4, "0")}`
);
const dummyResult = await Member.deleteMany({ phone: { $in: dummyPhones } });
console.log(`Removed ${dummyResult.deletedCount} dummy seed members`);

// Step 2: Dedup real members — keep newest per (center + phone)
const all = await Member.find().sort({ createdAt: -1 }); // newest first
const seen = new Map();
const toDelete = [];

for (const m of all) {
  const key = `${m.center}:${m.phone}`;
  if (seen.has(key)) {
    toDelete.push(m._id);
  } else {
    seen.set(key, m._id);
  }
}

if (toDelete.length > 0) {
  const dedupResult = await Member.deleteMany({ _id: { $in: toDelete } });
  console.log(`Removed ${dedupResult.deletedCount} duplicate real members`);
} else {
  console.log("No duplicate real members found");
}

const after = await Member.countDocuments();
console.log(`\nMembers after: ${after}`);

// Step 3: Show breakdown
const now = new Date();
const remaining = await Member.find();
const active   = remaining.filter(m => { const d = Math.ceil((new Date(m.expiryDate) - now) / 86400000); return d > 7; });
const expiring = remaining.filter(m => { const d = Math.ceil((new Date(m.expiryDate) - now) / 86400000); return d >= 0 && d <= 7; });
const expired  = remaining.filter(m => new Date(m.expiryDate) < now);
console.log(`  Active: ${active.length} | Expiring: ${expiring.length} | Expired: ${expired.length}`);

await mongoose.disconnect();
console.log("\nDone. Refresh your app.");
