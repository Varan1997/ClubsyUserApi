import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    joinDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    planDays: { type: Number, default: null },
    memberType: { type: String, enum: ["regular", "pt"], default: "regular" },
  },
  { timestamps: true }
);

memberSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model("Member", memberSchema);
