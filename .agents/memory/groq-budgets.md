---
name: Groq completion budgets
description: Avoid empty customer drafts when using reasoning models.
---
Give GPT-OSS customer-message requests enough completion tokens for both reasoning and the visible answer.

**Why:** A 220-token completion cap repeatedly returned no valid customer message, even though recommendation generation worked. Increasing the allowance with low reasoning effort passed the live refund regression.

**How to apply:** Bound visible length in the prompt and validate output separately; do not shrink the total completion budget to the desired visible message length.
