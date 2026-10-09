import express from "express";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createPost, listPosts, deletePost } from "../controllers/postController.js";

const router = express.Router();

router.post("/centers/:centerId/posts",  protect, asyncHandler(createPost));
router.get("/centers/:centerId/posts",   protect, asyncHandler(listPosts));
router.delete("/posts/:id",              protect, asyncHandler(deletePost));

export default router;
