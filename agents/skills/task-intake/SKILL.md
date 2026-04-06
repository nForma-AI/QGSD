# task-intake skill

Purpose
-------
Create a small, opinionated pipeline that converts a user request or idea into a ready-to-open GitHub/GitLab issue. The goal is to remove ambiguity, normalize language, and produce structured issue content (title, description, user story, acceptance criteria, light task decomposition, difficulty estimate, and routing recommendation).

When to use
-----------
- User gives a request, bug report, feature idea, meeting note, or voicemail that should become an issue
- Product manager or engineer wants a consistent issue template from informal input

High-level steps the skill should follow
--------------------------------------
1) Understand intent
  - Read the user's raw input
  - Extract the actual desire / problem; remove noise and ambiguous phrasing

2) Normalize into a task
  - Provide a short, actionable title (<= 70 chars)
  - Describe the problem in 2-4 sentences
  - Provide a one-line user story: "As a <role>, I want <capability>, so that <benefit>"

3) Define "done"
  - Generate 3–6 acceptance criteria framed as testable statements (Given/When/Then or bullet checks)

4) Light decomposition
  - Break the work into 3–6 small steps (not an implementation plan)

5) Assess difficulty
  - Assign size: S / M / L / XL
  - Give 2–4 sentence reasoning addressing scope, ambiguity, risk, and required context

6) Route the work
  - Recommend executor: Copilot/GPT-5-mini (simple), Codex (execution-heavy), Claude (complex/ambiguous), Gemini (large context)
  - Give brief rationale for routing

Output format
-------------
Always return a JSON object (for programmatic consumption) with the following keys:

- title: string
- description: string
- user_story: string
- acceptance_criteria: array of strings
- decomposition: array of strings
- difficulty: one of ["S","M","L","XL"]
- difficulty_reasoning: string
- routing: {"executor": string, "reason": string}
- original_input: string
- suggested_labels: array of strings (optional)

Best practices / rules
----------------------
- Prefer clarity and brevity. Titles should be <= 70 chars when possible.
- Acceptance criteria must be verifiable and not implementation steps.
- Decomposition should be actionable reminders (e.g., "add endpoint", "create tests"), not line-by-line code tasks.
- When ambiguity exists, create an explicit "open question" as the first decomposition item.
- Use conservative difficulty; if required context or stakeholders are missing, bump size up and explain why.
- Suggested labels: include area (frontend/backend/api/docs), priority (P0/P1/P2), and type (bug/feature/refactor)

Examples
--------
Input: "Our checkout sometimes duplicates orders when users click pay twice. Need to prevent duplicates and show clear feedback."

Output (JSON):
{
  "title": "Prevent duplicate orders when users click pay twice",
  "description": "Users can submit duplicate orders if they click the payment button more than once while the request is in flight. This causes duplicate charges and inventory problems.",
  "user_story": "As a shopper, I want the checkout to prevent duplicate submissions so that I am not charged twice and inventory remains correct.",
  "acceptance_criteria": [
    "Given a user clicks pay multiple times, only one order is created and one payment is processed",
    "Payment gateway receives a single charge per intended order",
    "UI shows a pending state or disables the pay button after first click"
  ],
  "decomposition": [
    "Investigate current checkout flow to find where duplicate orders are created",
    "Add idempotency key or client-side disable to prevent duplicate calls",
    "Add backend check to detect and ignore duplicate submissions",
    "Add tests for duplicate submission scenarios",
    "Roll out and monitor metrics for duplicate orders"
  ],
  "difficulty": "M",
  "difficulty_reasoning": "Medium — requires changes in both frontend and backend and careful payment handling, but scope is limited and solution patterns exist.",
  "routing": {"executor": "Codex", "reason": "Execution-heavy: touches payments and backend idempotency — prefer execution-capable model or engineer."},
  "original_input": "Our checkout sometimes duplicates orders when users click pay twice. Need to prevent duplicates and show clear feedback.",
  "suggested_labels": ["backend","bug","priority:P1"]
}

Integration notes
-----------------
- The skill must be deterministic given the same input (avoid hallucinating unstated stakeholders). If the input lacks required context, explicitly mark open questions and suggest probing prompts.
- Keep maximum output size reasonable so it can be posted as an issue body directly.

Prompt templates (for implementation)
-----------------------------------
- System prompt: "You are an assistant that converts informal product requests into structured issue JSON following the task-intake schema. Prioritize clarity, testable outcomes, and minimal ambiguity. If context is missing, add an explicit open question in decomposition."
- User prompt: "Convert the following raw input into the task-intake JSON: <RAW_INPUT>"

Edge cases
----------
- If input is a one-line bug report with stack trace, extract error summary and include stack trace as an attachment suggestion in decomposition
- If input is roadmap-level or very vague, create a discovery task as the first decomposition step and set difficulty to L or XL

Licensing / attribution
-----------------------
Inspired by product-manager-prompts (https://github.com/deanpeters/product-manager-prompts). This skill is an original transformation and summarization tool intended for use inside the nForma tooling.
