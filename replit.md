# RinoDesk AgentOS

A multi-agent AI workforce platform for customer support teams. Instead of giving agents another chatbot, RinoDesk gives them an AI team that reads tickets, researches policies, drafts responses, detects escalations, and generates business insights automatically.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/rinodesk run dev` — run the frontend (port 20290)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `GEMINI_API_KEY` — Google Gemini API key for all AI agent features

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: Google Gemini via `@google/genai` (model: `gemini-2.5-flash`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle ORM table definitions (tickets, agentRuns, insights, conversations, messages)
- `artifacts/api-server/src/routes/` — Express route handlers (tickets, insights, agentRuns, gemini)
- `artifacts/api-server/src/lib/gemini.ts` — Gemini AI client (uses GEMINI_API_KEY directly)
- `artifacts/rinodesk/src/pages/` — React pages (dashboard, tickets, ticket-detail, insights, chat)
- `artifacts/rinodesk/src/components/layout.tsx` — Global sidebar/topbar navigation

## Architecture decisions

- Gemini client uses GEMINI_API_KEY directly (not via Replit AI Integrations proxy — user provided own key)
- AI agent pipeline streams SSE events per-agent so UI shows live progress
- 5 AI agents run sequentially per ticket: TicketReader → PolicyResearcher → ResponseDrafter → EscalationDetector (InsightsGenerator runs separately on demand)
- All agent outputs stored in `agent_runs` table for audit trail and performance metrics
- Frontend uses fetch + ReadableStream for SSE endpoints (Orval can't generate typed hooks for SSE)

## Product

- **Dashboard** — live ticket stats, agent performance, recent insights, category breakdown
- **Ticket Inbox** — list/filter tickets, trigger AI processing with live streaming status
- **Ticket Detail** — view AI agent outputs (summary, policies, draft response, escalation risk), edit draft, send response
- **Insights** — AI-generated business intelligence from ticket patterns, with live streaming generation
- **Agent Chat** — full Gemini-powered conversation interface with streaming responses

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Gemini integration template client (`lib/integrations-gemini-ai/src/client.ts`) uses `AI_INTEGRATIONS_GEMINI_BASE_URL` — we bypass it and use `artifacts/api-server/src/lib/gemini.ts` with `GEMINI_API_KEY` instead
- SSE endpoints: `/api/tickets/:id/process`, `/api/insights` (POST), `/api/gemini/conversations/:id/messages` (POST)
- After any OpenAPI spec change, re-run codegen before using updated types

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
