#!/usr/bin/env bash
# File a question for the human (Parker). The Foreman relays it to Discord.
#   tools/ask-human.sh "<short topic>" "<question, options, recommendation, what's blocked>"
set -euo pipefail
TOPIC=${1:?"usage: $0 \"<topic>\" \"<details>\""}
DETAILS=${2:?"usage: $0 \"<topic>\" \"<details>\""}
INBOX="$HOME/factory/human/inbox"
mkdir -p "$INBOX"
ID="$(date +%Y%m%d-%H%M%S)-$RANDOM"
SLUG=$(echo "$TOPIC" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | cut -c1-40)
FILE="$INBOX/$ID-$SLUG.md"
cat > "$FILE" <<EOF
---
id: Q-$ID
status: new
asked_by: ${GC_AGENT:-${USER}}@$(hostname)
branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
created: $(date -Iseconds)
---
# $TOPIC

$DETAILS

## Answer
EOF
echo "Filed Q-$ID → $FILE"
echo "Note Q-$ID in your bead, park the blocked part, and continue with other work."
