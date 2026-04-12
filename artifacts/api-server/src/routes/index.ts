import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import uploadRouter from "./upload.js";
import personasRouter from "./personas.js";
import analyzeRouter from "./analyze.js";
import chatRouter from "./chat.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(personasRouter);
router.use(analyzeRouter);
router.use(chatRouter);

export default router;
