#!/usr/bin/env bash
#
# macOS settings — every value here is verified against this Mac.
# Safe to re-run. Called by bootstrap.sh, or run standalone: ./macos.sh

set -uo pipefail

echo "Applying macOS settings..."

# --------------------------------------------------------------------------
# Appearance
# --------------------------------------------------------------------------

# Dark mode
defaults write NSGlobalDomain AppleInterfaceStyle -string "Dark"

# Always show scroll bars
defaults write NSGlobalDomain AppleShowScrollBars -string "Always"

# --------------------------------------------------------------------------
# Keyboard & text
# --------------------------------------------------------------------------

# Fast key repeat (lower = faster)
# GUI slider steps — KeyRepeat: 120, 90, 60, 30, 12, 6, 2; InitialKeyRepeat: 120, 94, 68, 35, 25, 15
defaults write NSGlobalDomain KeyRepeat -int 2
defaults write NSGlobalDomain InitialKeyRepeat -int 15

# Holding a key repeats it instead of showing the accent popup
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

# Disable Caps Lock (System Settings > Keyboard > Modifier Keys > Caps Lock: No Action)
# Src 0x700000039 = Caps Lock, Dst 0x700000000 = no action; the Fn/Globe
# entries reproduce what the system stores alongside it.
# Per-host setting; takes effect after logout or replugging the keyboard.
defaults -currentHost write NSGlobalDomain com.apple.keyboard.modifiermapping.0-0-0 -array \
	'<dict><key>HIDKeyboardModifierMappingDst</key><integer>1095216660483</integer><key>HIDKeyboardModifierMappingSrc</key><integer>1095216660483</integer></dict>' \
	'<dict><key>HIDKeyboardModifierMappingDst</key><integer>1095216660483</integer><key>HIDKeyboardModifierMappingSrc</key><integer>280379760050179</integer></dict>' \
	'<dict><key>HIDKeyboardModifierMappingDst</key><integer>30064771072</integer><key>HIDKeyboardModifierMappingSrc</key><integer>30064771129</integer></dict>'

# No auto-capitalization, spelling autocorrect, or double-space period
# (smart quotes and dashes stay on)
defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false

# --------------------------------------------------------------------------
# Trackpad & scrolling
# --------------------------------------------------------------------------

# Disable "natural" scroll
defaults write NSGlobalDomain com.apple.swipescrolldirection -bool false

# Per-host trackpad setup, captured exactly from this Mac:
# right-click via bottom-right corner instead of two-finger click; pinch,
# rotate, smart zoom, Launchpad pinch, and Notification Center edge swipe off;
# three-finger swipes between spaces kept on.
defaults -currentHost write NSGlobalDomain com.apple.trackpad.enableSecondaryClick -bool false
defaults -currentHost write NSGlobalDomain com.apple.trackpad.trackpadCornerClickBehavior -int 1
defaults -currentHost write NSGlobalDomain com.apple.trackpad.pinchGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.rotateGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.twoFingerDoubleTapGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.twoFingerFromRightEdgeSwipeGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.threeFingerTapGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.threeFingerDragGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.threeFingerHorizSwipeGesture -int 1
defaults -currentHost write NSGlobalDomain com.apple.trackpad.threeFingerVertSwipeGesture -int 1
defaults -currentHost write NSGlobalDomain com.apple.trackpad.fourFingerPinchSwipeGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.fourFingerHorizSwipeGesture -int 2
defaults -currentHost write NSGlobalDomain com.apple.trackpad.fourFingerVertSwipeGesture -int 2
defaults -currentHost write NSGlobalDomain com.apple.trackpad.fiveFingerPinchSwipeGesture -int 0
defaults -currentHost write NSGlobalDomain com.apple.trackpad.momentumScroll -bool true
defaults -currentHost write NSGlobalDomain com.apple.trackpad.scrollBehavior -int 2

# --------------------------------------------------------------------------
# Dock
# --------------------------------------------------------------------------

# Small icons, pinned to the left edge
defaults write com.apple.dock tilesize -int 34
defaults write com.apple.dock orientation -string "left"

# --------------------------------------------------------------------------
# Finder & files
# --------------------------------------------------------------------------

# Show filename extensions everywhere, and don't warn when changing them
defaults write NSGlobalDomain AppleShowAllExtensions -bool true
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# List view by default
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"

# --------------------------------------------------------------------------
# Save & print dialogs
# --------------------------------------------------------------------------

# Always expanded
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint -bool true
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint2 -bool true

# --------------------------------------------------------------------------

killall Dock Finder 2>/dev/null || true
echo "Done. Some settings (dark mode, key repeat) need a logout or app restart to fully apply."
