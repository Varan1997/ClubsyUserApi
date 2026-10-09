import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: "Center", required: true, index: true },
    owner:  { type: mongoose.Schema.Types.ObjectId, ref: "Owner",  required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    // base64 data URI or external URL — optional
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// Newest-first feed per venue
postSchema.index({ center: 1, createdAt: -1 });

// Auto-delete posts after 24 hours (MongoDB TTL index)
postSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

postSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model("Post", postSchema);
