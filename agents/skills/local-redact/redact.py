import argparse
import json
import os
from pathlib import Path
import sys

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

REPO = 'divergentlabs/masker-mini'
REVISION = 'da82d8f02653c4cfb9856dbcec0a2dc6c6bbe145'
ROOT = Path(__file__).resolve().parent
MODEL = ROOT / 'model'


def setup():
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id=REPO,
        revision=REVISION,
        local_dir=MODEL,
        allow_patterns=['onnx/model_fp16.onnx', 'tokenizer.json', 'config.json',
                        'LICENSE', 'NOTICE', 'README.md'],
    )
    print(f'Downloaded {REPO}@{REVISION}', file=sys.stderr)


def detect(text):
    tokenizer = Tokenizer.from_file(str(MODEL / 'tokenizer.json'))
    config = json.loads((MODEL / 'config.json').read_text())
    tokenizer.enable_truncation(max_length=512, stride=128)
    tokenizer.no_padding()
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    session = ort.InferenceSession(str(MODEL / 'onnx/model_fp16.onnx'),
                                   sess_options=options,
                                   providers=['CPUExecutionProvider'])
    encoded = tokenizer.encode(text)
    spans = []
    for chunk in [encoded, *encoded.overflowing]:
        values = {'input_ids': chunk.ids, 'attention_mask': chunk.attention_mask,
                  'token_type_ids': chunk.type_ids}
        feed = {entry.name: np.asarray([values[entry.name]], dtype=np.int64)
                for entry in session.get_inputs()}
        predictions = session.run(None, feed)[0][0].argmax(axis=-1)
        active = None
        for prediction, (start, end), special in zip(
                predictions, chunk.offsets, chunk.special_tokens_mask):
            label = config['id2label'][str(int(prediction))]
            if special or start == end or label == 'O':
                active = None
                continue
            prefix, kind = label.split('-', 1)
            while start < end and text[start].isspace():
                start += 1
            while end > start and text[end - 1].isspace():
                end -= 1
            if start == end:
                continue
            if (active is not None and prefix in ('I', 'E')
                    and active['type'] == kind):
                active['end'] = end
            else:
                active = {'start': start, 'end': end, 'type': kind}
                spans.append(active)
            if prefix in ('S', 'E'):
                active = None
    merged = []
    for span in sorted(spans, key=lambda item: (item['start'], item['end'])):
        if merged and span['start'] < merged[-1]['end']:
            previous = merged[-1]
            previous['end'] = max(previous['end'], span['end'])
            if previous['type'] != span['type']:
                previous['type'] = 'PII'
        else:
            merged.append(span.copy())
    return merged


def redact(text, spans):
    result = []
    cursor = 0
    for span in spans:
        result.extend([text[cursor:span['start']], f"[{span['type']}]"])
        cursor = span['end']
    result.append(text[cursor:])
    return ''.join(result)


def main():
    parser = argparse.ArgumentParser(description='Redact UTF-8 text locally with masker-mini.')
    parser.add_argument('input', nargs='?', help='UTF-8 file; omit or use - for stdin')
    parser.add_argument('-o', '--output', help='Create a new UTF-8 output file')
    parser.add_argument('--json', action='store_true', help='Include offsets and labels, without original values')
    parser.add_argument('--setup', action='store_true', help='Download the pinned model; requires network')
    args = parser.parse_args()
    if args.setup:
        setup()
        return
    if not (MODEL / 'onnx/model_fp16.onnx').is_file():
        parser.error('Model is missing. Run run.sh --setup first.')
    text = sys.stdin.read() if args.input in (None, '-') else Path(args.input).read_text(encoding='utf-8')
    spans = detect(text)
    output = redact(text, spans)
    if args.json:
        output = json.dumps({'text': output, 'entities': spans, 'model': REPO,
                             'revision': REVISION}, ensure_ascii=False) + '\n'
    if args.output:
        descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            stream.write(output)
    else:
        sys.stdout.write(output)


if __name__ == '__main__':
    main()
