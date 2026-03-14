#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BASE_URL="${SMA_E2E_BASE_URL:-https://architecture-stack.vercel.app}"
COURSE_PATH="${SMA_E2E_COURSE_PATH:-/ios/index.html}"
COURSE_ID="${SMA_E2E_COURSE_ID:-stack-my-architecture-ios}"
TOPIC_ID="${SMA_E2E_TOPIC_ID:-01-fundamentos-00-introduccion}"
SYNC_TIMEOUT_MS="${SMA_E2E_SYNC_TIMEOUT_MS:-12000}"
ARTIFACT_DIR="${SMA_E2E_ARTIFACT_DIR:-$HUB_ROOT/output/playwright/auth-progress-cross-device}"
EMAIL="${SMA_E2E_AUTH_EMAIL:-}"
PASSWORD="${SMA_E2E_AUTH_PASSWORD:-}"

PWCLI_BIN="${SMA_PLAYWRIGHT_CLI:-${PWCLI:-}}"
CODEX_HOME_DEFAULT="${CODEX_HOME:-$HOME/.codex}"
DEFAULT_PWCLI="$CODEX_HOME_DEFAULT/skills/playwright/scripts/playwright_cli.sh"

SESSION_A="e2e-auth-device-a"
SESSION_B="e2e-auth-device-b"

LOGIN_AND_READ_JS='async (page) => {
  const base = __SMA_BASE_URL__;
  const coursePath = __SMA_COURSE_PATH__;
  const courseId = __SMA_COURSE_ID__;
  const topicId = __SMA_TOPIC_ID__;
  const email = __SMA_AUTH_EMAIL__;
  const password = __SMA_AUTH_PASSWORD__;

  const loginUrl = base.replace(/\/$/, "") + "/auth/login.html?next=" + encodeURIComponent(coursePath + "#" + topicId);

  await page.goto(loginUrl, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);

  await Promise.all([
    page.waitForURL((url) => url.pathname === coursePath, { timeout: 20000 }),
    page.locator("#login-form button[type=\"submit\"]").click()
  ]);

  await page.waitForSelector("#study-completion-toggle", { timeout: 20000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  const state = await page.evaluate(({ courseId, topicId }) => {
    const authUserKey = "sma:auth:user:v1";
    const authSessionKey = "sma:auth:session:v1";
    const completedKey = `sma:${courseId}:topics:completed`;
    const reviewKey = `sma:${courseId}:topics:review`;
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    const authUser = JSON.parse(localStorage.getItem(authUserKey) || "null");
    const authSession = JSON.parse(localStorage.getItem(authSessionKey) || "null");
    return {
      authReady: !!(authUser && authUser.id && authSession && authSession.accessToken),
      userId: authUser && authUser.id ? String(authUser.id) : "",
      initialDone: !!completed[topicId],
      initialReview: !!review[topicId],
      progressText: (document.getElementById("study-progress") || {}).textContent || ""
    };
  }, { courseId, topicId });

  return {
    ok: state.authReady,
    hasProfileQuery: page.url().includes("progressProfile="),
    url: page.url(),
    ...state
  };
}'

FORCE_TRUE_JS='async (page) => {
  const courseId = __SMA_COURSE_ID__;
  const topicId = __SMA_TOPIC_ID__;
  const artifactDir = __SMA_ARTIFACT_DIR__;
  const completedKey = `sma:${courseId}:topics:completed`;
  const reviewKey = `sma:${courseId}:topics:review`;

  async function waitForSyncPost() {
    const response = await page.waitForResponse((candidate) => {
      return candidate.request().method() === "POST" && candidate.url().includes("/api/progress-sync");
    }, { timeout: 15000 }).catch(() => null);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(300);
    return response;
  }

  async function readState() {
    return await page.evaluate(({ completedKey, reviewKey, topicId }) => {
      const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
      const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
      const completionBtn = document.getElementById("study-completion-toggle");
      const reviewBtn = document.getElementById("study-review-toggle");
      return {
        done: !!completed[topicId],
        review: !!review[topicId],
        progressText: (document.getElementById("study-progress") || {}).textContent || "",
        completionLabel: completionBtn ? String(completionBtn.textContent || "").trim() : "",
        reviewLabel: reviewBtn ? String(reviewBtn.textContent || "").trim() : ""
      };
    }, { completedKey, reviewKey, topicId });
  }

  let state = await readState();

  if (state.done) {
    const sync = waitForSyncPost();
    await page.locator("#study-completion-toggle").click();
    await sync;
    state = await readState();
  }

  if (state.review) {
    const sync = waitForSyncPost();
    await page.locator("#study-review-toggle").click();
    await sync;
    state = await readState();
  }

  {
    const sync = waitForSyncPost();
    await page.locator("#study-completion-toggle").click();
    await sync;
  }

  {
    const sync = waitForSyncPost();
    await page.locator("#study-review-toggle").click();
    await sync;
  }

  await page.waitForFunction(({ completedKey, reviewKey, topicId }) => {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return !!completed[topicId] && !!review[topicId];
  }, { completedKey, reviewKey, topicId }, { timeout: 12000 });

  await page.screenshot({ path: `${artifactDir}/device-a-after-mutation.png`, fullPage: false });

  state = await readState();
  return {
    ok: state.done && state.review,
    ...state
  };
}'

VERIFY_REMOTE_JS='async (page) => {
  const courseId = __SMA_COURSE_ID__;
  const topicId = __SMA_TOPIC_ID__;
  const timeoutMs = __SMA_SYNC_TIMEOUT_MS__;
  const artifactDir = __SMA_ARTIFACT_DIR__;
  const completedKey = `sma:${courseId}:topics:completed`;
  const reviewKey = `sma:${courseId}:topics:review`;

  await page.waitForFunction(({ completedKey, reviewKey, topicId }) => {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return !!completed[topicId] && !!review[topicId];
  }, { completedKey, reviewKey, topicId }, { timeout: timeoutMs });

  const state = await page.evaluate(({ completedKey, reviewKey, topicId }) => {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    const link = document.querySelector(`a.doc-nav-link[data-topic-id="${topicId}"]`) || document.querySelector(`a.doc-nav-link[href="#${topicId}"]`);
    return {
      done: !!completed[topicId],
      review: !!review[topicId],
      hasDoneBadge: !!(link && link.querySelector(".study-ux-completed-badge")),
      hasReviewBadge: !!(link && link.querySelector(".study-ux-review-badge")),
      progressText: (document.getElementById("study-progress") || {}).textContent || "",
      completionLabel: ((document.getElementById("study-completion-toggle") || {}).textContent || "").trim(),
      reviewLabel: ((document.getElementById("study-review-toggle") || {}).textContent || "").trim()
    };
  }, { completedKey, reviewKey, topicId });

  await page.screenshot({ path: `${artifactDir}/device-b-synced.png`, fullPage: false });

  return {
    ok: state.done && state.review && state.hasDoneBadge && state.hasReviewBadge,
    hasProfileQuery: page.url().includes("progressProfile="),
    url: page.url(),
    ...state
  };
}'

RESTORE_INITIAL_JS='async (page) => {
  const courseId = __SMA_COURSE_ID__;
  const topicId = __SMA_TOPIC_ID__;
  const initialDone = __SMA_INITIAL_DONE__;
  const initialReview = __SMA_INITIAL_REVIEW__;
  const completedKey = `sma:${courseId}:topics:completed`;
  const reviewKey = `sma:${courseId}:topics:review`;

  async function waitForSyncPost() {
    const response = await page.waitForResponse((candidate) => {
      return candidate.request().method() === "POST" && candidate.url().includes("/api/progress-sync");
    }, { timeout: 15000 }).catch(() => null);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(300);
    return response;
  }

  function readState() {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return {
      done: !!completed[topicId],
      review: !!review[topicId]
    };
  }

  let state = await page.evaluate(({ completedKey, reviewKey, topicId }) => {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return {
      done: !!completed[topicId],
      review: !!review[topicId]
    };
  }, { completedKey, reviewKey, topicId });

  if (state.done !== initialDone) {
    const sync = waitForSyncPost();
    await page.locator("#study-completion-toggle").click();
    await sync;
  }

  state = await page.evaluate(({ completedKey, reviewKey, topicId }) => {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return {
      done: !!completed[topicId],
      review: !!review[topicId]
    };
  }, { completedKey, reviewKey, topicId });

  if (state.review !== initialReview) {
    const sync = waitForSyncPost();
    await page.locator("#study-review-toggle").click();
    await sync;
  }

  await page.waitForFunction(({ completedKey, reviewKey, topicId, initialDone, initialReview }) => {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return !!completed[topicId] === initialDone && !!review[topicId] === initialReview;
  }, { completedKey, reviewKey, topicId, initialDone, initialReview }, { timeout: 12000 });

  return await page.evaluate(({ completedKey, reviewKey, topicId }) => {
    const completed = JSON.parse(localStorage.getItem(completedKey) || "{}");
    const review = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return {
      restoredDone: !!completed[topicId],
      restoredReview: !!review[topicId]
    };
  }, { completedKey, reviewKey, topicId });
}'

resolve_pwcli() {
  if [[ -n "$PWCLI_BIN" ]]; then
    echo "$PWCLI_BIN"
    return
  fi

  if [[ -x "$DEFAULT_PWCLI" ]]; then
    echo "$DEFAULT_PWCLI"
    return
  fi

  if command -v playwright-cli >/dev/null 2>&1; then
    echo "playwright-cli"
    return
  fi

  echo ""
}

PWCLI_BIN="$(resolve_pwcli)"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "[SKIP] authenticated cross-device progress e2e -> define SMA_E2E_AUTH_EMAIL y SMA_E2E_AUTH_PASSWORD"
  exit 0
fi

if [[ -z "$PWCLI_BIN" ]]; then
  echo "[FAIL] No se encontró playwright-cli ni el wrapper de Codex."
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  "$PWCLI_BIN" --session "$SESSION_A" close >/dev/null 2>&1 || true
  "$PWCLI_BIN" --session "$SESSION_B" close >/dev/null 2>&1 || true
}
trap cleanup EXIT

extract_result_json() {
  python3 -c '
import sys

text = sys.stdin.read()
lines = text.splitlines()
for index, line in enumerate(lines):
    if line.strip() == "### Result" and index + 1 < len(lines):
        print(lines[index + 1].strip())
        raise SystemExit(0)
print(text, file=sys.stderr)
raise SystemExit(1)
'
}

render_js_template() {
  local template="$1"
  JS_TEMPLATE="$template" \
  SMA_RENDER_BASE_URL="$BASE_URL" \
  SMA_RENDER_COURSE_PATH="$COURSE_PATH" \
  SMA_RENDER_COURSE_ID="$COURSE_ID" \
  SMA_RENDER_TOPIC_ID="$TOPIC_ID" \
  SMA_RENDER_AUTH_EMAIL="$EMAIL" \
  SMA_RENDER_AUTH_PASSWORD="$PASSWORD" \
  SMA_RENDER_ARTIFACT_DIR="$ARTIFACT_DIR" \
  SMA_RENDER_SYNC_TIMEOUT_MS="$SYNC_TIMEOUT_MS" \
  SMA_RENDER_INITIAL_DONE="${SMA_E2E_INITIAL_DONE:-false}" \
  SMA_RENDER_INITIAL_REVIEW="${SMA_E2E_INITIAL_REVIEW:-false}" \
  python3 - <<'PY'
import json
import os

template = os.environ['JS_TEMPLATE']
replacements = {
    '__SMA_BASE_URL__': json.dumps(os.environ['SMA_RENDER_BASE_URL']),
    '__SMA_COURSE_PATH__': json.dumps(os.environ['SMA_RENDER_COURSE_PATH']),
    '__SMA_COURSE_ID__': json.dumps(os.environ['SMA_RENDER_COURSE_ID']),
    '__SMA_TOPIC_ID__': json.dumps(os.environ['SMA_RENDER_TOPIC_ID']),
    '__SMA_AUTH_EMAIL__': json.dumps(os.environ['SMA_RENDER_AUTH_EMAIL']),
    '__SMA_AUTH_PASSWORD__': json.dumps(os.environ['SMA_RENDER_AUTH_PASSWORD']),
    '__SMA_ARTIFACT_DIR__': json.dumps(os.environ['SMA_RENDER_ARTIFACT_DIR']),
    '__SMA_SYNC_TIMEOUT_MS__': str(int(os.environ['SMA_RENDER_SYNC_TIMEOUT_MS'])),
    '__SMA_INITIAL_DONE__': 'true' if os.environ['SMA_RENDER_INITIAL_DONE'] == 'true' else 'false',
    '__SMA_INITIAL_REVIEW__': 'true' if os.environ['SMA_RENDER_INITIAL_REVIEW'] == 'true' else 'false',
}
for key, value in replacements.items():
    template = template.replace(key, value)
print(template)
PY
}

json_get() {
  local key="$1"
  python3 -c '
import json
import sys

payload = json.loads(sys.stdin.read())
value = payload
for part in sys.argv[1].split("."):
    value = value[part]
if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("null")
else:
    print(str(value))
' "$key"
}

assert_json_equals() {
  local json_payload="$1"
  local key="$2"
  local expected="$3"
  local actual
  actual="$(printf '%s' "$json_payload" | json_get "$key")"
  if [[ "$actual" != "$expected" ]]; then
    echo "[FAIL] ${key} esperado=${expected} actual=${actual}"
    echo "$json_payload"
    exit 1
  fi
}

pw_output() {
  local session="$1"
  shift
  "$PWCLI_BIN" --session "$session" "$@"
}

bootstrap_session() {
  local session="$1"
  "$PWCLI_BIN" --session "$session" close >/dev/null 2>&1 || true
  pw_output "$session" open about:blank >/dev/null
  pw_output "$session" delete-data >/dev/null
  pw_output "$session" open about:blank >/dev/null
}

echo "[E2E] Hub authenticated cross-device progress sync"
echo "[E2E] Base URL: $BASE_URL"
echo "[E2E] Course: $COURSE_PATH"
echo "[E2E] Topic: $TOPIC_ID"

export SMA_E2E_BASE_URL="$BASE_URL"
export SMA_E2E_COURSE_PATH="$COURSE_PATH"
export SMA_E2E_COURSE_ID="$COURSE_ID"
export SMA_E2E_TOPIC_ID="$TOPIC_ID"
export SMA_E2E_AUTH_EMAIL="$EMAIL"
export SMA_E2E_AUTH_PASSWORD="$PASSWORD"

bootstrap_session "$SESSION_A"
bootstrap_session "$SESSION_B"

device_a_login_output="$(pw_output "$SESSION_A" run-code "$(render_js_template "$LOGIN_AND_READ_JS")")"
device_a_login_json="$(printf '%s' "$device_a_login_output" | extract_result_json)"
assert_json_equals "$device_a_login_json" "ok" "true"
assert_json_equals "$device_a_login_json" "hasProfileQuery" "false"

INITIAL_DONE="$(printf '%s' "$device_a_login_json" | json_get "initialDone")"
INITIAL_REVIEW="$(printf '%s' "$device_a_login_json" | json_get "initialReview")"
export SMA_E2E_INITIAL_DONE="$INITIAL_DONE"
export SMA_E2E_INITIAL_REVIEW="$INITIAL_REVIEW"
export SMA_E2E_ARTIFACT_DIR="$ARTIFACT_DIR"
export SMA_E2E_SYNC_TIMEOUT_MS="$SYNC_TIMEOUT_MS"

device_a_force_output="$(pw_output "$SESSION_A" run-code "$(render_js_template "$FORCE_TRUE_JS")")"
device_a_force_json="$(printf '%s' "$device_a_force_output" | extract_result_json)"
assert_json_equals "$device_a_force_json" "ok" "true"
assert_json_equals "$device_a_force_json" "done" "true"
assert_json_equals "$device_a_force_json" "review" "true"

device_b_login_output="$(pw_output "$SESSION_B" run-code "$(render_js_template "$LOGIN_AND_READ_JS")")"
device_b_login_json="$(printf '%s' "$device_b_login_output" | extract_result_json)"
assert_json_equals "$device_b_login_json" "ok" "true"
assert_json_equals "$device_b_login_json" "hasProfileQuery" "false"

device_b_verify_output="$(pw_output "$SESSION_B" run-code "$(render_js_template "$VERIFY_REMOTE_JS")")"
device_b_verify_json="$(printf '%s' "$device_b_verify_output" | extract_result_json)"
assert_json_equals "$device_b_verify_json" "ok" "true"
assert_json_equals "$device_b_verify_json" "done" "true"
assert_json_equals "$device_b_verify_json" "review" "true"
assert_json_equals "$device_b_verify_json" "hasDoneBadge" "true"
assert_json_equals "$device_b_verify_json" "hasReviewBadge" "true"
assert_json_equals "$device_b_verify_json" "hasProfileQuery" "false"

device_a_restore_output="$(pw_output "$SESSION_A" run-code "$(render_js_template "$RESTORE_INITIAL_JS")")"
device_a_restore_json="$(printf '%s' "$device_a_restore_output" | extract_result_json)"
assert_json_equals "$device_a_restore_json" "restoredDone" "$INITIAL_DONE"
assert_json_equals "$device_a_restore_json" "restoredReview" "$INITIAL_REVIEW"

echo "[PASS] authenticated cross-device progress sync e2e"
