#!/usr/bin/env bash
# Self test of the Q10 pipeline WITHOUT Android: real Chromium stands in for the app, a fake adb for the emulator.
# It proves that pages, probe, driver, log parser and analyzer work together and that every failure path fails and says why.
# It says nothing about Android speed. Usage: bash run-selftest.sh <work dir> (needs npm ci done in tycoon/)
set -u
W=${1:?work dir}; HERE=$(cd "$(dirname "$0")" && pwd); T=$(cd "$HERE/../../.." && pwd); AP=$HERE/..
mkdir -p "$W"; W=$(cd "$W" && pwd); FAIL=0
ok()  { echo "PASS  $1"; }
bad() { echo "FAIL  $1"; FAIL=1; }
expect() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }
# shellcheck disable=SC2329  # called by the EXIT trap
cleanup() { for f in "$W"/*.dev/renderer.pids; do [ -f "$f" ] && xargs -r kill -9 < "$f" 2>/dev/null; done; true; }
trap cleanup EXIT

cd "$T" || exit 1
node --test "$HERE/parse.test.mjs" > "$W/parse-test.txt" 2>&1; expect "parser unit tests (7)" "grep -q '^# pass 7' $W/parse-test.txt && grep -q '^# fail 0' $W/parse-test.txt"
if ! { BUILD_OUT=$W/base.raw.html node build.mjs >/dev/null && ECO=1 BUILD_OUT=$W/eco.raw.html node build.mjs >/dev/null; }; then echo "build failed"; exit 1; fi
node "$AP/make-perf-pages.mjs" --base "$W/base.raw.html" --eco "$W/eco.raw.html" --save tests/fixtures/save-mid.json --preset medium \
  --warmup 6 --duration 12 --sync-gap 2 --end-gap 3 --out "$W/assets" >/dev/null || { echo "page build failed"; exit 1; }
touch "$W/fake.apk"
drive() { # name runs extra-env...  -> exit code of the driver
  local name=$1 runs=$2; shift 2
  env ADB="$HERE/fake-adb" FAKE_ADB_DIR="$W/$name.dev" FAKE_ASSETS="$W/assets" PERF_APK="$W/fake.apk" PERF_ASSETS="$W/assets" PERF_OUT="$W/$name" PERF_RUNS="$runs" "$@" \
    node "$AP/run-device.mjs" > "$W/$name.log" 2>&1
}
analyze() { node "$AP/analyze.mjs" "$W/$1" --history "$T/test-results/android" > "$W/$1.analyze.txt" 2>&1; }

# 1. happy path, 3 runs per mode
drive happy 3; expect "happy path: driver exit 0" "[ $? = 0 ]"
analyze happy; expect "happy path: analyzer exit 0" "[ $? = 0 ]"
expect "happy path: 9 run folders + the warm-up launch" "[ \$(ls -d $W/happy/raw/run*-* | wc -l) = 9 ] && [ -f $W/happy/raw/prime/prime.json ]"
expect "happy path: mode order rotates (run1 first=base, run2 first=tracking, run3 first=pricing)" \
  "[ \"\$(grep -o 'run [123] [A-Z]*: ready' $W/happy.log | awk 'NR==1||NR==4||NR==7{print \$2\$3}' | tr -d '\n:')\" = '1BASE2TRACKING3PRICING' ]"
expect "happy path: report states the frame source" "grep -q 'requestAnimationFrame. intervals' $W/happy/REPORT.md"
expect "happy path: n=3 per mode in the report" "grep -q 'n=3' $W/happy/REPORT.md"
expect "happy path: M0 comparison explicitly not performed" "grep -q 'Direct FPS comparison: not performed' $W/happy/REPORT.md"
expect "happy path: every run has exactly one boot (9 rows with boots = 1)" "[ \$(sed -n '/## Page boots/,/## Memory/p' $W/happy/REPORT.md | grep -cE '^\\| [0-9] \\| (base|tracking|pricing) \\| 1 \\|') = 9 ]"
expect "happy path: renderer PSS shown separately (app 97.7, renderer 195.3, total 293.0 MB)" "grep -q '| 97.7 | 195.3 | 293.0 |' $W/happy/REPORT.md"
expect "happy path: full-dump cross-check drops the duplicate section (293.0, not doubled)" "sed -n '/## Memory per run/,/## JavaScript/p' $W/happy/REPORT.md | grep -q '| 293.0 | [0-9]* |'"

# 2. a save that survives between runs: reported as a leak at the FIRST boot
drive leak 1 FAKE_ADB_NOCLEAR=1; RC=$?
expect "leak: driver exit 1" "[ $RC = 1 ]"
expect "leak: reported as a state leak at the first boot" "grep -rq 'state leak at the FIRST boot' $W/leak/raw/run1-*/run.json"
analyze leak; expect "leak: analyzer exit 1" "[ $? = 1 ]"

# 3. the first launch of the device loads the page twice, later launches are normal (the case seen in the first CI run):
#    the warm-up launch shows it, the measured runs are clean and pass
drive dblfirst 1 FAKE_DOUBLE_LOAD_FIRST=1; RC=$?
expect "first launch loads twice: driver exit 0 (measured runs clean)" "[ $RC = 0 ]"
expect "first launch loads twice: the warm-up launch recorded 2 boots" "grep -q 'page booted 2 times' $W/dblfirst/raw/prime/prime.json"
analyze dblfirst; expect "first launch loads twice: analyzer exit 0 and shows the observation" "[ $? = 0 ] && grep -q 'Warm-up launch' $W/dblfirst/REPORT.md && grep -q 'booted 2 times' $W/dblfirst/REPORT.md"

# 4. every launch loads twice: measured runs fail, described as a second load, not as leftover data
drive dbl 1 FAKE_DOUBLE_LOAD=1; RC=$?
expect "double load: driver exit 1" "[ $RC = 1 ]"
expect "double load: 'page booted 2 times' with the reason" "grep -rq 'page booted 2 times.*not data left by an earlier run' $W/dbl/raw/run1-*/run.json"
expect "double load: NOT reported as a first-boot leak" "! grep -rq 'state leak at the FIRST boot' $W/dbl/raw/run1-*/run.json"
expect "double load: activity re-creation visible in the evidence" "grep -rq 'created 2' $W/dbl/raw/run1-*/run.json"

# 5. renderer processes of the stopped app stay alive: found, cleaned with the WebView provider force-stop, run measured
drive linger 1 FAKE_LINGER=1; RC=$?
expect "leftover renderer: driver exit 0 after cleanup" "[ $RC = 0 ]"
expect "leftover renderer: cleanup action recorded" "grep -rq 'am force-stop com.google.android.webview' $W/linger/raw/run1-*/run.json"
analyze linger; expect "leftover renderer: analyzer exit 0" "[ $? = 0 ]"

# 6. renderer processes that cannot be removed: the run is NOT measured and fails
drive stuck 1 FAKE_LINGER=1 FAKE_LINGER_STUCK=1; RC=$?
expect "stuck renderer: driver exit 1" "[ $RC = 1 ]"
expect "stuck renderer: reported" "grep -rq 'survived the pre-run cleanup' $W/stuck/raw/run1-*/run.json"
analyze stuck; expect "stuck renderer: analyzer exit 1 and no FPS given" "[ $? = 1 ] && grep -q 'No valid measurement exists' $W/stuck.analyze.txt"

# 7. a page that never reports (missing file) -> timeout recorded, exit 1, nothing invented
mkdir -p "$W/assets-missing"; cp "$W/assets/manifest.json" "$W/assets-missing/"
drive missing 1 FAKE_ASSETS="$W/assets-missing" PERF_TIME_SCALE=0.05; RC=$?
expect "missing page: driver exit 1" "[ $RC = 1 ]"
analyze missing; expect "missing page: analyzer exit 1" "[ $? = 1 ]"
expect "missing page: report gives no FPS" "grep -q 'No valid measurement exists' $W/missing.analyze.txt"

# 8. no driver output at all -> analyzer fails and says so
mkdir -p "$W/empty"; node "$AP/analyze.mjs" "$W/empty" >"$W/empty.analyze.txt" 2>&1; expect "empty: analyzer exit 1" "[ $? = 1 ]"
expect "empty: says driver.json missing" "grep -q 'driver.json missing' $W/empty.analyze.txt"

echo; [ $FAIL = 0 ] && echo "SELFTEST: all checks passed" || echo "SELFTEST: FAILED"
exit $FAIL
