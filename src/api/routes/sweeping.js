import express from "express";
import { sweeping } from "../controllers/sweeping.js";

const router = express.Router();

router.get("/", sweeping);

export default router;
