import express from "express";
import binsRouter from "./bins.js";
import washingRouter from "./washing.js";
import devicesRouter from "./devices.js";
import statisticsRouter from "./statistics.js";
import routesRouter from "./routes.js";
import centersRouter from "./centers.js";
import typesRouter from "./types.js";
import supervisorRouter from "./supervisors.js";

import auth from "../middlewares/auth.js";
import moment from "moment";

const router = express.Router();
router.use(auth);
router.use((req, _, next) => {
  if (!req.query.from)
    req.query.from = moment().format().split("T")[0] + "T00:00";
  next();
});

router.use("/bins", binsRouter);
router.use("/washing", washingRouter);
router.use("/devices", devicesRouter);
router.use("/statistics", statisticsRouter);
router.use("/routes", routesRouter);
router.use("/centers", centersRouter);
router.use("/types", typesRouter);
router.use("/supervisors", supervisorRouter);
export default router;
