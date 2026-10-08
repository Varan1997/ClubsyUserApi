import { Router } from "express";
import { markAttendance, getCenterAttendance, getMembersForAttendance, bulkMarkAttendance } from "../controllers/attendanceController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Member self check-in via QR
router.post("/:venueId", protect, asyncHandler(markAttendance));

// Owner: get attendance for a day
router.get("/centers/:id/attendance", protect, asyncHandler(getCenterAttendance));

// Owner: get members list with today's check-in status
router.get("/centers/:id/members-for-attendance", protect, asyncHandler(getMembersForAttendance));

// Owner: bulk mark attendance for selected members
router.post("/centers/:id/attendance/bulk", protect, asyncHandler(bulkMarkAttendance));

export default router;
