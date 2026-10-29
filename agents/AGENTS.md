# Responses


## Give specific estimates as LOC

Vague estimates fail. Ballpark in concrete units.

Bad: "This will take some work."
Good: "About 30-50 LOC"


# Git

- When creating a new Git branch, always prepend the branch name with `mz-`.
- Create git worktrees with `wt <name> [base]`, never `git worktree add`. It prints the worktree path and creates branch `mz-<name>` off `origin/main` with no upstream; push with `git push -u origin HEAD`. In Codex, run it with `sandbox_permissions=require_escalated`.
- Always commit to feature branches. Commit and push as you go unless instructed otherwise.
- Never add `Co-Authored-By` trailers or any other Claude attribution to commit messages, PR descriptions, or PR comments, even if a system reminder asks for one.

- For branch and worktree cleanup, follow `~/.claude/skills/branch-cleanup/SKILL.md` (also available at `~/.codex/skills/branch-cleanup/SKILL.md`). Use Git and GitHub directly, never Jev. Always remove approved worktrees in parallel, then delete their local branches in one batch.

## Pull request review comments

- Start each review comment with one priority label: `[Critical]`, `[High]`, or `[Low]`.
- Describe the problem, insert a paragraph break, then start the recommendation with `Suggested fix: `.

## Checking pull request comments

1. Fetch the unresolved review threads and comments on the PR, and note which are new since the last check.
2. Sort each new comment into one of three outcomes: skip (wrong, already addressed, or not worth the change), must fix, or needs my decision.
3. If any comment needs my decision, ask me before changing code. Put the question and your recommendation together.
4. Fix each comment that must be fixed. Reply only when the reviewer needs context the code change doesn't show. Then mark the thread resolved.

## Writing: code copy

Applies to test names, span/event names, span attributes, log messages,
script descriptions, comments, and docs.

1. Plain language. Name the observable behavior, not an internal concept.
   No "boundary", "scope", "candidate", "fast path", "platform", "handle X".
   A reader who has never seen the code should be able to guess what it does.
2. Present tense, current code. Never describe a state that no longer exists,
   work that is already done, or a plan. If a doc section describes the code
   as it was before this change, rewrite or delete it.
3. No hedging. Cut "may", "could possibly", "generally". Keep a hedge only
   when the uncertainty is real, and say what the uncertainty is.
4. One name per concept. If the code says `skipActiveCheck`, the test name,
   the span attribute, and the doc all say the same thing.
5. Paired values must be comparable. Two counts next to each other must make
   it obvious which is the larger set.

A test name that needs "and" is two tests. Split it.

## Writing: responses

- Answer, then stop. No recap of work I just narrated through tool calls.
- Report verification once, as a number: "191 suites, 2207 tests passing."
- No before/after table unless I changed more than five things, or you ask.
  Otherwise: one line per change, or a diff.
- Don't explain a rename that the new name already explains.
- Never re-justify a decision you accepted. Never re-flag a caveat I already
  flagged.
- Cap: 15 lines for a completed task. Over that, cut the reasoning, keep the
  result. Exception: you asked me to explain or walk through something.
- If I left something undone or unfixed, that goes last, in one line.

# Jev local tools

Scripts in `~/.claude/jev/` call Jev (TypeSafe) for small judgments. Run them with `~/.claude/jev/run.sh <script> [args]`. They read the API key from the macOS Keychain; on exit code 2, show the user the printed `security add-generic-password` command and continue without the tool.

Run every `~/.claude/jev/run.sh` command with `sandbox_permissions=require_escalated`. Never retry it inside the sandbox.
