# Fishing Tycoon — Master GDD v1.0

**Status:** layihə sənədi (audit + dizayn). Oyun kodu dəyişdirilməyib. Tarix: 2026-11-14, branch `claude/clever-maxwell-tolun5`.
**Model:** 60% realist biznes simulyasiyası, 40% Idle Tycoon.
**Əlaqəli sənədlər:** `ECONOMY-ARCHITECTURE.md` (texniki həll), `ROADMAP-28-DAYS.md` (icra planı), `../HANDOFF.md`,
`../test-results/audit/WORKERS-AUDIT.md`, `../test-results/workers/PHASE-A-REPORT.md`.

**İşarələr**
- **[kod]** — mənbə kodunda oxunub; **[ölçülüb]** — əvvəlki auditlərdə ölçülüb (headless Chromium və ya CI emulyatoru);
- **[fərziyyə]** — yoxlanmayıb, təsdiq və ya ölçmə tələb edir;
- **[BALANS]** — ilkin balans fərziyyəsi. Bütün qiymət, faiz və müddət rəqəmləri oyun daxili vahidlərdir, **real bazar
  qiyməti deyil**, və playtest/balance-sim ilə kalibrləşdiriləcək.

---

## 0. Mövcud vəziyyətin auditi

### 0.1 Ümumi mənzərə

Oyun ~4 900 sətirlik Phaser 3.90 + DOM UI layihəsidir (`tycoon/src`). Simulyasiya (`src/sim/sim.js`) iqtisadiyyatın
**yeganə həqiqət mənbəyidir**: qayıq → iskələ (`quay`) → daşıyıcılar → anbar (`wh`) → konveyer → zavod (`facOut`) →
daşıyıcılar → bazar rəfləri (`mRaw`, `mProd`) → müştəri → kassa (`register`) → `money`. Render (qayıqlar,
işçilərin replay qatı, kranlar, arabalar) yalnız simulyasiyanı oxuyur. [kod]

Balıq **növsüzdür**: bütün ehtiyatlar tam ədəddir (`S.stock.{quay,wh,facOut,mRaw,mProd}`), qiymətlər iki ədəddir
(`rawPrice = 4 × …`, `prodPrice = 11 × …`). Xərc anlayışı yoxdur — pul yalnız upgrade/işçi/qayıq/tədqiqat alanda
xərclənir. Oyun təqvimi, hava, bazar dinamikası yoxdur. [kod]

### 0.2 Sistemlər üzrə audit

| Sistem | Mövcud funksiyalar | Əsas fayllar | Məlumat axını | Dəyişiklik riski |
|---|---|---|---|---|
| **İqtisadiyyat / simulyasiya** | `stat.*` (törəmə göstəricilər), `addMoney`, `spend`, `steadyRate`, XP/səviyyə, missiyalar, nailiyyətlər, tədqiqat | `src/core/economy.js`, `src/data/defs.js` | `defs` → `stat.*` → `Sim` hər kadrda oxuyur → `S.stock`, `S.register`, `S.money` | **Yüksək.** `stat` bütün sistemlərin ortaq qatıdır; hər çarpan dəyişikliyi gəliri və offline gəliri dəyişir. `stat` adi obyektdir (xüsusiyyətləri əvəz edilə bilər) — genişlənmə nöqtəsi kimi yararlıdır. |
| **Gəmilər, tutma, boşaltma** | Hal maşını `dock → out → fish → back → dock`; tutma `stat.boatCap()`, müddət `stat.fishTime()`; boşaltma iskələ tutumu ilə məhdud | `src/sim/sim.js` (`updBoat`), render: `src/render/boats.js`, `boatpaths.js`, `jetties.js` | Qayıq yükü `fish` sonunda `stats.caught`-a yazılır, `dock`-da `stock.quay`-a boşaldılır; `unload` hadisəsi | **Yüksək.** Render qayıqları simulyasiya saatından manevr planlayır (`boats.js`); marşrut/iskələ qorunur. Bütün `stat` funksiyaları **donanma üzrə ümumidir** — fərdi qayıq effekti üçün hook yoxdur. |
| **İşçilər və logistika** | Daşıyıcı hal maşını, iş seçimi `pickJob` (rezervasiyalarla), A* (`findPath`), faza A replay qatı | `src/sim/sim.js` (`updWorker`, `pickJob`), `src/sim/path.js`, `src/scenes/WorldScene.js` (`drawWalkers`, `replay`), `src/render/slipcarts.js` | `stock[src] → carry → stock[dst]`; `drop` hadisəsi `{w, dst, n}` | **Yüksək.** Daşıyıcılar vizual deyil, iqtisadiyyatın özüdür (audit §3). Faza A kodu qorunur. Yolda olan balıq save-də saxlanmır. |
| **Anbar, zavod, satış** | Tutumlar (`quayCap`, `whCap`, `facOutCap`, `shelfCap`), konveyer (4 s), zavod sürəti, müştəri axını (`custEvery`), kassa tutumu, avto-yığım | `src/sim/sim.js` (`updFactory`, `updCustomers`, `serve`), `economy.js` | `wh → convey → facOut`; müştəri `mProd`-u əvvəl, sonra `mRaw`-u alır; məbləğ `register`-ə | **Orta.** Satış qiyməti hər vahid üçün `stat.rawPrice()/prodPrice()` çağırışı ilə hesablanır — qiymət modelini `stat` səviyyəsində dəyişmək mümkündür. `sale` hadisəsi növ bölgüsünü vermir. |
| **Upgrade və progression** | 5 bina × 2–3 trek (max = 10 × tier), tier 1–3, işçi/qayıq limiti, tədqiqat (7 node), missiya ardıcıllığı (18), nailiyyət (6), gündəlik mükafat (7 gün), mağaza (gem) | `src/data/defs.js`, `economy.js`, `src/ui/ui.js` | `buyTrack/buyTier/hire/buyBoat` → `spend` → `S.up/tier` → `stat` | **Aşağı-orta.** Məlumat-yönümlüdür; yeni treklər əlavə etmək asandır, amma `defs.js` mövcud balansdır — yeni sistemlər öz `defs` faylında saxlanmalıdır. |
| **Save/load və offline** | `localStorage` açarı `fishingTycoon.save`, `SAVE_VERSION = 1`, boş `MIGRATIONS`, `deepFill` (naməlum açarları **saxlayır**), 5 s-dən bir save; offline = `steadyRate() × saniyə × 0.5`, limit `8 + 2×night` saat | `src/core/state.js`, `src/main.js`, `ui.js` (`setInterval(save, 5000)`) | `S` bütövlükdə JSON | **Çox yüksək.** `s.v > SAVE_VERSION` olduqda köhnə build **`fresh()` qaytarır** — versiya artırıb geri qayıtmaq bütün irəliləyişi silir. Offline modeli canlı simulyasiyadan fərqli qapalı düsturdur. |
| **UI və Android performansı** | DOM HUD, yan panel, dock, bina etiketləri, `VIEWS` panelləri, modallar; 3 qrafika preset-i | `src/ui/ui.js` (35 KB, tək fayl), `style.css`, `src/main.js` (`PRESETS`) | `bus` hadisələri → `tick()` → DOM | **Yüksək (performans).** Emulyator: Medium 11.9 FPS, High 8.8 FPS, PSS 131 MB [ölçülüb, CI #44]. `dt` 0.1 s-ə kəsilir → 10 FPS-dən aşağı simulyasiya real vaxtdan yavaş işləyir. `VIEWS` export olunmur. |

### 0.3 Genişlənməyə hazırlıq

- **Hazırdır:** `stat` qatı (tək nöqtədən çarpan əlavə etmək); `bus` hadisələri (`unload`, `drop`, `sale`, `produce`,
  `horn`, `upgrade`, `tier`, `frame`, …); məlumat-yönümlü `defs`; naməlum açarlara dözümlü save (`deepFill`);
  test infrastrukturu (`workers-regress.cjs` eyni seed, `save-compare.cjs`, `bench.cjs`, `run-tests.cjs`).
- **Hazır deyil:** növlü inventar, oyun təqvimi, xərc/maliyyə qatı, fərdi qayıq effektləri, ayrıca deterministik
  random axını (render və simulyasiya bir `Math.random` paylaşır), offline modelin canlı modellə uyğunluğu.

### 0.4 Qorunan hissələr (bu GDD-nin bütün təkliflərində)

Faza A işçi kodu; mövcud iqtisadiyyat, save/load və offline kodu (`src/core/*`, `src/sim/*`, `main.js`-in offline
bloku); qayıq marşrutları, liman və iskələlər (`boats.js`, `boatpaths.js`, `jetties.js`, `config.js` BERTHS);
Mərhələ 2 (`claude/stage2-wip-backup`) və multi-sea sistemi; Balıqçı Idle (`fishing/`); `tycoon/index.html`.
Bu GDD-nin bütün sistemləri **yeni modul qatında** (`src/eco/*`) qurulmaq üçün dizayn edilib; qorunan fayllara
toxunan hər addım ayrıca təsdiq tələb edir (bax: `ECONOMY-ARCHITECTURE.md` §2).

> **[fərziyyə]** Multi-sea sistemi bu branch-da `tycoon/src` daxilində tapılmadı; yalnız hesabatlarda "toxunulmayıb"
> kimi qeyd olunur. Yerləşdiyi yer (başqa branch/build) təsdiqlənməlidir — Regionlar sistemi (§16) ona bağlanacaq.

---

## 1. Dizayn prinsipləri

1. **Simulyasiya həqiqət mənbəyidir.** Yeni sistemlər mövcud ehtiyat sayını (`S.stock`) dəyişdirmir, yalnız onun
   **tərkibini** (növ, keyfiyyət, məhsul tipi) izləyir; say yalnız aydın qaydalarla azalır (xarab olma, müqavilə çatdırılması).
2. **Balans-neytral aktivləşdirmə.** Sistemlər açılan anda orta gəlir ±10% daxilində qalmalıdır (başlanğıc növ qarışığının
   orta qiymət çarpanı ≈ 1.0). Dərinlik qərarlarla gəlir, ilk dəqiqədə şokla yox.
3. **Idle-dostu risk.** Oyunçu heç vaxt məğlub olmur: iflas, qayıq itkisi, mənfi balans nəticəsində progress silinməsi yoxdur.
   Risklər gəliri azaldır, xərci artırır, reputasiyaya təsir edir — geri dönə bilən nəticələr.
4. **60/40 bölgüsü.** Realist qat qərar tələb edir (nə tutmaq, nə vaxt satmaq, hansı müqavilə, kredit), idle qat isə
   onları avtomatlaşdırır (menecerlər, avto-satış, offline gəlir).
5. **Deterministiklik.** Yeni sistemlər `Math.random` istifadə etmir; öz seed-li axınları var.
6. **Android büdcəsi.** Yeni məntiq oyun saatı ilə (hər oyun dəqiqəsi/saatı) işləyir, hər kadrda yox. DOM yalnız açıq
   panel və dəyişən məlumat üçün yenilənir.

## 2. Oyun vaxtı (bütün sistemlərin əsası)

- **1 oyun saatı = 1 real dəqiqə; 1 oyun günü = 24 real dəqiqə; 1 mövsüm = 7 oyun günü (~2.8 real saat);
  1 il = 4 mövsüm = 28 oyun günü (~11.2 real saat).** [BALANS] [təsdiq tələb edir]
- Saat simulyasiyanın `dt`-si ilə irəliləyir (canlı) və offline hesablamada qapalı addımlarla (bax: Arxitektura §8).
- HUD-da kiçik saat çipi: gün, mövsüm ikonu, hava ikonu.

---

## 3. Sistem spesifikasiyaları

Hər sistem eyni şablonla verilir: **Dəyər · Mexanika və qərarlar · Mövcud sistemlərlə əlaqə · Məlumat modeli · UI ·
Save/offline · Performans və balans riskləri · Asılılıqlar · V1 minimumu · Gələcək genişlənmə.**
Məlumat modelləri `S.eco` alt-ağacındadır (bax: Arxitektura §7).

### 3.1 Beş balıq növü

- **Dəyər:** "balıq" mücərrədliyindən real məhsul portfelinə keçid; qərarların əsası.
- **Mexanika:** sardina, skumbriya, levrek, qızılbalıq, tuna. Hər növün baza qiymət çarpanı, mövsüm profili, tələb
  əyrisi, xarab olma sürəti və emal reseptləri var. Tuna yalnız liman tier 3-də (və ya "Dərin dəniz torları" tədqiqatı ilə)
  tutulur; qızılbalıq tier 2-dən.

  | Növ | Baza qiymət çarpanı (×`rawPrice`) | Açılma | Xarab olma (soyuducusuz) | Əsas emal |
  |---|---|---|---|---|
  | Sardina | 0.6 | başlanğıc | sürətli | konserv |
  | Skumbriya | 0.9 | başlanğıc | sürətli | konserv, hisə verilmiş |
  | Levrek | 1.4 | başlanğıc (az pay) | orta | file (dondurulmuş) |
  | Qızılbalıq | 2.0 | liman tier 2 | orta | file, hisə verilmiş |
  | Tuna | 3.5 | liman tier 3 | yavaş | steyk, konserv |

  Bütün rəqəmlər [BALANS]. Effektiv çarpan = cədvəl dəyəri / `PRICE_NORM`, burada `PRICE_NORM` istinad başlanğıc
  qarışığının (sardina 55%, skumbriya 35%, levrek 10% → 0.785) orta çarpanıdır; beləliklə başlanğıcda orta qiymət
  bugünkü `rawPrice` ilə eynidir (balans-neytral aktivləşdirmə, §1).
- **Əlaqə:** `stat.rawPrice()` növ qarışığına görə orta çəkili qiymətə çevrilir; `S.stats.caught` dəyişmir (ümumi say).
- **Məlumat modeli:** `ECO_SPECIES` sabit cədvəli (`src/eco/defs-eco.js`); hər ehtiyat yerində tərkib vektoru
  `S.eco.mix[loc] = [f_sardina, f_skumbriya, f_levrek, f_qizilbaliq, f_tuna]` (cəmi 1) — bax Arxitektura §3.
- **UI:** anbar və bazar panellərində növ bölgüsü zolağı (5 rəngli bar + faiz); tutma toast-larında növ ikonu.
- **Save/offline:** tərkib vektorları save-ə düşür (≈25 float). Offline: tutulan qarışıq mövsüm ortalaması ilə.
- **Risk:** orta qiymət çarpanı başlanğıcda 1.0-dan çox fərqlənərsə balans pozulur → kalibrləmə testi.
- **Asılılıqlar:** oyun vaxtı (§2), RNG axınları.
- **V1:** 5 növ, tərkib vektoru 4 yerdə (quay, wh, mRaw, yolda), qiymət çarpanı.
- **Gələcək:** ölçü/çəki sinifləri, nadir növlər, kolleksiya nailiyyətləri.

### 3.2 Ov ehtimalı, mövsüm və gəlirlilik

- **Dəyər:** "nə vaxt və hara" qərarı; mövsümlər oyunu ritmləşdirir.
- **Mexanika:** hər qayıq səfərinin sonunda tutma tərkibi hesablanır:
  `w_s = base_s × season_s(mövsüm) × abundance_s (§3.6) × gear_s (torlar/tier) × weather_s`, sonra normallaşdırılır.
  Kəmiyyət `stat.boatCap()` olaraq qalır (V1), sadəcə `× abundanceTotal` ilə yumşaq korreksiya (0.7–1.0) [BALANS].
  **Oyunçu qərarı:** "Hədəf növ" seçimi (donanma üzrə): seçilmiş növün çəkisi ×1.6, digərləri ×0.85, tutma müddəti +10%.

  Mövsüm profili (yaz/yay/payız/qış çarpanı) [BALANS]: sardina 1.4/1.2/0.8/0.6; skumbriya 0.8/0.9/1.3/1.2;
  levrek 1.0/1.0/1.0/1.0; qızılbalıq 1.2/0.7/0.9/1.3; tuna 0.6/1.4/1.3/0.5.
- **Əlaqə:** qayıq `fish → back` keçidi (adapter vasitəsilə izlənir); `unload` zamanı qayığın tərkibi iskələyə qarışır.
- **Məlumat modeli:** `S.eco.fleet.target` (növ indeksi və ya null); hər qayıq üçün `S.eco.boats[i].mix` (səfər tərkibi).
- **UI:** Qayıqlar panelində "Hədəf növ" seçicisi; "Bu mövsüm: ↑ skumbriya, ↓ sardina" ipucu; gözlənilən gəlirlilik ($/saat) müqayisəsi.
- **Save/offline:** qayıq tərkibi save olunur; offline-də mövsüm ortalaması və hədəf seçimi.
- **Risk:** hədəf növ həmişə tuna olarsa → ehtiyat tükənməsi (§3.6) bunu tarazlayır. Performans: səfər başına bir hesablama.
- **Asılılıqlar:** §2, §3.1, §3.6, §3.4.
- **V1:** mövsüm profili + hədəf növ + tərkib hesablaması.
- **Gələcək:** balıq ovu zonaları (xəritədə), sonar tədqiqatı, fərdi qayıq hədəfi.

### 3.3 Dinamik bazar qiymətləri və tələb-təklif

- **Dəyər:** "indi sat, yoxsa saxla/emal et" qərarı; realizmin əsas hissəsi.
- **Mexanika:** hər növ və məhsul üçün qiymət indeksi hər oyun saatında yenilənir:
  `price_s = base_s × demandSeason_s × (1 − k × saturation_s) × event_s × reputationMod × (1 + noise_s)`,
  `[0.5, 2.0] × base` daxilində kəsilir. `saturation_s` oyunçunun satışları ilə artır, yarımparçalanma ~3 oyun saatı ilə
  azalır. `noise_s` — seed-li təsadüfi gəzinti (±3%/saat, ortaya dönən). [BALANS]
  **Qərar:** bazar paneli trend göstərir; oyunçu "satış siyasəti" seçir: *Hamısını sat* (default, idle) / *Qiymət ≥ X olanda sat*
  (növ üzrə) / *Emala yönəlt*.
- **Əlaqə:** `stat.rawPrice/prodPrice` bazar indeksini oxuyur; satış zamanı `sale` hadisəsi saturation-u artırır.
  *Qiymət ≥ X olanda sat* siyasəti müştərinin müəyyən növü almamasını, yəni daşıyıcıların/rəflərin davranışını dəyişməyi
  tələb edir (simulyasiyaya müdaxilə). Buna görə V1-də yalnız *Hamısını sat* və *Emala yönəlt* (resept, §3.8) var; seçici satış
  gələcəkdə ayrıca təsdiqlə. [təsdiq]
- **Məlumat modeli:** `S.eco.market = { idx: Float[10], sat: Float[10], walk: Float[10], lastHour }` (5 növ + 5 məhsul).
- **UI:** "Bazar" paneli: hər növ üçün qiymət, 24 saatlıq mini-qrafik (sadə CSS bar, canvas yox), ↑↓ ox.
- **Save/offline:** indekslər save olunur. Offline: saturation sıfıra yaxınlaşır, gəzinti addımlarla davam edir; offline satış
  orta indeks ilə.
- **Risk:** müsbət əks-əlaqə (qiymət ↑ → daha çox satış → ...) yoxdur, çünki satış saturation-u artırır (mənfi əks-əlaqə).
  Çarpanların çoxalması (`priceMul × boost×2 × bazar × reputasiya`) inflyasiya riski — ümumi çarpan limiti tətbiq edilir.
- **Asılılıqlar:** §2, §3.1, §3.13 (reputasiya), §3.15 (hadisələr).
- **V1:** 10 indeks, saturation + seed-li gəzinti, bazar paneli.
- **Gələcək:** rəqib şirkətlər, auksion, fyuçers müqavilələri.

### 3.4 Hava şəraiti, fırtına və biznes riskləri

- **Dəyər:** gözlənilməzlik və planlama ("fırtınadan əvvəl qayıqları qaytar").
- **Mexanika:** hava hal maşını (oyun saatı ilə, seed-li Markov zənciri): `Aydın → Küləkli → Yağışlı → Fırtına`,
  mövsümdən asılı keçid ehtimalları. Proqnoz 6 oyun saatı əvvəldən görünür (≈80% dəqiqlik).
  Effektlər [BALANS]: Küləkli — tutma müddəti +10%; Yağışlı — tutma +20%, müştəri axını −10%; Fırtına — limanda olan qayıqlar
  çıxmır, dənizdə olanlar vəziyyət itkisi (−8..15%) və tutma −30%.
  **Qərar:** "Fırtına xəbərdarlığı" çıxanda: *Qayıqları saxla* (gəlir itkisi, risk yox) / *Risk et* (sığorta varsa təmir ödənilir).
- **Əlaqə:** fırtınada limandakı qayığın çıxışını gecikdirmək simulyasiya obyektinin `b.t` taymerini adapterdən uzatmaq deməkdir
  → qayıq render-i (`boats.js`) uzun dok gözləməsini artıq dəstəkləyir (iskələ dolu olanda) [fərziyyə — `boat-sync.cjs` ilə yoxlanmalı].
- **Məlumat modeli:** `S.eco.weather = { state, hoursLeft, forecast: [..6], policy: 'hold'|'risk' }`.
- **UI:** HUD hava çipi + proqnoz tooltip; fırtına modal/toast; ekran tonu (Low preset-də söndürülür).
- **Save/offline:** offline-də fırtına yalnız gəliri azaldır (dənizdə qayıq itkisi/zərəri offline **tətbiq olunmur**). [təsdiq]
- **Risk:** qayıq gecikdirilməsi qorunan render planlamasına təsir edə bilər (yuxarıdakı test). Vizual effekt FPS-ə zərər — yalnız CSS overlay.
- **Asılılıqlar:** §2, §3.5 (təmir, sığorta).
- **V1:** 4 hal, proqnoz, fırtınada saxlama siyasəti, HUD çipi.
- **Gələcək:** regiona görə iqlim, yağış partikülləri (High preset), sunami kimi nadir hadisələr.

### 3.5 Yanacaq, gəmi təmiri və sığorta

- **Dəyər:** gəlir yox, **mənfəət** düşüncəsi; daha sürətli mühərrik = daha çox yanacaq.
- **Mexanika [BALANS]:**
  - Yanacaq: hər səfər `fuel = 2 × routeLen × (1 + 0.04 × engineLv) × fuelPrice`; `fuelPrice` bazar kimi indeksdir (baza 1.0, ±30%).
  - Vəziyyət: hər qayığın `cond` 0–100; səfər −0.6, fırtına −8..15. `cond < 50` → sürət −10%, `< 25` → −25% və tutma −15%.
  - Təmir: `cost = (100 − cond) × repairRate × boatTierMul`; manual düymə və ya avto-təmir (menecer).
  - Sığorta: gündəlik haqq (donanma dəyərinin ~0.5%-i); fırtına zərərinin təmirini 80% ödəyir.
- **Əlaqə:** səfər başlanğıcı (`dock → out`) adapterdə xərc hadisəsidir. Sürət effekti `stat.boatSpeed()` donanma üzrə
  olduğundan V1-də **donanma orta vəziyyəti** tətbiq olunur (fərdi qayıq effekti gələcəkdə). Pul yetmirsə: səfər yenə baş verir,
  xərc "ödənilməmiş hesablar"a yazılır (§3.12) — simulyasiya dayanmır.
- **Məlumat modeli:** `S.eco.boats[i] = { cond, mix }`, `S.eco.fleet = { insured, autoRepair, fuelIdx }`.
- **UI:** Qayıqlar panelində hər qayıq üçün vəziyyət barı, "Təmir et ($)" düyməsi, sığorta toggle-ı; P&L-də yanacaq sətri.
- **Save/offline:** offline-də yanacaq xərci səfər sayına mütənasib (steadyRate səfər tezliyindən) gəlirdən çıxılır; vəziyyət
  offline-də ən çox −20 düşür (idle-dostu limit). [BALANS]
- **Risk:** xərclər erkən oyunda gəliri sıfırlaya bilər → yanacaq xərci səfər gəlirinin ≤15%-i hədəfi (balance-sim testi).
- **Asılılıqlar:** §3.4, §3.12.
- **V1:** səfər yanacağı, vəziyyət, təmir, sığorta.
- **Gələcək:** fərdi qayıq tipləri/mühərrikləri, dok təmir binası, qayıq satışı.

### 3.6 Balıq ehtiyatlarının azalması və bərpası

- **Dəyər:** davamlılıq qərarı; həmişə ən bahalı növü tutmaq strategiyasının qarşısını alır.
- **Mexanika:** hər növ üçün biomassa `B_s ∈ [0.05, 1]` (daşıma tutumunun payı). Hər oyun saatı:
  `B_s += r_s × B_s × (1 − B_s) − catch_s / K_s` (logistik bərpa). `abundance_s = 0.4 + 0.6 × B_s`.
  `r` (bərpa): sardina 0.08, skumbriya 0.06, levrek 0.04, qızılbalıq 0.03, tuna 0.015 /saat; `K_s` donanmanın maksimum
  tutma sürətinə görə miqyaslanır ki, max donanma bir növü ~2 oyun gününə tükəndirə bilsin. [BALANS]
- **Əlaqə:** §3.2 çəkiləri; reputasiya (davamlı ovçuluq bonusu — gələcək).
- **Məlumat modeli:** `S.eco.stocks[region][s] = B` (V1-də bir region).
- **UI:** "Dəniz ehtiyatı" göstəricisi (5 kiçik bar, rəng: yaşıl/sarı/qırmızı) Qayıqlar panelində.
- **Save/offline:** offline-də addımlarla hesablanır (bərpa həm də offline baş verir — "qayıtdım, ehtiyat bərpa olunub").
- **Risk:** çox sərt tükənmə → gəlir uçurumu; `abundanceTotal ≥ 0.7` alt limiti. Performans: saatda 5 hesablama.
- **Asılılıqlar:** §3.2, §2.
- **V1:** tək region, 5 biomassa, logistik bərpa.
- **Gələcək:** kvota/lisenziya, regionlar arası fərq, ekoloji reputasiya.

### 3.7 Soyuq anbar, keyfiyyət və xarab olma

- **Dəyər:** saxlama ilə satış arasında gərginlik — bazarı gözləmək xarab olma riski ilə ödənir.
- **Mexanika:** hər yerdə orta təzəlik `q ∈ [0,1]` (1 = təzə). Saatlıq azalma: `q −= decay_s × locMul / coldMul`.
  `locMul`: iskələ 2.0 (açıq hava), anbar 1.0, rəf 1.2. `coldMul = 1 + 0.25 × up.warehouse.cold` (mövcud "Soyuducu" treki
  yenidən istifadə olunur; onun +5% qiymət effekti saxlanır). Keyfiyyət dərəcəsi: A (q ≥ 0.7, qiymət ×1.1),
  B (0.4–0.7, ×1.0), C (< 0.4, ×0.6, reputasiya −). `q < 0.15` olanda saatlıq ehtiyatın 2%-i xarab olur (silinir). [BALANS]
  Qarışma: yeni təzə balıq gələndə `q` çəkili orta ilə yenilənir.
- **Əlaqə:** xarab olma `S.stock[loc]`-u azaldır — **rezervasiya edilmiş hissəyə (`sim.res`) toxunmadan**. Bu, mövcud
  ehtiyat sayını dəyişən yeganə passiv qaydadır.
- **Məlumat modeli:** `S.eco.q[loc]` (5 float).
- **UI:** anbar panelində keyfiyyət dərəcəsi nişanı (A/B/C) və "xarab olmağa qədər ~X saat".
- **Save/offline:** offline-də addımlarla; offline xarab olma itkisi ehtiyatın ən çox 25%-i ilə məhdud. [BALANS] [təsdiq]
- **Risk:** passiv itki oyunçunu cəzalandırır kimi hiss oluna bilər → aydın UI xəbərdarlığı. Rezervasiya ilə yarış — test.
- **Asılılıqlar:** §3.1, §2.
- **V1:** orta təzəlik, A/B/C, xarab olma, mövcud "Soyuducu" trekinə bağlantı.
- **Gələcək:** ayrıca soyuducu bina, enerji xərci, buz istehsalı.

### 3.8 Balıq emalı və istehsal məhsulları

- **Dəyər:** dəyər zənciri; ucuz növü bahalı məhsula çevirmək.
- **Mexanika:** mövcud zavod (`facRate`, konveyer) saxlanır; aktiv **istehsal xətti** reseptini oyunçu seçir:

  | Məhsul | Giriş (üstünlük verilən) | Qiymət çarpanı (×`prodPrice`) | Açılma |
  |---|---|---|---|
  | Konserv | sardina/skumbriya/tuna | 0.8 | zavod tier 1 |
  | Dondurulmuş file | levrek/qızılbalıq | 1.3 | zavod tier 1 |
  | Hisə verilmiş balıq | skumbriya/qızılbalıq | 1.5 | zavod tier 2 |
  | Tuna steyk | tuna | 2.2 | zavod tier 3 |
  | Balıq unu | istənilən, C keyfiyyət | 0.35 | zavod tier 1 |

  Uyğun olmayan giriş qiyməti ×0.7 edir. Keyfiyyət (§3.7) məhsula keçir (A → ×1.1). [BALANS]
- **Əlaqə:** zavod 1 xam → 1 məhsul qaydası dəyişmir; `produce` hadisəsində `facOut` tərkibinə məhsul tipi əlavə olunur;
  `stat.prodPrice()` məhsul tərkibinin orta çəkili qiyməti olur.
- **Məlumat modeli:** `S.eco.factory = { recipe }`, `S.eco.pmix[loc]` (facOut, mProd, yolda) — 5 məhsul payı.
- **UI:** zavod bina panelində resept seçicisi (kart: giriş → çıxış, gözlənilən mənfəət).
- **Save/offline:** resept save olunur; offline-də aktiv reseptlə.
- **Risk:** resept dəyişəndə konveyerdəki vahidlər köhnə reseptdə qalır (sadə qayda). İkinci xətt Mərhələ 2-nin işidir — toxunulmur.
- **Asılılıqlar:** §3.1, §3.7, §3.3.
- **V1:** tək aktiv xətt, 5 resept, məhsul tərkibi.
- **Gələcək:** paralel xətlər (Mərhələ 2 ilə), qablaşdırma brendi, yan məhsullar.

### 3.9 Restoran, supermarket və ixrac müqavilələri

- **Dəyər:** proqnozlaşdırıla bilən gəlir və hədəflər; reputasiyanın əsas mənbəyi.
- **Mexanika:** "Müqavilə lövhəsi" hər oyun günü 3 təklif yaradır (seed-li):
  - **Restoran:** kiçik həcm (20–60), konkret növ + min. keyfiyyət A/B, qiymət ×1.3, müddət 1 gün.
  - **Supermarket:** orta həcm (100–300), məhsul (konserv/file), ×1.15, müddət 2 gün, təkrarlanan (3 çatdırılma).
  - **İxrac:** böyük həcm (500+), tuna/qızılbalıq/məhsul, ×1.6, müddət 3 gün, reputasiya ≥ 60 tələb edir.
  Çatdırılma: oyunçu "Göndər" basır və ya avto-göndərmə (menecer); vahidlər anbardan/`facOut`-dan çıxarılır (rezervasiyaya
  toxunmadan), logistika (§3.10) üzərindən çatdırılır. Gecikmə → cərimə (dəyərin 20%-i) + reputasiya −. [BALANS]
- **Əlaqə:** bazar satışına alternativ kanal; ehtiyatı azaldır → bazar rəflərinə daha az gedir (oyunçu qərarı).
- **Məlumat modeli:** `S.eco.contracts = { offers: [...], active: [{id, kind, item, qMin, need, done, price, due, deliveries}], seed }`.
- **UI:** "Müqavilələr" paneli: təkliflər (qəbul/rədd), aktiv müqavilələrin irəliləmə barı, müddət sayğacı.
- **Save/offline:** aktivlər save olunur; offline-də müddət keçir, **avto-göndərmə açıqdırsa** offline istehsaldan çatdırılır,
  deyilsə müddət offline zamanı dayandırılır (idle-dostu). [təsdiq]
- **Risk:** müqavilələr bazardan çox gəlirli olarsa bazar mənasızlaşır → müqavilə həcmi gündəlik istehsalın ≤40%-i.
- **Asılılıqlar:** §3.1, §3.7, §3.8, §3.10, §3.13.
- **V1:** 3 tip, gündəlik lövhə, manual + avto göndərmə, cərimə.
- **Gələcək:** uzunmüddətli çərçivə müqavilələri, danışıqlar, xarici bazarlar regionlar ilə.

### 3.10 Logistika və çatdırılma

- **Dəyər:** müqavilələrin fiziki tərəfi; tutum planlaması.
- **Mexanika:** V1-də **mücərrəd yük maşını parkı** (xəritədə görünmür): `trucks` sayı, tutum (50/vahid), səfər müddəti
  (restoran 1, supermarket 2, ixrac limanı 4 oyun saatı), səfər xərci (yanacaq indeksi ilə). Növbə: göndərmələr FIFO.
  Soyuducu maşın tədqiqatı keyfiyyət itkisini səfərdə sıfırlayır. [BALANS]
- **Əlaqə:** mövcud daşıyıcılara (faza A) **toxunmur**; yalnız ehtiyat sayını azaldır. Vizual yük maşınları Mərhələ 2-yə aiddir.
- **Məlumat modeli:** `S.eco.logi = { trucks, queue: [{contractId, n, eta}] }`.
- **UI:** Müqavilələr panelinin altında "Yolda" siyahısı (ETA).
- **Save/offline:** növbə save olunur; offline-də ETA-lar keçir.
- **Risk:** xəritədə görünməyən logistika realizmi azaldır — açıq qeyd. Performans: cüzi.
- **Asılılıqlar:** §3.9, §3.5 (yanacaq).
- **V1:** mücərrəd park, növbə, ETA.
- **Gələcək:** vizual yük maşınları və forkliftlər (Mərhələ 2 ilə birləşmə), marşrut seçimi.

### 3.11 İşçilərin bacarıqları və menecerlər

- **Dəyər:** idle avtomatlaşdırma (40% qat) və insan resursu qərarları.
- **Mexanika:**
  - **Bacarıq:** komanda üzrə orta bacarıq səviyyəsi (1–10), iş vaxtı ilə yavaş artır və "Təlim kursu" ilə sürətlənir.
    Effekt: `workerSpeed × (1 + 0.02 × skill)`, `loadTime × (1 − 0.02 × skill)`. Fərdi işçi kartları V1-də yoxdur (faza A
    daşıyıcıları fərdi vəziyyət saxlamır). [BALANS]
  - **Menecerlər (5 slot):** Donanma (avto-təmir, fırtına siyasəti), Anbar (keyfiyyət ×1.1 yavaş xarab olma), Zavod
    (resept avto-seçimi), Satış (avto-müqavilə qəbulu/göndərmə), Maliyyə (kredit faizi −10%, avto-ödəmə).
    Hər menecerin gündəlik maaşı var; işə götürmə nadir hadisə/təklif kimi gəlir.
  - Maaşlar: işçi başına gündəlik maaş (P&L-də).
- **Əlaqə:** `stat.workerSpeed/loadTime` adapter vasitəsilə çarpanla; faza A replay qatı bu dəyərləri yalnız oxuyur.
  **Risk:** `loadTime` azalması faza A-nın qəbul edilmiş "poz müddəti" istisnasını ağırlaşdırır (HANDOFF) — bacarıq effekti
  `loadTime`-a tətbiq edilməməlidir (yalnız sürətə). [təsdiq]
- **Məlumat modeli:** `S.eco.staff = { skill, xp, managers: { fleet: null|{lv, wage}, ... } }`.
- **UI:** İşçilər panelinə "Komanda bacarığı" barı və "Menecerlər" bölməsi.
- **Save/offline:** save olunur; offline-də maaşlar çıxılır, bacarıq artmır.
- **Risk:** sürət artımı audit-in "qaçış kimi görünür" (10 tile/s) problemini pisləşdirir → ümumi sürət limiti tövsiyəsi.
- **Asılılıqlar:** §3.12; faza A (yalnız oxuma).
- **V1:** komanda bacarığı, 5 menecer, maaşlar.
- **Gələcək:** fərdi işçi profilləri, rollar (Mərhələ 2: forklift sürücüsü və s.), tətil/yorğunluq.

### 3.12 Gəlir-xərc, mənfəət, kredit və investisiya

- **Dəyər:** biznes simulyasiyasının nüvəsi — "mən həqiqətən qazanıram?"
- **Mexanika:**
  - **Kitab (ledger):** gəlir kateqoriyaları (bazar xam, bazar məhsul, müqavilə, ixrac, hadisə) və xərc kateqoriyaları
    (yanacaq, təmir, sığorta, maaş, logistika, kredit faizi, cərimə, upgrade/capex ayrıca). Oyun günü üzrə P&L, son 7 gün saxlanır.
  - **Ödənilməmiş hesablar:** xərc pul yetmədikdə `bills`-ə yazılır; `money` mənfi olmur. Hesab varsa: reputasiya saatlıq −,
    yeni müqavilə yoxdur, gəlirin 50%-i avtomatik hesablara gedir. İflas yoxdur.
  - **Kredit:** 3 məhsul (qısa: 1 gün, 8%; orta: 3 gün, 15%; uzun: 7 gün, 25%), məbləğ limiti = son 3 günün orta mənfəəti × 5
    və reputasiyadan asılı. Saatlıq ödəniş avtomatik. [BALANS]
  - **İnvestisiya (V1):** birdəfəlik layihələr (Buz maşını, Soyuducu maşın, Sonar, Marketinq kampaniyası) — sabit qiymət,
    ölçülə bilən effekt, göstərilən ROI. Portfel/səhm V1-də yoxdur.
- **Əlaqə:** gəlir `addMoney`/kassa yığımı ilə gəlir — ledger `sale`/`collect` hadisələrini kateqoriyalaşdırır; xərclər
  `spend` kimi amma mənfi balansa düşməyən ayrıca funksiya (`eco.charge`). Mövcud `spend()` dəyişmir.
- **Məlumat modeli:** `S.eco.fin = { days: [{inc:{}, exp:{}}], bills, loans: [{p, rate, left, perHour}], projects: {} }`.
- **UI:** "Maliyyə" paneli: bugünkü/dünənki P&L, 7 günlük mənfəət barları, kredit kartları, layihələr.
- **Save/offline:** offline nəticə P&L-də "Offline" sətri kimi; kredit ödənişləri offline gəlirdən çıxılır.
- **Risk:** kredit + yüksək ROI layihə = sürətli progress exploit-i → kredit limiti mənfəətə bağlı. Ledger yaddaşı: 7 gün × ~15 ədəd.
- **Asılılıqlar:** demək olar ki, bütün sistemlər (xərc mənbələri).
- **V1:** ledger, P&L paneli, bills, 3 kredit, 4 layihə.
- **Gələcək:** vergilər, səhmdarlar, filial investisiyası (regionlar).

### 3.13 Şirkət reputasiyası

- **Dəyər:** uzunmüddətli keyfiyyət hədəfi; sistemləri birləşdirən göstərici.
- **Mexanika:** 0–100, başlanğıc 50. **+**: vaxtında müqavilə (+2..+5), A keyfiyyət satışları (kiçik +), hadisə seçimləri.
  **−**: gecikmiş müqavilə (−5), C keyfiyyət satışı, ödənilməmiş hesablar, xarab olma. Hər gün 50-yə doğru 2% yaxınlaşma.
  Effektlər: müştəri axını `custEvery / (1 + (rep−50)/250)` (±20%), bazar qiymət çarpanı ±5%, ixrac açılması (≥60),
  kredit limiti. [BALANS]
- **Əlaqə:** `stat.custEvery()` və qiymət adapterləri.
- **Məlumat modeli:** `S.eco.rep = { v, history: [7 gün] }`.
- **UI:** HUD-da kiçik ulduz/rəqəm; Maliyyə panelində tarixçə və səbəblər siyahısı.
- **Save/offline:** offline-də yalnız 50-yə yaxınlaşma tətbiq olunur.
- **Risk:** çox güclü effekt → "ölüm spiralı" (aşağı rep → az müştəri → az gəlir → bills → daha aşağı rep). Alt təsir limiti −10%.
- **Asılılıqlar:** §3.7, §3.9, §3.12.
- **V1:** tək dəyər, 4 effekt.
- **Gələcək:** seqment reputasiyası (restoran/ixrac), media hadisələri.

### 3.14 Gündəlik tapşırıqlar və nailiyyətlər

- **Dəyər:** gündəlik qayıtma səbəbi; yeni sistemləri öyrətmək.
- **Mexanika:** mövcud missiya ardıcıllığı, nailiyyətlər və 7 günlük mükafat **dəyişmir**. Əlavə:
  - **Gündəlik tapşırıqlar:** real tarixə görə seed-li 3 tapşırıq (məs. "50 levrek sat", "1 müqavilə tamamla", "A keyfiyyəti
    1 saat saxla", "Fırtınada qayıq itirmə"). Mükafat: pul (steadyRate-ə miqyaslanmış) + gem.
  - **Yeni nailiyyətlər (ayrıca siyahı):** növ ustası (hər növdən N), müqavilə ustası, reputasiya 80, borcsuz 7 gün, ehtiyat qoruyucusu.
- **Əlaqə:** `MISSIONS/ACHIEVEMENTS` (`defs.js`) toxunulmaz; eco öz siyahısını öz panel bölməsində göstərir.
  Gələcəkdə birləşdirmə ayrıca qərardır.
- **Məlumat modeli:** `S.eco.tasks = { date, list: [{id, k, n, v, claimed}] }`, `S.eco.ach = { id: steps }`, `S.eco.stats = {...}`.
- **UI:** mövcud "Missiyalar" panelinin altında "Bugünkü tapşırıqlar" bölməsi (DOM inyeksiyası) və ya eco paneli.
- **Save/offline:** tarix dəyişəndə yenilənir; offline irəliləmə tapşırıqlara sayılmır (exploit-in qarşısı). [təsdiq]
- **Risk:** cihaz saatını dəyişmə exploit-i (mövcud daily ilə eyni risk, qəbul edilir).
- **Asılılıqlar:** bütün sistemlərin metrikaları.
- **V1:** 3 gündəlik tapşırıq, 8 yeni nailiyyət.
- **Gələcək:** həftəlik tədbirlər, mövsüm keçidi (battle-pass yoxdur — dizayn qərarı).

### 3.15 Biznes hadisələri

- **Dəyər:** hekayə və qərar anları; monotonluğu qırır.
- **Mexanika:** seed-li hadisə dəstəsi, oyun günündə 1–2 hadisə (soyutma müddəti ilə). İki növ:
  - **Passiv:** "Balıq festivalı: levrek tələbi +50%, 1 gün", "Yanacaq qiyməti +25%, 2 gün", "Media məqaləsi: rep +4".
  - **Seçimli (2 variant):** "Sanitariya yoxlaması: C keyfiyyəti məhv et (itki) / risk et (cərimə ehtimalı)",
    "Rəqib qiymət salır: endirim et / gözlə", "Böyük ixrac təklifi: 4 saata qəbul et".
  V1-də ~12 hadisə. Ehtimallar mövsüm/reputasiyadan asılı. [BALANS]
- **Əlaqə:** bazar (§3.3) `event_s` çarpanı, yanacaq indeksi, reputasiya, müqavilələr.
- **Məlumat modeli:** `S.eco.events = { active: [{id, ends, mods}], pending: {id, expires}|null, cooldown, seedPos }`.
- **UI:** toast + modal (seçimli), HUD-da aktiv effekt nişanları.
- **Save/offline:** offline-də yalnız passiv hadisələr; ən çox 1 seçimli hadisə qayıdışda gözləyir (avto-default variant
  menecer varsa).
- **Risk:** hadisə tezliyi çox olarsa yorucu; modallar idle oyunçunu narahat edir → toast-first dizayn.
- **Asılılıqlar:** §3.3, §3.5, §3.9, §3.13.
- **V1:** 12 hadisə, passiv + seçimli.
- **Gələcək:** zəncirvari hekayə hadisələri, sezonlu tədbirlər.

### 3.16 Yeni regionlar və limanlara genişlənmə (gələcək)

- **Dəyər:** uzunmüddətli hədəf (prestige alternativi).
- **Mexanika (dizayn):** hər regionun öz ehtiyatları (§3.6), iqlimi (§3.4), növ çəkiləri, məsafəsi (yanacaq), bazarı.
  Açılma: səviyyə + mənfəət + reputasiya şərtləri. Yeni liman xəritələri və marşrutlar **28 günə daxil deyil**; mövcud liman
  quruluşu və multi-sea sistemi qorunur.
- **Əlaqə:** multi-sea sistemi ilə inteqrasiya (yeri təsdiqlənməlidir — §0.4).
- **Məlumat modeli:** `ECO_REGIONS` cədvəli; `S.eco.region = 'home'`; bütün eco strukturları region açarı ilə genişlənə bilən formada.
- **UI (V1):** "Xəritə" panelində kilidli region kartları və tələblər (mövcud `map` view genişlənir və ya eco bölməsi).
- **Save/offline:** V1-də yalnız sxem hazırlığı (`stocks[region]`).
- **Risk:** çox regionlu offline hesablama mürəkkəbliyi; render yaddaşı (yeni xəritə atlasları) — Android PSS limiti.
- **V1:** data modeli + kilidli UI. **Gələcək:** oynanıla bilən ikinci liman, region arası ticarət.

---

## 4. Sistemlər arası asılılıq qrafı (qısa)

```
Oyun vaxtı (§2) ─┬─> Növlər (§3.1) ─> Ov/mövsüm (§3.2) <─ Ehtiyatlar (§3.6)
                 ├─> Bazar (§3.3) <────────────── Hadisələr (§3.15)
                 ├─> Hava (§3.4) ─> Yanacaq/təmir/sığorta (§3.5)
                 └─> Keyfiyyət (§3.7) ─> Emal (§3.8) ─> Müqavilələr (§3.9) ─> Logistika (§3.10)
Maliyyə (§3.12) <─ bütün xərc/gəlir mənbələri;  Reputasiya (§3.13) <─ §3.7, §3.9, §3.12
İşçi bacarığı/menecerlər (§3.11) ─> §3.5, §3.8, §3.9, §3.12 avtomatlaşdırma
Tapşırıqlar/nailiyyətlər (§3.14) <─ bütün metrikalar;  Regionlar (§3.16) <─ §3.4, §3.6, §3.3
```

## 5. UI ümumi tələbləri

- Yeni panellər: **Bazar**, **Müqavilələr**, **Maliyyə**; mövcud panellərə bölmələr: Qayıqlar (hədəf, vəziyyət, ehtiyat),
  Anbar/Zavod (keyfiyyət, resept), İşçilər (bacarıq, menecerlər), Missiyalar (gündəlik tapşırıqlar).
- HUD: saat/mövsüm çipi, hava çipi, reputasiya. Dock-a ən çox **bir** yeni düymə ("Biznes" → Bazar/Müqavilələr/Maliyyə tabları)
  — kiçik ekranlarda (640×360) mövcud layout testləri (`run-tests.cjs` 12 ölçü) keçməlidir.
- Dil: Azərbaycan dili (mövcud UI kimi).
- Yeniləmə: panel açıq olanda 2 Hz, bağlı olanda yox; HUD çipləri yalnız dəyər dəyişəndə.

## 6. Açıq dizayn sualları (təsdiq üçün)

Bax: `ROADMAP-28-DAYS.md` §6 "Təsdiq tələb edən qərarlar" — vaxt miqyası, inteqrasiya yolu, save strategiyası, fırtınada
qayıq saxlama, offline qaydaları, mənfi balans qaydası, bacarıq effektinin `loadTime`-a tətbiqi, multi-sea yeri.
