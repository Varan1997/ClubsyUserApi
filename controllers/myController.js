import Member from "../models/Member.js";
import Center from "../models/Center.js";
import Owner from "../models/Owner.js";
import { withStatus } from "../utils/status.js";

// GET /api/my/memberships
export async function myMemberships(req, res) {
  const phone = req.owner.phone;
  const members = await Member.find({ phone }).sort({ expiryDate: 1 });

  const now = new Date();
  const result = await Promise.all(
    members.map(async (m) => {
      const center = await Center.findById(m.center).select(
        "name type location address upiId plans ptPlans owner"
      );
      const withS = withStatus(m, now);
      const planArray = m.memberType === "pt"
        ? (center?.ptPlans || [])
        : (center?.plans || []);
      const plan = planArray.find((p) => p.days === m.planDays);

      // Fetch owner's name + phone so member can contact them
      let ownerInfo = null;
      if (center?.owner) {
        const ownerDoc = await Owner.findById(center.owner).select("name phone").lean();
        if (ownerDoc) ownerInfo = { name: ownerDoc.name, phone: ownerDoc.phone };
      }

      return {
        ...withS,
        venue: center
          ? {
              _id: center._id,
              name: center.name,
              type: center.type,
              location: center.location,
              address: center.address,
              upiId: center.upiId,
              ownerInfo,
            }
          : null,
        price: plan?.price ?? null,
      };
    })
  );

  res.json({ memberships: result });
}
