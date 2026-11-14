# Fishing Tycoon — 28 günlük icra planı

**Status:** plan (kod yazılmayıb). Başlanğıc: təsdiqdən sonrakı ilk iş günü = **Gün 1**. Branch: `claude/clever-maxwell-tolun5`.
Dizayn: `FISHING-TYCOON-GDD-V1.md`; texniki həll: `ECONOMY-ARCHITECTURE.md` (bölmə nömrələri **A§**, GDD bölmələri **G§**).

## 0. Ümumi qaydalar

- **Bir tapşırıq = bir commit** (rollback səviyyə 4, A§13). Hər commit-dən əvvəl: unit testlər + eco söndürülmüş regresiya.
- **Hər gün tapşırıq bitəndə yoxlama dəsti (`CHECK`):**
  `node --test tests/eco/` · `tests/workers-regress.cjs` (eco söndürülmüş = baseline ilə eyni) · `tests/save-compare.cjs` ·
  `tests/run-tests.cjs` (dev build). Uzun dəst (`bench.cjs`, `boat-sync.cjs`, offline matrisi) həftə sonu.
- **Build:** yalnız dev build (`ECO=1 BUILD_OUT=.preview/dev.html node build.mjs`). `tycoon/index.html` və APK yalnız ayrıca təsdiqlə.
- **Qorunan fayllar** (`src/sim/*`, `src/core/*`, `main.js`, faza A kodu, qayıq marşrutları/iskələlər, `fishing/`) dəyişmir.
  İstisna lazım olarsa — tapşırıq dayanır və təsdiq istənilir.
- **Prioritet:** P0 = olmadan sonrakılar mümkün deyil; P1 = sistemin V1 minimumu; P2 = cila, kəsilə bilər.
- **Mürəkkəblik:** S ≤ 0.5 gün, M ≈ 1 gün, L > 1 gün (bölünməlidir).
- **Model tövsiyəsi:** **Opus** — arxitektura, save/offline, determinizm, balans, adapterlə simulyasiya kəsişməsi;
  **Sonnet** — UI panelləri, məlumat cədvəlləri, test skeletləri, sənəd, mexaniki genişlənmə.
- **FPS riski** işarəsi: 🟢 cüzi · 🟡 ölçülməli · 🔴 Android-də yoxlanmadan buraxılmamalı. **Save riski** eyni şkala.

## 1. Performans ölçmə planı

| Nöqtə | Nə vaxt | Necə | Nəticə faylı |
|---|---|---|---|
| **M0 — baseline** | Gün 1 | `bench.cjs` (12 səhnə, 2 təkrar) bugünkü dev build + eco-suz; CI emulyator (Medium/High) | `test-results/eco/perf-M0.md` |
| M1 | Gün 7 | eco açıq: növ + bazar + saat | `perf-M1.md` |
| M2 | Gün 14 | + hava, yanacaq, ehtiyat, keyfiyyət, offline | `perf-M2.md` |
| M3 | Gün 21 | + emal, müqavilə, logistika, maliyyə, işçilər | `perf-M3.md` |
| M4 | Gün 27 | tam dəst; emulyator + (mümkünsə) real cihaz | `perf-M4.md` |

- **Hədəf:** emulyatorda baseline-dan ≤ 0.5 FPS düşmə (baseline: Medium 11.9, High 8.8 [ölçülüb, CI #44]); heap ≤ +3 MB;
  `eco.tick` ≤ 0.02 ms (A§11). Hədəf aşılarsa növbəti həftənin ilk tapşırığı optimallaşdırmadır.
- **Məhdudiyyət [təsdiq]:** CI emulyator işi (`.github/workflows/android-apk.yml`) yalnız `tycoon/index.html` dəyişəndə işləyir və APK-nı
  avtomatik commit edir. Dev build-i emulyatorda ölçmək üçün ya (a) ayrıca `workflow_dispatch` işi (dev HTML yolu ilə, APK commit etmədən),
  ya da (b) ölçmə üçün production build icazəsi lazımdır. Bu konteynerdə emulyator yoxdur; real cihaz yalnız sizin tərəfinizdən.

---

## 2. Həftə 1 (Gün 1–7) — Təməl: eco qatı, növlər, bazar

### Gün 1 — T1.1 Baseline + eco skeleti (P0, M, Opus)
- **Fayllar (yeni):** `src/eco/index.js`, `adapter.js` (boş sarğılar, hamısı `orig()`), `rng.js`, `clock.js`, `src/main-eco.js`;
  `build.mjs` (`ECO=1` → entry `src/main-eco.js`); `tests/eco/rng.test.mjs`, `tests/eco/no-math-random.cjs`, `tests/eco/adapter-contract.cjs`.
- **Asılılıq:** təsdiq (§6, Q1–Q3).
- **Qəbul:** `ECO` olmadan build bayt-bayt bugünkü ilə eyni (hash); `ECO=1` + bütün sistemlər sönük → `workers-regress` 6/6, `save-compare` 4/4,
  `run-tests` 15/15 eyni; `perf-M0.md` yazılıb.
- **Testlər:** RNG determinizmi və axın müstəqilliyi; `Math.random` yoxdur; adapter-contract (`b.state`, `w.job`, `sim.res`, `sim.convey`, `stat.*` mövcuddur).
- **Risk:** Save 🟢 · FPS 🟢.

### Gün 2 — T1.2 Eco save alt-ağacı, miqrasiya, reconcile (P0, M, Opus)
- **Fayllar:** `src/eco/state-eco.js` (`ecoFresh`, `migrateEco`, `reconcile`), `index.js` (tənbəl init); `tests/eco/state.test.mjs`;
  `tests/eco/save-matrix.cjs` + fixture-lər (`tests/fixtures/save-{new,mid,max}.json`).
- **Asılılıq:** T1.1.
- **Qəbul:** eco-suz v1 save → eco build-də yüklənir, `snapshot()` dəyişmir; eco build save → **köhnə build** (`index.html` @ HEAD) yükləyir,
  `snapshot()` eyni, `S.eco` saxlanır; korlanmış `S.eco` → reconcile, crash yoxdur. `SAVE_VERSION` = 1 qalır.
- **Testlər:** save matrisi (3 fixture × irəli/geri), reconcile edge-case-lər (NaN, mənfi, boş ehtiyat).
- **Risk:** Save 🔴 (ən kritik gün) · FPS 🟢.

### Gün 3 — T1.3 Növlər və tərkib vektoru (P0, M, Opus)
- **Fayllar:** `src/eco/defs-eco.js` (növ cədvəli), `mix.js`, `catch.js`, `adapter.js` (qayıq `fish→back`, `unload`, işçi `pick→toDst`, `drop`,
  konveyer müşahidəsi); `tests/eco/mix.test.mjs`, `catch.test.mjs`.
- **Asılılıq:** T1.2.
- **Qəbul:** 600 s seed-li işdə hər saat `Σmix = 1 ± 1e-9`, heç bir pay < 0; tərkib iskələ → anbar → rəf zəncirində izlənir; eco söndürülmüş regresiya eyni.
- **Testlər:** mix unit; invariant rejimi (`?ecoCheck=1`) 0 `ECOERR`; `WeakMap` sızma yoxlaması (işçi/konveyer obyektləri).
- **Risk:** Save 🟡 (yeni sahələr) · FPS 🟡 (hər kadr müşahidə — allokasiyasız).

### Gün 4 — T1.4 Növ qiyməti, balans-neytral kalibrləmə (P0, S, Opus)
- **Fayllar:** `adapter.js` (`stat.rawPrice` sarğısı), `defs-eco.js` (`PRICE_NORM`); `tools/balance-sim.mjs` (ilk versiya); `tests/eco/price.test.mjs`.
- **Asılılıq:** T1.3.
- **Qəbul:** istinad qarışığında faktor 1.000 ± 0.01; 600 s işdə gəlir eco söndürülmüş ilə ±10%; ümumi limit [0.4, 2.5] işləyir.
- **Testlər:** qiymət unit; balance-sim 1 günlük əyri.
- **Risk:** Save 🟢 · FPS 🟢. **Qeyd:** `steadyRate` → offline/mağaza dəyərlərinə təsir (A§8.1) — offline konteksti T2.6-da.

### Gün 5 — T1.5 Oyun təqvimi, mövsüm, HUD saat çipi (P1, M, Sonnet)
- **Fayllar:** `clock.js`, `step.js` (`hourStep` skeleti), `catch.js` (mövsüm profili), `src/ui/eco-ui.js`, `src/ui/eco.css`, `build.mjs` (CSS birləşdirmə).
- **Asılılıq:** T1.3.
- **Qəbul:** 1 oyun saatı = 60 s sim vaxtı; mövsüm 7 gündə dəyişir; çip 12 ekran ölçüsündə üst-üstə düşmür (`run-tests` layout).
- **Testlər:** clock unit (15/30/60 FPS-də eyni oyun saatı — `dt` əsaslı); layout testi.
- **Risk:** Save 🟢 · FPS 🟡 (DOM — yalnız dəyər dəyişəndə yazılır).

### Gün 6 — T1.6 Dinamik bazar + Bazar paneli (P1, M, Opus məntiq / Sonnet UI)
- **Fayllar:** `market.js`, `adapter.js` (`sale` abunəsi, saturation), `eco-ui.js` ("Biznes" düyməsi → Bazar tabı); `tests/eco/market.test.mjs`.
- **Asılılıq:** T1.4, T1.5.
- **Qəbul:** indekslər [0.5, 2.0]; satışsız 12 saatda saturation < 5%; panel bağlı ikən 0 DOM yazısı; açıq ikən ≤ 2 Hz.
- **Testlər:** bazar unit (bərpa, gəzinti ortaya dönür, determinizm); DOM mutasiya sayğacı.
- **Risk:** Save 🟢 · FPS 🟡.

### Gün 7 — T1.7 Həftə 1 inteqrasiyası, M1 ölçməsi, bufer (P0, M, Opus)
- **Fayllar:** `test-results/eco/perf-M1.md`, `test-results/eco/WEEK1.md`; eco açıq golden snapshot (`tests/eco/golden.cjs`).
- **Qəbul:** tam `CHECK` + `bench.cjs` + `boat-sync.cjs`; M1 hədəflərdə; golden snapshot qeydə alınıb.
- **Risk:** — . Bufer: geri qalan T1.x tapşırıqları.

---

## 3. Həftə 2 (Gün 8–14) — Risk və əməliyyatlar

### Gün 8 — T2.1 Maliyyə ledger-i və `eco.charge` (P0, M, Opus)
- **Fayllar:** `finance.js` (kateqoriyalar, gündəlik P&L, `bills`), `adapter.js` (`sale`/`collect` kateqoriyalaşdırma); `tests/eco/finance.test.mjs`.
- **Asılılıq:** T1.5.
- **Qəbul:** `money` heç vaxt < 0; xərc çatmırsa `bills`; gəlir cəmi = `S.stats.earned` artımı (uyğunluq testi).
- **Risk:** Save 🟡 · FPS 🟢.

### Gün 9 — T2.2 Yanacaq, vəziyyət, təmir, sığorta (P1, M, Opus)
- **Fayllar:** `fleet.js`, `adapter.js` (`dock→out` keçidi, `stat.boatSpeed`/`boatCap` sarğıları), `eco-ui.js` (Qayıqlar bölməsi: vəziyyət, təmir, sığorta).
- **Asılılıq:** T2.1.
- **Qəbul:** yanacaq ≤ səfər gəlirinin 15%-i (balance-sim); `cond < 50` → sürət −10%; **`boat-sync.cjs` və `boat-timeline.cjs` keçir**.
- **Risk:** Save 🟡 · FPS 🟡 (qayıq render-i sim sürətindən plan qurur).

### Gün 10 — T2.3 Hava və fırtına (P1, M, Opus)
- **Fayllar:** `weather.js`, `adapter.js` (fırtınada `boat.t` saxlama, `stat.fishTime`/`custEvery`), `eco-ui.js` (hava çipi, xəbərdarlıq toast-u, CSS ton).
- **Asılılıq:** T2.2, **Q5 təsdiqi** (fırtınada qayıq saxlama).
- **Qəbul:** proqnoz = reallıq (deterministik); fırtınada limandakı boş qayıq çıxmır; render-də qayıq "ilişmir" (`boat-sync`, video/screenshot);
  Low preset-də ton effekti sönük.
- **Testlər:** Markov stasionar paylanma; uzun dok gözləməsi ssenarisi.
- **Risk:** Save 🟢 · FPS 🔴 (render qayıq planlaması + overlay — emulyatorda yoxlanmalı).

### Gün 11 — T2.4 Balıq ehtiyatları (P1, S, Opus)
- **Fayllar:** `stocks.js`, `catch.js` (bolluq çəkisi), `adapter.js` (`stat.boatCap` × ümumi bolluq ≥ 0.7), `eco-ui.js` (5 bar).
- **Asılılıq:** T1.3, T1.5.
- **Qəbul:** `B ∈ [0.05, 1]`; max donanma tək növü ~2 günə tükəndirir, 1–3 günə bərpa (balance-sim).
- **Risk:** Save 🟢 · FPS 🟢.

### Gün 12 — T2.5 Keyfiyyət və xarab olma (P1, M, Opus)
- **Fayllar:** `quality.js`, `adapter.js` (`S.stock` azaltma ≤ `stock − res`; "Soyuducu" treki oxunur), `eco-ui.js` (A/B/C nişanı).
- **Asılılıq:** T1.3, T2.1.
- **Qəbul:** invariant `stock ≥ res` 0 pozuntu (10 haulerli maks ssenari, 600 s); işçi "boş pick" (`take <= 0`) tezliyi baseline-dan artmır.
- **Risk:** Save 🟡 · FPS 🟢. **Simulyasiya ehtiyatına ilk yazma — diqqət.**

### Gün 13 — T2.6 Offline v2 (P0, L→ bölünmüş: 13a + 13b, Opus)
- **13a:** `offline.js`, `step.js` ortaq `hourStep`; offline kontekstdə qiymət = 24 saat ortası (A§8.1); `tests/eco/offline.test.mjs` (`offline(N) == N×hourStep`).
- **13b:** `eco-ui.js` "Biznes hesabatı" modalı (mövcud offline modalından sonra); `tests/eco/offline-matrix.cjs` (30 s … 48 saat), paritet testi (A§8.3).
- **Asılılıq:** T2.1–T2.5, **Q6 təsdiqi**.
- **Qəbul:** 8 saat offline ≤ 30 ms; paritet 0.5 ± 0.15; mövcud offline məbləği (`main.js`) eco söndürülmüş halda dəyişmir.
- **Risk:** Save 🔴 · FPS 🟢.

### Gün 14 — T2.7 Həftə 2 inteqrasiyası, M2 ölçməsi (P0, M, Opus)
- **Fayllar:** `perf-M2.md`, `WEEK2.md`, golden yenilənməsi (təsdiqlə).
- **Qəbul:** tam `CHECK` + bench + offline matrisi + save matrisi; emulyator ölçməsi (§1 məhdudiyyət).

---

## 4. Həftə 3 (Gün 15–21) — İstehsal, satış kanalları, insanlar, pul

### Gün 15 — T3.1 Emal reseptləri (P1, M, Opus məntiq / Sonnet UI)
- **Fayllar:** `factory.js`, `defs-eco.js` (5 resept), `adapter.js` (konveyer → `pmix`, `stat.prodPrice`), `eco-ui.js` (zavod resept kartları).
- **Asılılıq:** T1.4, T2.5.
- **Qəbul:** resept dəyişikliyi konveyerdəkilərə təsir etmir; uyğunsuz giriş ×0.7; balans-neytral (konserv + istinad qarışığı ≈ bugünkü `prodPrice` ±10%).
- **Risk:** Save 🟢 · FPS 🟢.

### Gün 16 — T3.2 Müqavilələr: restoran + supermarket (P1, M, Opus)
- **Fayllar:** `contracts.js`, `adapter.js` (stokdan çıxarış), `eco-ui.js` (Müqavilələr tabı).
- **Asılılıq:** T2.1, T2.5, T3.1.
- **Qəbul:** gündəlik 3 təklif (seed-li); çıxarış ≤ `stock − res`; gecikmə → cərimə + rep; həcm ≤ gündəlik istehsalın 40%-i.
- **Risk:** Save 🟡 · FPS 🟢.

### Gün 17 — T3.3 İxrac + mücərrəd logistika (P1, M, Sonnet)
- **Fayllar:** `logistics.js`, `contracts.js` (ixrac), `eco-ui.js` ("Yolda" siyahısı).
- **Asılılıq:** T3.2.
- **Qəbul:** FIFO növbə; ETA oyun saatı ilə; ödəniş çatdırılmada; offline-də ETA keçir.
- **Risk:** Save 🟡 · FPS 🟢.

### Gün 18 — T3.4 Reputasiya (P1, S, Sonnet)
- **Fayllar:** `reputation.js`, `adapter.js` (`stat.custEvery`, qiymət ±5%), `eco-ui.js` (HUD rəqəmi).
- **Asılılıq:** T3.2, T2.5, T2.1.
- **Qəbul:** ölüm spiralı yoxdur (balance-sim: rep 10-dan 7 gündə bərpa mümkündür); effekt limitləri (−10% / +20%).
- **Risk:** Save 🟢 · FPS 🟢. Qeyd: müştəri vaxtı dəyişir → eco açıq golden yenilənir.

### Gün 19 — T3.5 Komanda bacarığı və menecerlər (P1, M, Sonnet; avtomatlaşdırma məntiqi Opus ilə review)
- **Fayllar:** `staff.js`, `adapter.js` (`stat.workerSpeed` — **`loadTime` yox**, Q7), `eco-ui.js` (İşçilər bölməsi).
- **Asılılıq:** T2.1, T2.2, T3.2.
- **Qəbul:** faza A testləri (`pose-sync`, `walk-anim`, `workers-regress` eco söndürülmüş) dəyişmir; ümumi hauler sürət limiti; maaşlar ledger-də.
- **Risk:** Save 🟢 · FPS 🟡 (sürət ↑ → replay catch-up).

### Gün 20 — T3.6 Kreditlər və investisiya layihələri + Maliyyə paneli (P1, M, Opus)
- **Fayllar:** `finance.js` (kreditlər, layihələr), `eco-ui.js` (Maliyyə tabı: P&L, 7 gün, kreditlər).
- **Asılılıq:** T2.1, T3.4.
- **Qəbul:** amortizasiya dəqiq (unit); limit = 3 gün orta mənfəət × 5 × rep faktoru; balance-sim-də kredit exploit-i yoxdur.
- **Risk:** Save 🟡 · FPS 🟢.

### Gün 21 — T3.7 Həftə 3 inteqrasiyası, M3, balans keçidi (P0, M, Opus)
- **Fayllar:** `perf-M3.md`, `WEEK3.md`, `test-results/eco/balance-week3.md`.
- **Qəbul:** tam dəst; 7 oyun günlük balance-sim əyrisi bugünkü progressiyadan ±25% (missiya ardıcıllığı keçilə bilir).

---

## 5. Həftə 4 (Gün 22–28) — Meta, genişlənmə hazırlığı, sabitləşmə

### Gün 22 — T4.1 Biznes hadisələri (P1, M, Opus məntiq / Sonnet məzmun)
- **Fayllar:** `events.js`, `defs-eco.js` (12 hadisə), `eco-ui.js` (toast-first, seçim modalı, aktiv nişanlar).
- **Asılılıq:** T1.6, T2.2, T3.2, T3.4.
- **Qəbul:** gündə 1–2 hadisə; modlar deklarativ və save olunur; offline-də yalnız passiv.
- **Risk:** Save 🟡 · FPS 🟢.

### Gün 23 — T4.2 Gündəlik tapşırıqlar və yeni nailiyyətlər (P2, M, Sonnet)
- **Fayllar:** `tasks.js`, `eco-ui.js` (Missiyalar panelinin altına bölmə — DOM inyeksiyası; `ui.js`-ə toxunmadan).
- **Asılılıq:** bütün metrikalar.
- **Qəbul:** tarixə görə seed (eyni gün = eyni 3 tapşırıq); offline irəliləmə sayılmır; mövcud missiya/nailiyyət/daily dəyişmir.
- **Risk:** Save 🟢 · FPS 🟢.

### Gün 24 — T4.3 Regionlar: məlumat modeli + kilidli UI (P2, S, Sonnet)
- **Fayllar:** `defs-eco.js` (`ECO_REGIONS`), `stocks.js` (region açarı), `eco-ui.js` (kilidli kartlar).
- **Asılılıq:** T2.4; multi-sea yerinin aydınlaşdırılması (Q8).
- **Qəbul:** bütün eco strukturları region açarlı; bir region aktiv; heç bir xəritə/marşrut dəyişməyib.
- **Risk:** Save 🟢 · FPS 🟢.

### Gün 25 — T4.4 UI konsolidasiyası və Android optimallaşdırması (P0, M, Sonnet UI / Opus perf)
- **Fayllar:** `eco-ui.js`, `eco.css`; M3-də tapılan isti nöqtələr.
- **Qəbul:** `run-tests` 12 ekran ölçüsü keçir (640×360 daxil); panel açıq/bağlı DOM mutasiya hədəfləri; heap ≤ +3 MB.
- **Risk:** FPS 🔴.

### Gün 26 — T4.5 Tam regresiya: save/offline matrisləri (P0, M, Opus)
- **Fayllar:** `test-results/eco/REGRESSION.md`.
- **Qəbul:** eco söndürülmüş: baseline ilə eyni (bütün testlər); eco açıq: golden, invariant rejimi 60 dəqiqəlik işdə 0 `ECOERR`; downgrade testi keçir.
- **Risk:** Save 🔴 (yoxlama günü).

### Gün 27 — T4.6 M4: emulyator, real cihaz, balans tənzimi (P0, M, Opus)
- **Fayllar:** `perf-M4.md`, `defs-eco.js` (yalnız [BALANS] rəqəmləri).
- **Asılılıq:** §1 emulyator qərarı; real cihaz — sizin tərəfinizdən.
- **Qəbul:** FPS hədəfi; balans hədəfləri (A§12.8).
- **Risk:** FPS 🔴.

### Gün 28 — T4.7 Release candidate (dev build), sənəd, handoff (P0, S, Sonnet)
- **Fayllar:** `HANDOFF.md`, `test-results/eco/RC-REPORT.md`, `.preview/dev.html`.
- **Qəbul:** bütün hesabatlar; production build/APK **yalnız ayrıca təsdiqlə**.

---

## 6. Təsdiq tələb edən qərarlar

| # | Qərar | Tövsiyə | Bloklayır |
|---|---|---|---|
| Q1 | İnteqrasiya yolu: Adapter (A) vs qorunan fayllarda incə hook-lar (B) | **A** (A§2) | Gün 1 |
| Q2 | Yeni entry `src/main-eco.js` + `build.mjs`-də `ECO=1` (main.js dəyişmir) | Bəli | Gün 1 |
| Q3 | Save: `S.eco` alt-ağacı, `SAVE_VERSION = 1` qalır, eco-nun öz versiyası | Bəli (A§7.1) | Gün 2 |
| Q4 | Vaxt miqyası: 1 oyun saatı = 1 real dəq, mövsüm = 7 oyun günü | Bəli [BALANS] | Gün 5 |
| Q5 | Fırtınada limandakı qayıqları saxlamaq üçün `boat.t`-yə adapterdən yazma | Bəli, `boat-sync` şərti ilə | Gün 10 |
| Q6 | Offline qaydaları (A§8.2 cədvəli), ayrıca "Biznes hesabatı" modalı | Bəli | Gün 13 |
| Q7 | Bacarıq yalnız sürətə təsir edir, `loadTime`-a yox (faza A poz istisnası) | Bəli | Gün 19 |
| Q8 | Multi-sea sisteminin yeri (bu branch-da tapılmadı) və regionlarla əlaqəsi | Aydınlaşdırılmalı | Gün 24 |
| Q9 | Pul mənfi olmur, "ödənilməmiş hesablar" modeli, iflas yoxdur | Bəli | Gün 8 |
| Q10 | Android ölçməsi: ayrıca `workflow_dispatch` emulyator işi (dev HTML, APK commit yox) | Bəli | Gün 1/7 |
| Q11 | Mövcud oyunçular üçün eco default açıq, yoxsa "yeni biznes rejimi" ilə opt-in | Açıq, balans-neytral aktivləşdirmə ilə | Gün 28 |
| Q12 | Seçici satış (*qiymət ≥ X olanda sat*) V1-dən çıxarılır (simulyasiyaya müdaxilə tələb edir) | Bəli, gələcəyə | — |

## 7. Realizm qiymətləndirməsi: 28 günə nə sığır, nə sığmır

**Sığır (funksional minimum, plana görə):** 16 sistemin 15-i V1 minimumunda (G§3.1–3.15), regionlar yalnız data modeli + kilidli UI.

**Sığmır / açıq şəkildə kəsilir:**
- Oynanıla bilən yeni regionlar/limanlar (yeni xəritə, marşrut, atlas) — qorunan liman quruluşu və multi-sea ilə inteqrasiya tələb edir.
- Vizual yük maşınları/forkliftlər — Mərhələ 2-nin işidir; logistika V1-də mücərrəd.
- Fərdi qayıq və fərdi işçi effektləri — Variant B hook-ları və ya faza B tələb edir; V1-də donanma/komanda ortası.
- Seçici satış siyasəti, rəqib şirkətlər, fyuçers, vergilər, səhm portfeli.
- Hava vizualları (yağış partikülləri) — yalnız CSS ton.
- Real cihazda yoxlama — sizin cihazınızdan asılıdır; emulyator CI qərarından (Q10).

**Riskli günlər (bufer tükənərsə kəsiləcək P2-lər):** T4.2 (tapşırıqlar), T4.3 (regionlar UI), hadisə məzmununun yarısı (12 → 6).
Həftə sonu günləri (7, 14, 21) bufer rolunu oynayır; bir həftədə 1 günlük gecikmə növbəti həftənin P2-lərini kəsməklə bağlanır.

**Ümumi qiymətləndirmə:** funksional minimum **real, amma sıxdır** — şərt: Q1–Q3 Gün 1-dən əvvəl təsdiqlənsin, balans [BALANS] rəqəmləri
ilk versiyada "kifayət qədər yaxşı" qəbul edilsin və Android FPS hədəfi aşılarsa yeni sistem əlavə etmək dayandırılsın.
