#!/bin/bash
# Installs dependencies in Claude Code cloud sessions so tests (vitest, rules, Playwright E2E) can run.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
# Chromium is preinstalled at /opt/pw-browsers; playwright.config.ts picks it up. Do not run `playwright install`.
