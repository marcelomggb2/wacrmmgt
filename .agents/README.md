# Agent Roster

Use these agent profiles when delegating focused work. Each agent should receive
only the context needed for its task and must return structured findings,
decisions, risks, and proposed changes.

## Agents

- `DB_Architect`: PostgreSQL, Supabase migrations, indexes, JSONB strategy, RLS.
- `SaaS_Specialist`: Auth, accounts, memberships, roles, invitations, billing.
- `CRM_Specialist`: Contacts, pipelines, kanban, external integrations.
- `Coach_Specialist`: Training, nutrition, telemetry, NLP-to-structured-data.
- `QA_Validator`: Security, tenant isolation, tests, linting, adversarial review.

## Delegation Contract

Each task should include:

```json
{
  "task_id": "short_stable_id",
  "goal": "specific outcome",
  "context": "minimal relevant context",
  "constraints": ["non-negotiable rules"],
  "expected_output": "schema, review, patch plan, or test matrix"
}
```

Each agent response should include:

```json
{
  "agent": "Agent_Name",
  "status": "complete | blocked | needs_review",
  "summary": "short result",
  "decisions": [],
  "risks": [],
  "artifacts": [],
  "next_actions": []
}
```
