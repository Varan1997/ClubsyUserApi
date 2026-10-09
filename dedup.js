/**
 * Dedup script — for each phone number in a center, keeps only the
 * most recently created member record and removes the rest.
 * Run: node dedup.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import Member from "./models/Member.js";

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected:", process.env.MONGO_URI);

// Get all members grouped by center + phone
const all = await Member.find().sort({ createdAt: -1 }); // newest first

const seen = new Map(); // key: `centerId:phone` → keep the first (newest) one
const toDelete = [];

for (const m of all) {
  const key = `${m.center}:${m.phone}`;
  if (seen.has(key)) {
    toDelete.push(m._id);
  } else {
    seen.set(key, m._id);
  }
}

console.log(`Total members: ${all.length}`);
console.log(`Duplicates to remove: ${toDelete.length}`);

if (toDelete.length > 0) {
  const result = await Member.deleteMany({ _id: { $in: toDelete } });
  console.log(`✅ Removed ${result.deletedCount} duplicate members.`);
} else {
  console.log("No duplicates found.");
}

const remaining = await Member.countDocuments();
console.log(`Remaining members: ${remaining}`);

await mongoose.disconnect();
console.log("Done.");
