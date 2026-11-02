---
name: pr-description
description: Write or rewrite a pull request title and description in Morley's style - a plain-language title, a first sentence stating the effect, short bullets, evidence as numbers, no headings. Use whenever you create a PR (`gh pr create`), edit a PR's title or body, or are asked to draft, shorten, or fix a PR description.
---

# PR descriptions

Write for a reviewer who has not seen the conversation or the code. Say what changes for users and why, give the evidence, then stop. Most descriptions are 2-6 lines. Go longer only when the PR is driven by an eval or production data and the numbers are the argument.

Before writing, read the diff (`git diff $(git merge-base HEAD origin/main)...HEAD`) and the PR's live text if it exists. When editing, keep what the author wrote unless asked to change it.

## Title

- Name the observable change in plain words, as an imperative or present-tense sentence: "Hide the door access log without settings access", "Send new staff to sign-in before the payroll dashboard", "Flag \"not verified on Google\" as robocall spam".
- Prefix the area only when it's a tool or product line people filter by: `Camber Bench: ...`, `CRM: ...`.
- No Linear ticket IDs in the title; put `Fixes ENG-1234` or the Linear link in the body.
- No `feat:`/`fix:` prefixes, no trailing period.

## Body

1. **First sentence: the effect.** Either the new behavior ("Editing a lesson activity now suggests milestones automatically, the same way creating one does.") or the problem a user hit ("Admins without billing access saw the Manage Subscription tab, so it opened a 404.").
2. **For a bug: problem, then fix, as two short paragraphs.** The problem says who saw what and why. The fix says what the code does now, and points at the precedent it matches ("the same permission as the route", "the same check #8927 added for guardians").
3. **Several changes: short bullets**, one change per bullet, no headings above them. A bullet can be a fragment.
4. **Evidence as numbers, with the source.** Production counts ("18 of 59 calls (31%)", "7 clicks in the [PostHog alert](...) this week"), latency (p50/p95), cost, and bench scores as `passed/total` with whether the difference is significant. Paired numbers must be comparable: same units, before → after, or a two-column table.
5. **Tables only** for before/after metrics or a problem → fix mapping with several rows.
6. **Plain-text lead-ins instead of headings** when a section is needed: `To test:`, `TODO before merge:` (with `- [ ]`), `Follow-up, not in this PR:`, `Still shown:`. Never `##` headings, and no "Summary" or "Test plan" sections.
7. **Last, in this order, each only when it applies:**
   - The known gap or caveat, said plainly in one line ("Not yet verified in a browser against a live model.", "Leaving that page vulnerable for now, [to be fixed later](...)").
   - Anything an engineer must do before merging.
   - `To test:` steps for UI changes (sign into preview as happyhands@tryplayground.com, then the clicks).
   - `Fixes ENG-1234` or the Linear link.

## Wording

- Name behavior, not internals. A reader who has never seen the code should follow it. Put code names (functions, events, endpoints, flags) in backticks when a reviewer needs them.
- Present tense for the new code ("The tab now requires..."); past tense only for what users saw before.
- Refer to related PRs by number (`Builds on #9055`, `the #8980 setup`).
- No hedging unless the uncertainty is real, then say what it is ("This seems to be a race condition that is hard to reproduce locally; we'll know it works if this drops from the alert").
- Don't restate the diff file by file, list tests that pass, or explain a rename the new name already explains. Mention test counts only when the tests are the point.
- No Claude or Codex attribution, no Co-Authored-By. Leave the Cursor Bugbot summary alone; the bot writes it.
- For UI changes, leave room for a screenshot or video and tell the user to add one; never invent an image link.

## Examples

Bug fix:

```
Staff who can read custom reports but not write them saw Create and Edit, which open the report builder they cannot access, so they saw a 404.

Create, row Edit/Delete, and the details page Edit button now require the same permission as the builder route.
```

Several changes:

```
Lead extraction no longer fills fields the caller never stated with placeholders such as "Not provided", 0, or false.

- The prompt tells the model to use null for empty fields, and the schema only accepts null as an empty value
- Calls where nobody spoke skip extraction
- Phone values with fewer than 7 digits are dropped, so voicemail greetings don't save "calling" or "number" as a phone

Camber Bench gets 8 lead extraction cases from voicemail greetings and real calls. Main's model output had 12 placeholders and this branch had none; the drop checks already kept them out of the CRM, so the bench score is unchanged (474/475 → 475/475).
```

Data-driven change:

```
Voice agents are still exhibiting problems when no transfer destinations exist (production, last 14 days):

- In 18 of 59 calls (31%) to agents with no transfer rules, the agent said it was checking for a transfer, then said it couldn't transfer.
- In 35 of the 43 calls where the caller asked for a person, the agent's first check of transfer destinations came in its reply to that request.

To fix the variability:
- Tell the model on call start whether any transfer destinations exist
- Update the prompt to refer to this

TODO before merge:
- [ ] `recomposeAgentPrompts` before running
```
