import express from "express";
import { protect } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
} from "../controllers/pushController.js";

const router = express.Router();

// Public — frontend needs this before auth to set up the subscription
router.get("/vapid-public-key", asyncHandler(getVapidPublicKey));

// Protected — user must be logged in to save/remove subscriptions
router.post("/subscribe",   protect, asyncHandler(subscribe));
router.delete("/unsubscribe", protect, asyncHandler(unsubscribe));

export default router;
