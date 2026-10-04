#!/bin/zsh
# Drives VoiceOver with its own keys and prints what it says after each step, read from the caption panel by
# vo-caption (build it once: swiftc vo-caption.swift -o vo-caption). Needs VoiceOver on (Command-F5) with its caption
# panel showing, and Accessibility and Screen Recording permission for the terminal.
#
#   ./vo-run.sh front:<browser pid> in "until:The power is out" act next next ...
#
#   next | prev        VO-Right / VO-Left: next / previous item
#   first | last       VO-Home / VO-End: first / last item
#   in | out           VO-Shift-Down / VO-Shift-Up: into / out of a group or the web area
#   act                VO-Space: press the item under the VoiceOver cursor
#   heading            VO-Command-H: next heading
#   tab | shifttab | esc | enter | page (F6: from the browser toolbar into the page)
#   until:<text>       VO-Right until VoiceOver says the text (at most 90 moves)
#   front:<pid>        bring that process to the front
#   wait:<ms>
here=${0:A:h}
key() { osascript -e "tell application \"System Events\" to key code $1 using {$2}" >/dev/null 2>&1; }
plain() { osascript -e "tell application \"System Events\" to key code $1" >/dev/null 2>&1; }
VO="control down, option down"
for step in "$@"; do
  case $step in
    next) key 124 "$VO" ;;
    prev) key 123 "$VO" ;;
    act) key 49 "$VO" ;;
    in) key 125 "$VO, shift down" ;;
    out) key 126 "$VO, shift down" ;;
    heading) key 4 "$VO, command down" ;;
    first) key 115 "$VO" ;;
    last) key 119 "$VO" ;;
    tab) plain 48 ;;
    page) plain 97 ;;  # F6: move keyboard focus from the browser toolbar into the page
    shifttab) key 48 "shift down" ;;
    esc) plain 53 ;;
    enter) plain 36 ;;
    front:*) osascript -e "tell application \"System Events\" to set frontmost of (first process whose unix id is ${step#front:}) to true" >/dev/null 2>&1 ;;
    wait:*) sleep $(( ${step#wait:} / 1000.0 )); continue ;;
    until:*)
      target=${step#until:}
      for i in {1..90}; do
        key 124 "$VO"
        sleep 0.7
        said=$($here/vo-caption)
        [[ $said == *$target* ]] && break
      done
      print -r -- "$step ($i moves) → $said"
      continue ;;
  esac
  sleep 1.1
  print -r -- "$step → $($here/vo-caption)"
done
