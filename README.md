# RinoDesk

An AI-native customer support platform — a smarter alternative to traditional helpdesks. Incoming tickets are automatically read, categorized, drafted, and risk-scored by a pipeline of Gemini AI agents, so support teams move faster with fewer things slipping through.

## Features

- AI agent pipeline — five Gemini agents read each ticket, research policy, draft a reply, and detect escalation risk
- Google sign-in — secure authentication; every page except the public submit form requires login
- Ticket inbox — searchable, filterable, sortable list with bulk "Run Agents" actions
- AI-assisted replies — write a draft and let the AI enhance it, grounded in your knowledge base
- Knowledge base — add your policies so AI replies stay accurate to your business
- Assignment & internal notes — assign tickets to teammates and leave private team notes
- Resolution tracker — every solved ticket is logged with the agent, date, customer, issue, and resolution
- Email-to-ticket — a webhook turns incoming support emails into tickets
- Insights & Slack alerts — AI-generated trends and escalation alerts to Slack

## Tech stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, PostgreSQL (Drizzle ORM)
- AI: Google Gemini
- Auth: Google Identity Services + session cookies

## Getting started

See SETUP.md for full instructions. In short: copy .env.example to .env, fill in DATABASE_URL and GEMINI_API_KEY, then run "pnpm install", "pnpm db:push", and "pnpm dev". The app runs at http://localhost:20290

## Project structure

- artifacts/api-server — Express API and AI agents
- artifacts/rinodesk — React frontend
- lib/db — database schema (Drizzle)
- lib — shared API client, types, and integrations
