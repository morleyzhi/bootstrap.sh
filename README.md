# Bootstrap.sh

An opinionated shell script to bootstrap a new Mac.

# Setup

0. Install Xcode from the Mac App Store.
1. Open Xcode and agree to its license.
1. Install Xcode Command Line Tools: `xcode-select --install`
1. Open bootstrap.sh and edit the PACKAGES and CASKS list to your liking.
1. Add or remove [OS X settings](https://github.com/mathiasbynens/dotfiles/blob/master/.osx) as you see fit.

# Run

Run `sh bootstrap.sh` from the directory you cloned this project in.

# Post-run todos

- Setup Dropbox
- `mackup restore`
