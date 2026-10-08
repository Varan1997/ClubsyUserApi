const DAY_MS = 24 * 60 * 60 * 1000;

const EXPIRING_SOON_DAYS = Number(process.env.EXPIRING_SOON_DAYS || 7);

/**
 * Compute a member's membership status from its expiry date.
 * @param {Date|string} expiryDate
 * @param {Date} [now]
 * @returns {"active"|"expiring"|"expired"}
 */
export function computeStatus(expiryDate, now = new Date()) {
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);

  if (diffDays < 0) return "expired";
  if (diffDays <= EXPIRING_SOON_DAYS) return "expiring";
  return "active";
}

/**
 * Attach computed status (and days left) to a plain member object.
 */
export function withStatus(member, now = new Date()) {
  const obj = typeof member.toObject === "function" ? member.toObject() : { ...member };
  const expiry = new Date(obj.expiryDate);
  obj.status = computeStatus(expiry, now);
  obj.daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
  delete obj.__v;
  return obj;
}

/**
 * Build dashboard counters for a list of members.
 * Only counts regular members (not PT records) in the totals.
 */
export function summarize(members, now = new Date()) {
  const regular = members.filter((m) => (m.memberType || "regular") === "regular");
  const summary = { total: regular.length, active: 0, expiring: 0, expired: 0 };
  for (const m of regular) {
    const status = computeStatus(m.expiryDate, now);
    summary[status] += 1;
  }
  return summary;
}
