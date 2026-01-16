#!/bin/bash
# Claude Code Statusline - GSD Edition
# Shows: model | current task | directory | context usage

input=$(cat)
model=$(echo "$input" | jq -r '.model.display_name')
dir=$(echo "$input" | jq -r '.workspace.current_dir')
session=$(echo "$input" | jq -r '.session_id')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Context window display (shows USED percentage)
ctx=""
if [ -n "$remaining" ]; then
    rem=$(printf "%.0f" "$remaining")
    used=$((100 - rem))

    # Build progress bar (10 segments) - fills as context is consumed
    filled=$((used / 10))
    bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=filled; i<10; i++)); do bar+="░"; done

    # Color based on usage with blinking skull at 80%+
    if [ "$used" -lt 50 ]; then
        ctx=$' \033[32m'"$bar $used%"$'\033[0m'
    elif [ "$used" -lt 65 ]; then
        ctx=$' \033[33m'"$bar $used%"$'\033[0m'
    elif [ "$used" -lt 80 ]; then
        ctx=$' \033[38;5;208m'"$bar $used%"$'\033[0m'
    else
        # Blinking red with skull
        ctx=$' \033[5;31m💀 '"$bar $used%"$'\033[0m'
    fi
fi

# Current task from todos
task=""
todo=$(ls -t "$HOME/.claude/todos/${session}"-agent-*.json 2>/dev/null | head -1)
if [[ -f "$todo" ]]; then
    task=$(jq -r '.[] | select(.status=="in_progress") | .activeForm' "$todo" 2>/dev/null | head -1)
fi

# Output
dirname=$(basename "$dir")
if [[ -n "$task" ]]; then
    printf '\033[2m%s\033[0m │ \033[1m%s\033[0m │ \033[2m%s\033[0m%s' "$model" "$task" "$dirname" "$ctx"
else
    printf '\033[2m%s\033[0m │ \033[2m%s\033[0m%s' "$model" "$dirname" "$ctx"
fi
