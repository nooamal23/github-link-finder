import { Router } from "express";
import * as competitionsController from "../../controllers/admin/competitions.controller.js";

export const competitionsRouter = Router();

competitionsRouter.get("/", competitionsController.list);
competitionsRouter.post("/", competitionsController.create);
competitionsRouter.put("/:id", competitionsController.update);
competitionsRouter.delete("/:id", competitionsController.remove);