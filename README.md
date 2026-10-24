🚀 TwinBoss: The SME Owner's Digital Twin
Tagline: Less Busywork, Better Business.

SDC Hackathon 2026 - Domain 2 (Orbyte Smart SME Challenge)
Sponsored by: Alpha Red Solutions (Orbyte)

📌 1. The Problem
Micro and small business (SME) owners in Malaysia are the biggest bottleneck in their own operations. They suffer from severe decision fatigue, constantly manually approving minor operational tasks like customer refunds and return exceptions.

Current e-commerce platforms often shift the financial burden of "no-reason" refunds onto the seller. Scammers exploit this by returning worn items or empty boxes, leaving SME owners to manually gather evidence and fight disputes within strict deadlines. If the owner is busy, the business stalls, and money is lost to fraud.

💡 2. The Solution: TwinBoss
TwinBoss is a secure, AI-powered delegation plugin designed specifically for the Orbyte ecosystem. It transforms the refund process into a fraud-resistant, 3-tier Maker-Checker workflow:

Customer Portal: Submits the order ID, phone number, bank details, and photo evidence.

Staff Verification (The Maker): Our AI acts as a Fraud & Validity Engine, verifying the evidence against the Orbyte CRM before sending it to the Boss.

Boss Approval (The Checker): The Boss reviews the AI's recommendation and makes the final business decision.

Staff Execution: Once approved, the Staff triggers the payment and sends the WhatsApp notification.

✨ 3. Core Features (The "Wow" Factors)
🛡️ AI Fraud Engine: Assigns a Validity Score (0-100%) by cross-referencing the customer's name with the order record, checking for missing photos, and preventing double-refunds.

📜 The Business Constitution: The AI doesn't just guess. It applies strict business rules: VIP customers get Cash Refunds (retention), while Regular customers over RM50 get Store Credit (cash flow protection).

🤖 Auto-Pilot (CCTV Mode): The Boss can toggle Auto-Pilot. Low-risk requests under RM100 with >70% validity are automatically approved, allowing the owner to simply monitor the activity log.

🔒 Maker-Checker Security: Separation of duties. The Boss only approves financial actions; the Staff must execute the payment. This prevents insider fraud.

💬 WhatsApp Integration: Generates a polite, pre-filled WhatsApp message draft with a real wa.me link for the Staff to send to the customer.

🛠️ 4. Tech Stack & Architecture
Frontend: React 18, Vite, TypeScript, Tailwind CSS.

AI Engine: Groq API using the openai/gpt-oss-20b model for ultra-fast, strict JSON reasoning.

State Management: React useState (in-memory for predictable demo resets).

Hosting: Replit (Static Deployment).

🟢 5. Orbyte Ecosystem Integration
As per the Domain 2 guidelines, we do not have live access to the Orbyte platform, so we built a Mock Orbyte Gateway using 100% synthetic data.

Connected to Orbyte Hub Badges: Visual indicators prove TwinBoss is a native plugin.

CRM Data Lookup: The AI pulls customer tiers and order history from our mock hub.

Activity Logs: Every decision generates a timestamped receipt (e.g., OB-1234) simulating a push back to the Orbyte Activity Log.

📈 6. SDG Alignment
SDG 8 (Decent Work and Economic Growth): Empowers micro-SMEs to operate efficiently, prevent financial loss from fraud, and avoid owner burnout.

SDG 9 (Industry, Innovation, and Infrastructure): Brings safe, governed, and accessible AI automation to traditional businesses.

🛡️ 7. Security & Compliance
PDPA Compliant: 100% synthetic data. No real customer or financial records are used.

Prompt Injection Defense: The AI system prompt strictly instructs the model to treat customer text as "untrusted data" and ignore embedded malicious instructions.

Client-Side API Key Note: For this hackathon MVP, the VITE_GROQ_API_KEY is bundled client-side. In a production deployment, this would be routed through a secure backend proxy.

🛣️ 8. Future Roadmap (Universal Decision Engine)
While this MVP focuses strictly on Refund Exceptions (per the Domain 2 brief), the core Trust Engine is industry-agnostic. Future iterations will support:

Supplier Payment Chasing: AI verifies invoices against order records.

E-Invoicing Validation: AI cleanses data before submission to LHDN.

🚀 9. How to Run Locally
Clone this repository.

Install dependencies:
npm install

Create a .env file in the root directory and add your Groq API key:
VITE_GROQ_API_KEY=gsk_your_key_here

Start the development server:
npm run dev

