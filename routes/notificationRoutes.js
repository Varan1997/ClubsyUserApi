import { Router } from "express";
import {
  listNotifications,
  unreadCount,
  markRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(protect);
router.get("/", asyncHandler(listNotifications));
router.get("/count", asyncHandler(unreadCount));
router.post("/read", asyncHandler(markRead));
router.delete("/:id", asyncHandler(deleteNotification));

export default router;
