#!/usr/bin/env bash
# Runs inside the Android emulator job: installs Fishing Tycoon, plays it for a
# while with touch input and collects screenshots, frame and memory stats.
set -x
OUT=tycoon/test-results/android
mkdir -p "$OUT"
APK=android/app/build/outputs/apk/tycoon/debug/app-tycoon-debug.apk
adb shell getprop ro.build.version.release > "$OUT/device.txt"
adb shell getprop ro.product.model >> "$OUT/device.txt"
adb shell wm size >> "$OUT/device.txt"
adb shell wm density >> "$OUT/device.txt"
adb shell dumpsys package com.google.android.webview | grep -m1 versionName >> "$OUT/device.txt"
adb install -r "$APK"
# no first-run "Viewing full screen" bubble (it would swallow the test taps)
adb shell settings put secure immersive_mode_confirmations confirmed
# the slow CI emulator often reports "Launcher isn't responding": hide system error dialogs
adb shell settings put global hide_error_dialogs 1
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher || true
nodialog() { adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1; }
adb logcat -c
adb shell am start -W -n az.fishing.tycoon/az.universitet.tycoon.MainActivity | tee "$OUT/start.txt"
sleep 40
nodialog; sleep 1
adb exec-out screencap -p > "$OUT/0-welcome.png"
read W0 H0 < <(adb shell wm size | tail -1 | sed 's/.*: //; s/x/ /' | awk '{ if ($1 < $2) print $2, $1; else print $1, $2 }')
# press "Başla" on the welcome card (centre of the screen, lower half)
adb shell input tap $((W0/2)) $((H0 * 29 / 40))
sleep 3
adb exec-out screencap -p > "$OUT/1-start.png"
adb shell dumpsys gfxinfo az.fishing.tycoon reset > /dev/null
# screen size in landscape
read W H < <(adb shell wm size | tail -1 | sed 's/.*: //; s/x/ /' | awk '{ if ($1 < $2) print $2, $1; else print $1, $2 }')
D=$(adb shell wm density | tail -1 | sed 's/.*: //')
px() { echo $(( $1 * D / 160 )); }
# drag the map
nodialog
adb shell input swipe $((W/2)) $((H/2)) $((W/2 - W/5)) $((H/2 - H/10)) 400
sleep 2
adb exec-out screencap -p > "$OUT/2-after-drag.png"
nodialog
# double-tap on the sea at the lower right to zoom in
adb shell input tap $((W - W/8)) $((H - H/4)); adb shell input tap $((W - W/8)) $((H - H/4))
sleep 2
adb exec-out screencap -p > "$OUT/3-after-doubletap.png"
# centre button (left rail, second button)
adb shell input tap $(px 30) $(px 110)
sleep 2
nodialog
# open the "Gəmilər" panel from the middle of the dock
adb shell input tap $((W/2)) $((H - $(px 30)))
sleep 2
adb exec-out screencap -p > "$OUT/4-panel.png"
# close the panel (red × in the panel header, top-right)
adb shell input tap $((W - $(px 30))) $(px 28)
sleep 2
nodialog
# open the left rail
adb shell input tap $(px 30) $(px 66)
sleep 2
adb exec-out screencap -p > "$OUT/5-rail-open.png"
adb shell input tap $(px 30) $(px 66)
sleep 40
adb shell dumpsys gfxinfo az.fishing.tycoon > "$OUT/gfxinfo.txt"
adb shell dumpsys meminfo az.fishing.tycoon > "$OUT/meminfo.txt"
adb logcat -d -s FishingTycoon:I AndroidRuntime:E > "$OUT/logcat.txt"
adb shell dumpsys activity activities | grep -c "az.fishing.tycoon/az.universitet.tycoon.MainActivity" > "$OUT/activity-count.txt"
adb exec-out screencap -p > "$OUT/6-end.png"
grep -E "Total frames|Janky|50th|90th|99th" "$OUT/gfxinfo.txt" > "$OUT/summary.txt"
grep -E "TOTAL PSS|TOTAL RSS|Graphics:|GL mtrack|EGL mtrack|Native Heap|Java Heap" "$OUT/meminfo.txt" >> "$OUT/summary.txt"
grep PERF "$OUT/logcat.txt" | tail -5 >> "$OUT/summary.txt"
cat "$OUT/summary.txt"
exit 0
