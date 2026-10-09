#!/usr/bin/env bash
# Runs the AI guide tests against a second server that talks to a fake Anthropic API (no key, no cost).
#   scripts/run-ai-tests.sh            → API tests, then the browser tests
# Needs a production build (npm run build) and the database from .env.
set -euo pipefail
cd "$(dirname "$0")/.."
FAKE_PORT=${FAKE_PORT:-4010}; APP_PORT=${APP_PORT:-3100}
node tests/support/fake-anthropic.mjs "$FAKE_PORT" & FAKE_PID=$!
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL="http://127.0.0.1:$FAKE_PORT" AYA_AI_VISITOR_DAILY=6 AUTH_TRUST_HOST=true NEXTAUTH_URL="http://localhost:$APP_PORT" \
  npx next start -p "$APP_PORT" & APP_PID=$!
trap 'kill $FAKE_PID $APP_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -fsS "http://localhost:$APP_PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
export AYA_TEST_URL="http://localhost:$APP_PORT" AYA_FAKE_LLM="http://127.0.0.1:$FAKE_PORT"
npx vitest run --config vitest.api.config.ts tests/api/ai-chat.test.ts
npx playwright test tests/e2e/ai-chat.spec.ts
