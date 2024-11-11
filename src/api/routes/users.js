import express from "express";
import { getUser, isTokenUnique } from "../controllers/users.js";

const router = express.Router();

router.get("/token_unique", isTokenUnique);

router.get("/:id", getUser);

export default router;
