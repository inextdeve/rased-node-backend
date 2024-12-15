import express from "express";
import {
  DELETE_PERMISSION,
  POST_PERMISSION,
} from "../controllers/permissions.js";

const router = express.Router();

router.post("/", POST_PERMISSION);
router.delete("/", DELETE_PERMISSION);
export default router;
