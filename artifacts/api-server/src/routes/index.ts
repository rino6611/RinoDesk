import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import inboundEmailRouter from "./inboundEmail";
import ticketsRouter from "./tickets";
import agentRunsRouter from "./agentRuns";
import insightsRouter from "./insights";
import geminiRouter from "./gemini";
import settingsRouter from "./settings";
import collabRouter from "./collab";
import trackerRouter from "./tracker";
import { requireAuth } from "../lib/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(inboundEmailRouter);
router.use(ticketsRouter);

router.use(requireAuth);
router.use(collabRouter);
router.use(trackerRouter);
router.use(agentRunsRouter);
router.use(insightsRouter);
router.use(geminiRouter);
router.use(settingsRouter);

export default router;
