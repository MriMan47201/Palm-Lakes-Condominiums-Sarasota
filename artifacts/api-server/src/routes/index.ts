import { Router, type IRouter } from "express";
import healthRouter from "./health";
import propertiesRouter from "./properties";

const router: IRouter = Router();

router.use(healthRouter);
router.use(propertiesRouter);

export default router;
