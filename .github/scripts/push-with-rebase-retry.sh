#!/usr/bin/env bash
set -euo pipefail

branch="${1:-main}"
max_attempts="${MAX_PUSH_ATTEMPTS:-4}"

for attempt in $(seq 1 "$max_attempts"); do
  if git push origin "HEAD:$branch"; then
    exit 0
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Push failed after $max_attempts attempts" >&2
    exit 1
  fi

  echo "Push raced with another writer; rebasing on origin/$branch (attempt $attempt/$max_attempts)" >&2
  git fetch origin "$branch"
  git rebase "origin/$branch"
  sleep $((attempt * 2))
done
