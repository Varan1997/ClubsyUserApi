/**
 * fixprod.js — run locally against production MongoDB
 * Usage: MONGO_URI="mongodb+srv://..." node fixprod.js
 *
 * Does two things:
 * 1. Fixes attendance records stored under wrong day (UTC instead of IST)
 * 2. Shows a summary of what was fixed
 */
import mongoose from "mongoose";
import Attendance from "./models/Attendance.js";

const uri = process.env.MONGO_URI;
if (!uri || uri.includes("127.0.0.1")) {
  console.error("ERROR: Set MONGO_URI to your production MongoDB Atlas URI");
  console.error('Usage: MONGO_URI="mongodb+srv://..." node fixprod.js');
  process.exit(1);
}

console.log("Connecting to production MongoDB...");
await mongoose.connect(uri);
console.log("Connected!");

const all = await Attendance.find().lean();
console.log(`Total attendance records: ${all.length}`);

let fixed = 0;
for (const r of all) {
  const correct = r.checkInAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (r.day !== correct) {
    await Attendance.updateOne({ _id: r._id }, { $set: { day: correct } });
    console.log(`  Fixed: phone=${r.phone}  ${r.day} → ${correct}  (checkInAt=${r.checkInAt.toISOString()})`);
    fixed++;
  }
}

console.log(`\n✅ Fixed ${fixed} of ${all.length} record(s).`);
await mongoose.disconnect();
console.log("Done.");
