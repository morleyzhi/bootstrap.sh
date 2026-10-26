import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { askJev, exitIfNoKey, readStdin, sh } from './jev.mjs';

const POSTABLE_ACTIONS = new Set(['post', 'post_as_low']);
const EVENT_BY_FLAG = { approve: 'APPROVE', 'request-changes': 'REQUEST_CHANGES', comment: 'COMMENT' };
const GUIDELINE_THRESHOLD = 0.6;

const readFlag = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
};

const buildBody = (finding) => {
  const problem = (finding.problem ?? finding.summary ?? '').trim();
  const fix = (finding.suggested_fix ?? '').trim();
  const priority = finding.triage.action === 'post_as_low' ? 'Low' : finding.triage.priority;
  return `[${priority}] ${problem}\n\nSuggested fix: ${fix}`;
};

const GUIDELINE_RULES = {
  plain_language: {
    instructions: 'Does the problem paragraph name the observable behavior in plain language, so a reader who has never opened the code can tell what goes wrong and for whom?',
    true: 'Describes what a user, caller, or engineer observes; internal identifiers appear only to locate the code.',
    false: 'Leans on internal concepts, mechanism-only wording, or identifiers the reader must already know to follow the sentence.',
  },
  no_hedging: {
    instructions: 'Is the comment free of hedging words such as may, might, could, possibly, perhaps, seems, or generally, unless it states what the uncertainty is?',
    true: 'States facts directly, or names the specific uncertainty.',
    false: 'Hedges without saying what is uncertain.',
  },
  fix_is_action: {
    instructions: 'Is the text after "Suggested fix:" one concrete action the author can carry out, rather than a question, a restatement of the problem, or a vague direction such as "handle this case"?',
    true: 'A specific change: what to add, remove, move, or check, and where.',
    false: 'A question, a restatement, or advice too vague to act on.',
  },
  problem_then_fix: {
    instructions: 'Does the comment state the problem first and keep the recommendation entirely inside the "Suggested fix:" paragraph?',
    true: 'The problem paragraph contains no recommendation; the fix paragraph contains no new problem.',
    false: 'The fix leaks into the problem paragraph, or the fix paragraph introduces a new problem.',
  },
};

const checkGuidelines = async (comments) => {
  const answers = await askJev({
    state: { comments: comments.map((comment) => comment.body) },
    questions: Object.fromEntries(
      comments.flatMap((_, index) =>
        Object.entries(GUIDELINE_RULES).map(([rule, definition]) => [
          `${rule}_${index}`,
          {
            type: 'noul',
            instructions: `For the review comment \`comments[${index}]\`: ${definition.instructions}`,
            criteria: { true: definition.true, false: definition.false },
          },
        ]),
      ),
    ),
    timeoutMs: 15_000,
  });
  return comments.map((comment, index) => ({
    ...comment,
    failedRules: Object.keys(GUIDELINE_RULES).filter((rule) => (answers[`${rule}_${index}`]?.noul ?? 0) < GUIDELINE_THRESHOLD),
  }));
};

const main = async () => {
  exitIfNoKey();
  const input = JSON.parse(await readStdin());
  const findings = Array.isArray(input) ? input : input.findings;
  const isDryRun = process.argv.includes('--dry-run');
  const isIncludingUnverified = process.argv.includes('--include-unverified');
  if (isIncludingUnverified && !isDryRun) {
    console.error('--include-unverified is allowed only with --dry-run. Verify findings before posting.');
    process.exit(1);
  }
  const prNumber = readFlag('pr') ?? sh('gh', ['pr', 'view', '--json', 'number', '--jq', '.number']);
  if (!prNumber) {
    console.error('No PR found. Pass --pr <number> or run inside the PR branch.');
    process.exit(1);
  }
  const repo = readFlag('repo') ?? sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);

  const unverified = findings.filter((finding) => finding.triage?.action === 'verify_then_post');
  if (unverified.length && !isIncludingUnverified) {
    console.error(`${unverified.length} finding(s) still marked verify_then_post. Verify them and set triage.action to post or drop, or pass --include-unverified.`);
    process.exit(1);
  }
  const toPost = findings.filter((finding) => POSTABLE_ACTIONS.has(finding.triage?.action) || (isIncludingUnverified && finding.triage?.action === 'verify_then_post'));
  const missingFix = toPost.filter((finding) => !finding.suggested_fix?.trim());
  if (missingFix.length) {
    console.error(`Add a suggested_fix to: ${missingFix.map((finding) => `${finding.file}:${finding.line}`).join(', ')}`);
    process.exit(1);
  }

  const comments = await checkGuidelines(toPost.map((finding) => ({ path: finding.file, line: finding.line, side: 'RIGHT', body: buildBody(finding) })));
  const offGuideline = comments.filter((comment) => comment.failedRules.length);
  if (offGuideline.length) {
    console.error('These comments break review-comment rules. Rewrite problem or suggested_fix and re-run:');
    for (const comment of offGuideline) console.error(`\n${comment.path}:${comment.line} fails ${comment.failedRules.join(', ')}\n${comment.body}`);
    process.exit(1);
  }

  const isBlocking = toPost.some((finding) => finding.triage.isBlocking);
  const event = EVENT_BY_FLAG[readFlag('event')] ?? (isBlocking ? 'REQUEST_CHANGES' : 'APPROVE');
  const body = readFlag('body') ?? (event === 'REQUEST_CHANGES' ? `Requesting changes: ${toPost.filter((finding) => finding.triage.isBlocking).length} finding(s) would break the app if merged.` : '');
  const payload = { event, body, comments: comments.map(({ path, line, side, body: commentBody }) => ({ path, line, side, body: commentBody })) };

  console.log(`${isDryRun ? 'Would post' : 'Posting'} ${event} on ${repo}#${prNumber} with ${payload.comments.length} inline comment(s)`);
  for (const comment of payload.comments) console.log(`\n${comment.path}:${comment.line}\n${comment.body}`);
  if (isDryRun) return;

  const payloadPath = join(tmpdir(), `review-${prNumber}-${Date.now()}.json`);
  writeFileSync(payloadPath, JSON.stringify(payload));
  const result = sh('gh', ['api', `repos/${repo}/pulls/${prNumber}/reviews`, '-X', 'POST', '--input', payloadPath, '--jq', '.html_url'], { timeoutMs: 30_000 });
  if (!result) {
    console.error(`Posting failed. Common cause: a comment line is not part of the PR diff. Payload kept at ${payloadPath}; run gh api with it to see the error.`);
    process.exit(1);
  }
  console.log(`\nPosted: ${result}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
