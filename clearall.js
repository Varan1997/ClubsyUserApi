/**
 * clearall.js — removes ALL members from production DB
 * Usage: node clearall.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import Member from "./models/Member.js";
import Attendance from "./models/Attendance.js";
import Notification from "./models/Notification.js";

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected.");

const m = await Member.deleteMany({});
console.log(`Deleted ${m.deletedCount} member(s).`);

const a = await Attendance.deleteMany({});
console.log(`Deleted ${a.deletedCount} attendance record(s).`);

const n = await Notification.deleteMany({});
console.log(`Deleted ${n.deletedCount} notification(s).`);

await mongoose.disconnect();
console.log("Done. All records cleared.");
