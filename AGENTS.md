# Development-stage model policy

This policy supplements the existing environment, gitignore access, UI verification,
and proportional development workflows. It does not relax their restrictions.

## Preferred models

| Stage | Preferred model | Reasoning effort |
| --- | --- | --- |
| Requirements and implementation planning | `gpt-6.1-sol` | `high` |
| Plan review and architectural decisions | `gpt-6-astra` | `high` |
| Feature implementation and test writing | `gpt-6.1-sol` | `high` |
| Code review | `gpt-6-astra` | `high` |
| Re-verification and test-result analysis | `gpt-6.1-sol` | `medium` |
| Copy, simple styling, and documentation edits | `gpt-6-luna` | `medium` |
| Complex debugging, authentication, and data-integrity changes | `gpt-6-astra` | `xhigh` |

## Operating rules

- Honor an explicit user model or reasoning-effort choice over this table.
- Apply the full plan -> plan review -> implement -> code review -> re-verify
  sequence to feature additions, structural changes, and complex or high-risk fixes.
  Use the complex/high-risk assignment for the affected work when it overrides a
  general stage assignment.
- Complete small, low-risk edits with one model and focused verification. Do not
  introduce extra stages, model switches, or reviewers solely to satisfy this table.
- Treat these assignments as preferences, not an automatic model-switching
  configuration. Use supported model-selection controls only when available and
  permitted. This file does not itself change the current chat's model.
- If the preferred model or effort is unavailable, continue with the current
  available model and supported effort, and disclose the substitution and material
  limitations. Do not interrupt work or create a new chat merely to switch models.
- This table does not independently authorize subagents or delegation. When an
  independent reviewer is otherwise authorized and available, prefer the review
  model above; otherwise perform and disclose self-review.
- Review actual code and diffs, including relevant uncommitted changes, against
  requirements. Do not rely solely on the implementer's explanation. Validate
  findings before making corrections, then re-verify affected behavior.
- Report only models and reasoning settings actually used and known. Never claim
  the preferred model performed a stage unless it did; disclose when the active
  model or effort cannot be verified.
- Model selection never permits access to ignored files or real environment and
  secret files, bypassing permissions, or claiming checks that were not run.
