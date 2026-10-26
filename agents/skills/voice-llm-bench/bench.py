#!/usr/bin/env python3
"""Fetch ElevenLabs calls and compare voice LLM latency and call outcomes per model."""
import argparse, math, collections, concurrent.futures, datetime, hashlib, json, os, random, sys, time, urllib.request

API = 'https://api.elevenlabs.io/v1/convai'
CACHE = os.path.expanduser('~/.cache/voice-llm-bench')
TURN_METRICS = {
    'gap': 'convai_ttf_audio_since_silence',
    'wait': 'convai_turn_silence_before_initiation',
    'llm_ttfb': 'convai_llm_service_ttfb',
    'llm_sentence': 'convai_llm_service_ttf_sentence',
    'tts_ttfb': 'convai_tts_service_ttfb',
}


def get(path, key):
    for attempt in range(3):
        try:
            req = urllib.request.Request(API + path, headers={'xi-api-key': key})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def list_calls(agent_id, since, key):
    cursor, out = None, []
    while True:
        q = f'/conversations?agent_id={agent_id}&page_size=100&call_start_after_unix={since}'
        page = get(q + (f'&cursor={cursor}' if cursor else ''), key)
        out += page['conversations']
        cursor = page.get('next_cursor')
        if not page.get('has_more') or not cursor:
            return out


def compact_set(xs):
    return {x for x in xs if x}


def call_model(turns):
    models = set()
    for t in turns:
        if t['role'] != 'agent':
            continue
        if t.get('producing_llm'):
            models.add(t['producing_llm'])
        models |= set(((t.get('llm_usage') or {}).get('model_usage') or {}).keys())
    return '+'.join(sorted(models)) or None


def summarize(d):
    turns = d.get('transcript') or []
    meta = d.get('metadata') or {}
    agent_turns = [t for t in turns if t['role'] == 'agent']
    user_turns = [t for t in turns if t['role'] == 'user' and (t.get('message') or '').strip()]
    metrics = []
    for t in agent_turns:
        m = ((t.get('conversation_turn_metrics') or {}).get('metrics')) or {}
        if TURN_METRICS['llm_ttfb'] not in m:
            continue
        row = {k: m[v]['elapsed_time'] for k, v in TURN_METRICS.items() if v in m}
        if all(k in row for k in ('gap', 'wait', 'llm_sentence', 'tts_ttfb')):
            row['other'] = row['gap'] - row['wait'] - row['llm_sentence'] - row['tts_ttfb']
        metrics.append(row)
    tool_results = [r for t in turns for r in (t.get('tool_results') or [])]
    usage = ((meta.get('charging') or {}).get('llm_usage') or {}).get('irreversible_generation', {}).get('model_usage', {})
    llm_cost = sum(p.get('price', 0) for u in usage.values() for p in u.values() if isinstance(p, dict))
    return {
        'id': d['conversation_id'], 'agent_id': d['agent_id'], 'agent_name': d.get('agent_name'),
        'version_id': d.get('version_id'), 'start': meta.get('start_time_unix_secs'),
        'duration': meta.get('call_duration_secs') or 0, 'llm': call_model(turns),
        'tts': '+'.join(sorted(compact_set((t.get('conversation_turn_metrics') or {}).get('convai_tts_model')
                                           for t in agent_turns))) or None,
        'successful': (d.get('analysis') or {}).get('call_successful'),
        'termination': meta.get('termination_reason'), 'error': bool(meta.get('error')),
        'user_turns': len(user_turns), 'agent_turns': len(agent_turns),
        'interrupted': sum(1 for t in agent_turns if t.get('interrupted')),
        'tool_calls': len(tool_results), 'tool_errors': sum(1 for r in tool_results if r.get('is_error')),
        'llm_cost': llm_cost, 'turns': metrics,
    }


def fetch(args):
    key = args.key or os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        sys.exit('Pass --key or set ELEVENLABS_API_KEY')
    snap = os.path.join(CACHE, datetime.date.today().isoformat())
    raw = os.path.join(CACHE, 'raw')
    os.makedirs(raw, exist_ok=True)
    os.makedirs(snap, exist_ok=True)
    since = int(time.time()) - args.days * 86400
    listed = [c for a in args.agents for c in list_calls(a, since, key)]
    done = [c for c in listed if c.get('status') == 'done']

    def load(cid):
        path = os.path.join(raw, cid + '.json')
        if not os.path.exists(path):
            with open(path, 'w') as f:
                json.dump(get(f'/conversations/{cid}', key), f)
            os.chmod(path, 0o600)
        with open(path) as f:
            return summarize(json.load(f))

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        rows = list(pool.map(load, [c['conversation_id'] for c in done]))
    rows.sort(key=lambda r: r['start'])
    corpus = os.path.join(snap, 'calls.jsonl')
    with open(corpus, 'w') as f:
        f.writelines(json.dumps(r) + '\n' for r in rows)
    os.chmod(corpus, 0o600)
    sha = hashlib.sha256(open(corpus, 'rb').read()).hexdigest()
    manifest = {'agents': args.agents, 'days': args.days, 'since': since, 'listed': len(listed),
                'done': len(rows), 'sha256': sha}
    with open(os.path.join(snap, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print(corpus, json.dumps(manifest))


def pct(xs, p):
    xs = sorted(xs)
    return xs[max(0, math.ceil(len(xs) * p / 100) - 1)] if xs else None


def boot_ci(a_calls, b_calls, metric, n=2000):
    rng = random.Random(0)
    diffs = []
    for _ in range(n):
        a = [t[metric] for c in rng.choices(a_calls, k=len(a_calls)) for t in c['turns'] if metric in t]
        b = [t[metric] for c in rng.choices(b_calls, k=len(b_calls)) for t in c['turns'] if metric in t]
        if a and b:
            diffs.append(pct(b, 50) - pct(a, 50))
    return pct(diffs, 2.5), pct(diffs, 97.5)


def fmt(x):
    return '-' if x is None else f'{x:.2f}'


def label(variant):
    return variant.replace('|', ' + ')


def pauses(calls):
    return [t['gap'] for c in calls for t in c['turns'] if 'gap' in t]


def mean_ci(a, b, n=2000):
    rng = random.Random(0)
    diffs = sorted(sum(rng.choices(b, k=len(b))) / len(b) - sum(rng.choices(a, k=len(a))) / len(a) for _ in range(n))
    return pct(diffs, 2.5), pct(diffs, 97.5)


def summary_rows(calls, variants, grades, min_calls):
    by = {v: [c for c in calls if c['model'] == v] for v in variants}
    graded = {v: [grades[c['id']]['grade'] for c in by[v] if c['id'] in grades] for v in variants}
    base, base_grades = by[variants[0]], graded[variants[0]]
    rows, notes = [], []
    for i, v in enumerate(variants):
        xs = pauses(by[v])
        if not xs:
            continue
        p50, grade = fmt(pct(xs, 50)), fmt(sum(graded[v]) / len(graded[v])) if graded[v] else '-'
        if i:
            change = pct(xs, 50) - pct(pauses(base), 50)
            if len(by[v]) < min_calls or len(base) < min_calls:
                lo = hi = None
            else:
                lo, hi = boot_ci(base, by[v], 'gap')
            if lo is None or lo <= 0 <= hi:
                p50 += '*'
                ci = f', 95% CI [{lo:+.2f}, {hi:+.2f}]' if lo is not None else ', too few calls for a CI'
                notes.append(f'{label(v)} pause: {len(by[v])} calls vs {len(base)}; P50 {change:+.2f} s{ci}.')
            if graded[v]:
                if len(graded[v]) < 5 or len(base_grades) < 5:
                    glo = ghi = None
                else:
                    glo, ghi = mean_ci(base_grades, graded[v])
                if glo is None or glo <= 0 <= ghi:
                    grade += '*'
                    gci = f', 95% CI [{glo:+.2f}, {ghi:+.2f}]' if glo is not None else ', too few graded calls for a CI'
                    notes.append(f'{label(v)} grade: {len(graded[v])} graded calls vs {len(base_grades)}{gci}.')
        rows.append(f'| {label(v)} | {p50} | {fmt(pct(xs, 95))} | {fmt(max(xs))} | {grade} |')
    return rows, notes


def outcome_rows(calls, variants):
    rows = []
    for v in variants:
        cs = [c for c in calls if c['model'] == v]
        if not cs:
            continue
        rated = [c for c in cs if c['successful'] in ('success', 'failure')]
        rate = sum(c['successful'] == 'success' for c in rated) / len(rated) if rated else None
        mins = sum(c['duration'] for c in cs) / 60
        backup = sum('+' in (c['llm'] or '') for c in cs)
        rows.append(f'| {label(v)} | {fmt(rate)} | {sum(c["tool_errors"] for c in cs)}/{sum(c["tool_calls"] for c in cs)} | '
                    f'{fmt(sum(c["llm_cost"] for c in cs) / mins if mins else None)} | {backup} |')
    return rows


def report(args):
    snap = args.snapshot or max(p for p in os.listdir(CACHE) if p[:2] == '20')
    snap_dir = os.path.join(CACHE, snap)
    calls = [json.loads(l) for l in open(os.path.join(snap_dir, 'calls.jsonl'))]
    for c in calls:
        c['model'] = f"{(c['llm'] or '').split('+')[0]}|{c['tts']}"
    grades_path = os.path.join(CACHE, 'grades.json')
    grades = json.load(open(grades_path)) if os.path.exists(grades_path) else {}
    manifest = json.load(open(os.path.join(snap_dir, 'manifest.json')))
    kept = [c for c in calls if c['duration'] >= args.min_duration and c['user_turns'] >= 1 and c['turns']]
    variants = args.variants
    rows, notes = summary_rows(kept, variants, grades, args.min_calls)
    lines = [f'# Voice LLM bench: {" vs ".join(label(v) for v in variants)}\n',
             f'Snapshot `{snap_dir}`, sha256 {manifest["sha256"][:12]}, {len(kept)} of {len(calls)} done calls kept '
             f'(10 s or more, a caller turn), all agents. Pause = caller stops talking until agent audio starts, in '
             f'seconds. Grade = mean blind transcript grade, 1-5. * = not significantly different from '
             f'{label(variants[0])}.\n',
             '| Model + voice model | Pause P50 | Pause P95 | Pause Max | Grade |',
             '|---|---|---|---|---|'] + rows
    lines += ['', *[f'\\* {n}' for n in notes]]
    lines += ['\n## Outcomes\n', '| Model + voice model | Success rate | Tool errors | LLM $/min | Backup LLM calls |',
              '|---|---|---|---|---|'] + outcome_rows(kept, variants)
    flagged = [(label(c['model']), grades[c['id']], c['id']) for c in kept
               if c['model'] in variants and grades.get(c['id'], {}).get('flags', 'none') != 'none']
    if flagged:
        lines.append('\n## Flagged calls\n')
        lines += [f'- {v}: {g["grade"]}, {g["flags"]}, {g["reason"]} https://elevenlabs.io/app/agents/history/{cid}'
                  for v, g, cid in sorted(flagged, key=lambda x: (x[0], x[1]['grade']))]
    lines.append('\n## Longest pauses\n')
    for v in variants:
        worst = sorted(((t['gap'], c) for c in kept if c['model'] == v for t in c['turns'] if 'gap' in t),
                       key=lambda x: -x[0])[:5]
        lines += [f'- {label(v)} {gap:.2f}s {c["agent_name"]} https://elevenlabs.io/app/agents/history/{c["id"]}'
                  for gap, c in worst]
    out_dir = os.path.join(snap_dir, 'runs', datetime.datetime.now().strftime('%H%M') + '-' + '-vs-'.join(variants).replace('|', '_'))
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, 'report.md'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    print('\nreport:', os.path.join(out_dir, 'report.md'))


def save_grades(args):
    key = json.load(open(args.key))
    path = os.path.join(CACHE, 'grades.json')
    grades = json.load(open(path)) if os.path.exists(path) else {}
    for line in open(args.graded):
        parts = [p.strip() for p in line.split('|')]
        if len(parts) == 4 and parts[0] in key:
            grades[key[parts[0]]] = {'grade': int(parts[1]), 'reason': parts[2], 'flags': parts[3]}
    with open(path, 'w') as f:
        json.dump(grades, f, indent=1)
    os.chmod(path, 0o600)
    print(path, len(grades), 'graded calls')


p = argparse.ArgumentParser()
sub = p.add_subparsers(dest='cmd', required=True)
f = sub.add_parser('fetch')
f.add_argument('--agents', nargs='+', required=True)
f.add_argument('--days', type=int, default=14)
f.add_argument('--key')
r = sub.add_parser('report')
r.add_argument('--variants', nargs='+', required=True, help='llm|tts pairs, baseline first')
r.add_argument('--snapshot')
r.add_argument('--min-duration', type=int, default=10)
r.add_argument('--min-calls', type=int, default=10)
g = sub.add_parser('grades')
g.add_argument('--key', required=True, help='JSON map of callNN to conversation id')
g.add_argument('--graded', required=True, help='grader reply, one "callNN | grade | reason | flags" line per call')
a = p.parse_args()
{'fetch': fetch, 'report': report, 'grades': save_grades}[a.cmd](a)
