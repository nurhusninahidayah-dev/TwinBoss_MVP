# 🚀 TwinBoss: The SME Owner's Digital Twin
**Tagline:** Less Busywork, Better Business.

**SDC Hackathon 2026 - Domain 2 (Orbyte Smart SME Challenge)**
**Sponsored by:** Alpha Red Solutions (Orbyte)

---

## 📌 1. The Problem
Micro and small business (SME) owners in Malaysia are the biggest bottleneck in their own operations. They suffer from severe decision fatigue, constantly manually approving minor operational tasks like customer refunds and return exceptions.

Current e-commerce platforms often shift the financial burden of "no-reason" refunds onto the seller. Scammers exploit this by returning worn items, empty boxes, or claiming items never arrived, leaving SME owners to manually gather evidence and fight disputes within strict deadlines. If the owner is busy, the business stalls, and money is lost to fraud.

## 💡 2. The Solution: TwinBoss
TwinBoss is a secure, AI-powered delegation plugin designed specifically for the Orbyte ecosystem. It transforms the refund process into a fraud-resistant, 3-tier **Maker-Checker workflow**:

1. **Customer Portal:** Submits the order ID, issue description, bank details, and photo evidence.
2. **Staff Verification (The Maker):** Our AI acts as a Fraud & Validity Engine, verifying the evidence against the Orbyte CRM before sending it to the Boss.
3. **Boss Approval (The Checker):** The Boss reviews the AI's recommendation and makes the final business decision. 
4. **Staff Execution:** Once approved, the Staff triggers the payment and sends the WhatsApp notification.

---

## ✨ 3. Core Features (The "Wow" Factors)
*   🛡️ **AI Fraud Engine:** Assigns a Validity Score (0-100%) by cross-referencing the customer's name with the order record, checking for missing photos, and preventing double-refunds.
*   📜 **The Business Constitution:** The AI doesn't just guess. It applies strict business rules: VIP customers get Cash Refunds (retention), while Regular customers over RM50 get Store Credit (cash flow protection).
*   🤖 **Auto-Pilot (CCTV Mode):** The Boss can toggle Auto-Pilot. Low-risk requests under RM100 with >70% validity are automatically approved, allowing the owner to simply monitor the activity log like a security guard watching CCTV.
*   🔒 **Maker-Checker Security:** Separation of duties. The Boss only approves financial actions; the Staff must execute the payment. This prevents insider fraud.
*   💬 **WhatsApp Integration:** Generates a polite, pre-filled WhatsApp message draft with a real `wa.me` link for the Staff to send to the customer.

---

## 🧪 4. How to Test TwinBoss (Judge Demo Guide)

> ⚠️ **IMPORTANT REMINDER FOR ALL SCENARIOS:** 
> Please make sure to **upload any random image** (e.g., a screenshot or a random picture from your computer) in the "Upload Photo of Damage" field. If you skip the photo upload, the AI will correctly flag the request as **"High Risk / Missing Evidence"** and lower the Validity Score.

To ensure you experience the full Maker-Checker workflow and our AI Fraud Detection, please use the following synthetic test credentials in the **Customer Portal**:

### 🟢 Scenario 1: The "Happy Path" (VIP Customer)
*   **Customer Name:** `Siti`
*   **Order ID:** `ORD-101` (Emerald Silk Dress - RM150)
*   **Issue:** "Hi, the dress arrived with a tear at the seam. I would like a refund."
*   **Action:** **Upload any image** (to pass the evidence check).
*   **Expected Result:** The AI will match the name to the database, verify the evidence, and grant a **High Validity Score**. The Staff can verify and send to the Boss for approval.

### 🔴 Scenario 2: The "Fraud Block" (Already Refunded)
*   **Customer Name:** `Kumar`
*   **Order ID:** `ORD-103` (Wool Winter Coat - RM250)
*   **Issue:** "I want to return this coat."
*   **Action:** **Upload any image**.
*   **Expected Result:** The system will instantly flag this as **0% Validity** because `ORD-103` is marked as `isRefunded: true` in our mock Orbyte database. The AI will block the request to prevent double-dipping fraud.

### 🟡 Scenario 3: The "Identity Mismatch" (Potential Scam)
*   **Customer Name:** `Bob` (Note: Bob is not the owner of this order)
*   **Order ID:** `ORD-102` (Linen Casual Shirt - RM80)
*   **Issue:** "I want my money back."
*   **Action:** **Upload any image**.
*   **Expected Result:** The AI will detect that the input name "Bob" does not match the database name "Ali". It will cap the Validity Score at 20% and flag a **Name Mismatch / High Risk**.

*(Note: All bank details entered are completely synthetic and no real money is processed. You can use fake numbers like "Maybank 12345678").*

---

## 🛠️ 5. Tech Stack & Architecture
*   **Frontend:** React 18, Vite, TypeScript, Tailwind CSS.
*   **AI Engine:** Groq API using the `openai/gpt-oss-20b` model for ultra-fast, strict JSON reasoning.
*   **State Management:** React `useState` (in-memory for predictable demo resets).
*   **Hosting:** Replit (Static Deployment).

## 🟢 6. Orbyte Ecosystem Integration
As per the Domain 2 guidelines, we do not have live access to the Orbyte platform, so we built a **Mock Orbyte Gateway** using 100% synthetic data.
*   **Connected to Orbyte Hub Badges:** Visual indicators prove TwinBoss is a native plugin.
*   **CRM Data Lookup:** The AI pulls customer tiers and order history from our mock hub.
*   **Activity Logs:** Every decision generates a timestamped receipt (e.g., `OB-1234`) simulating a push back to the Orbyte Activity Log.

## 📈 7. SDG Alignment
*   **SDG 8 (Decent Work and Economic Growth):** Empowers micro-SMEs to operate efficiently, prevent financial loss from fraud, and avoid owner burnout.
*   **SDG 9 (Industry, Innovation, and Infrastructure):** Brings safe, governed, and accessible AI automation to traditional businesses.

## 🛡️ 8. Security & Compliance
*   **PDPA Compliant:** 100% synthetic data. No real customer or financial records are used.
*   **Prompt Injection Defense:** The AI system prompt strictly instructs the model to treat customer text as "untrusted data" and ignore embedded malicious instructions.
*   **Client-Side API Key Note:** For this hackathon MVP, the `VITE_GROQ_API_KEY` is bundled client-side. In a production deployment, this would be routed through a secure backend proxy.

## 🛣️ 9. Future Roadmap (Universal Decision Engine)
While this MVP focuses strictly on Refund Exceptions (per the Domain 2 brief), the core Trust Engine is industry-agnostic. Future iterations will support:
*   **Supplier Payment Chasing:** AI verifies invoices against order records.
*   **E-Invoicing Validation:** AI cleanses data before submission to LHDN.

---

## 🚀 10. How to Run Locally
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
