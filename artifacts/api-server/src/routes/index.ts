import { Router, type IRouter } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(jobsRouter);
router.use(storageRouter);

export default router;
