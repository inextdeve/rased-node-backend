import express from "express";
import {
  contracts,
  getContract,
  putContract,
} from "../controllers/contracts.js";

const router = express.Router();

router.get("/", contracts);
router.get("/:id", getContract);
router.put("/:id", putContract);
// router.post("/:id/companies", postRfidTag);
export default router;
