# TwinBoss

TwinBoss helps Malaysian SME owners delegate small operational decisions without giving up final approval.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/twinboss run dev` — run the TwinBoss web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; `GROQ_API_KEY` — Groq recommendation requests

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React + Vite
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/twinboss/` — dashboard, staff portal, customer context, rules, and decision receipts
- `artifacts/api-server/src/routes/twinboss.ts` — request, recommendation, decision, and activity endpoints
- `artifacts/api-server/src/lib/groq.ts` — Groq chat-completion client and response validation
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/` — PostgreSQL tables for the TwinBoss demo data

## Architecture decisions

- The workspace uses React, Express, and PostgreSQL rather than the brief's proposed Flask and SQLite stack; it keeps the app inside the existing pnpm artifact structure.
- Groq recommendations use `openai/gpt-oss-120b`; the brief's Llama 3.3 model was retired. Keep `GROQ_API_KEY` in Replit Secrets.
- The owner always makes the final decision. A changed recommendation requires a reason, which is saved as an owner correction for future Groq recommendations.
- The Staff/Boss toggle is for demos only, not authentication or server-enforced RBAC.
- Customer records are mock Orbyte data; the displayed Orbyte sync is simulated and does not call an external Orbyte service.

## Product

Staff can submit refund, discount, and purchase requests. TwinBoss combines customer context and owner rules for an explainable Groq recommendation with alternatives. The owner can approve, choose store credit, or reject; every decision creates a receipt and appears in the activity trail.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run API code generation after every OpenAPI change before using generated types.
- Recommendation requests send request descriptions and customer context to Groq; use synthetic data until a privacy policy and production handling are defined.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
