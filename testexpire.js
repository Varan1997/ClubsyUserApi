/**
 * testexpire.js — set 3 active members to expired (5 days ago) for testing.
 * Run: node testexpire.js
 * Undo: node testexpire.js --restore
 */
import "dotenv/config";
import mongoose from "mongoose";
import Member from "./models/Member.js";

const restore = process.argv.includes("--restore");

await mongoose.connect(process.env.MONGO_URI);

const now = new Date();

if (restore) {
  // Restore: find members whose expiry is 5 days ago (within ±1 hr) and push back 60 days
  const cutoff = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const from = new Date(cutoff.getTime() - 60 * 60 * 1000);
  const to   = new Date(cutoff.getTime() + 60 * 60 * 1000);
  const members = await Member.find({ expiryDate: { $gte: from, $lte: to } });
  for (const m of members) {
    m.expiryDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days ahead
    await m.save();
    console.log(`Restored: ${m.name} → active (60 days)`);
  }
} else {
  // Expire: take first 3 regular active members
  const members = await Member.find({
    expiryDate: { $gt: now },
    memberType: "regular",
  }).limit(3);

  if (members.length === 0) {
    console.log("No active members found.");
  } else {
    const expired = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    for (const m of members) {
      console.log(`${m.name}: ${m.expiryDate.toLocaleDateString("en-IN")} → expired (5 days ago)`);
      m.expiryDate = expired;
      await m.save();
    }
    console.log("\nDone. Refresh the app to see expired members.");
    console.log("To restore: node testexpire.js --restore");
  }
}

await mongoose.disconnect();
