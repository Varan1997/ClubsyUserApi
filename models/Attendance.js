import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      required: true,
      index: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true,
    },
    phone: { type: String, required: true, index: true },
    // Local calendar day key "YYYY-MM-DD" used to enforce one check-in per day.
    day: { type: String, required: true },
    checkInAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One attendance per member per day per centre.
attendanceSchema.index({ member: 1, day: 1 }, { unique: true });

attendanceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model("Attendance", attendanceSchema);
