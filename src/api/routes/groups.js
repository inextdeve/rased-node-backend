import express from "express";
import { groups } from "../controllers/groups.js";

const router = express.Router();

router.get("/", groups);

export default router;
