---
name: pre-pr
description: Gate that runs before opening any pull request. Counts non-test lines added on the current branch vs main; if over 100, spawns a fresh context-free reviewer to look for simplifications, and stops to ask the user before creating the PR when the reviewer finds savings of 10% or more of the changed lines. Use whenever you are about to run `gh pr create` or the user asks to open, make, or create a PR.
---

# Pre-PR simplification gate

Run this before every `gh pr create`. Do not open the PR until the gate passes or the user tells you to proceed.

## 1. Count the diff

```sh
base=$(git merge-base HEAD origin/main)
git diff --numstat "$base"...HEAD -- . \
  ':!yarn.lock' ':!*.lock' ':!*.snap' ':!*.min.*' \
  ':!*.test.*' ':!*.spec.*' ':!**/__tests__/**' ':!**/__mocks__/**' ':!**/test/**' ':!**/tests/**' ':!**/e2e/**' \
  | awk '{a+=$1; d+=$2} END {print "added=" a " deleted=" d " changed=" a+d}'
```

Test files, fixtures, and mocks never count toward the threshold.

- `added` ≤ 100: skip to step 5.
- `added` > 100: continue.

Binary files show `-` in numstat and count as zero.

## 2. Spawn a fresh reviewer

The reviewer must have no memory of this conversation. Give it only the brief below, with the placeholders filled in. It is read-only and must not edit files.

Tool mapping:

- Claude Code: `Agent` tool, `subagent_type: general-purpose`. Never `fork`; a fork inherits your context.
- Codex: `spawn_agent` with the brief as the whole prompt.
- Cursor: launch a sub-agent with the brief as the whole prompt. If no sub-agent runner is available, run `cursor agent -p "<brief>"` from the repo root.

Reviewer brief:

```
You are reviewing branch <BRANCH> in the git repo at <REPO_ROOT> for simplification only. You have no other context; do not ask questions.

Diff to review (test files are out of scope and excluded here):
  base=$(git merge-base HEAD origin/main); git diff "$base"...HEAD -- . ':!*.test.*' ':!*.spec.*' ':!**/__tests__/**' ':!**/__mocks__/**' ':!**/test/**' ':!**/tests/**' ':!**/e2e/**'
Read the full diff, then read any changed file whole when the diff alone is ambiguous. Read AGENTS.md or CLAUDE.md at the repo root for conventions.

Find changes that make the diff smaller while preserving every observable behavior:
- Duplicated logic that an existing helper, hook, or util in the repo already provides. Name the existing symbol and file.
- New abstractions used once, wrappers that only forward arguments, dead branches, unused params or types.
- Two or more near-identical blocks that collapse into one.
- Comments, docstrings, or logging the repo conventions forbid.
Do not report: formatting, naming, style preferences, or anything that changes behavior, API shape, or test coverage.

For each finding estimate net lines saved: lines removed from the diff minus lines added to implement the fix. Be conservative; if unsure, round down.

Reply with exactly this structure and nothing else:
TOTAL_SAVED=<integer>
FINDINGS:
- <file>:<line> — <one sentence: what to do> — saves ~<n> LOC
(at most 5 findings, largest savings first; write "FINDINGS: none" if there are none)
```

## 3. Decide

```
threshold = 0.10 * changed        (changed from step 1)
simplify = TOTAL_SAVED >= threshold
```

Sanity-check the reviewer's biggest finding yourself in under a minute. If it is wrong, drop it and recompute. Do not adjust its numbers upward.

## 4. If `simplify` is true, stop

Do not run `gh pr create`. Reply to the user with:

1. First line: `Pre-PR: reviewer found ~<TOTAL_SAVED> LOC of savings on <changed> changed lines (<pct>%). Simplify first, or open the PR as-is?`
2. The findings list from the reviewer, verbatim, at most 5 bullets.
3. Nothing else.

Wait for the answer. If the user says simplify, apply the findings, re-run this skill from step 1, then open the PR. If the user says open as-is, go to step 5.

## 5. Open the PR

Follow repo rules for PRs. In this repo: draft (`gh pr create --draft`), title plus a plain description body, no headings. Add one line to your reply stating the gate result, for example `Pre-PR: 64 LOC added, under the 100 line threshold.` or `Pre-PR: 312 LOC added, reviewer found no savings above 10%.`
