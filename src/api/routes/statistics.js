import express from "express";
import {
  kpi,
  summary,
  summaryByGeofence,
  sweepingSummary,
  vehicle,
} from "../controllers/statistics.js";

const router = express.Router();

router.get("/kpi", kpi);
router.get("/summary", summary);
router.get("/summary-geo", summaryByGeofence);
router.get("/vehicle", vehicle);
router.get("/sweeping", sweepingSummary);

export default router;
