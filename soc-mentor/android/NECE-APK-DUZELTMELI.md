# SOC Mentor — APK düzəltmək (Android)

Bu qovluq hazır Android layihəsidir. İçində tam proqram (offline HTML) var:
`app/src/main/assets/index.html`. APK-ya çevirmək üçün 3 yol:

## Yol 1 — Android Studio (ən sadə, pulsuz, tövsiyə olunur)
1. Android Studio-nu endir (developer.android.com/studio) və quraşdır.
2. Android Studio → **Open** → bu `android` qovluğunu seç.
3. İlk açılışda SDK və Gradle avtomatik endirilir (internet lazımdır).
4. Yuxarı menyu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Hazır olanda "locate" linkinə bas — APK burada olur:
   `app/build/outputs/apk/debug/app-debug.apk`
6. Bu `app-debug.apk` faylını telefona köçür və quraşdır
   (telefonda "naməlum mənbələrə icazə" aktiv olmalıdır).

## Yol 2 — Komanda sətri (Gradle quraşdırılıbsa + Android SDK)
```bash
cd android
# local.properties faylı yarat (SDK yolunu göstər):
echo "sdk.dir=/YOUR/Android/Sdk" > local.properties
gradle assembleDebug
# Nəticə: app/build/outputs/apk/debug/app-debug.apk
```

## Yol 3 — Pulsuz onlayn builder (proqramçı bilik lazım deyil)
Sənə ayrıca göndərdiyim `SOC-Mentor.html` faylını bir "HTML to APK"
onlayn xidmətinə yüklə (məs. Median.co, WebIntoApp, AppsGeyser kimi
pulsuz saytlar) — onlar HTML-dən APK düzəldir.

## Qeyd
- Tətbiq tam **offline** işləyir, internet istəmir.
- Proqres (oxunan dərslər, test nəticələri) telefonun yaddaşında saxlanır.
- `app-debug.apk` test üçündür. Google Play-ə yükləmək istəsən,
  imzalanmış "release" APK/AAB düzəltmək lazımdır (Android Studio: Generate Signed Bundle).
