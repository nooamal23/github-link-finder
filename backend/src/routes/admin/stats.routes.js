import { Router } from "express";
import * as statsController from "../../controllers/admin/stats.controller.js";

export const statsRouter = Router();

statsRouter.get("/", statsController.get);