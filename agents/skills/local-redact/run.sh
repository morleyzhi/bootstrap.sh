#!/bin/sh
set -eu
skill_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
exec "$skill_dir/.venv/bin/python" "$skill_dir/redact.py" "$@"
