---
name: local-redact
description: Redact personal information in local UTF-8 text files or stdin using the exact divergentlabs/masker-mini model offline. Use when asked to mask PII locally before sharing text or logs.
---

Use `~/.claude/skills/local-redact/run.sh INPUT -o OUTPUT` to create a redacted copy. Omit INPUT or use `-` to read stdin. Output files must not already exist. The script preserves the source file and creates output with owner-only permissions.

For sensitive files, invoke the script directly on their paths before reading their content with agent tools. Read only the redacted output into the conversation. Do not place sensitive text in command arguments or print original values. This skill does not automatically intercept other tool calls or redact text already sent to an assistant.

`--json` returns redacted text plus original character offsets and entity labels, without original values. Plain text output uses placeholders such as `[EMAIL]` and `[GIVEN_NAME]`. No reversible mapping is stored. Input must be UTF-8 text; PDF, Word, and image extraction are separate tasks. Redacting JSON or CSV as text does not promise valid structured output.

Inference uses the publisher's `onnx/model_fp16.onnx` and `tokenizer.json` from https://huggingface.co/divergentlabs/masker-mini at revision `da82d8f02653c4cfb9856dbcec0a2dc6c6bbe145`. This is the published model, with no training, conversion, substitute model, or extra regex detector. ONNX Runtime runs on the local CPU with two threads. Text longer than 512 tokens uses 128-token overlaps; overlapping detections are merged so all detected characters are masked.

Run `~/.claude/skills/local-redact/run.sh --setup` only to download the pinned artifacts. Ordinary inference loads local files only and makes no network requests. The Python environment and model files reside inside this skill directory; Codex discovers the same skill through a symlink at `~/.codex/skills/local-redact`.

The model predicts 12 entity types: given names, surnames, cities, street names, building numbers, postal codes, phone numbers, email addresses, credit cards, dates, ages, and government IDs. Local checks show partial email masking (for example, `alice@example.com` becomes `[EMAIL]example.com`) and occasional incorrect name labels. Detection is imperfect, especially for names in real documents; output is not a guarantee that all identifying information is removed. Do not silently switch models. Publisher attribution and license files are retained in `model/`.
