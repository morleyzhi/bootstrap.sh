# Bootstrap.sh

An opinionated setup for bootstrapping a new Mac.

- `bootstrap.sh` — the setup script (idempotent, safe to re-run)
- `Brewfile` — every CLI tool, app, font, and VS Code extension
- `macos.sh` — macOS `defaults` settings, verified against the current machine
- `zsh/` — shell config (zshrc, custom oh-my-zsh theme, git-prompt, ripgreprc), symlinked into place so edits show up in `git diff`
- `vscode/` — VS Code settings + keybindings (backup alongside VS Code Settings Sync)
- `iterm/` — iTerm2 preferences
- `clocker/` — Clocker preferences (timezone list; no cloud sync exists for it)
- `chrome/` — curated Chrome bookmarks, merged into the bookmarks bar (or import `bookmarks.html` via chrome://bookmarks), plus `search-shortcuts.tsv` documenting site-search keywords (restore by hand at chrome://settings/searchEngines — they live in Chrome Sync, not on disk here)
- `backup.sh` — pulls current machine state back into this repo

## Setup

1. (Optional) Install Xcode from the Mac App Store and accept its license.
2. Clone this repo and run:

```sh
./bootstrap.sh
```

The script installs Xcode Command Line Tools and Homebrew if missing, runs
`brew bundle`, sets up nvm/Node, oh-my-zsh, git + an SSH key, restores VS Code
settings, and applies macOS defaults.

## Post-run todos

- Sign in to 1Password, Dropbox, and browser profiles
- iTerm2 → Settings → General → Preferences → load from `iterm/`
- Add the generated SSH key to GitHub (it's on your clipboard)

## Keeping it in sync

Run `./backup.sh` every so often — it copies current VS Code/iTerm2 config into
the repo and dumps a fresh `Brewfile.dump` to diff against `Brewfile`.
