import { Router } from "express";
import {
  listNotifications,
  unreadCount,
  markRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(protect);
router.get("/", asyncHandler(listNotifications));
router.get("/count", asyncHandler(unreadCount));
router.post("/read", asyncHandler(markRead));

export default router;
