import { Router } from "express";
import { myMemberships } from "../controllers/myController.js";
import { myAttendance } from "../controllers/attendanceController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(protect);
router.get("/memberships", asyncHandler(myMemberships));
router.get("/attendance/:memberId", asyncHandler(myAttendance));

export default router;
