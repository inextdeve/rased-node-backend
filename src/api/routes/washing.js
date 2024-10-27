import express from "express";
import { summary, washingCategorized } from "../controllers/washing.js";

const router = express.Router();

router.get("/summary", summary);
router.get("/by/:category", washingCategorized);

export default router;
