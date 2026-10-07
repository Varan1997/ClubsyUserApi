import { Router } from "express";
import { markAttendance } from "../controllers/attendanceController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/:venueId", protect, asyncHandler(markAttendance));

export default router;
