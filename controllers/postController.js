import Post from "../models/Post.js";
import Center from "../models/Center.js";
import Member from "../models/Member.js";
import { notifyEvent } from "../utils/notify.js";

// POST /api/centers/:centerId/posts
export async function createPost(req, res) {
  const center = await Center.findOne({ _id: req.params.centerId, owner: req.owner._id });
  if (!center) {
    res.status(404);
    throw new Error("Center not found");
  }

  const { content, imageUrl } = req.body;
  if (!content || !content.trim()) {
    res.status(400);
    throw new Error("Post content is required");
  }
  if (content.trim().length > 1000) {
    res.status(400);
    throw new Error("Content must be 1000 characters or less");
  }

  // Reject images over ~1MB (base64 ~1.37× raw, so 1MB raw ≈ 1.37MB base64)
  if (imageUrl && imageUrl.length > 1_400_000) {
    res.status(400);
    throw new Error("Image too large. Please use an image under 1 MB.");
  }

  const post = await Post.create({
    center: center._id,
    owner:  req.owner._id,
    content: content.trim(),
    imageUrl: imageUrl || "",
  });

  // Notify all active members of this venue — fire and forget
  const members = await Member.find({
    center: center._id,
    memberType: "regular",
  }).select("phone").lean();

  // Deduplicate phones (a person may have multiple records)
  const phones = [...new Set(members.map((m) => m.phone).filter(Boolean))];

  // Short preview of the post content for the notification message
  const preview = content.trim().length > 80
    ? content.trim().slice(0, 77) + "…"
    : content.trim();

  for (const phone of phones) {
    notifyEvent({
      recipientPhone: phone,
      role: "member",
      type: "announcement",
      title: `📢 ${center.name}`,
      message: preview,
      meta: { venue: center.name, centerId: String(center._id), postId: String(post._id) },
    });
  }

  res.status(201).json({ post: post.toJSON() });
}

// GET /api/centers/:centerId/posts
// Accessible by: owner of the center OR a member of the center
export async function listPosts(req, res) {
  const centerId = req.params.centerId;

  // Check access: owner OR member
  const isOwner = await Center.exists({ _id: centerId, owner: req.owner._id });
  if (!isOwner) {
    // Check if requester is a member of this center
    const isMember = await Member.exists({ center: centerId, phone: req.owner.phone });
    if (!isMember) {
      res.status(403);
      throw new Error("Not authorized to view posts for this venue");
    }
  }

  const posts = await Post.find({ center: centerId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ posts });
}

// DELETE /api/posts/:id
export async function deletePost(req, res) {
  const post = await Post.findOne({ _id: req.params.id, owner: req.owner._id });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }
  await post.deleteOne();
  res.json({ ok: true });
}
