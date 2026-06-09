# RinoDesk AgentOS — Local Setup

A multi-agent AI customer-support tool. The backend (Express + Postgres) runs
5 Gemini agents per ticket; the frontend is React + Vite.

This copy has been cleaned up to run outside Replit. See **"What changed"** at
the bottom for the exact differences from the original.

---

## 1. Prerequisites

- **Node.js 20 or newer** (the project targets 24, but 20+ works)
- **pnpm** — `npm install -g pnpm`
- **PostgreSQL** — a local install, a Docker container, or a free hosted DB
  (Neon / Supabase). You just need a connection string.
- **A Google Gemini API key** — free at https://aistudio.google.com/apikey
  (nothing AI-related works without this).

> No Postgres handy? Quick Docker option:
> `docker run --name rinodesk-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rinodesk -p 5432:5432 -d postgres:16`

## 2. Configure secrets

```bash
cp .env.example .env
```

Open `.env` and set:
- `DATABASE_URL` — your Postgres connection string
- `GEMINI_API_KEY` — your Gemini key

That's it — ports and base path have sensible defaults.

## 3. Install dependencies

```bash
pnpm install
```

(Use plain `pnpm install`, not `--frozen-lockfile` — a few tooling
dependencies were added, so the lockfile will refresh on first install.)

## 4. Create the database tables

```bash
pnpm db:push
```

This reads your `DATABASE_URL` and creates all tables (tickets, agent_runs,
insights, conversations, messages, settings).

## 5. (Optional) Add sample data

```bash
pnpm db:seed
```

Inserts 5 example tickets so the dashboard/inbox aren't empty. You can skip
this and create your own tickets from the **/submit** page instead.

## 6. Run it

```bash
pnpm dev
```

This starts **both** servers at once:
- API → http://localhost:8080
- Web → http://localhost:20290  ← open this in your browser

Prefer separate terminals? Run `pnpm dev:api` and `pnpm dev:web`.

---

## How it works (the flow)

1. **A ticket comes in** — created via the `/submit` page, the "New ticket"
   button in the inbox, or the seed script.
2. **You trigger processing** on a ticket. The API runs 5 Gemini agents in
   sequence and streams their progress live to the UI:
   - **TicketReader** — categorizes the ticket and summarizes it
   - **PolicyResearcher** — identifies relevant policies and guidance
   - **ResponseDrafter** — writes a draft reply you can edit and send
   - **EscalationDetector** — scores escalation risk (and can fire a Slack
     alert if you've set a webhook in Settings)
   - **InsightsGenerator** — runs separately, on the Insights page, to find
     business patterns across tickets
3. **Every agent run is stored** in the `agent_runs` table for an audit trail
   and the performance numbers on the dashboard.
4. **Agent Chat** is a standalone Gemini chat with streaming responses.

The pages: **Dashboard** (stats), **Tickets** (inbox + processing),
**Ticket Detail** (agent outputs + editable draft), **Insights**, **Chat**,
**Settings** (e.g. Slack webhook), **Submit** (public ticket form).

---

## Troubleshooting

- **API calls 404 / "failed to fetch"** — make sure the API server is
  actually up on 8080. The frontend proxies `/api` there (configurable via
  `API_TARGET`).
- **Server won't start, "DATABASE_URL must be set"** — your `.env` isn't being
  read. Run via the root `pnpm dev` / `pnpm db:*` scripts (they load `.env`),
  or export the vars manually.
- **Gemini errors / "GEMINI_API_KEY must be set"** — check the key in `.env`.
- **Port already in use** — set `PORT` (API) or `PORT`/`BASE_PATH` (web) in
  your environment to override the defaults.

---

## Windows notes (read this first if you're on Windows)

- **Don't keep the project inside OneDrive** (e.g. `OneDrive\Desktop\...`).
  OneDrive locks files mid-sync and breaks `node_modules`. Put it somewhere
  plain like `C:\dev\rinodesk-app`.
- This copy is already patched for Windows: the Linux-only build settings and
  the `sh`-based scripts that crash PowerShell have been removed, and the
  native-binary downloads for Windows are enabled. A plain `pnpm install`
  should just work — you should **not** need `pnpm approve-builds`.
- If the zip extracted as a folder-inside-a-folder
  (`rinodesk-app\rinodesk-app`), open the **inner** one — it's the one with
  `package.json` in it.

---

## What changed vs. the original Replit export

- **Vite dev proxy added** so the frontend's `/api` calls reach the backend
  locally (this was the main thing stopping it from running off-Replit).
- **PORT / BASE_PATH now default** (8080 / 20290 / "/") instead of throwing,
  so it runs without Replit's injected env.
- **One-command dev** — root `pnpm dev` runs both servers; `pnpm db:push` and
  `pnpm db:seed` load `.env` automatically (via `dotenv-cli` + `concurrently`).
- **`.env.example` added** documenting the two required secrets.
- **Seed script added** (`lib/db/src/seed.ts`) for instant sample data.
- **Removed dead code** — `use-sse.ts` (used GET-only EventSource against
  POST endpoints; unused).
- **Windows compatibility** — removed the `sh`-based `preinstall` script and
  the `export NODE_ENV` dev script (both crash PowerShell), added
  `@google/genai` and `protobufjs` to the build-approval list, and removed the
  Replit "Linux-only" overrides that deleted the Windows native binaries
  (esbuild/rollup/etc.). Installs cleanly on Windows, macOS, and Linux now.
- **Removed `artifacts/mockup-sandbox`** — an unrelated scratch app.
- Stripped `node_modules`, build output, and caches to keep the download small.
