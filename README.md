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

## Customer → Staff → Owner workflow

1. Open the Customer Portal and enter an order ID, issue description, optional damage photo, and bank destination.
2. Log in as Staff (Ahmad), select the new request, and review its AI extraction and completeness score.
3. Verify the request to send it to the Owner Approval Queue.
4. The Owner can review the recommendation and choose Approve Cash, Offer Store Credit, or Reject. A decision that differs from the AI recommendation requires an override reason.
5. With Auto-Pilot enabled, a request below RM50 and with a validity score above 90% is approved automatically and appears in the Activity Log.
6. Confirm cash refunds in the Payment Gateway preview. Staff can then send the WhatsApp draft and share the receipt.

AI extraction and customer-message drafting use the Groq Chat Completions API with `openai/gpt-oss-20b`, as configured in `src/App.tsx`. The prompt includes the local customer profile and VIP business rule. Drafts can be requested in English or Malaysian Malay (Bahasa Melayu).

## Workspace boundaries

- Customer profiles are local preview data; submitted requests and the wallet exist only in React memory and reset on refresh.
- The Orbyte Hub and CRM labels are visual integration previews. No Orbyte API or activity log is connected.
- The payment dialog creates a local transaction reference only. No bank transfer, WhatsApp message, or receipt is sent.
- Role selection is a workflow preview, not authentication or secure access control.
- The optional photo is checked for attachment only; its contents are not uploaded or sent to Groq.
- `VITE_GROQ_API_KEY` is bundled into browser code and visible to app users. Use only a disposable, rate-limited demo key; never use this client-side setup for a production secret.
- Only Groq is contacted, and only when an AI action is requested. The rest of the app runs locally.

## Commands

- `npm run dev` — start Vite's local development server.
- `npm run typecheck` — check the TypeScript app.
- `npm run build` — typecheck and create a production build in `dist/`.
- `npm run preview` — preview the production build locally.
