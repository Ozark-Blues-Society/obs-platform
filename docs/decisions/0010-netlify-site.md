# 0010 — Netlify site for the platform

Status: Accepted (Parker, 2026-11-27, Q-20261126-084158-1521, option B).

## Decision

The platform is hosted on a Netlify site named `obs-platform` on Parker's Netlify team (`obs-nwa`) until
it moves to a Society-owned account. Settings, which only Parker changes:

- Production branch: `main` (only Parker merges to it; `main` is protected by a GitHub ruleset).
- Branch deploys: `main` and `develop`. The Design Approval package is at the `develop` deploy,
  `/design-preview`.
- Pull request deploy previews: off.
- No environment variables on Netlify for now; no Netlify token on the factory server.

Rules:
- Agents never change Netlify settings, accounts or visitor access.
- Nobody shares the preview link with anyone other than Parker. Parker decides when and how the board
  sees it.
