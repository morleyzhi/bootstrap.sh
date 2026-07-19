# Bootstrap.sh

An opinionated setup for bootstrapping a new Mac.

- `bootstrap.sh` — the setup script (idempotent, safe to re-run)
- `Brewfile` — every CLI tool, app, font, and VS Code extension
- `macos.sh` — macOS `defaults` settings, verified against the current machine
- `vscode/` — VS Code settings + keybindings (backup alongside VS Code Settings Sync)
- `iterm/` — iTerm2 preferences
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
- `mackup restore`
- iTerm2 → Settings → General → Preferences → load from `iterm/`
- Add the generated SSH key to GitHub (it's on your clipboard)

## Keeping it in sync

Run `./backup.sh` every so often — it copies current VS Code/iTerm2 config into
the repo and dumps a fresh `Brewfile.dump` to diff against `Brewfile`.
