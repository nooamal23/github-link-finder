import { Router } from "express";
import { usersRouter } from "./users.routes.js";
import { coursesRouter } from "./courses.routes.js";
import { newsRouter } from "./news.routes.js";
import { competitionsRouter } from "./competitions.routes.js";
import { galleryRouter } from "./gallery.routes.js";
import { boardRouter } from "./board.routes.js";
import { financeRouter } from "./finance.routes.js";
import { statsRouter } from "./stats.routes.js";
import { registrationRequestsRouter } from "./registration-requests.routes.js";

export const adminRouter = Router();

adminRouter.use("/users", usersRouter);
adminRouter.use("/courses", coursesRouter);
adminRouter.use("/news", newsRouter);
adminRouter.use("/competitions", competitionsRouter);
adminRouter.use("/gallery", galleryRouter);
adminRouter.use("/board", boardRouter);
adminRouter.use("/finance", financeRouter);
adminRouter.use("/stats", statsRouter);
adminRouter.use("/registration-requests", registrationRequestsRouter);