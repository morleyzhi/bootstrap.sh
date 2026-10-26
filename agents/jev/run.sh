#!/bin/sh
# Runs a Jev script with the nvm default node, so hooks work outside an interactive shell.
export NVM_DIR="$HOME/.nvm"
NODE_BIN=$(ls -d "$NVM_DIR"/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
export PATH="$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:$PATH"
script="$1"; shift; exec node "$HOME/.claude/jev/$script" "$@"
