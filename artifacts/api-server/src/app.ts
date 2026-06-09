import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET || "dev-insecure-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 },
  }),
);

app.use("/api", router);

// Production: serve the built React app from this same server (single deploy).
const clientDir = path.join(__dirname, "../../rinodesk/dist/public");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/")) {
      return res.sendFile(path.join(clientDir, "index.html"));
    }
    next();
  });
}

export default app;
