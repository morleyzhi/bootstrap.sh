import { askJev, exitIfNoKey, sh } from './jev.mjs';

const PROTECTED = new Set(['main', 'master', 'scripts']);
const DAY_MS = 86_400_000;
const isApply = process.argv.includes('--apply');
const isNoFetch = process.argv.includes('--no-fetch');
const cwd = sh('git', ['rev-parse', '--show-toplevel']) ?? process.cwd();
const git = (args, options = {}) => sh('git', args, { cwd, timeoutMs: 20_000, ...options });

const readWorktrees = () =>
  (git(['worktree', 'list', '--porcelain']) || '')
    .split('\n\n')
    .map((block) => {
      const path = block.match(/^worktree (.+)$/m)?.[1];
      const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1];
      if (!path || !branch) return null;
      const dirtyFiles = (sh('git', ['status', '--porcelain'], { cwd: path, timeoutMs: 20_000 }) || '').split('\n').filter(Boolean).length;
      return { path, branch, dirtyFiles };
    })
    .filter(Boolean);

const readPullRequests = () => {
  const json = sh('gh', ['pr', 'list', '--state', 'all', '--limit', '300', '--json', 'headRefName,state,number,isDraft,mergedAt,closedAt,updatedAt,author'], { cwd, timeoutMs: 30_000 });
  const byBranch = new Map();
  for (const pr of JSON.parse(json || '[]')) {
    const existing = byBranch.get(pr.headRefName);
    if (!existing || pr.updatedAt > existing.updatedAt) byBranch.set(pr.headRefName, pr);
  }
  return byBranch;
};

const readBranches = () => {
  const me = sh('gh', ['api', 'user', '--jq', '.login'], { timeoutMs: 8000 });
  const worktrees = readWorktrees();
  const prs = readPullRequests();
  const current = git(['branch', '--show-current']);
  const rows = (git(['for-each-ref', '--format=%(refname:short)|%(committerdate:unix)|%(upstream:short)|%(upstream:track)|%(authorname)', 'refs/heads']) || '').split('\n').filter(Boolean);
  return rows.map((row) => {
    const [name, committedAt, upstream, track, lastAuthor] = row.split('|');
    const pr = prs.get(name) ?? null;
    const isUpstreamGone = track === '[gone]';
    const hasUpstream = Boolean(upstream) && !isUpstreamGone;
    const unpushedCommits = hasUpstream ? Number(git(['rev-list', '--count', `${upstream}..${name}`]) ?? 0) : null;
    const commitsComparedWithMain = git(['cherry', 'main', name]);
    const commitsNotOnMain = commitsComparedWithMain === null
      ? null
      : commitsComparedWithMain.split('\n').filter((line) => line.startsWith('+')).length;
    return {
      name,
      ageDays: Math.floor((Date.now() - Number(committedAt) * 1000) / DAY_MS),
      isCurrent: name === current,
      hasUpstream,
      isUpstreamGone,
      unpushedCommits,
      commitsNotOnMain,
      lastAuthor,
      worktree: worktrees.find((worktree) => worktree.branch === name) ?? null,
      pr: pr ? { number: pr.number, state: pr.state, isDraft: pr.isDraft, author: pr.author?.login, isMine: pr.author?.login === me, daysSinceUpdate: Math.floor((Date.now() - Date.parse(pr.updatedAt)) / DAY_MS) } : null,
    };
  });
};

const decideByRules = (branch) => {
  if (PROTECTED.has(branch.name) || branch.isCurrent) return { verdict: 'keep', reason: branch.isCurrent ? 'checked out here' : 'protected' };
  if (branch.worktree?.dirtyFiles) return { verdict: 'ask', reason: `worktree has ${branch.worktree.dirtyFiles} uncommitted files` };
  if (branch.pr?.state === 'OPEN') return { verdict: 'keep', reason: `PR #${branch.pr.number} open${branch.pr.isDraft ? ' (draft)' : ''}` };
  if (branch.unpushedCommits > 0) return { verdict: 'keep', reason: `${branch.unpushedCommits} unpushed commits` };
  if (branch.commitsNotOnMain === 0) return { verdict: 'safe', reason: 'no commits beyond main' };
  return null;
};

const askJevVerdicts = async (branches) => {
  if (!branches.length) return new Map();
  const answers = await askJev({
    state: { branches },
    questions: Object.fromEntries(
      branches.flatMap((branch, index) => [
        [
          `verdict_${index}`,
          {
            type: 'choice',
            instructions: `For \`branches[${index}]\`: should the user keep this local git branch or inspect it before deciding? The branch has commits not on main and no open PR, so it cannot be deleted automatically.`,
            criteria: {
              ask: 'A checkout of someone else\'s PR for review, a closed PR whose work appears abandoned, or a throwaway named like a test, experiment, or backup.',
              keep: 'Recent work (under a week old) by the user with no PR yet, or a name that suggests it is in progress.',
            },
          },
        ],
      ]),
    ),
    timeoutMs: 15_000,
  });
  return new Map(branches.map((branch, index) => [branch.name, answers[`verdict_${index}`]]));
};

const describe = (branch) =>
  [
    branch.name,
    `${branch.ageDays}d`,
    branch.pr ? `PR #${branch.pr.number} ${branch.pr.state.toLowerCase()}${branch.pr.isMine ? '' : ` by ${branch.pr.author}`}` : 'no PR',
    branch.worktree ? `worktree ${branch.worktree.path.replace(process.env.HOME, '~')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

const deleteBranch = (branch) => {
  if (branch.worktree) {
    const removed = git(['worktree', 'remove', branch.worktree.path]);
    if (removed === null) return `failed to remove worktree ${branch.worktree.path}`;
  }
  return git(['branch', '-D', branch.name]) === null ? 'failed to delete branch' : 'deleted';
};

const main = async () => {
  exitIfNoKey();
  if (!isNoFetch) git(['fetch', '--prune', '--quiet'], { timeoutMs: 60_000 });
  const branches = readBranches();
  const decisions = new Map();
  const undecided = [];
  for (const branch of branches) {
    const ruled = decideByRules(branch);
    if (ruled) decisions.set(branch.name, ruled);
    else undecided.push(branch);
  }
  const jevVerdicts = await askJevVerdicts(undecided);
  for (const branch of undecided) {
    const answer = jevVerdicts.get(branch.name);
    const verdict = answer?.choice === 'keep' && answer.confidence >= 0.5 ? 'keep' : 'ask';
    decisions.set(branch.name, { verdict, reason: `jev ${answer?.choice ?? 'unavailable'} (${(answer?.confidence ?? 0).toFixed(2)})` });
  }

  const groups = { safe: [], ask: [], keep: [] };
  for (const branch of branches) groups[decisions.get(branch.name).verdict].push(branch);

  for (const verdict of ['safe', 'ask', 'keep']) {
    if (!groups[verdict].length) continue;
    console.log(`\n${verdict.toUpperCase()} (${groups[verdict].length})`);
    for (const branch of groups[verdict]) {
      const outcome = verdict === 'safe' && isApply ? ` -> ${deleteBranch(branch)}` : '';
      console.log(`  ${describe(branch)} | ${decisions.get(branch.name).reason}${outcome}`);
    }
  }
  if (!isApply && groups.safe.length) console.log('\nDry run. Re-run with --apply to delete the SAFE group and their clean worktrees.');
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
