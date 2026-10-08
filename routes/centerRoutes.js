import { Router } from "express";
import {
  listCenters,
  createCenter,
  getCenter,
  updateCenter,
  updatePlans,
  updatePtPlans,
  updateUpi,
  deleteCenter,
} from "../controllers/centerController.js";
import { createMember } from "../controllers/memberController.js";
import { getCenterAttendance, getMembersForAttendance, bulkMarkAttendance } from "../controllers/attendanceController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(protect);

// ── Collection routes ──────────────────────────────────────
router.route("/").get(asyncHandler(listCenters)).post(asyncHandler(createCenter));

// ── Specific sub-routes BEFORE /:id to avoid param capture ─
// owner: members list with today check-in status
// must be before /:id GET
// (Express matches /:id first if placed after)

// ── Resource routes ─────────────────────────────────────────
router
  .route("/:id")
  .get(asyncHandler(getCenter))
  .put(asyncHandler(updateCenter))
  .delete(asyncHandler(deleteCenter));

// plan pricing
router.put("/:id/plans", asyncHandler(updatePlans));
router.put("/:id/pt-plans", asyncHandler(updatePtPlans));

// UPI id (OTP-verified)
router.put("/:id/upi", asyncHandler(updateUpi));

// nested: add a member to a center
router.post("/:centerId/members", asyncHandler(createMember));

// owner view: who attended this venue on a given day
router.get("/:id/attendance", asyncHandler(getCenterAttendance));

// owner: members list with today check-in status
router.get("/:id/members-for-attendance", asyncHandler(getMembersForAttendance));

// owner: bulk mark attendance for selected members
router.post("/:id/attendance/bulk", asyncHandler(bulkMarkAttendance));

export default router;
