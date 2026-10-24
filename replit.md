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
- Follow the Domain 2 brief: use only team-created synthetic data, simulate role permissions, focus the demo on Refund Exceptions, and do not imply access to the live Orbyte platform.

## Product

TwinBoss focuses on refund exceptions for Malaysian micro and small businesses. Staff submit a refund request; TwinBoss combines synthetic customer context and owner rules for an explainable Groq recommendation; the owner approves, chooses store credit, or rejects; the result is recorded in a decision receipt.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run API code generation after every OpenAPI change before using generated types.
- Use only team-created synthetic records in the demo. Recommendation requests send request descriptions and customer context to Groq.
- If a requirement is unclear, ask the user before choosing an interpretation. Follow the attached Domain 2 brief and keep the design original rather than copying Orbyte or another product's screens.
- Make commits at genuine, tested milestones with messages that describe the actual work; never split changes to misrepresent who or what contributed them.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
