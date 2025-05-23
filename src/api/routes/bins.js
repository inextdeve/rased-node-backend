import express from "express";
import {
  bins,
  binById,
  binReports,
  binCategorized,
  summary,
  updateBin,
  addBin,
  deleteBin,
  updateBinStatus,
  putBin,
  categorizedBins,
} from "../controllers/bins.js";
import cache from "../middlewares/cache.js";

const router = express.Router();

router.use(cache(120, "json"));

router.get("/", bins);
router.get("/reports", binReports);
router.get("/summary", summary);
router.get("/categorized", categorizedBins);
router.get("/by/:category", binCategorized);
router.get("/:id", binById);

router.put("/:id", putBin);

router.post("/", addBin);
router.patch("/", updateBin);
router.patch("/status", updateBinStatus);
router.delete("/:id", deleteBin);

export default router;
