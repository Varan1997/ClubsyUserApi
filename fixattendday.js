/**
 * fixattendday.js — run once on production to fix attendance day keys.
 * Records stored with UTC date instead of IST date get corrected.
 * Usage: node fixattendday.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import Attendance from "./models/Attendance.js";

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected. Scanning all attendance records...");

const all = await Attendance.find().lean();
console.log("Total records:", all.length);

let fixed = 0;
for (const r of all) {
  const correct = r.checkInAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (r.day !== correct) {
    console.log(`  Fix: phone=${r.phone}  stored=${r.day}  correct=${correct}`);
    await Attendance.updateOne({ _id: r._id }, { $set: { day: correct } });
    fixed++;
  }
}

console.log(`\nFixed ${fixed} of ${all.length} record(s). Done.`);
await mongoose.disconnect();
