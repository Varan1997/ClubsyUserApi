import { Router } from "express";
import {
  listCenters,
  createCenter,
  getCenter,
  updateCenter,
  updatePlans,
  updateUpi,
  deleteCenter,
} from "../controllers/centerController.js";
import { createMember } from "../controllers/memberController.js";
import { getCenterAttendance } from "../controllers/attendanceController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(protect);

router.route("/").get(asyncHandler(listCenters)).post(asyncHandler(createCenter));
router
  .route("/:id")
  .get(asyncHandler(getCenter))
  .put(asyncHandler(updateCenter))
  .delete(asyncHandler(deleteCenter));

// plan pricing
router.put("/:id/plans", asyncHandler(updatePlans));

// UPI id (OTP-verified)
router.put("/:id/upi", asyncHandler(updateUpi));

// nested: add a member to a center
router.post("/:centerId/members", asyncHandler(createMember));

// owner view: who attended this venue on a given day
router.get("/:id/attendance", asyncHandler(getCenterAttendance));

export default router;
