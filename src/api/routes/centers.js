import express from "express";
import {
  addCenter,
  centers,
  editCenter,
  deleteCenter,
} from "../controllers/centers.js";

const router = express.Router();

router.get("/", centers);
router.put("/", addCenter);
router.patch("/", editCenter);
router.delete("/", deleteCenter);

export default router;
