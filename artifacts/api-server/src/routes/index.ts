import { Router, type IRouter } from "express";
import healthRouter from "./health";
import twinbossRouter from "./twinboss";

const router: IRouter = Router();

router.use(healthRouter);
router.use(twinbossRouter);

export default router;
