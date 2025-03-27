import express from "express";
import {
  kpi,
  newSummary,
  summary,
  vehicle,
} from "../controllers/statistics.js";

const router = express.Router();

router.get("/kpi", kpi);
router.get("/summary", summary);
router.get("/vehicle", vehicle);
router.get("/new", newSummary);

export default router;
