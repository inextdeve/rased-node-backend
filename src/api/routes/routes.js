import express from "express";
import {
  addRoute,
  deleteRoute,
  editRoute,
  routes,
} from "../controllers/routes.js";

const router = express.Router();

router.get("/", routes);
router.put("/", addRoute);
router.patch("/", editRoute);
router.delete("/", deleteRoute);

export default router;
