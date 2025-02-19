import express from "express";
import {
  deleteTag,
  getTag,
  postRfidTag,
  putTag,
  tags,
} from "../controllers/rfidTags.js";
import cache from "../middlewares/cache.js";

const router = express.Router();

router.use(cache(30, "json"));

router.get("/", tags);
router.get("/:id", getTag);
router.post("/", postRfidTag);
router.put("/:id", putTag);
router.delete("/:id", deleteTag);
export default router;
