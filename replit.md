# TwinBoss on Replit

## Run

- Use the **Start application** workflow (the Run button), which runs `npm run dev`.
- Vite serves the existing React app on `0.0.0.0:5000` and accepts Replit's preview proxy hosts.
- Dependencies use npm and the existing `package-lock.json`. Node.js 20 or newer is required.
- `npm run typecheck` checks TypeScript; `npm run build` checks types and creates `dist/`.

## Demo boundaries

The dashboard and Customer/Staff/Owner workflow run without external services or API keys. Requests, decisions, and wallet data are held in memory and reset on refresh. Role selection is a demo, not authentication. Payments, WhatsApp sending, and integrations are previews only.

Groq AI actions are optional and remain unconfigured in this setup. Without a key they show a setup message. The existing `VITE_GROQ_API_KEY` implementation exposes its key in browser code; do not configure a production secret this way. Move AI calls to a server before enabling them for real users.
