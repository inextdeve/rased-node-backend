import express from "express";
import {
  kpi,
  summary,
  sweepingSummary,
  vehicle,
} from "../controllers/statistics.js";

const router = express.Router();

router.get("/kpi", kpi);
router.get("/summary", summary);
router.get("/vehicle", vehicle);
router.get("/sweeping", sweepingSummary);

export default router;
