/**
 * cleanup.js
 * 1. Removes ALL PT member records (memberType === "pt")
 * 2. Removes duplicate regular member records
 *    — keeps the newest per (center, phone, memberType)
 *
 * Run: node cleanup.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import Member from "./models/Member.js";

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected:", mongoose.connection.name);

// ── Step 1: Remove all PT records ─────────────────────────────────────────
const ptResult = await Member.deleteMany({ memberType: "pt" });
console.log(`✅ Removed ${ptResult.deletedCount} PT member record(s).`);

// ── Step 2: Remove duplicate regular records ──────────────────────────────
// For each (center, phone) keep only the most recently created record.
const regulars = await Member.find({ memberType: { $in: ["regular", null, undefined] } })
  .sort({ createdAt: -1 }); // newest first

const seen = new Set();
const toDelete = [];

for (const m of regulars) {
  const key = `${m.center}:${m.phone}`;
  if (seen.has(key)) {
    toDelete.push(m._id);
  } else {
    seen.add(key);
  }
}

console.log(`Regular members found : ${regulars.length}`);
console.log(`Duplicates to remove  : ${toDelete.length}`);

if (toDelete.length > 0) {
  const dupResult = await Member.deleteMany({ _id: { $in: toDelete } });
  console.log(`✅ Removed ${dupResult.deletedCount} duplicate regular record(s).`);
} else {
  console.log("No duplicate regular records found.");
}

const remaining = await Member.countDocuments();
console.log(`\nRemaining members: ${remaining}`);

await mongoose.disconnect();
console.log("Done.");
