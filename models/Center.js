import mongoose from "mongoose";

const centerSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Gym", "Yoga", "Swimming", "Tuition", "Sports", "Other"],
      default: "Gym",
    },
    address: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    capacity: { type: Number, min: 0, default: 0 },
    // UPI ID the venue collects payments to (e.g. name@okbank).
    upiId: { type: String, trim: true, default: "" },
    // Custom membership plans the owner defines for this centre.
    // Each plan has a duration in days and a price in rupees.
    plans: {
      type: [
        {
          days: { type: Number, required: true, min: 1 },
          price: { type: Number, required: true, min: 0 },
        },
      ],
      default: [
        { days: 30, price: 0 },
        { days: 90, price: 0 },
        { days: 180, price: 0 },
        { days: 360, price: 0 },
      ],
    },
  },
  { timestamps: true }
);

centerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model("Center", centerSchema);
