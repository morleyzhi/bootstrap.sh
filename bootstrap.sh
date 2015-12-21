#!/usr/bin/env bash

# check that xtools are installed before proceeding
gcc --help > /dev/null 2>&1 || { echo >&2 "Install XCode and Command Line Tools first!"; exit 1; }


# ===============================================
# Edit brew and cask packages here!
# -----------------------------------------------

PACKAGES=(
    ack
    git
    hub
    vim
    wget
)

CASKS=(
    adobe-creative-cloud
    atom
    caffeine
    dropbox
    firefox
    google-chrome
    iterm2
    sketch
    slack
    sublime-text3
    virtualbox
    vlc

    # morley shit
    1password
    amazon-music
    flux
    jaikoz
    sizeup
    spotify
    swinsian
)



echo "Starting bootstrapping"


# ===============================================
# Edit OS X settings here!
# -----------------------------------------------

echo "Configuring OSX..."

# Set fast key repeat rate
defaults write NSGlobalDomain KeyRepeat -int 0

# Require password as soon as screensaver or sleep mode starts
defaults write com.apple.screensaver askForPassword -int 1
defaults write com.apple.screensaver askForPasswordDelay -int 0

# Show filename extensions by default
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# Disable transparency in the menu bar and elsewhere on Yosemite
defaults write com.apple.universalaccess reduceTransparency -bool true

# Disable Notification Center and remove the menu bar icon
launchctl unload -w /System/Library/LaunchAgents/com.apple.notificationcenterui.plist 2> /dev/null

# Disable smart quotes as they’re annoying when typing code
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false

# Disable smart dashes as they’re annoying when typing code
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false

# Trackpad: map bottom right corner to right-click
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadCornerSecondaryClick -int 2
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadRightClick -bool true
defaults -currentHost write NSGlobalDomain com.apple.trackpad.trackpadCornerClickBehavior -int 1
defaults -currentHost write NSGlobalDomain com.apple.trackpad.enableSecondaryClick -bool true

# Disable press-and-hold for keys in favor of key repeat
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

# Set the timezone; see `sudo systemsetup -listtimezones` for other values
sudo systemsetup -settimezone "America/New_York" > /dev/null

# Stop iTunes from responding to the keyboard media keys
launchctl unload -w /System/Library/LaunchAgents/com.apple.rcd.plist 2> /dev/null

# Set Desktop as the default location for new Finder windows
# For other paths, use `PfLo` and `file:///full/path/here/`
defaults write com.apple.finder NewWindowTarget -string "PfDe"
defaults write com.apple.finder NewWindowTargetPath -string "file://${HOME}/Desktop/"

# Display full POSIX path as Finder window title
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true

# Disable the warning when changing a file extension
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# Avoid creating .DS_Store files on network volumes
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true

# Use list view in all Finder windows by default
# Four-letter codes for the other view modes: `icnv`, `clmv`, `Flwv`
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"

# Enable Safari’s debug menu
defaults write com.apple.Safari IncludeInternalDebugMenu -bool true


DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check for Homebrew,
# Install if we don't have it
if test ! $(which brew); then
  echo "Installing homebrew..."
  ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
fi

# Update homebrew recipes
brew update

# Install GNU core utilities (those that come with OS X are outdated)
brew tap homebrew/dupes
brew install coreutils
brew install gnu-sed --with-default-names
brew install gnu-tar --with-default-names
brew install gnu-indent --with-default-names
brew install gnu-which --with-default-names
brew install gnu-grep --with-default-names


# Install GNU `find`, `locate`, `updatedb`, and `xargs`, g-prefixed
brew install findutils

# Install Bash 4
brew install bash


echo "Installing packages..."
brew install ${PACKAGES[@]}

echo "Cleaning up..."
brew cleanup

echo "Installing cask..."
brew install caskroom/cask/brew-cask
brew tap caskroom/versions

echo "Installing cask apps..."
brew cask install ${CASKS[@]}

echo "Set up NVM"
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.29.0/install.sh | bash
source $(brew --prefix nvm)/nvm.sh
nvm install 4.2.3
nvm use 4.2.3
nvm alias default node

# add paths to .profile (if not already present)
grep -q "prompt.sh" ~/.profile || echo "source $DIR/prompt.sh" >> ~/.profile


echo "Bootstrapping complete"
