# 🚀 TwinBoss: The SME Owner's Digital Twin
**Tagline:** *Less Busywork, Better Business.*

**SDC Hackathon 2026 - Domain 2 (Orbyte Smart SME Challenge)**
**Sponsored by:** Alpha Red Solutions Sdn Bhd

---

## 📌 1. The Problem
Micro and small business (SME) owners are the bottleneck of their own operations. They suffer from **decision fatigue**, constantly having to approve minor operational exceptions (e.g., a VIP customer requesting a refund for a returned dress with missing tags). 

If the owner is busy, the business stalls, staff are left waiting, and customers leave frustrated. Current generic AI solutions are too risky—SME owners are terrified of AI hallucinating and giving away their money without human oversight.

## 💡 2. The Solution: TwinBoss
TwinBoss is an AI-powered delegation plugin designed specifically for the **Orbyte ecosystem**. It acts as the owner's "Digital Twin." 

Instead of just acting as a dumb "Yes/No" automation bot, TwinBoss acts as a **Trust Engine**. When a staff member submits an exception request, TwinBoss pulls data from the Orbyte hub, analyzes it against the owner's rules, and presents the Boss with a **Counterfactual Choice** (e.g., 'Approve Cash', 'Offer Store Credit', or 'Reject'). The AI explains *why* it made the recommendation, and the Boss makes the final click.

## ⚙️ 3. The Automated Journey (Domain 2 Requirements)
TwinBoss perfectly hits all the must-have criteria for Domain 2:
1.  **Trigger:** A staff member submits an exception request via the UI (e.g., "Siti requests a RM150 refund, no tags").
2.  **Connected Data (Mock Orbyte):** The backend queries our SQLite database (simulating the Orbyte Hub) to check Siti's customer tier (VIP) and the Boss's predefined rules.
3.  **Decision Logic (AI):** The **Groq API (Llama 3)** analyzes the data and generates a structured JSON recommendation with a Confidence Score.
4.  **Human Approval (RBAC):** The Boss sees the AI's reasoning on a dashboard and uses Role-Based Access Control to approve or override the decision.
5.  **Visible Outcome:** A **Decision Receipt** is generated, timestamped, and logged as an activity record (simulating a push back to Orbyte).

## ✨ 4. The "Wow" Features
*   **Explainable AI:** The AI never just says "Approve." It provides a 1-sentence reasoning (e.g., *"Siti is a VIP customer and the amount is under your RM200 rule."*).
*   **Counterfactual Choices:** Gives the Boss strategic alternatives (Cash Refund vs. Store Credit) to protect cash flow.
*   **Decision Receipts:** Generates a detailed log of exactly *why* the AI recommended an action, bridging the AI Trust Gap.
*   **Confidence-Aware Escalation:** (Future Roadmap) If the AI's confidence is low, it flags the request in red for manual human review.

## 🛠️ 5. Tech Stack
*   **Hosting & Environment:** [Replit](https://replit.com)
*   **Backend:** Python (Flask)
*   **Database:** SQLite (Acts as the Mock Orbyte Hub with 100% synthetic data)
*   **AI Engine:** [Groq API](https://console.groq.com/) (Llama 3 8B) for lightning-fast, strict JSON structured outputs.
*   **Frontend:** HTML / CSS / JavaScript

## 🚀 6. How to Run the Prototype
1.  Clone this repository.
2.  Create a `.env` file or use Replit Secrets to add your Groq API key:
    ```env
    GROQ_API_KEY=your_gsk_key_here

    Install dependencies:

bash
Copy
Download
pip install -r requirements.txt
Run the application:

bash
Copy
Download
python main.py
📈 7. SDG Alignment
SDG 8 (Decent Work and Economic Growth): Empowers micro-SMEs to operate efficiently without burning out the owner.

SDG 9 (Industry, Innovation, and Infrastructure): Brings safe, accessible, and governed AI automation to traditional businesses.

🛡️ 8. Data Privacy & Compliance
This project uses 100% synthetic/mock data as required by the hackathon rules. No real customer, company, or personal records are used. In a real production deployment, the system would comply with Malaysia's PDPA by ensuring all customer data remains encrypted within the Orbyte workspace, and no PII is sent to third-party LLMs without anonymization.

9. Future Roadmap & Scalability (The "Universal Decision Engine")
While our MVP focuses strictly on one clear use case (VIP Refund Exceptions) as required by the Domain 2 brief, the underlying architecture of TwinBoss is a Universal Decision Engine.

The core loop—Trigger → Orbyte Data → AI Logic → Human Approval → Decision Receipt—is entirely platform-agnostic. Because we designed the AI logic to be modular, the exact same Trust Engine can be applied to other high-friction SME decision-making workflows.

Future Roadmap (Post-Hackathon):

Supplier Payment Chasing: AI drafts payment chasers for overdue invoices and recommends whether to escalate to a phone call.

E-Invoicing Data Validation: AI extracts data from receipts, validates it against LHDN rules, and asks the Boss to approve the final submission.

Staff Leave Exceptions: AI checks the SME's operational calendar and recommends whether to approve a staff leave request during a busy period.

By keeping the MVP focused, we prove the concept works flawlessly. By designing for scalability, we prove TwinBoss can become a permanent, high-value plugin on the Orbyte ecosystem.

Built with ❤️ by kpmbians for SDC Hackathon 2026.


