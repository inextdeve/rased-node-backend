import express from "express";
import {
  summary,
  nearbyStops,
  reportDevices,
  devices,
} from "../controllers/devices.js";

const router = express.Router();

router.get("/", devices);
router.get("/summary", summary);

router.get("/nearby-stops", nearbyStops);
router.get("/report", reportDevices);

// router.get("/speed-summary", speedSummary);

export default router;
