import Member from "../models/Member.js";
import Center from "../models/Center.js";
import { withStatus } from "../utils/status.js";

// GET /api/my/memberships
// Returns all memberships whose phone matches the logged-in user's phone,
// across every venue (member view).
export async function myMemberships(req, res) {
  const phone = req.owner.phone;
  const members = await Member.find({ phone }).sort({ expiryDate: 1 });

  const now = new Date();
  const result = await Promise.all(
    members.map(async (m) => {
      const center = await Center.findById(m.center).select(
        "name type location upiId plans"
      );
      const withS = withStatus(m, now);
      // Attach the price the member is on (match plan days to the venue's plans).
      const plan = (center?.plans || []).find((p) => p.days === m.planDays);
      return {
        ...withS,
        venue: center
          ? {
              _id: center._id,
              name: center.name,
              type: center.type,
              location: center.location,
              upiId: center.upiId,
            }
          : null,
        price: plan?.price ?? null,
      };
    })
  );

  res.json({ memberships: result });
}
