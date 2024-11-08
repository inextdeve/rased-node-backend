import express from "express";
import {
  companies,
  getCompany,
  postCompany,
  putCompany,
  getCompanyContracts,
  deleteCompany,
} from "../controllers/companies.js";

const router = express.Router();

router.get("/", companies);
router.get("/:id", getCompany);
router.delete("/:id", deleteCompany);
router.get("/:id/contracts", getCompanyContracts);
router.put("/:id", putCompany);
router.post("/", postCompany);
export default router;
