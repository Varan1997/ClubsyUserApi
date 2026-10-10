import "dotenv/config";
import mongoose from "mongoose";
import Attendance from "./models/Attendance.js";

await mongoose.connect(process.env.MONGO_URI);

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
console.log("Deleting all attendance for IST today:", today);

const result = await Attendance.deleteMany({ day: today });
console.log("Deleted:", result.deletedCount, "record(s)");

const todayUTC = new Date().toISOString().slice(0, 10);
if (todayUTC !== today) {
  const r2 = await Attendance.deleteMany({ day: todayUTC });
  if (r2.deletedCount > 0)
    console.log("Also deleted:", r2.deletedCount, "under UTC date", todayUTC);
}

await mongoose.disconnect();
console.log("Done.");
