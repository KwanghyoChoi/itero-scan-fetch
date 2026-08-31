#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROFILE_DIR="${ITERO_PROFILE_DIR:-$SCRIPT_DIR/../.itero-chrome-profile}"
PORT="${ITERO_CDP_PORT:-9334}"
CHROME="${ITERO_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
START_URL="${ITERO_BASE_URL:-https://myitero.com}"
LOG_FILE="${ITERO_CHROME_LOG:-$PWD/itero-chrome-cdp.log}"

if [[ ! -x "$CHROME" ]]; then
  print -u2 "Chrome 실행 파일을 찾지 못했습니다: $CHROME"
  exit 1
fi

mkdir -p "$PROFILE_DIR"
if curl -fsS "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
  print "CDP가 이미 실행 중입니다: $PORT"
  exit 0
fi

typeset -a chrome_args
chrome_args=(
  "--remote-debugging-port=$PORT"
  "--user-data-dir=$PROFILE_DIR"
  # 헤드리스 기본 창은 800px대라 좁다 — 화면 위치로 버튼을 고르는 코드가 흔들린다(2026-09-01 실측).
  "--window-size=1600,1000"
  "--no-first-run"
  "--no-default-browser-check"
)
if [[ "${ITERO_HEADLESS:-0}" == "1" ]]; then
  chrome_args+=("--headless=new" "--disable-gpu")
fi

"$CHROME" "${chrome_args[@]}" "$START_URL" >"$LOG_FILE" 2>&1 &
print "Chrome CDP 시작: port=$PORT pid=$!"

for _ in {1..20}; do
  sleep 1
  if curl -fsS "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
    print "CDP 준비 완료: http://127.0.0.1:$PORT"
    exit 0
  fi
done

print -u2 "CDP가 준비되지 않았습니다. 로그: $LOG_FILE"
exit 1
