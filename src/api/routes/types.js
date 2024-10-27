import express from "express";
import { addType, editType, types, deleteType } from "../controllers/types.js";

const router = express.Router();

router.get("/", types);
router.put("/", addType);
router.patch("/", editType);
router.delete("/", deleteType);

export default router;
