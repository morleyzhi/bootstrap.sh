import { execFileSync } from 'node:child_process';

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const KEYCHAIN_SERVICE = 'jev-api-key';

export const MISSING_KEY_MESSAGE = [
  'Jev API key not found in the macOS Keychain.',
  'Ask the user to add it once (the key is typed at a hidden prompt, nothing lands in shell history):',
  `  security add-generic-password -a "$USER" -s ${KEYCHAIN_SERVICE} -w`,
].join('\n');

export const readApiKey = () => {
  if (process.env.JEV_API_KEY) return process.env.JEV_API_KEY;
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-a', process.env.USER, '-s', KEYCHAIN_SERVICE, '-w'],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .toString()
      .trim();
  } catch {
    return null;
  }
};

export const exitIfNoKey = () => {
  if (readApiKey()) return;
  process.stderr.write(`${MISSING_KEY_MESSAGE}\n`);
  process.exit(2);
};

export const askJev = async ({ state, questions, timeoutMs = 8000 }) => {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error(MISSING_KEY_MESSAGE);
  const response = await fetch(JEV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, state, questions }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Jev HTTP ${response.status}`);
  const body = await response.json();
  return body.answers;
};

export const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
};

export const sh = (command, args, options = {}) => {
  try {
    return execFileSync(command, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: options.timeoutMs ?? 4000,
      cwd: options.cwd,
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
};
