import express from "express";
import { binTagConnection } from "../controllers/connections.js";

const router = express.Router();

router.put("/bin_tag", binTagConnection);

export default router;
