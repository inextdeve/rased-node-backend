import express from "express";
import {
  contractors,
  deleteContractor,
  getContractor,
  getContractorCompanies,
  parentContractors,
  postContractor,
  putContractor,
} from "../controllers/contractors.js";

const router = express.Router();

router.get("/", contractors);
router.get("/parents", parentContractors);
router.get("/:id", getContractor);
router.delete("/:id", deleteContractor);
router.get("/:id/companies", getContractorCompanies);
router.put("/:id", putContractor);
router.post("/", postContractor);
export default router;
