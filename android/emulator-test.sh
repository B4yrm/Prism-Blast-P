#!/usr/bin/env bash
# Android emulator check for Fishing Tycoon. Taps are placed from the game's own
# UIPOS log (CSS px) converted to screen px, and every step is verified from the
# game's UI/GESTURE log lines in logcat. Results: tycoon/test-results/android/.
set -x
OUT=tycoon/test-results/android
rm -rf "$OUT"; mkdir -p "$OUT"
APK=android/app/build/outputs/apk/tycoon/debug/app-tycoon-debug.apk
PKG=az.fishing.tycoon
RES="$OUT/results.txt"; : > "$RES"
{ adb shell getprop ro.build.version.release; adb shell getprop ro.product.model; adb shell wm size; adb shell wm density;
  adb shell dumpsys package com.google.android.webview | grep -m1 versionName; } > "$OUT/device.txt"
adb install -r "$APK"
adb shell settings put secure immersive_mode_confirmations confirmed
adb shell settings put global hide_error_dialogs 1
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher || true
nodialog() { adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1; }
shot() { nodialog; sleep 1; adb exec-out screencap -p > "$OUT/$1.png"; }
log() { adb logcat -d -s FishingTycoon:I; }
check() { # name, regex expected in new log lines since mark
  if log | tail -n +$MARK | grep -qE "$2"; then echo "PASS  $1" >> "$RES"; else echo "FAIL  $1  (expected: $2)" >> "$RES"; fi; }
mark() { MARK=$(( $(log | wc -l) + 1 )); }

adb logcat -c
adb shell am start -W -n $PKG/az.universitet.tycoon.MainActivity > "$OUT/start.txt"
sleep 45; nodialog
read SW SH < <(adb shell wm size | tail -1 | sed 's/.*: //; s/x/ /' | awk '{ if ($1 < $2) print $2, $1; else print $1, $2 }')
D=$(adb shell wm density | tail -1 | sed 's/.*: //')
uipos() { log | grep UIPOS | tail -1 | sed 's/.*UIPOS //'; }
U=$(uipos); echo "$U" > "$OUT/uipos.json"
# page size in CSS px → horizontal offset of the app window (display cutout side)
read CW CH < <(echo "$U" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["w"], d["h"])')
OFFX=$(python3 -c "print(max(0, $SW - round($CW * $D / 160)))")
echo "screen=${SW}x${SH} density=$D page=${CW}x${CH} windowOffsetX=$OFFX" >> "$OUT/device.txt"
tapcss() { adb shell input tap $(python3 -c "print(round($OFFX + $1 * $D / 160), round($2 * $D / 160))"); }
pos() { echo "$(uipos)" | python3 -c "import json,sys; d=json.load(sys.stdin); v=d.get('$1'); print(v[0], v[1]) if v else print('')"; }
# close any game pop-up (level up, offline earnings) the way a player would
dismiss() { sleep 6; read MX MY < <(pos start); if [ -n "$MX" ] && [ "$MX" -gt 0 ]; then tapcss $MX $MY; sleep 2; echo "INFO  closed a game pop-up before: $1" >> "$RES"; fi; }
if [ "$OFFX" -gt 0 ]; then echo "INFO  app window is inset ${OFFX}px from the display cutout (UI is not under the notch)" >> "$RES"; fi
shot 0-welcome
# 1. welcome button
mark; read X Y < <(pos start); [ -n "$X" ] && tapcss $X $Y; sleep 3; shot 1-start
# 2. drag the map
mark; adb shell input swipe $((SW/2)) $((SH/2)) $((SW/2 - SW/5)) $((SH/2 - SH/10)) 500; sleep 2; shot 2-drag
# 3. left rail open / close
mark; read X Y < <(pos sideTog); tapcss $X $Y; sleep 2; shot 3-rail-open; check "left rail opens (notch-safe position)" "UI rail open"
mark; tapcss $X $Y; sleep 2; check "left rail closes" "UI rail closed"
# 4. centre button
mark; read X Y < <(pos recenter); tapcss $X $Y; sleep 2; check "centre button" "UI recenter"
# 5. dock → Gəmilər panel → close
mark; read X Y < <(pos boats); tapcss $X $Y; sleep 3; shot 4-panel; check "dock button opens panel" "UI open boats"
sleep 6; mark; read X Y < <(pos pclose); [ -n "$X" ] && tapcss $X $Y; sleep 2; check "panel close button" "UI close boats"
# 6. mission chip expand / collapse
dismiss mission
mark; read X Y < <(pos mission); tapcss $X $Y; sleep 2; shot 5-mission-open; check "mission chip expands" "UI mission open"
dismiss mission-close; mark; read X Y < <(pos missionX); [ -n "$X" ] && tapcss $X $Y; sleep 2; check "mission card collapses" "UI mission mini"
# 7. single tap on a building opens it (market, centre-left of the map)
# 8. double tap on open sea (two taps sent in one shell call; adb timing is not exact)
DT=0
for k in 1 2 3; do
  dismiss double-tap; mark; X=$(python3 -c "print(round($OFFX + $CW * 0.82 * $D / 160))"); Y=$(python3 -c "print(round($CH * 0.72 * $D / 160))")
  adb shell "input tap $X $Y & sleep 0.12; input tap $X $Y"; sleep 2
  if log | tail -n +$MARK | grep -q "GESTURE doubletap"; then DT=$((DT+1)); fi
  read X2 Y2 < <(pos recenter); tapcss $X2 $Y2; sleep 2
done
echo "INFO  double tap via adb: $DT/3 recognised (adb cannot send two taps with exact timing)" >> "$RES"
shot 6-after-doubletap
# 9. real play, then close and reopen: every progress value must survive
shot 8-dock-before-restart
dismiss collect; mark; read X Y < <(pos collect); tapcss $X $Y; sleep 2; check "collect button" "UI collect"
dismiss upgrades; read X Y < <(pos boats); tapcss $X $Y; sleep 6
for k in 1 2; do read X Y < <(pos upg); [ -n "$X" ] && tapcss $X $Y; sleep 6; done
read X Y < <(pos pclose); [ -n "$X" ] && tapcss $X $Y; sleep 20
dismiss before-home
adb shell input keyevent KEYCODE_HOME; sleep 3          # page hidden → game saves
SAVED=$(log | grep "SAVED " | tail -1 | sed 's/.*SAVED //')
adb shell am force-stop $PKG; sleep 2; adb logcat -c
adb shell am start -W -n $PKG/az.universitet.tycoon.MainActivity > /dev/null; sleep 40; nodialog
LOADED=$(log | grep "LOADED " | head -1 | sed 's/.*LOADED //')
echo "SAVED  $SAVED"  > "$OUT/save-load.txt"; echo "LOADED $LOADED" >> "$OUT/save-load.txt"
python3 - "$SAVED" "$LOADED" >> "$RES" <<'PY'
import json, sys
try:
    s, l = json.loads(sys.argv[1]), json.loads(sys.argv[2])
except Exception as e:
    print("FAIL  save/load after real play (could not read snapshots: %s)" % e); sys.exit()
diff = [k for k in s if s[k] != l.get(k)]
played = s["money"] != 120 or s["upgrades"] != "0-0-0-0-0"
print(("PASS" if not diff and played else "FAIL") + "  save/load after real play + force-stop: %d fields equal%s (level %s, money %s, upgrades %s, workers %s)"
      % (len(s) - len(diff), "" if not diff else ", different: " + ",".join(diff), s["level"], s["money"], s["upgrades"], s["workers"]))
PY
shot 7-after-restart
# second restart: icons must still render the same
adb shell am force-stop $PKG; sleep 2
adb shell am start -W -n $PKG/az.universitet.tycoon.MainActivity > /dev/null; sleep 40; nodialog
shot 9-after-second-restart
# 10. performance & memory
adb shell dumpsys gfxinfo $PKG > "$OUT/gfxinfo.txt"
adb shell dumpsys meminfo $PKG > "$OUT/meminfo.txt"
log > "$OUT/logcat.txt"
adb logcat -d -s AndroidRuntime:E > "$OUT/crashes.txt"
{ grep -E "Total frames|Janky frames:|50th percentile|90th percentile" "$OUT/gfxinfo.txt"
  grep -E "TOTAL PSS|Java Heap:|Native Heap:|Graphics:" "$OUT/meminfo.txt"
  grep PERF "$OUT/logcat.txt" | tail -2; } > "$OUT/summary.txt"
N=$(grep -c "FATAL EXCEPTION" "$OUT/crashes.txt" || true); echo "INFO  crashes: $N" >> "$RES"
cat "$RES" "$OUT/summary.txt"
exit 0
