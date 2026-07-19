#!/usr/bin/env bash
#
# Pull current machine state back into this repo so it stays a faithful backup.
# Run occasionally, review the diff, commit.

set -euo pipefail
cd "$(dirname "$0")"

echo "Backing up VS Code settings and keybindings..."
VSCODE_USER="$HOME/Library/Application Support/Code/User"
cp "$VSCODE_USER/settings.json" vscode/settings.json
cp "$VSCODE_USER/keybindings.json" vscode/keybindings.json

echo "Backing up iTerm2 preferences..."
cp ~/Library/Preferences/com.googlecode.iterm2.plist iterm/com.googlecode.iterm2.plist

echo "Backing up Clocker preferences..."
defaults export com.abhishek.Clocker clocker/com.abhishek.Clocker.plist
plutil -convert xml1 clocker/com.abhishek.Clocker.plist

echo "Regenerating Brewfile.dump (compare against Brewfile by hand)..."
brew bundle dump --force --file=Brewfile.dump

echo "Done. Review with: git diff && diff Brewfile Brewfile.dump"
