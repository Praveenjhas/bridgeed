import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { userRouter } from "./routes/user.routes";
import { studentProfileRouter } from "./routes/student-profile.routes";
import { universityRouter } from "./routes/university.routes";
import { skillRouter } from "./routes/skill.routes";
import { interestRouter } from "./routes/interest.routes";
import { studentSkillRouter } from "./routes/student-skill.routes";
import { studentInterestRouter } from "./routes/student-interest.routes";
import {
  connectionRouter,
  studentConnectionRouter,
} from "./routes/connection.routes";
import {
  communityRouter,
  studentCommunityRouter,
} from "./routes/community.routes";
import { communityMembershipRouter } from "./routes/community-membership.routes";
import {
  communityPostRouter,
  postRouter,
} from "./routes/post.routes";
import { commentRouter } from "./routes/comment.routes";
import {
  commentReactionRouter,
  postReactionRouter,
} from "./routes/reaction.routes";
dotenv.config();

const app = express();

const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "bridgeed-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/student-profiles", studentProfileRouter);
app.use("/api/v1/universities", universityRouter);
app.use("/api/v1/skills", skillRouter);
app.use("/api/v1/interests", interestRouter);
app.use(
  "/api/v1/student-profiles/:userId/skills",
  studentSkillRouter,
);
app.use(
  "/api/v1/student-profiles/:userId/interests",
  studentInterestRouter,
);
app.use("/api/v1/connections", connectionRouter);
app.use("/api/v1/student-profiles/:userId", studentConnectionRouter);
app.use("/api/v1/communities", communityRouter);
app.use(
  "/api/v1/communities/:communityId/posts",
  communityPostRouter,
);
app.use("/api/v1/community-memberships", communityMembershipRouter);
app.use("/api/v1/student-profiles/:userId", studentCommunityRouter);
app.use("/api/v1/posts/:postId/reactions", postReactionRouter);
app.use("/api/v1/posts", postRouter);
app.use("/api/v1/comments/:commentId/reactions", commentReactionRouter);
app.use("/api/v1/comments", commentRouter);
app.listen(PORT, () => {
  console.log(`BridgeEd API running on http://localhost:${PORT}`);
});
