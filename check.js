import "dotenv/config";
import mongoose from "mongoose";
import Owner from "./models/Owner.js";
import Center from "./models/Center.js";
import Member from "./models/Member.js";

await mongoose.connect(process.env.MONGO_URI);

const owners = await Owner.find();
console.log("\n=== OWNERS ===");
owners.forEach(o => console.log(`  ${o.name} | ${o.phone} | id:${o._id}`));

const centers = await Center.find();
console.log("\n=== CENTERS ===");
centers.forEach(c => console.log(`  ${c.name} (${c.type}) | owner:${c.owner} | id:${c._id}`));

const allMembers = await Member.find();
console.log(`\n=== MEMBERS total: ${allMembers.length} ===`);

for (const center of centers) {
  const members = allMembers.filter(m => String(m.center) === String(center._id));
  const now = new Date();
  const active   = members.filter(m => { const d = Math.ceil((new Date(m.expiryDate) - now) / 86400000); return d > 7; });
  const expiring = members.filter(m => { const d = Math.ceil((new Date(m.expiryDate) - now) / 86400000); return d >= 0 && d <= 7; });
  const expired  = members.filter(m => new Date(m.expiryDate) < now);
  const dummy    = members.filter(m => m.phone.startsWith("990000"));
  console.log(`\n  Center: ${center.name}`);
  console.log(`    Total: ${members.length} | Active: ${active.length} | Expiring: ${expiring.length} | Expired: ${expired.length}`);
  console.log(`    Dummy members (990000xxx): ${dummy.length}`);
}

await mongoose.disconnect();
console.log("\nDone.");
