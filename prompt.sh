#!/usr/bin/env bash

alias resource='source ~/.profile'
alias mastdiff="git diff master -w"
alias f="rg -g '!src/locale'"

export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"


# add git branch to bash prompt
function parse_git_branch {
        git branch --no-color 2> /dev/null | sed -e '/^[^*]/d' -e "s/* \(.*\)/\1/"
        #git rev-parse --abbrev-ref HEAD
}
export PS1='\[\033[1;32m\]$(date +%-I:%M%p)\[\033[0m\] \w \[\033[0;36m\]$(parse_git_branch)\[\033[0m\] \n\[\033[1;37m\]$\[\033[0m\] '
