#!/usr/bin/env bash
#
# Bootstrap script for setting up a new Mac (Apple Silicon).
#
# Idempotent — safe to run multiple times.
#
# Packages, apps, fonts, and VS Code extensions live in the Brewfile.
# VS Code settings/keybindings live in vscode/ (restored by this script).
#
# Not installable via Homebrew / done by hand:
# - Xcode (App Store) — install first if you want the full IDE
# - App Store-only apps (Clocker, etc.)

set -uo pipefail

cd "$(dirname "$0")"

echo_ok() { echo -e '\033[1;32m'"$1"'\033[0m'; }
echo_warn() { echo -e '\033[1;33m'"$1"'\033[0m'; }
echo_error() { echo -e '\033[1;31mERROR: '"$1"'\033[0m'; }

echo_ok "Bootstrap starting. You may be asked for your password (for sudo)."

# --------------------------------------------------------------------------
# Xcode Command Line Tools
# --------------------------------------------------------------------------
if ! xcode-select -p &>/dev/null; then
	echo_warn "Installing Xcode Command Line Tools..."
	xcode-select --install
	echo_error "Re-run this script after the Command Line Tools finish installing."
	exit 1
fi

# --------------------------------------------------------------------------
# Homebrew
# --------------------------------------------------------------------------
if ! command -v brew &>/dev/null; then
	echo_warn "Installing Homebrew..."
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Make brew available in this shell (Apple Silicon path, Intel fallback)
if [[ -x /opt/homebrew/bin/brew ]]; then
	eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
	eval "$(/usr/local/bin/brew shellenv)"
fi

echo_ok "Updating Homebrew..."
brew update

echo_ok "Installing everything in the Brewfile..."
brew bundle --file=Brewfile || echo_warn "Some Brewfile entries failed (apps installed outside Homebrew will conflict — that's fine)."

echo_ok "Cleaning up..."
brew cleanup

# --------------------------------------------------------------------------
# Node (via nvm) + global npm packages
# --------------------------------------------------------------------------
export NVM_DIR="$HOME/.nvm"
mkdir -p "$NVM_DIR"
if [[ -s "$(brew --prefix nvm)/nvm.sh" ]]; then
	# shellcheck disable=SC1091
	source "$(brew --prefix nvm)/nvm.sh"
	if ! nvm current | grep -q '^v'; then
		echo_ok "Installing Node LTS via nvm..."
		nvm install --lts
	fi
	echo_ok "Installing global npm packages..."
	npm install -g pnpm license-checker
fi

# --------------------------------------------------------------------------
# oh-my-zsh
# --------------------------------------------------------------------------
if [[ ! -d ~/.oh-my-zsh ]]; then
	echo_ok "Installing oh-my-zsh..."
	RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi

# --------------------------------------------------------------------------
# Git + GitHub
# --------------------------------------------------------------------------
if [[ ! -f ~/.ssh/id_ed25519 && ! -f ~/.ssh/id_rsa ]]; then
	echo_ok "Configuring git and GitHub..."
	read -rp "GitHub username: " github_user
	read -rp "GitHub email: " github_email

	if [[ $github_user && $github_email ]]; then
		git config --global user.name "$github_user"
		git config --global user.email "$github_email"
		git config --global github.user "$github_user"
		git config --global color.ui true
		git config --global push.default current
		git config --global core.editor "code --wait"
		git config --global credential.helper osxkeychain

		ssh-keygen -t ed25519 -C "$github_email" -f ~/.ssh/id_ed25519
		pbcopy <~/.ssh/id_ed25519.pub
		echo_ok "Your new SSH public key is on the clipboard."
		echo_ok "Add it at https://github.com/settings/ssh/new then run: ssh -T git@github.com"
	fi
fi

# --------------------------------------------------------------------------
# VS Code settings + keybindings (backup lives in vscode/)
# --------------------------------------------------------------------------
VSCODE_USER="$HOME/Library/Application Support/Code/User"
if [[ -d vscode ]]; then
	echo_ok "Restoring VS Code settings and keybindings..."
	mkdir -p "$VSCODE_USER"
	for f in settings.json keybindings.json; do
		if [[ -f "$VSCODE_USER/$f" && ! -f "$VSCODE_USER/$f.bak" ]]; then
			cp "$VSCODE_USER/$f" "$VSCODE_USER/$f.bak"
		fi
		cp "vscode/$f" "$VSCODE_USER/$f"
	done
fi

# --------------------------------------------------------------------------
# Chrome bookmarks (curated list in chrome/bookmarks.html)
# --------------------------------------------------------------------------
if [[ -f chrome/merge-bookmarks.py ]]; then
	echo_ok "Merging Chrome bookmarks..."
	python3 chrome/merge-bookmarks.py || echo_warn "Skipped — see message above."
fi

# --------------------------------------------------------------------------
# Clocker preferences (timezone list has no other backup)
# --------------------------------------------------------------------------
if [[ -f clocker/com.abhishek.Clocker.plist ]]; then
	echo_ok "Restoring Clocker preferences..."
	defaults import com.abhishek.Clocker clocker/com.abhishek.Clocker.plist
fi

# --------------------------------------------------------------------------
# macOS settings (see macos.sh)
# --------------------------------------------------------------------------
echo_ok "Configuring macOS..."
./macos.sh

# --------------------------------------------------------------------------
# Folders
# --------------------------------------------------------------------------
echo_ok "Creating folder structure..."
mkdir -p ~/Projects

echo_ok "Bootstrapping complete."
echo_warn "Post-run: sign in to Dropbox/1Password and import iterm/com.googlecode.iterm2.plist in iTerm2."
