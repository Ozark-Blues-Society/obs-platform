# 0012 — A separate Sanity project for development

Status: Accepted (Parker, 2026-11-27, Q-20261126-042834-8727, option A).

## Decision

The factory develops against a separate, dev-only Sanity project with synthetic data, created by Parker.
Its project ID, a Viewer token and an Editor token are in the factory's secrets file on the server, and
`localhost:3000` is allowed in its CORS settings.

Rules:
- The factory never holds a token for the Society's real Sanity project (decision 0001's production
  dataset).
- Tokens are read from the secrets file into an untracked `.env.local` when needed. They are never
  committed, printed in logs or pasted into chat, and `.env.example` keeps placeholders only.
- Only synthetic content goes in the dev project. Its dataset may turn public when the trial ends,
  which is harmless with fake data.

Update 2026-11-27 (Q-20261127-233533-27089): Parker set both datasets of the dev project
(`development` and `production`) to Private, so the factory tests private-dataset behavior now.
