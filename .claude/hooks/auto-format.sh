#!/bin/bash
# Claude Code PostToolUse hook: auto-format edited files.
# - frontend/**: prettier --write
# - backend/**.py: ruff format + ruff check --fix --select=I (import sorting only)
# Reads JSON from stdin (tool_input). Failures are silent to avoid blocking Claude.

set +e

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

FILE=$(python3 -c "import sys,json
try: print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))
except Exception: pass" 2>/dev/null)

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

case "$FILE" in
  "$ROOT/frontend/"*)
    case "$FILE" in
      *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md|*.mjs|*.cjs)
        (cd "$ROOT/frontend" && npx --no-install prettier --write --log-level=error --ignore-unknown "$FILE") >/dev/null 2>&1
        ;;
    esac
    ;;
  "$ROOT/backend/"*.py)
    (cd "$ROOT/backend" && uv run ruff format "$FILE" && uv run ruff check --fix --select=I "$FILE") >/dev/null 2>&1
    ;;
esac

exit 0
