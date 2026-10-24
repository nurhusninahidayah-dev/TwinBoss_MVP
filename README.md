# TwinBoss

TwinBoss is a small React + Vite demo for handling SME refund exceptions with a human in the loop. It uses synthetic customer/request data, local React state, and (when configured) the Groq API for a recommendation and a WhatsApp message draft.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. For AI features, copy `.env.example` to `.env` and add a Groq API key from the free tier:

   ```env
   VITE_GROQ_API_KEY=your_groq_api_key
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

Without a key, the dashboard and Staff/Boss handoff still work; AI actions show a setup message. Restart the dev server after changing `.env`.

## Demo flow

1. In Staff Mode, submit the fictional RM150 damaged-item refund request.
2. Switch to Boss Mode and generate the AI recommendation.
3. Choose Approve Cash, Offer Store Credit, or Reject.
4. Review the generated WhatsApp draft and the decision receipt in the activity log.

The recommendation and customer message use the Groq Chat Completions API with `llama3-8b-8192`, as configured in `src/App.tsx`. If Groq no longer offers this model to your account, change the model ID there to one currently available on your Groq free tier.

## Important demo limits

- All customer and request details are fictional.
- Requests, decisions, and receipts exist only in React memory and reset when the page reloads.
- WhatsApp messages are drafts only; this app does not send messages, issue refunds, or connect to a payment provider.
- Staff/Boss Mode is a presentation toggle, not authentication or access control.
- `VITE_GROQ_API_KEY` is bundled into browser code and is visible to anyone using the app. Use only a disposable, rate-limited demo key; never use this client-side setup for a production secret.
- Only the Groq API is called, and only when an AI action is requested. The rest of the app runs locally.

## Commands

- `npm run dev` — start Vite's local development server.
- `npm run typecheck` — check the TypeScript app.
- `npm run build` — typecheck and create a production build in `dist/`.
- `npm run preview` — preview the production build locally.
