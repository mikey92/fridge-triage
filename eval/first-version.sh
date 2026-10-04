#!/bin/sh
# Scores the first submitted version (commit b8fff1e: its recognizer prompt and its verdict rules) on the same photos,
# labels and judgments, so the before and after numbers in eval/EVAL.md come from the same yardstick.
#   sh eval/first-version.sh        # score the saved runs in eval/runs/v1-gpt-5.5-low with that commit's rules
#   sh eval/first-version.sh run    # read the photos again with that commit's prompt first (needs .dev.vars)
set -e
dir="${TMPDIR:-/tmp}/fridge-triage-b8fff1e"
git worktree remove --force "$dir" 2>/dev/null || rm -rf "$dir"
git worktree add --detach "$dir" b8fff1e >/dev/null 2>&1
cp -R eval "$dir/"
ln -s "$PWD/node_modules" "$dir/node_modules"
if [ "$1" = run ]; then
  cp .dev.vars "$dir/"
  rm -rf "$dir/eval/runs/v1-gpt-5.5-low"
  (cd "$dir" && for set in tune held-out; do SET=$set TAG=v1-gpt-5.5-low MODEL=gpt-5.5 npx tsx eval/run.ts; done)
  rm -rf eval/runs/v1-gpt-5.5-low && cp -R "$dir/eval/runs/v1-gpt-5.5-low" eval/runs/
fi
(cd "$dir" && for set in tune held-out; do SET=$set npx tsx eval/score.ts eval/runs/v1-gpt-5.5-low; done)
git worktree remove --force "$dir"
