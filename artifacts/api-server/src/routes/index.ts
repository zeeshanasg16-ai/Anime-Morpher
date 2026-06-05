import { Router, type IRouter } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";
import storageRouter from "./storage";
import workerRouter from "./worker";

const router: IRouter = Router();

router.use(healthRouter);
router.use(jobsRouter);
router.use(storageRouter);
router.use(workerRouter);

export default router;
