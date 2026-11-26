# Job: apply decisions 0002 and 0003 to the work items

Idempotent: safe to run while the kickoff (op-pc0) is still creating beads.

1. git pull develop. Read docs/backlog.md (priority section at the top), docs/decisions/0002 and 0003,
   and docs/spec/board-decisions.md (resolved questions table).
2. For EVERY backlog ID in docs/backlog.md (F-1 ... Q-5, including the new N-1..N-3): make sure exactly
   one bead exists in the obs-platform rig whose title starts with that ID. Create missing ones with
   acceptance criteria and dependencies. If duplicates exist, keep the oldest and close the others as
   duplicates.
3. Label each bead launch-1 or launch-2 per the priority section. Set launch-1 beads to P1, launch-2 to P2.
4. Unblock beads that were blocked on Q-A..Q-E; those are answered now.
5. Do not file human questions for anything already decided in docs/decisions or board-decisions.md.
6. Close this job with a short summary: count of beads by label, and what was created or deduplicated.
