#!/usr/bin/env bash
# Self test of the Q10 pipeline WITHOUT Android: real Chromium stands in for the app, a fake adb for the emulator.
# It proves that pages, probe, driver, log parser and analyzer work together and that the failure paths fail.
# It says nothing about Android speed. Usage: bash run-selftest.sh <work dir> (needs npm ci done in tycoon/)
set -u
W=${1:?work dir}; HERE=$(cd "$(dirname "$0")" && pwd); T=$(cd "$HERE/../../.." && pwd); AP=$HERE/..
mkdir -p "$W"; W=$(cd "$W" && pwd); FAIL=0
ok()  { echo "PASS  $1"; }
bad() { echo "FAIL  $1"; FAIL=1; }
expect() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

cd "$T" || exit 1
if ! { BUILD_OUT=$W/base.raw.html node build.mjs >/dev/null && ECO=1 BUILD_OUT=$W/eco.raw.html node build.mjs >/dev/null; }; then echo "build failed"; exit 1; fi
node "$AP/make-perf-pages.mjs" --base "$W/base.raw.html" --eco "$W/eco.raw.html" --save tests/fixtures/save-mid.json --preset medium \
  --warmup 6 --duration 12 --sync-gap 2 --end-gap 3 --out "$W/assets" >/dev/null || { echo "page build failed"; exit 1; }
touch "$W/fake.apk"
drive() { # name runs extra-env...  -> exit code of the driver in $?
  local name=$1 runs=$2; shift 2
  env ADB="$HERE/fake-adb" FAKE_ADB_DIR="$W/$name.dev" FAKE_ASSETS="$W/assets" PERF_APK="$W/fake.apk" PERF_ASSETS="$W/assets" PERF_OUT="$W/$name" PERF_RUNS="$runs" "$@" \
    node "$AP/run-device.mjs" > "$W/$name.log" 2>&1
}

# 1. happy path, 3 runs per mode
drive happy 3; expect "happy path: driver exit 0" "[ $? = 0 ]"
node "$AP/analyze.mjs" "$W/happy" --history "$T/test-results/android" > "$W/happy.analyze.txt" 2>&1; expect "happy path: analyzer exit 0" "[ $? = 0 ]"
expect "happy path: 9 run folders" "[ \$(ls -d $W/happy/raw/run*-* | wc -l) = 9 ]"
expect "happy path: mode order rotates (run1 first=base, run2 first=tracking, run3 first=pricing)" \
  "[ \"\$(grep -o 'run [123] [A-Z]*: ready' $W/happy.log | awk 'NR==1||NR==4||NR==7{print \$2\$3}' | tr -d '\n:')\" = '1BASE2TRACKING3PRICING' ]"
expect "happy path: report states the frame source" "grep -q 'requestAnimationFrame. intervals' $W/happy/REPORT.md"
expect "happy path: n=3 per mode in the report" "grep -q 'n=3' $W/happy/REPORT.md"
expect "happy path: M0 comparison explicitly not performed" "grep -q 'Direct FPS comparison: not performed' $W/happy/REPORT.md"

# 2. a save that survives between runs must fail the run and the job
drive leak 1 FAKE_ADB_NOCLEAR=1; RC=$?
expect "leak: driver exit 1" "[ $RC = 1 ]"
expect "leak: state leak reported" "grep -rq 'state leak' $W/leak/raw/*/run.json"
node "$AP/analyze.mjs" "$W/leak" >/dev/null 2>&1; expect "leak: analyzer exit 1" "[ $? = 1 ]"

# 3. a page that never reports (missing file) -> timeout recorded, exit 1, nothing invented
mkdir -p "$W/assets-missing"; cp "$W/assets/manifest.json" "$W/assets-missing/"; rm -f "$W/assets-missing/"*.html
drive missing 1 FAKE_ASSETS="$W/assets-missing" PERF_TIME_SCALE=0.05; RC=$?
expect "missing page: driver exit 1" "[ $RC = 1 ]"
node "$AP/analyze.mjs" "$W/missing" >"$W/missing.analyze.txt" 2>&1; expect "missing page: analyzer exit 1" "[ $? = 1 ]"
expect "missing page: report gives no FPS" "grep -q 'No valid measurement exists' $W/missing.analyze.txt"

# 4. no driver output at all -> analyzer fails and says so
mkdir -p "$W/empty"; node "$AP/analyze.mjs" "$W/empty" >"$W/empty.analyze.txt" 2>&1; expect "empty: analyzer exit 1" "[ $? = 1 ]"
expect "empty: says driver.json missing" "grep -q 'driver.json missing' $W/empty.analyze.txt"

echo; [ $FAIL = 0 ] && echo "SELFTEST: all checks passed" || echo "SELFTEST: FAILED"
exit $FAIL
