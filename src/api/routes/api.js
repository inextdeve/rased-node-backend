import express from "express";
import binsRouter from "./bins.js";
import washingRouter from "./washing.js";
import devicesRouter from "./devices.js";
import statisticsRouter from "./statistics.js";
import routesRouter from "./routes.js";
import centersRouter from "./centers.js";
import typesRouter from "./types.js";
import supervisorRouter from "./supervisors.js";
import rfidTagsRouter from "./rfidTags.js";
import usersRouter from "./users.js";
import companiesRouter from "./companies.js";
import contractsRouter from "./contracts.js";
import connectionsRouter from "./connections.js";
import contractorsRouter from "./contractors.js";
import sweepingRouter from "./sweeping.js";
import permissionsRouter from "./permissions.js";
import eventsRouter from "./events.js";

import auth from "../middlewares/auth.js";

const router = express.Router();
router.use(auth);

router.use("/sweeping", sweepingRouter);
router.use("/bins", binsRouter);
router.use("/washing", washingRouter);
router.use("/devices", devicesRouter);
router.use("/statistics", statisticsRouter);
router.use("/routes", routesRouter);
router.use("/centers", centersRouter);
router.use("/binstypes", typesRouter);
router.use("/supervisors", supervisorRouter);
router.use("/rfid_tags", rfidTagsRouter);
router.use("/users", usersRouter);
router.use("/companies", companiesRouter);
router.use("/contracts", contractsRouter);
router.use("/connections", connectionsRouter);
router.use("/contractors", contractorsRouter);
router.use("/permissions", permissionsRouter);
router.use("/events", eventsRouter);

export default router;
