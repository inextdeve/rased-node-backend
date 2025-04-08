import express from "express";
import {
  contracts,
  deleteContract,
  getContract,
  ManagmentContracts,
  postContract,
  putContract,
} from "../controllers/contracts.js";

const router = express.Router();

router.get("/", contracts);
router.get("/mngmt", ManagmentContracts);
router.get("/:id", getContract);
router.put("/:id", putContract);
router.delete("/:id", deleteContract);
router.post("/", postContract);
// router.post("/:id/companies", postRfidTag);
export default router;
