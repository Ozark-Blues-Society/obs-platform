# Human gates — when agents must stop and ask Parker

Use `tools/ask-human.sh`. Everything not listed here, agents decide themselves (and record notable
technical choices in `docs/decisions/`).

## Always ask

| Gate | Examples |
| --- | --- |
| Scope | Anything not in `docs/spec/scope.md`; anything that might be a Change Order |
| Board/business rules | A membership, pricing, renewal, classifieds or sponsor rule that `board-decisions.md` doesn't answer |
| Design approval | The home page and four page templates, before building the rest on them (contract milestone: Design Approval) |
| Choosing between architecture options | Any decision record marked `Status: Proposed` |
| Money and accounts | Creating or changing any real account, plan, billing, or paid dependency |
| Production | Merging `develop` → `main`, production deploys, environment variables in production, DNS, domain, email-sending domains |
| Real people | Sending any email to real members; importing or handling the real member export (personal data) |
| Legal and policy text | Privacy policy, terms, refund wording, consent language |
| Destructive actions | Deleting data, force-pushing, rewriting history, dropping tables outside local dev |
| Repeated failure | The same task has failed three times or CI has been red on `develop` for more than a day |

## Never needs asking

Library choices within the fixed stack, component structure, refactors, tests, local tooling, CI
config, fixture data, copy edits that match approved content, and bug fixes within scope.
