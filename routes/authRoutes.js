import { Router } from "express";
import { sendOtp, verifyOtp, me, sendMyOtp } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/send-otp", asyncHandler(sendOtp));
router.post("/verify-otp", asyncHandler(verifyOtp));
router.get("/me", protect, asyncHandler(me));
router.post("/my-otp", protect, asyncHandler(sendMyOtp));

export default router;
