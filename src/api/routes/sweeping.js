import express from "express";
import { sweeping, sweepingSessions } from "../controllers/sweeping.js";

const router = express.Router();

router.get("/", sweeping);
router.get("/sessions", sweepingSessions);

export default router;
