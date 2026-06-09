import fs from "fs";
const f = "artifacts/api-server/src/routes/index.ts";
let s = fs.readFileSync(f, "utf8");
if (!s.includes("requireAuth")) {
  s = s.replace(
    'import settingsRouter from "./settings";',
    'import settingsRouter from "./settings";\nimport { requireAuth } from "../lib/requireAuth";'
  );
  s = s.replace(
    "router.use(agentRunsRouter);",
    "router.use(requireAuth);\nrouter.use(agentRunsRouter);"
  );
  fs.writeFileSync(f, s);
  console.log("PATCHED");
} else {
  console.log("ALREADY PATCHED");
}
