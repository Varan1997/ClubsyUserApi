import { Router } from "express";
import {
  updateMember,
  deleteMember,
  renewMember,
} from "../controllers/memberController.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(protect);

router.route("/:id").put(asyncHandler(updateMember)).delete(asyncHandler(deleteMember));
router.post("/:id/renew", asyncHandler(renewMember));

export default router;
