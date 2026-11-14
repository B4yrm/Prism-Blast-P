# Fishing Tycoon — iqtisadiyyat genişlənməsinin texniki arxitekturası

**Status:** təklif (kod yazılmayıb). Branch `claude/clever-maxwell-tolun5`, 2026-11-14.
**Oxucu:** bu layihədə kod yazacaq hər kəs (insan və ya agent). Dizayn: `FISHING-TYCOON-GDD-V1.md`; plan: `ROADMAP-28-DAYS.md`.
İşarələr GDD ilə eynidir: **[kod] [ölçülüb] [fərziyyə] [BALANS] [təsdiq]**.

---

## 1. Əsas qərar: mövcud iqtisadiyyatı yenidən yazmırıq

Mövcud zəncir (`Sim` + `stat` + `S.stock`) işləyir, test olunub (eyni seed regresiyası, save müqayisəsi) və faza A onun üzərində
qəbul edilib. Yeni sistemlər **ayrıca qat** kimi qurulur:

```
            ┌──────────── mövcud, qorunan ────────────┐
 defs.js → stat.* ─→ Sim (sim.js) ─→ S.stock / S.register / S.money ─→ UI (ui.js)
              ▲          │  bus: unload/drop/produce/sale/collect
              │          ▼
        ┌─────┴──── src/eco/adapter.js (YEGANƏ əlaqə nöqtəsi) ────┐
        │  stat sarğıları · Sim.prototype.update sarğısı · bus abunəsi │
        └─────┬──────────────────────────────────────────────────┘
              ▼
   src/eco/* təmiz modullar (state → state), öz RNG axınları, öz saatı
              ▼
   S.eco (save-in alt-ağacı)          src/ui/eco-ui.js (DOM inyeksiyası)
```

Əsas fikir: **say (neçə balıq) simulyasiyadan gəlir, tərkib (hansı balıq, hansı keyfiyyət, hansı məhsul) eco-dan.**
Eco hər ehtiyat yerinin tərkibini *paylar vektoru* kimi saxlayır; buna görə eco ilə simulyasiya arasında "sayda sürüşmə" ola bilməz
— cəm həmişə `S.stock`-dur.

## 2. İnteqrasiya strategiyası — variantlar

| Variant | Nə edir | Qorunan fayllara toxunur? | Üstünlük | Çatışmazlıq |
|---|---|---|---|---|
| **A. Adapter (tövsiyə)** | `src/eco/adapter.js` quraşdırılanda `stat.*` funksiyalarını sarğılayır (`stat` adi obyektdir [kod]), `Sim.prototype.update`-i sarğılayır, `bus` hadisələrinə abunə olur | Xeyr. Yalnız yeni giriş nöqtəsi: `src/main-eco.js` (`import './eco/index.js'; import './main.js';`) və `build.mjs`-də `ECO=1` ilə seçilən entry | Eco söndürüləndə bundle bugünkü ilə eynidir; geri qaytarma trivialdır; faza A-ya sıfır təsir | Daxili adlara (`b.state`, `w.job`, `sim.res`, `convey`) bağlılıq — kövrəkdir; donanma-ümumi `stat` fərdi qayıq effektini ifadə etmir |
| B. İncə hook-lar | `sim.js`/`economy.js`-ə 6–8 sətirlik `G.eco?.onX()` çağırışları | Bəli (qorunan) | Açıq, sənədləşmiş API; daha dəqiq (fərdi qayıq, satış növü) | Qorunan kodu dəyişir; hər addım eyni seed regresiyası ilə sübut tələb edir |
| C. Yenidən yazma | Növlü inventarla yeni Sim | Bəli, tamamilə | Təmiz model | 28 günə sığmır; faza A, qayıq render sinxronu, save — hamısı yenidən test; **rədd edilir** |

**Tövsiyə:** V1 üçün **A**. B yalnız A-nın ifadə edə bilmədiyi konkret ehtiyac (məs. fərdi qayıq vəziyyəti → sürət) yaranarsa,
ayrıca təsdiqlə, nöqtə-nöqtə. [təsdiq]

### 2.1 Hook xəritəsi (Variant A)

| Hədəf | Mexanizm | Eco nə edir | Risk |
|---|---|---|---|
| `stat.rawPrice`, `stat.prodPrice` | sarğı: `orig() × eco.priceFactor('raw'|'prod')` | növ/məhsul tərkibi × bazar indeksi × keyfiyyət × reputasiya; ümumi çarpan limiti | `steadyRate` (offline, mağaza "warp/purse", sandıq) da bu dəyəri görür — §8 |
| `stat.custEvery` | sarğı: `orig() × eco.custFactor()` | reputasiya, yağış | Müştəri vaxtı dəyişir → simulyasiyanın `Math.random` ardıcıllığı sürüşür (yalnız eco açıq olanda) |
| `stat.boatSpeed`, `stat.fishTime`, `stat.boatCap` | sarğı | donanma orta vəziyyəti, hava, ümumi bolluq | Render qayıqları (`boats.js`) simulyasiya saatından plan qurur → `boat-sync.cjs`, `boat-timeline.cjs` ilə yoxlanmalı |
| `stat.workerSpeed` | sarğı | komanda bacarığı (yalnız sürət, `loadTime` yox — faza A poz istisnası) | Audit: 10 tile/s "qaçış" — ümumi limit |
| `Sim.prototype.update` | sarğı: `orig.call(this, dt); eco.tick(this, dt)` | saat, keçidlərin müşahidəsi, saatlıq addım | Hər kadr çağırılır → allokasiyasız olmalıdır |
| `bus` `unload`, `drop`, `produce`, `sale`, `collect` | abunə | tərkib köçürməsi, ledger, saturation | `sale` növ bölgüsü vermir → orta tərkib qaydası (§3.3) |
| `S.stock[loc]` (yazma) | birbaşa | xarab olma, müqavilə çıxarışı; **həmişə `≤ stock − sim.res[loc]`** | Rezervasiya ilə yarış — invariant testi |
| `boat.t` (yazma, yalnız fırtına) | birbaşa | limanda boş qayığın çıxışını saxlamaq (`t = max(t, 0.2)`) | Sim obyektinə yeganə yazma; [təsdiq] |

Qeyd: `main.js` offline-i modul yüklənəndə hesablayır [kod]. Eco `main.js`-dən **əvvəl** import olunduğu üçün (`main-eco.js`)
sarğılar artıq quraşdırılıb; `G.S` hələ yüklənməyib — buna görə sarğılar `G.S.eco` yoxdursa `orig()` qaytarır (tənbəl init).

## 3. Balıq növləri və inventar modeli

### 3.1 Tərkib vektoru (paylar modeli)

```js
// 5 növ: 0 sardina, 1 skumbriya, 2 levrek, 3 qizilbaliq, 4 tuna
S.eco.mix = { quay: [..5], wh: [..5], mRaw: [..5] };          // cəmi 1 (stock 0 olanda istinad qarışığı)
S.eco.q   = { quay: 1, wh: 1, facOut: 1, mRaw: 1, mProd: 1 };  // orta təzəlik 0..1
S.eco.pmix = { facOut: [..5], mProd: [..5] };                  // 5 məhsul: konserv, file, hisə, steyk, un
```

Əməliyyatlar (`src/eco/mix.js`, təmiz funksiyalar):
- `blend(dstMix, dstN, srcMix, n)` → `(dstMix×dstN + srcMix×n)/(dstN+n)` — daxilolma (boşaltma, drop, konveyer).
- Çıxarış (pick, satış, xarab olma) **payları dəyişmir** (proporsional çıxarış); yalnız say azalır (simulyasiyada).
- `normalize`, `clamp` — üzən nöqtə xətası üçün hər saat.

**Niyə tam ədəd sayları deyil:** 5 yer × 5 növ × 3 keyfiyyət sayı simulyasiyanın hər tam ədəd dəyişikliyi ilə sinxron
saxlanmalı idi (pick/drop/serve/konveyer — hamısı qorunan kodda). Paylar modeli yalnız *daxilolma* anlarını izləyir və
simulyasiyanın sayına heç vaxt zidd ola bilməz. Qiymət: hər satılan vahid **orta** tərkibin qiymətini alır (fərdi növ seçimi yoxdur) —
oyunçu üçün fərq hiss olunmur, çünki rəfdə qarışıq tərkib orta gəlir verir.

### 3.2 Yolda olan balıq

- Daşıyıcı: eco hər kadr `w.state` keçidini müşahidə edir; `pick → toDst` anında `transit.set(w, copy(mix[src]), q[src])`
  (`WeakMap`, sim obyektinə yazılmır). `drop` hadisəsində `blend(mix[dst], …, transit.get(w), n)`.
- Qayıq: `fish → back` keçidində səfər tərkibi hesablanır (§3.2 GDD), `S.eco.boats[i].mix`; `unload`-da iskələyə qarışır
  (say = `S.stock.quay` artımı).
- Konveyer: yeni `convey` elementləri (`WeakMap`-də olmayan) `wh` tərkibini + aktiv resepti götürür; `produce`-da `pmix.facOut`-a qarışır.
- Save/load: yolda olan balıq simulyasiyada da itir [kod, audit §4] — eco `transit`-i save etmir, load-da sıfırlanır. Davranış eynidir.

### 3.3 Satış qiyməti

`serve()` hər vahid üçün `stat.prodPrice()` və ya `stat.rawPrice()` çağırır [kod]. Sarğı:

```
rawFactor  = Σ_s mix.mRaw[s] × SPECIES[s].base / PRICE_NORM × market.idx[s] × qualityMul(q.mRaw) × repMul
prodFactor = Σ_p pmix.mProd[p] × PRODUCT[p].base × market.idx[5+p] × qualityMul(q.mProd) × repMul
factor     = clamp(factor, 0.4, 2.5)      // ümumi limit, mövcud priceMul və boost-dan ayrı [BALANS]
```

`sale` hadisəsi `{amt, units}` verir; eco vahidləri mRaw/mProd tərkibinə görə növlərə bölüb `market.sat[s] += units × f_s / depth_s` edir
və ledger-ə yazır. Xam/məhsul bölgüsü üçün `S.stats.soldProd` artımı istifadə olunur.

## 4. Bazar və qiymət mexanizmi

```js
S.eco.market = { idx: Float64[10], sat: Float64[10], walk: Float64[10], fuel: 1.0 };
```

Saatlıq addım (`market.step(m, ctx, rng)`), hər indeks `i` üçün:

```
sat[i]  *= 0.5 ** (1 / HALF_LIFE_H)            // HALF_LIFE_H = 3 [BALANS]
walk[i]  = walk[i] × 0.9 + rng.normal() × 0.03  // ortaya dönən gəzinti
idx[i]   = clamp(season[i][ctx.season] × (1 − K_SAT × sat[i]) × (1 + walk[i]) × eventMul[i], 0.5, 2.0)
```

- Deterministik: yalnız `rng.market` axını; addım sayı oyun saatı ilə (kadrla yox).
- Offline: eyni `step` N dəfə; saturation offline-də "satış yoxdur" fərziyyəsi ilə yalnız azalır (offline satışın təsiri ortalama
  indekslə hesablanır — §8).
- Mövcud çarpanlar (`up.market.price`, `brand`, `boost ×2`) **dəyişmir**; eco çarpanı onların üstünə vurulur və ayrıca limitlənir.

## 5. Risk və hadisə sistemi

### 5.1 Hava (`weather.js`)
Markov zənciri, oyun saatı addımı; keçid matrisi mövsümə görə (`defs-eco.js`). Proqnoz: növbəti 6 saat əvvəlcədən *həmin axından*
çəkilir və növbəyə yazılır (proqnoz = gələcəyin özü, 80% "dəqiqlik" yalnız UI-də qeyri-müəyyənlik kimi göstərilir) — bu, proqnozla
reallığın deterministik uyğunluğunu təmin edir.

### 5.2 Biznes hadisələri (`events.js`)
```js
EVENTS = [{ id, w(ctx) /*çəki*/, cooldownH, durationH, mods: {priceIdx?, fuel?, cust?, rep?}, choice?: [{label, apply}] }]
```
- Hər oyun saatı: `cooldown` bitibsə `rng.events` ilə `p = BASE_P × Σw`; seçim çəkiyə görə.
- Modlar **deklarativdir** (funksiya yox, məlumat) → save-ə yazıla bilir və offline-də eyni tətbiq olunur.
- Seçimli hadisə gözləyərkən simulyasiya dayanmır; müddət bitərsə default variant.

### 5.3 Fırtına zərəri və sığorta
Fırtına saatında dənizdə olan qayıqlar (`b.state ∈ {out, fish, back}`) üçün `rng.weather` ilə zərər; sığorta varsa təmir xərcinin
80%-i ödənilir. Qayıq heç vaxt itmir (idle prinsipi).

## 6. Müqavilə və istehsal sistemi

### 6.1 İstehsal (`factory.js`)
Simulyasiyanın zavodu (sürət, konveyer, tutum) dəyişmir. Eco yalnız resepti saxlayır: `S.eco.factory.recipe`. Konveyerə girən
hər vahid üçün məhsul tipi = resept; giriş uyğunluğu `fit = Σ_s mix.wh[s] × RECIPE.accept[s]` → qiymət çarpanı `0.7 + 0.3 × fit`.
Balıq unu resepti keyfiyyəti nəzərə almır (C keyfiyyətin istifadəsi).

### 6.2 Müqavilələr (`contracts.js`) və logistika (`logistics.js`)
```js
S.eco.contracts = { day, offers: [Offer], active: [{ id, kind, item /*növ və ya məhsul indeksi*/, qMin, need, shipped, price, dueH, deliveries }] };
S.eco.logi = { trucks: 1, queue: [{ cid, n, etaH, value }] };
```
- Təkliflər hər oyun günü `rng.contracts` ilə; həcm gündəlik istehsal təxmininə (`steadyRate`-in vahid sürəti) miqyaslanır.
- **Göndərmə** (manual və ya avto): `n = min(need − shipped, truckCap, available(loc))`, `available = stock − sim.res[loc]`;
  tərkib uyğunluğu: müqavilə növünün payı `mix[loc][s]`-dən götürülür — paylar modelində "yalnız levrek götürmək" üçün
  `n_s = floor(stock × f_s)` limiti tətbiq olunur və çıxarışdan sonra **paylar yenidən hesablanır** (bu yeganə qeyri-proporsional çıxarışdır).
- `S.stock[loc] −= n` (simulyasiyada `inc`/`res`-ə toxunulmur); ödəniş çatdırılmada (`etaH` bitəndə) `addMoney` ilə; ledger kateqoriyası `contract`.

## 7. Save modeli, miqrasiya və geriyə uyğunluq

### 7.1 Qərar: `SAVE_VERSION` artırılmır
- `state.js`: `s.v > SAVE_VERSION` → köhnə build **`fresh()`** qaytarır [kod]. Versiyanı 2-yə qaldırıb sonra köhnə build-ə qayıtmaq
  (rollback, köhnə APK) oyunçunun bütün irəliləyişini silər.
- `deepFill` naməlum açarları **silmir**, `save()` bütün `S`-i yazır [kod] → `S.eco` köhnə build-də toxunulmadan saxlanır.
- Buna görə: `S.eco = { v: 1, … }` — **öz sxem versiyası və öz miqrasiya zənciri** (`state-eco.js`), əsas `SAVE_VERSION = 1` qalır.
  `state.js`-ə toxunulmur. [təsdiq]

### 7.2 Yükləmə ardıcıllığı
1. `main.js` `G.S = load()` (dəyişməz).
2. Eco tənbəl init (ilk sarğı çağırışında və ya `worldReady`-də): `S.eco` yoxdursa `ecoFresh(S)` — mövcud ehtiyatlar istinad
   qarışığı ilə, `q = 0.8`, reputasiya 50, bazar baza, hava aydın, RNG seed = `S.created`-dən.
3. `migrateEco(S.eco)` — `eco.v` zənciri.
4. `reconcile(S)`:
   - paylar normallaşdırılır, NaN/mənfi → istinad qarışığı; `q` [0,1]-ə;
   - `stock[loc] = 0` olan yerlərin tərkibi istinad qarışığına;
   - aktiv müqavilə/logistika vaxtları `lastSeen`-ə görə offline qaydası ilə (§8);
   - köhnə build-də oynanılan vaxt (eco köhnəlib): `S.eco.lastTick < S.lastSeen` → yalnız saat irəli çəkilir, offline hesabı təkrarlanmır.
5. Offline eco hesabı (§8).

### 7.3 Ölçü
`S.eco` ≈ 3–5 KB JSON (ledger 7 gün, ən çox 3 təklif + 5 aktiv müqavilə, hadisə tarixçəsi yoxdur). Save hər 5 s [kod]; əlavə
`JSON.stringify` xərci cüzidir [fərziyyə — bench ilə ölçülməli].

## 8. Offline gəlir qaydaları

### 8.1 Mövcud (dəyişməz)
`amt = steadyRate() × min(away, offlineCapH) × 0.5` (`main.js`) [kod]. `steadyRate` sarğılanmış `stat.*`-ı oxuduğu üçün eco
çarpanları **avtomatik daxil olur** — bu istənilən davranışdır, amma iki qayda ilə:
- Offline kontekstdə (`eco.ctx = 'offline'`, `worldReady`-dən əvvəl) qiymət sarğıları **son 24 oyun saatının orta** indeksini qaytarır
  (bağlamazdan əvvəlki qiymət sıçrayışını offline-ə daşımamaq üçün).
- Eyni qayda mağazanın "Vaxt sıçrayışı/Pul kisəsi" və sandıq dəyərlərinə də tətbiq olunur (`steadyRate` istifadə edirlər [kod]).

### 8.2 Eco offline hesabı (`offline.js`)
`hours = min(away, offlineCapH) / 60` oyun saatı addımı (1 oyun saatı = 1 real dəq; 8 saat → 480 addım; addım ≈ µs səviyyəsində [fərziyyə]).
Hər addımda **canlı oyunla eyni** `hourStep` funksiyası çağırılır, amma axınlar müşahidə yox, təxmin edilir:

| Sistem | Offline qayda |
|---|---|
| Saat, mövsüm, hava | tam irəliləyir |
| Bazar | gəzinti + saturation azalması |
| Ehtiyatlar | bərpa + təxmini tutma (`steadyRate`-in balıq axını × hədəf qarışığı) |
| Xərclər (yanacaq, maaş, sığorta, kredit) | təxmini səfər sayı ilə; offline gəlirdən çıxılır; çatmırsa `bills` |
| Xarab olma | tətbiq olunur, ehtiyatın ≤25%-i [BALANS] |
| Qayıq zərəri | vəziyyət ≤ −20, fırtına zərəri **yox** |
| Müqavilələr | avto-göndərmə menecerlə → çatdırılır; yoxsa müddət dayandırılır, cərimə yoxdur |
| Hadisələr | yalnız passiv; ≤1 seçimli hadisə qayıdışda gözləyir |
| Tapşırıqlar | offline irəliləmə sayılmır |

Nəticə ledger-ə "Offline" günü kimi yazılır və mövcud offline modalından **sonra** ayrıca qısa "Biznes hesabatı" göstərilir
(mövcud modala toxunulmur). [təsdiq]

### 8.3 Paritet testi
Eyni save ilə: canlı 1 saat (seed-li headless) gəliri vs offline 1 saat → nisbət ≈ 0.5 ± 0.15 (mövcud dizayn nisbəti). Eco açıq/qapalı
hər ikisində ölçülür; fərq eco-nun offline/online uçurumu yaratmadığını göstərir.

## 9. Deterministik simulyasiya və random axınlarının ayrılması

- **Problem [kod, HANDOFF risk 2]:** render və simulyasiya bir `Math.random` paylaşır; render-dəki əlavə çağırış iqtisadiyyatın
  təsadüfi yolunu sürüşdürür.
- **Qayda 1:** `src/eco/*` **heç vaxt** `Math.random` çağırmır (lint/grep testi: `tests/eco/no-math-random.cjs`).
- **Qayda 2:** eco-nun öz PRNG-si (`sfc32`, 4×uint32 vəziyyət) və **hər domen üçün ayrı axın**: `catch`, `weather`, `market`,
  `contracts`, `events`, `damage`. Bir sistemə yeni çəkiliş əlavə etmək digərlərinin ardıcıllığını dəyişmir. Vəziyyətlər save-də.
- **Qayda 3:** gündəlik tapşırıqlar `hash(YYYY-MM-DD)` seed-i ilə (cihazlar arası eyni gün = eyni tapşırıqlar).
- **Qayda 4:** saatlıq addımlar kadrdan asılı deyil: `eco.acc += dt; while (acc >= 60) { acc -= 60; hourStep(); }`.
- **Qeyd:** eco açıq olanda sarğılar simulyasiyanın davranışını dəyişir (müştəri vaxtı, qayıq sürəti) → simulyasiyanın `Math.random`
  çəkiliş ardıcıllığı da dəyişir. Ona görə: **eco söndürülmüş** regresiya bugünkü baseline ilə *eyni* olmalıdır; **eco açıq**
  regresiya isə öz "golden" snapshot-u ilə müqayisə edilir (test harness `Math.random`-u da seed-ləyir — mövcud harness kimi).
- **dt kəsilməsi [kod]:** `WorldScene.update` `dt ≤ 0.1`. Eco `Sim.update`-dən `dt` aldığı üçün 10 FPS-dən aşağı eco saatı da
  simulyasiya ilə birlikdə yavaşlayır — tutarlıdır (gün gəliri ilə gün xərci eyni sürətlə), amma oyun günü real vaxtda uzanır. Qəbul edilir, sənədləşdirilir.

## 10. Modul sərhədləri

```
src/eco/
  index.js        install(), bayraqlar, ctx ('offline'|'live'), public API (UI üçün oxuma funksiyaları)
  adapter.js      YEGANƏ fayl ki, stat / Sim / bus / S.stock / boat.t ilə danışır
  defs-eco.js     növlər, məhsullar, mövsümlər, reseptlər, hadisələr, kreditlər — bütün [BALANS] rəqəmlər
  rng.js clock.js mix.js
  state-eco.js    ecoFresh, migrateEco, reconcile
  catch.js stocks.js market.js weather.js fleet.js quality.js factory.js
  contracts.js logistics.js staff.js finance.js reputation.js events.js tasks.js
  offline.js      hourStep-i N dəfə təxmini axınlarla
  step.js         hourStep(eco, ctx, rng) — canlı və offline üçün ortaq
src/ui/eco-ui.js  `worldReady`-də DOM-a panel/çip inyeksiyası; yalnız index.js API-sini oxuyur, əmrləri index.js-ə ötürür
src/ui/eco.css    ayrıca stil (build.mjs-də birləşdirilir)
src/main-eco.js   import './eco/index.js'; import './main.js';
```

Qaydalar:
- Domen modulları (`catch.js` … `tasks.js`) **təmizdir**: Phaser, DOM, `G`, `bus` import etmir; `(state, ctx, rng) → state` → Node-da test olunur.
- `adapter.js` domen modullarını çağırır, əksinə yox.
- `eco-ui.js` `ui.js`-in daxili funksiyalarına (`VIEWS`, `open`) bağlanmır (export olunmur [kod]); öz paneli var, yalnız `toast/showModal`
  (export olunur) istifadə edir.
- Bayraqlar: `S.eco.flags = { species, market, weather, fleet, stocks, quality, factory, contracts, staff, finance, rep, events, tasks }`;
  hər sistem öz bayrağı sönükdürsə sarğı `orig()` qaytarır.

## 11. Performans büdcəsi

| Ölçü | Hədəf | Ölçmə |
|---|---|---|
| `eco.tick` (hər kadr) | ≤ 0.02 ms orta, allokasiya yox | `bench.cjs` + probe (audit metodu: funksiyanı sarğılayıb vaxt ölçmək) |
| `hourStep` | ≤ 0.3 ms, real dəqiqədə 1 dəfə | Node unit bench |
| Offline 8 saat | ≤ 30 ms yükləmədə | Node + headless |
| Eco UI | panel bağlı → 0 DOM yazısı; açıq → ≤ 2 Hz, yalnız dəyişən hüceyrələr | headless DOM mutasiya sayğacı |
| FPS (emulyator) | baseline-dan ≤ 0.5 FPS aşağı (Medium 11.9 / High 8.8 [ölçülüb]) | CI emulyator işi, eyni preset |
| Heap | ≤ +3 MB | `bench.cjs` (GC səs-küyü: 2 təkrar) |

Android riski əsasən DOM-dadır (reflow), hesablamada deyil: yeni HUD çipləri `transform`/`textContent` ilə, layout dəyişdirmədən.

## 12. Test strategiyası

1. **Unit (Node, `node --test tests/eco/*.test.mjs`)**: mix invariantları (Σ=1, ≥0), bazar bərpası, hava stasionar paylanması,
   biomassa sərhədləri, kredit amortizasiyası, `offline(N) == N × hourStep` eyni girişlə, RNG axınlarının müstəqilliyi.
2. **Statik:** `no-math-random` (src/eco-da `Math.random` yoxdur), `adapter-only` (yalnız `adapter.js` `../sim` və `../core/economy` import edir).
3. **Eco söndürülmüş regresiya:** `workers-regress.cjs` (6 ssenari), `save-compare.cjs` (4 save), `run-tests.cjs` (15), `outer-save.cjs`,
   `boat-sync.cjs` — baseline ilə **eyni**. Bu, eco qatının sönük halda sıfır təsirini sübut edir.
4. **Eco açıq golden:** seed-li 600 s ssenarilər → `S.eco` + `S.money` snapshot hash; dəyişiklik yalnız təsdiqlə yenilənir.
5. **Invariant rejimi (dev build, `?ecoCheck=1`):** hər saat `Σmix=1`, `stock ≥ res`, `money ≥ 0`, `q∈[0,1]`, `bills ≥ 0`; pozuntu → `console.log('ECOERR …')`.
6. **Save matrisi:** fixture-lər (yeni, orta, max save; eco-suz v1) → eco build-də yüklə → save → **köhnə build**-də yüklə (downgrade) →
   `snapshot()` eyni, `S.eco` saxlanıb → yenidən eco build → reconcile düzgün.
7. **Offline matrisi:** 30 s, 2 dəq, 1 saat, 8 saat, 48 saat; kreditli/kreditsiz; avto-göndərmə açıq/qapalı → sərhədlər və paritet (§8.3).
8. **Balans simulyatoru (`tools/balance-sim.mjs`):** təmiz modullar + sadələşdirilmiş axın modeli ilə 7 oyun günü → CSV/MD hesabat;
   avtomatik yoxlamalar: başlanğıc qiymət çarpanı 1.0 ± 0.1, yanacaq ≤ gəlirin 15%-i, ehtiyat ≥ 0.7 alt limit, kredit exploit-i yoxdur.
9. **Performans:** hər həftə sonu `bench.cjs` əvvəl/sonra + CI emulyator; nəticələr `test-results/eco/`.

## 13. Rollback strategiyası

| Səviyyə | Necə | Save təsiri |
|---|---|---|
| 1. Sistem bayrağı | `S.eco.flags.X = 0` (debug paneli və ya dev konsol) | Yoxdur; sistem məlumatı saxlanır |
| 2. Master bayraq | `S.eco.on = 0` → adapter sarğıları `orig()` qaytarır | Yoxdur |
| 3. Build | `ECO` olmadan build → bundle bugünkü ilə eyni (eco import olunmur) | `S.eco` saxlanır, istifadə olunmur (§7.1) |
| 4. Git | hər roadmap tapşırığı = bir commit → `git revert` | Yoxdur (sxem geriyə uyğun) |

`SAVE_VERSION` artırılmadığı üçün istənilən səviyyədə köhnə build-ə qayıtmaq oyunçu irəliləyişini silmir.

## 14. Açıq texniki risklər

1. Adapter daxili adlara bağlıdır (`b.state`, `w.state`, `w.job.src`, `sim.res`, `sim.convey`) → `adapter-contract` testi bu adların
   mövcudluğunu yoxlayır; simulyasiya refaktor olunarsa test qırılır (səssiz sınma yox).
2. Donanma-ümumi `stat` → fərdi qayıq effektləri (vəziyyət, hədəf növ) V1-də orta dəyərlə; dəqiqlik üçün Variant B nöqtəsi lazım ola bilər.
3. `steadyRate` canlı modeldən fərqlidir [kod, audit] → eco çarpanları offline/online fərqini böyüdə bilər → paritet testi.
4. Fırtınada `boat.t` yazısı render qayıq planlamasına təsir edə bilər [fərziyyə] → `boat-sync/boat-timeline` testləri məcburidir.
5. Çarpanların yığılması (mövcud `priceMul` × boost ×2 × eco) → eco faktoru ayrıca `[0.4, 2.5]` limitli; balans simulyatoru.
