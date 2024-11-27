import express from "express";
import { summary, nearbyStops } from "../controllers/devices.js";

const router = express.Router();

router.get("/summary", summary);

router.get("/nearby-stops", nearbyStops);

// router.get("/speed-summary", speedSummary);

export default router;
