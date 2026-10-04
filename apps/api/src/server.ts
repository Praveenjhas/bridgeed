import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { userRouter } from "./routes/user.routes";

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

app.listen(PORT, () => {
  console.log(`BridgeEd API running on http://localhost:${PORT}`);
});
