/**
 * seedall.js — comprehensive dummy data seed
 *
 * Adds for the first owner's first center:
 *   Regular members: 5 active, 3 expiring, 3 expired
 *   PT members:      3 active, 2 expiring, 2 expired
 *
 * Usage: node seedall.js [ownerPhone]
 */

import "dotenv/config";
import mongoose from "mongoose";
import Owner from "./models/Owner.js";
import Center from "./models/Center.js";
import Member from "./models/Member.js";

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// yyyy-mm-dd → IST midnight stored as UTC
function istDate(dateStr) {
  return new Date(`${dateStr}T00:00:00+05:30`);
}

const REGULAR = [
  // Active (expiry > 7 days ahead)
  { name: "Aarav Sharma",    phone: "9900000001", planDays: 90,  expiryOffset: 80  },
  { name: "Priya Patel",     phone: "9900000002", planDays: 60,  expiryOffset: 45  },
  { name: "Rohan Mehta",     phone: "9900000003", planDays: 30,  expiryOffset: 20  },
  { name: "Sneha Iyer",      phone: "9900000004", planDays: 90,  expiryOffset: 60  },
  { name: "Karan Verma",     phone: "9900000005", planDays: 30,  expiryOffset: 15  },
  // Expiring (1-7 days ahead)
  { name: "Ananya Nair",     phone: "9900000006", planDays: 30,  expiryOffset: 1   },
  { name: "Vikram Singh",    phone: "9900000007", planDays: 30,  expiryOffset: 3   },
  { name: "Deepika Reddy",   phone: "9900000008", planDays: 60,  expiryOffset: 6   },
  // Expired (past)
  { name: "Amit Kumar",      phone: "9900000009", planDays: 30,  expiryOffset: -2  },
  { name: "Pooja Gupta",     phone: "9900000010", planDays: 30,  expiryOffset: -5  },
  { name: "Siddharth Joshi", phone: "9900000011", planDays: 90,  expiryOffset: -10 },
];

const PT = [
  // PT Active
  { name: "Neha Pillai",   phone: "9900000012", planDays: 30,  expiryOffset: 25  },
  { name: "Rahul Das",     phone: "9900000013", planDays: 60,  expiryOffset: 40  },
  { name: "Kavya Menon",   phone: "9900000014", planDays: 30,  expiryOffset: 12  },
  // PT Expiring
  { name: "Arjun Rao",     phone: "9900000015", planDays: 30,  expiryOffset: 2   },
  { name: "Riya Chopra",   phone: "9900000016", planDays: 30,  expiryOffset: 5   },
  // PT Expired
  { name: "Manish Tiwari", phone: "9900000017", planDays: 30,  expiryOffset: -3  },
  { name: "Shruti Agarwal",phone: "9900000018", planDays: 60,  expiryOffset: -8  },
];

async function seed(ownerPhone) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  const owner = ownerPhone
    ? await Owner.findOne({ phone: ownerPhone })
    : await Owner.findOne().sort({ createdAt: 1 });

  if (!owner) { console.error("No owner found. Log in to the app first."); process.exit(1); }
  console.log(`Owner : ${owner.name} (${owner.phone})`);

  const center = await Center.findOne({ owner: owner._id }).sort({ createdAt: 1 });
  if (!center) { console.error("No center found. Create a venue first."); process.exit(1); }
  console.log(`Center: ${center.name} (${center.type})`);

  // Clear old dummy members
  const allPhones = [...REGULAR, ...PT].map(m => m.phone);
  const removed = await Member.deleteMany({ center: center._id, phone: { $in: allPhones } });
  if (removed.deletedCount) console.log(`Removed ${removed.deletedCount} old dummy records.`);

  // Ensure center has plans and ptPlans
  let changed = false;
  if (!center.plans || center.plans.length === 0) {
    center.plans = [{ days: 30, price: 500 }, { days: 60, price: 900 }, { days: 90, price: 1200 }];
    changed = true;
  }
  if (!center.ptPlans || center.ptPlans.length === 0) {
    center.ptPlans = [{ days: 30, price: 800 }, { days: 60, price: 1400 }];
    changed = true;
  }
  if (changed) { await center.save(); console.log("Added default plans to center."); }

  // Build regular members
  const regularDocs = REGULAR.map(m => ({
    center:     center._id,
    owner:      owner._id,
    name:       m.name,
    phone:      m.phone,
    planDays:   m.planDays,
    expiryDate: daysFromNow(m.expiryOffset),
    joinDate:   daysFromNow(m.expiryOffset - m.planDays),
    memberType: "regular",
  }));

  // Build PT members — same phone as regular so they're linked to same person
  // Use different phones so they appear as separate PT-only entries
  const ptDocs = PT.map(m => ({
    center:     center._id,
    owner:      owner._id,
    name:       m.name,
    phone:      m.phone,
    planDays:   m.planDays,
    expiryDate: daysFromNow(m.expiryOffset),
    joinDate:   daysFromNow(m.expiryOffset - m.planDays),
    memberType: "pt",
  }));

  await Member.insertMany([...regularDocs, ...ptDocs]);

  const now = new Date();
  const reg = regularDocs;
  const pt  = ptDocs;

  console.log(`\n✅ Seeded successfully for "${center.name}":`);
  console.log(`\n   REGULAR (${reg.length}):`);
  console.log(`     Active:   ${reg.filter(m => Math.ceil((m.expiryDate - now) / 86400000) > 7).length}`);
  console.log(`     Expiring: ${reg.filter(m => { const d = Math.ceil((m.expiryDate - now) / 86400000); return d >= 0 && d <= 7; }).length}`);
  console.log(`     Expired:  ${reg.filter(m => m.expiryDate < now).length}`);
  console.log(`\n   PT (${pt.length}):`);
  console.log(`     Active:   ${pt.filter(m => Math.ceil((m.expiryDate - now) / 86400000) > 7).length}`);
  console.log(`     Expiring: ${pt.filter(m => { const d = Math.ceil((m.expiryDate - now) / 86400000); return d >= 0 && d <= 7; }).length}`);
  console.log(`     Expired:  ${pt.filter(m => m.expiryDate < now).length}`);

  await mongoose.disconnect();
  console.log("\nDone. Refresh your dashboard.");
}

const phone = process.argv[2];
seed(phone).catch(err => { console.error("Seed failed:", err.message); process.exit(1); });
