import express from "express";
import {
  sweeping,
  sweepingSessions,
  sweepingSessionsReport,
} from "../controllers/sweeping.js";

const router = express.Router();

router.get("/", sweeping);
router.get("/sessions", sweepingSessions);
router.get("/equipments", sweepingSessionsReport);

export default router;
