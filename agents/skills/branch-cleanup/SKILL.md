---
name: branch-cleanup
description: Find and remove stale local Git branches and worktrees when asked to list or clean them up.
---

# Branch and worktree cleanup

Use Git and GitHub directly. Do not use Jev or `~/.claude/jev/run.sh` for this workflow.

## Find work to remove

- Refresh remote refs without deleting remote branches. Inventory local branches and worktrees with Git.
- Read worktree status concurrently. Check staged, unstaged, untracked, and ignored files before declaring a worktree safe to remove.
- Use GitHub PR status and the PR's head commit to recognize squash merges. A merged PR with the same branch name alone does not prove the local commits are preserved.
- Show SAFE, ASK, and KEEP groups with branch names, worktree paths, and reasons.
- SAFE: all local commits are in main or in a merged PR's head history; no uncommitted work is lost. Preserve unique ignored files such as local environment files before removal. Dependencies, caches, build output, and duplicate environment files do not need preservation.
- ASK: uncommitted work, closed unmerged PRs, extra local commits, or insufficient evidence that work is preserved.
- KEEP: the current checkout, main, persistent utility branches, or branches with open PRs.
- Finding or listing does not authorize deletion. When the user approves a group or specific names, proceed without asking again.

## Remove approved work

- Recheck each approved worktree's HEAD and file status against the inventory. Skip changed worktrees and report them.
- Always remove independent approved worktrees in parallel. Launch every approved removal together for modest batches; use a worker pool of at least eight for larger batches. Never wait for each removal before launching the next. One worktree requires only one removal.
- Use `git worktree remove` with exact approved paths. Preserve unique ignored files first. Do not force deletion of uncommitted work unless the user explicitly approves discarding that work.
- Wait for all worktree removals to finish before deleting their branches. Keep branches whose worktrees fail removal.
- Recheck branch heads, then delete approved local branches in one `git branch -D` invocation. The SAFE checks establish preservation even when squash merges prevent `git branch -d` from recognizing a merge.
- Do not delete remote branches unless explicitly requested.
- If interrupted, inspect running removals and the current Git inventory before restarting. Do not launch a second removal for a worktree already being deleted.
- Verify the approved worktrees and branches are absent. Report counts, failures, and the remaining ASK group when requested.
