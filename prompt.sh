#!/usr/bin/env bash

alias resource='source ~/.profile'
alias dev="ssh $(echo $USER).dev.okcupid.com"
alias okcontent="cd /Volumes/$(echo $USER)/oksrc/cupid/okcontent"
alias watch="../offline/frontendscripts/webpack-watch.js"
alias build="../offline/frontendscripts/webpack-build.js"

# add git branch to bash prompt
function parse_git_branch {
        git branch --no-color 2> /dev/null | sed -e '/^[^*]/d' -e "s/* \(.*\)/\1/"
        #git rev-parse --abbrev-ref HEAD
}
export PS1='\[\033[1;32m\]$(date +%-I:%M%p)\[\033[0m\] \[\033[0;37m\]\H\[\033[0m\]:\[\033[0;37m\]\u\[\033[0m\] \w \[\033[0;36m\]$(parse_git_branch)\[\033[0m\] \n\[\033[1;37m\]$\[\033[0m\] '
