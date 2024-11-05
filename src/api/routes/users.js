import express from "express";
import { userOwner } from "../controllers/users.js";

const router = express.Router();

router.get("/owner", userOwner);

export default router;
