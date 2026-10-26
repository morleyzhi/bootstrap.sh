---
name: voice-llm-bench
description: Compare LLMs (and voice models) on the ElevenLabs voice agents using real calls. Reports the pause from caller stopping to agent speaking and a blind transcript grade per model across all agents, marking results that are not significant, plus call outcomes and cost. Use when asked how a voice agent model is performing, to compare glm / deepseek / qwen / gemini on the agents, or to check latency after a model or voice change.
---

# Benchmark a voice agent LLM

Voice calls cannot be replayed, so each run compares real calls grouped by the models that actually produced them. The protocol is fixed; `bench.py` in this folder does the fetching and the latency/outcome report.

## 1. Find the variants

- Read `TARGET_LLM`, `PILOT_LLM`, the pilot agent ids, and the TTS model from `packages/backend/src/scripts/stagingprod/updateElevenLabsAgents.utils.ts` with the file tools (never run anything under `stagingprod`).
- Read the current config of each agent of interest: `GET /v1/convai/agents/<id>` (`prompt.llm`, `tts.model_id`, `turn.turn_eagerness`, `tts.optimize_streaming_latency`, `expressive_mode`). Settings change from the UI without code changes.
- A variant is an `llm|tts` pair, for example `deepseek-v41-flash|eleven_v4_turbo`. Never compare across voice models and attribute the difference to the LLM: switching to `eleven_v4_turbo` alone added about 0.5 s to the median pause. If the LLM and the voice model changed on the same day, use as the baseline a same-voice-model group from other agents, and say so.

## 2. Build or reuse the corpus

API key: `grep '^ELEVENLABS_API_KEY=' packages/backend/.env | cut -d= -f2- | tr -d '"'`. Run with `dangerouslyDisableSandbox: true` (network). Every call is a read-only GET.

```sh
python3 ~/.claude/skills/voice-llm-bench/bench.py fetch --key "$K" --days 14 --agents <ids...>
```

- Agents: the variant's agents, plus 3-4 of the busiest agents on the baseline over the same window (rank by call count over 7 days) as a same-period control.
- Raw conversations are cached forever in `~/.cache/voice-llm-bench/raw/` (chmod 600) and only fetched once; `calls.jsonl` and `manifest.json` (with sha256) go to `~/.cache/voice-llm-bench/<YYYY-MM-DD>/`. Re-running fetch the same day rebuilds the snapshot from the cache.
- Each call's model comes from the transcript (`producing_llm`, per-turn `llm_usage`), never from the agent's current config. A call with two LLMs (`a+b`) means the backup LLM fired; count those per variant and report them.
- Transcripts contain family PII. Never quote names, phone numbers, or emails in chat; run excerpts through `local-redact` before showing them.

## 3. Grade transcripts blind

Grades live in `~/.cache/voice-llm-bench/grades.json`, keyed by conversation id, and carry forward across snapshots. Grade only calls not already in it.

- Pick up to 12 calls per variant across all agents (20 s or more, two or more caller turns) and shuffle them. Write each one as `callNN.json` to a scratchpad `blind/` folder (chmod 600), keeping only role, time, text, interrupted, and the tool call names, params and results.
- Never give the grader raw files: they name the model (`producing_llm`, `llm_usage`).
- Keep the `{callNN: conversation id}` key outside that folder.
- Spawn one `general-purpose` subagent with no conversation context and point it at the folder only. It grades each call 1-5 on these checks:
  - answered the caller's actual question;
  - no wrong or invented facts (including claiming a link was sent without a tool call);
  - didn't repeat itself or ignore an interruption;
  - used a tool when one was needed;
  - replies sound natural and aren't too long.
- It returns `callNN | grade | reason | flags` per call with no PII. Save that reply to a file, then run:

```sh
python3 ~/.claude/skills/voice-llm-bench/bench.py grades --key <blind_key.json> --graded <reply.txt>
```

## 4. Report

```sh
python3 ~/.claude/skills/voice-llm-bench/bench.py report --variants '<baseline llm|tts>' '<candidate llm|tts>' [--min-calls 10]
```

The only latency that matters is the **pause**: caller stops talking until agent audio starts (`convai_ttf_audio_since_silence`). Do not report LLM, TTS, or turn-detection stage timings unless the user asks why the pause changed; `calls.jsonl` keeps them per turn for that.

The report pools all agents and never breaks results out per center. It keeps done calls of 10 s or more with a caller turn and prints:
- One table: `Model + voice model | Pause P50 | Pause P95 | Pause Max | Grade`, baseline first. There is no count column and no change-vs-baseline column.
- An asterisk on a candidate's Pause P50 or Grade when it is not significantly different from the baseline's: the 95% bootstrap CI on the difference includes 0, or there are too few calls (fewer than `--min-calls` calls, or fewer than 5 graded calls). Each asterisk gets a footnote under the table with both call counts and the CI.
- Outcomes per variant: success rate, tool errors, LLM $/min, backup-LLM calls.
- Flagged calls from the grades, and the 5 longest pauses per variant, with links.

## 5. Output

In chat:
1. The table and its footnotes from `report.md`, copied as is.
2. One line on outcomes or cost that differ, and the flag pattern per variant (for example "both DeepSeek flags are loops").
3. One line: anything confounding the comparison (voice model change, turn eagerness, different agent mix).
4. The `report.md` path.

Do not declare a winner while either cell carries an asterisk.
