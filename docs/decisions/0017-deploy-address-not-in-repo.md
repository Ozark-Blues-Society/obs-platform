# 0017 — The deploy address is not written in the public repo

Status: Accepted (Parker, 2026-11-27, Q-20261127-220351-3578, option A). Confirmed on Discord 2026-11-28.

## Decision

Writing the `develop` deploy's address in this public repository counts as sharing the link (decision
0010). So:

- Docs say "the develop branch deploy" instead of the address. README.md and decision 0008 are updated.
- Agents edit the address out of PR descriptions and comments, and never add it anywhere new.
- Agents that need it for deploy checks read it from Netlify or local, untracked config.

Old versions remain in git history. Only Netlify's visitor access settings (Parker's) actually keep the
preview private.
