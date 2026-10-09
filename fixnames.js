/**
 * fixnames.js
 *
 * One-time script: strips accidental status suffixes from member names.
 * e.g. "Suresh (Expiring)" → "Suresh"
 *
 * Usage: node fixnames.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import Member from "./models/Member.js";

const SUFFIX_RE = /\s*\((expiring|expired|active)\)\s*$/i;

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected to MongoDB.");

const members = await Member.find({ name: SUFFIX_RE });
console.log(`Found ${members.length} member(s) with status suffixes in their name.`);

for (const m of members) {
  const fixed = m.name.replace(SUFFIX_RE, "").trim();
  console.log(`  Fixing: "${m.name}" → "${fixed}"  (${m._id})`);
  m.name = fixed;
  await m.save();
}

console.log("Done.");
await mongoose.disconnect();
