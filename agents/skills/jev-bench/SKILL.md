---
name: jev-bench
description: Benchmark a new prompt, threshold, or agent for a Jev-like judgment API (structured state in, typed answer out) against a recent corpus of real transcripts. Reports P95/Max latency and score per variant and lists the transcripts whose accept/reject outcome differs between variants. Use when asked to benchmark, compare, A/B, or regression-test a Jev prompt, a TypeSafe question, or a scoring agent.
---

# Benchmark a Jev-like judgment

A Jev-like API takes `state` (text) and named `questions`, and returns one typed answer per question (for example `noul`, a 0-1 probability). Each run compares two or more variants on the same frozen inputs. Write throwaway code for each run; the protocol below is fixed, the code is not.

## 1. Find the target

Find the judgment in code each run instead of trusting an old copy. For example, the Camber voice spam rating lives in `packages/backend/src/llm/transcriptions/spamRating.ts`: read `IS_SPAM_QUESTION`, the threshold, and the decision rule (`getIsSpamRating`). Use `origin/main` for the baseline (`git show origin/main:<path>`) unless the user names a branch.

Each variant is one of:
- the baseline from code;
- a question the user pastes, or the version on another branch or worktree;
- a different endpoint, model, or agent that takes the same input and returns a comparable answer.

Write the variants to `variants.json` as `{ name: { endpoint, model, question, threshold } }`, and show the user the diff between them before running. Pin the model version. If the only option is `jev-latest`, say so in the report header, because two runs a week apart may use different models.

## 2. Build or reuse the corpus

Snapshots live in `~/.cache/jev-bench/<target>/<YYYY-MM-DD>/corpus.jsonl`, one row per line: `{ id, state, meta }`. `meta` holds what the report links to (conversation id, created, duration, production score) and never feeds the variants.

- Reuse the newest snapshot for the target unless the user says "refresh" or it is older than 14 days. Back-to-back comparisons must run on the same file.
- To build one, read through the read-only Firebase or Supabase MCPs. Never use `gcloud`, `firebase`, `supabase`, or `stagingprod` scripts. For the spam rating: query prod `actions` where `actionType == "recordedCall"` and `created >= <now - N days>`, then build `state` the same way production does (read the code that calls Jev).
- Have a subagent page through the MCP and write the file, so transcripts do not land in this context. Default to the last 7 days, capped at 2,000 rows.
- `chmod 600` the snapshot. Prod transcripts contain family PII: never quote names, phone numbers, or emails in chat, and run excerpts through the `local-redact` skill before showing them.
- Write `manifest.json` next to it: query, row count, date range, and `shasum -a 256` of `corpus.jsonl`.

If the user has ground truth, keep it in `labels.json` next to the corpus as `{ id: true | false }`. Labels carry forward across snapshots by id.

## 3. Run

Create `runs/<HHMM>-<variant names>/` under the snapshot and write the runner there as `runner.mjs`. Use `askJev` from `~/.claude/jev/jev.mjs` for Jev, and run it with `~/.claude/jev/run.sh`-style node outside the sandbox. On exit code 2, show the printed `security add-generic-password` command and stop.

- Send every variant for one row in the same request when they share an endpoint; otherwise call each endpoint separately and time each call.
- Run k=3 repeats per row per variant (k=1 only if the user asks for a quick pass).
- Up to 12 rows at once, a 20 s timeout, and 3 attempts per call.
- Write `results.jsonl` with one line per call: `{ id, variant, repeat, score, latencyMs, decision, error }`. Append as you go so a crash resumes from the rows already done.
- Cache: before calling, skip any `(id, variant, repeat)` already in `results.jsonl` whose variant definition is unchanged.

When rerunning the same comparison, reuse the saved `runner.mjs` instead of writing a new one.

## 4. Report

Compute from `results.jsonl` only. Fixed definitions:
- **P50, P95, Max**: nearest-rank percentiles over all successful calls, for latency (ms) and for score.
- **Decision**: the variant's own rule, for example `score >= threshold → accept`.
- **Stable**: all k repeats of a variant on a row reach the same decision.
- **Outcome flip**: a row where every variant is stable and their decisions differ.
- **Noise flip**: a row where some variant is not stable. Report these separately; they are not evidence that one variant is better.

Output, in this order:
1. Header: target, snapshot path and row count, corpus sha256 (first 12 chars), each variant's model and threshold, and k.
2. A table with one row per variant: calls, errors, accept count, latency P50/P95/Max, and score P50/P95/Max.
3. Outcome flips: counts per direction (for example "A accepts, B rejects: 4"), then every flip sorted by score gap, largest first. Each one shows the id, each variant's mean score, the production score, a redacted excerpt of at most 200 characters, and a link (for an ElevenLabs conversation, `https://elevenlabs.io/app/agents/history/<conversation id>`). Over 25 flips, show the 25 with the largest gap and write the rest to `flips.csv`.
4. Noise flips: count per variant, and the 5 ids with the widest score spread.
5. With `labels.json`: false positives and false negatives per variant, over labeled rows only, with the labeled row count.

Write the report to `report.md` in the run folder and give the user its path. Do not declare a winner without labels; say which variant accepts more and list the flips.
