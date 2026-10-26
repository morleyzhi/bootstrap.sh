import { askJev, exitIfNoKey, readStdin } from './jev.mjs';

const SUBSTANCE_LEVELS = [
  'Style, naming, or preference. No observable behavior changes.',
  'Theoretical. Needs inputs or states no caller in this codebase produces.',
  'Plausible on realistic inputs, but the impact is minor or self-correcting.',
  'Real defect on common inputs, or a security, data-exposure, or money-handling error.',
];
const CHUNK_SIZE = 10;
const BLOCKING_THRESHOLD = 0.7;

const buildQuestions = (findings, offset) =>
  Object.fromEntries(
    findings.flatMap((_, localIndex) => {
      const index = offset + localIndex;
      const path = `findings[${index}]`;
      const entries = [
        [
          `substance_${index}`,
          {
            type: 'score',
            instructions: `How substantive is \`${path}\`? Judge from its summary and failure scenario against the code excerpt in \`${path}.excerpt\` when present.`,
            criteria: SUBSTANCE_LEVELS,
          },
        ],
        [
          `priority_${index}`,
          {
            type: 'choice',
            instructions: `Which review priority label fits \`${path}\`?`,
            criteria: {
              Critical: 'Security hole, data loss or exposure, wrong charges or balances, or a production outage.',
              High: 'Incorrect behavior real users or engineers hit in normal use, or a regression of shipped behavior.',
              Low: 'Nit, style, readability, or an edge case with negligible impact.',
            },
          },
        ],
        [
          `breaks_app_${index}`,
          {
            type: 'noul',
            instructions: `If the pull request merged with \`${path}\` left unfixed, would the app break for users or staff?`,
            criteria: {
              true: 'A crash, a blocked user flow, lost or exposed data, wrong charges or balances, a failed deploy, or an endpoint that returns errors on normal requests.',
              false: 'Degraded quality, a rare edge case, a maintainability or style problem, or a defect users can work around.',
            },
          },
        ],
        [
          `needs_code_check_${index}`,
          {
            type: 'noul',
            instructions: `Does confirming \`${path}\` require reading code beyond the finding itself, such as tracing callers, checking a type definition, or inspecting data?`,
            criteria: {
              true: 'The claim rests on an assumption about other code or data (a value can be undefined, a caller passes X, an index exists) that the finding does not show.',
              false: 'The defect is visible from the finding and excerpt alone.',
            },
          },
        ],
      ];
      if (index > 0) {
        entries.push([
          `duplicate_${index}`,
          {
            type: 'noul',
            instructions: `Is \`${path}\` the same underlying problem as any earlier entry in \`findings\` (index below ${index})?`,
            criteria: {
              true: 'Fixing an earlier finding would fix this one too, or both describe one root cause in different places.',
              false: 'A distinct root cause, even if in the same file.',
            },
          },
        ]);
      }
      return entries;
    }),
  );

const decideAction = ({ substance, duplicate, needsCodeCheck }) => {
  if (duplicate >= 0.7) return 'drop_duplicate';
  if (substance < 1.0) return 'drop';
  if (substance < 1.75) return 'post_as_low';
  return needsCodeCheck >= 0.5 ? 'verify_then_post' : 'post';
};

const main = async () => {
  exitIfNoKey();
  const findings = JSON.parse(await readStdin());
  if (!Array.isArray(findings) || !findings.length) {
    console.error('Expected a non-empty JSON array of findings on stdin.');
    process.exit(1);
  }
  const answers = {};
  for (let offset = 0; offset < findings.length; offset += CHUNK_SIZE) {
    const chunk = findings.slice(offset, offset + CHUNK_SIZE);
    Object.assign(answers, await askJev({ state: { findings }, questions: buildQuestions(chunk, offset), timeoutMs: 20_000 }));
  }
  const triaged = findings.map((finding, index) => {
    const substance = answers[`substance_${index}`]?.score ?? 0;
    const duplicate = answers[`duplicate_${index}`]?.noul ?? 0;
    const needsCodeCheck = answers[`needs_code_check_${index}`]?.noul ?? 0;
    const breaksApp = answers[`breaks_app_${index}`]?.noul ?? 0;
    const priority = answers[`priority_${index}`];
    const action = decideAction({ substance, duplicate, needsCodeCheck });
    return {
      ...finding,
      triage: {
        action,
        priority: priority?.choice ?? 'Low',
        priorityConfidence: Number((priority?.confidence ?? 0).toFixed(2)),
        substance: Number(substance.toFixed(2)),
        duplicateOfEarlier: Number(duplicate.toFixed(2)),
        needsCodeCheck: Number(needsCodeCheck.toFixed(2)),
        breaksAppIfMerged: Number(breaksApp.toFixed(2)),
        isBlocking: action !== 'drop' && action !== 'drop_duplicate' && breaksApp >= BLOCKING_THRESHOLD,
      },
    };
  });
  const order = { verify_then_post: 0, post: 1, post_as_low: 2, drop_duplicate: 3, drop: 4 };
  triaged.sort((a, b) => order[a.triage.action] - order[b.triage.action] || b.triage.substance - a.triage.substance);
  const blocking = triaged.filter((finding) => finding.triage.isBlocking);
  const review = {
    event: blocking.length ? 'REQUEST_CHANGES' : 'APPROVE',
    blockingCount: blocking.length,
    rule: 'REQUEST_CHANGES only when a non-dropped finding would break the app if merged; otherwise APPROVE with inline comments.',
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ review, findings: triaged }, null, 2));
    return;
  }
  console.log(`Review verdict: ${review.event} (${blocking.length} blocking)\n`);
  for (const finding of triaged) {
    const { action, priority, substance, needsCodeCheck, duplicateOfEarlier, breaksAppIfMerged, isBlocking } = finding.triage;
    console.log(`${action.padEnd(16)} [${priority}]${isBlocking ? ' BLOCKING' : ''} ${finding.file}${finding.line ? `:${finding.line}` : ''} — ${finding.summary}`);
    console.log(`${''.padEnd(16)} substance ${substance}/3, breaks app ${breaksAppIfMerged}, needs code check ${needsCodeCheck}, duplicate ${duplicateOfEarlier}`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
