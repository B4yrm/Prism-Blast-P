/* L3 — Threat Hunting, DFIR, Malware RE, Purple Team & SOC Leadership */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;
SOC.modules.push(
// =====================================================================
{
id: "l3-hunting", level: "L3", title: "Threat Hunting (proaktiv təhdid ovu)",
intro: "Alert gözləməkdən çıxıb proaktiv axtarışa. Fərziyyə-əsaslı hunting, metodologiya və TTP ovu.",
lessons: [
{ title: "Threat hunting fəlsəfəsi və növləri", html: R`
<p><b>Threat hunting</b> — mövcud detection-ın buraxdığı təhdidləri <b>proaktiv</b>, insan-aparıcı axtarışla tapmaqdır. Fərziyyə: "mühitimizdə artıq aşkarlanmamış kompromis var — gəl tapaq".</p>
<h3>Niyə lazımdır?</h3>
<ul><li>Dwell time (hücumçunun aşkarlanmamış qaldığı müddət) çox vaxt həftələr/aylardır</li>
<li>Avtomatik detection yalnız bildiyini tutur (naməlum/fileless/yeni TTP-ni buraxır)</li>
<li>Hunting görünürlük boşluqlarını və yeni detection imkanlarını aşkarlayır</li></ul>
<h3>Hunting növləri</h3>
<table><tr><th>Növ</th><th>Təsvir</th></tr>
<tr><td><b>Hypothesis-driven</b></td><td>Fərziyyə qur, test et (ATT&CK/TI əsaslı)</td></tr>
<tr><td><b>IOC/IOA-driven</b></td><td>Məlum göstərici/davranışı mühitdə axtar</td></tr>
<tr><td><b>Baseline/anomaly</b></td><td>Normalı müəyyən et, kənarlaşmanı tap</td></tr>
<tr><td><b>Model/ML-assisted</b></td><td>Statistik/ML ilə anomaliya</td></tr></table>
<h3>Hunting Maturity Model (Sqrrl)</h3>
<p>HM0 (yalnız avtomatik alert) → HM1 (TI IOC axtarışı) → HM2 (prosedurları izləyir) → HM3 (yeni prosedurlar yaradır) → HM4 (avtomatlaşdırılmış hunting).</p>
<h3>PEAK / hunting loop</h3>
<ol><li><b>Prepare:</b> fərziyyə, scope, data mənbələri</li><li><b>Execute:</b> data topla, təhlil et</li>
<li><b>Act:</b> tapıntı → IR / yeni detection / yeni fərziyyə</li></ol>
<div class="note"><b>Hunting-in çıxışları (hamısı qiymətlidir):</b> (1) aktiv təhdid tapıldı → IR; (2) heç nə tapılmadı, amma yeni detection qaydası yarandı; (3) görünürlük boşluğu aşkarlandı (logging artırılmalı); (4) baseline/mühit biliyi artdı. "Heç nə tapmadım" uğursuzluq deyil.</div>`},
{ title: "Hunting metodologiyası və data analizi", html: R`
<h3>Yaxşı fərziyyə qurmaq</h3>
<p>Spesifik, test edilə bilən, ATT&CK-ə bağlı olmalıdır.</p>
<ul><li>Zəif: "bəlkə malware var"</li>
<li>Güclü: "Hücumçu T1053.005 (scheduled task) ilə persistence qurubsa, qeyri-standart yollardan işləyən və ya qeyri-iş saatında yaradılmış tapşırıqlar olmalıdır — 4698 və TaskScheduler loglarında axtar"</li></ul>
<h3>Data analiz texnikaları</h3>
<table><tr><th>Texnika</th><th>Təsvir</th></tr>
<tr><td><b>Stacking / frequency analysis</b></td><td>Dəyərləri qrupla, nadir olanları (long tail) tap. Məs: nadir rast gəlinən parent-child cütləri, nadir imzalanmamış binary-lər</td></tr>
<tr><td><b>Baselining</b></td><td>Normalı müəyyən et → kənarlaşma</td></tr>
<tr><td><b>Clustering/grouping</b></td><td>Oxşar hadisələri qrupla</td></tr>
<tr><td><b>Time analysis</b></td><td>Beacon intervalları, qeyri-iş saatı fəaliyyət</td></tr>
<tr><td><b>Enrichment/pivoting</b></td><td>TI, GeoIP, asset kontekst əlavə et</td></tr>
<tr><td><b>Outlier detection</b></td><td>Statistik anomaliyalar</td></tr></table>
<h3>Hunting üçün data mənbələri</h3>
<p>Zəngin endpoint telemetriyası (EDR/Sysmon — proses, şəbəkə, fayl, registry), DNS logları, proxy, auth logları, şəbəkə metadata (Zeek), cloud audit logları. <b>Görünürlük olmadan hunting mümkün deyil</b> — ona görə data mənbələrinin keyfiyyəti kritikdir.</p>
<h3>MITRE ATT&CK-i hunting-də istifadə</h3>
<ul><li>Hansı texnikaları izləyə bilirik (coverage)? Navigator ilə xəritələ.</li>
<li>Prioritet: ən çox hədəfləndiyimiz/təhlükəli texnikalar üçün hunt qur.</li>
<li>Hər hunt-dan sonra coverage-ı yenilə (yeni detection = yeni əhatə).</li></ul>`},
{ title: "Praktiki TTP ovu nümunələri", html: R`
<h3>Nümunə hunt-lar (fərziyyə → axtarış → nə tap)</h3>
<table><tr><th>TTP</th><th>Hunt məntiqi</th></tr>
<tr><td>C2 Beaconing (T1071)</td><td>Bağlantı delta vaxtlarını hesabla, aşağı dispersiya (müntəzəm) + nadir təyinat + uzun müddət tap</td></tr>
<tr><td>LOLBin sui-istifadəsi (T1218)</td><td>certutil/mshta/rundll32/regsvr32 qeyri-adi arqumentlərlə (URL, javascript, scrobj)</td></tr>
<tr><td>Fileless/PowerShell (T1059.001)</td><td>4104 script block-larda IEX, DownloadString, FromBase64, obfuscation</td></tr>
<tr><td>Persistence (T1547/T1053)</td><td>Yeni Run açarları, qeyri-standart yoldan servis/task, nadir autostart girişləri (stacking)</td></tr>
<tr><td>Credential dumping (T1003)</td><td>lsass-a qeyri-adi proses girişi; reg save SAM; comsvcs.dll MiniDump</td></tr>
<tr><td>Lateral movement (T1021)</td><td>Qeyri-adi SMB/RDP/WinRM nümunələri; bir hostdan çox hostʼa qısa müddətdə</td></tr>
<tr><td>Masquerading (T1036)</td><td>System proses adları System32-dən kənarda; imzalanmamış "sistem" faylları</td></tr>
<tr><td>Discovery (T1087/T1082)</td><td>Qısa müddətdə çoxlu kəşfiyyat əmrləri (whoami, net group, nltest, systeminfo)</td></tr></table>
<h3>Hunting iş axını nümunəsi (beacon)</h3>
<ol><li>Fərziyyə: gizli C2 beacon var (443-də, legitim görünən)</li>
<li>Data: proxy/Zeek conn.log (src, dst, duration, bytes, timestamps)</li>
<li>Analiz: src-dst cütü üçün bağlantı vaxtları arasındakı delta-ları hesabla; standart sapma aşağı olanları (müntəzəm) tap; az byte + uzun müddət + nadir dst filtrlə</li>
<li>Enrich: dst domen/IP yaşı, TI, JA3</li>
<li>Nəticə: şübhəli host → IR; yoxsa → beacon detection qaydası yarat</li></ol>
<div class="tip">Scripting (Python + pandas) hunting-i güclendirir: minlərlə bağlantını əl ilə yox, kodla analiz et (delta hesablama, aqreqasiya, vizuallaşdırma). Jupyter notebook hunting üçün populyardır. RITA (Zeek üzərində) beacon hunting-i avtomatlaşdırır.</div>`},
{ title: "Hunting-i detection-a çevirmək və sənədləşdirmə", html: R`
<h3>Hər hunt sənədləşdirilməlidir</h3>
<ul><li><b>Fərziyyə:</b> nə axtardıq, niyə</li><li><b>Scope & data:</b> hansı sistemlər, hansı loglar, hansı dövr</li>
<li><b>Metod:</b> hansı sorğular/analiz</li><li><b>Tapıntılar:</b> nə tapıldı (və ya tapılmadı)</li>
<li><b>Nəticə/tədbir:</b> IR? Yeni detection? Boşluq? Yeni fərziyyə?</li></ul>
<p>Sənədləşdirmə təkrarlanabilir hunt-lar (playbook) yaradır və biliyi komandada saxlayır.</p>
<h3>Metrikalar (hunting-in dəyərini göstər)</h3>
<ul><li>Tapılan əvvəlcədən naməlum təhdidlər</li><li>Yaradılan yeni detection qaydaları</li>
<li>Aşkarlanan görünürlük/logging boşluqları</li><li>Azaldılan dwell time</li><li>Əhatə dairəsinin (ATT&CK coverage) artması</li></ul>
<h3>Threat hunting komandası və alətlər</h3>
<p>Alətlər: SIEM (Splunk/Sentinel/Elastic), EDR, Jupyter/Python, Velociraptor (fleet-wide hunting), OSQuery, RITA/Zeek, YARA (fayl hunting), Kestrel (hunting dili). Çərçivələr: MITRE ATT&CK, TaHiTI, PEAK, MaGMa.</p>
<div class="note">Müsahibə (senior): "Bir threat hunt necə planlaşdırardın?" Güclü cavab: konkret fərziyyə (ATT&CK-ə bağlı) → lazımi data mənbələri → analiz metodu (stacking/baseline) → nəticəni IR və ya detection-a çevirmə → sənədləşdirmə. "Heç nə tapmasam belə, detection boşluğu və ya baseline bilik qazanıram" demək bütöv düşüncəni göstərir.</div>`}
],
quiz: [
{ q: "Threat hunting-in əsas fərqi nədir?", o: ["Proaktiv — alert gözləmədən təhdid axtarır", "Daha çox alert yaradır", "Yalnız firewall", "Yalnız antivirus"], a: 0, e: "İnsan-aparıcı, fərziyyə-əsaslı." },
{ q: "Yaxşı hunting fərziyyəsinin xüsusiyyəti nədir?", o: ["Spesifik, test edilə bilən, ATT&CK-ə bağlı", "Ümumi və qeyri-müəyyən", "Yalnız hash", "Alert sayı"], a: 0, e: "'Bəlkə malware var' zəifdir." },
{ q: "Stacking (frequency analysis) nə tapır?", o: ["Nadir dəyərləri (long tail)", "Ən çox rast gəlinəni", "Logları silir", "Alert yaradır"], a: 0, e: "Nadir = çox vaxt maraqlı." },
{ q: "Dwell time nədir?", o: ["Hücumçunun aşkarlanmadan sistemdə qaldığı müddət", "Alert müddəti", "Patch vaxtı", "Log saxlama"], a: 0, e: "Hunting bunu azaldır." },
{ q: "'Heç nə tapmadım' hunting-də nə deməkdir?", o: ["Yenə dəyərli — detection/boşluq/baseline bilik qazanıla bilər", "Tam uğursuzluq", "Vaxt itkisi", "Alert yaradılmalı"], a: 0, e: "Nəticə hələ də faydalıdır." },
{ q: "Hunting Maturity Model-də HM0 nədir?", o: ["Yalnız avtomatik alert (hunting yoxdur)", "Avtomatlaşdırılmış hunting", "Yeni prosedur yaradır", "TI axtarışı"], a: 0, e: "Ən aşağı yetkinlik." },
{ q: "C2 beacon hunting-də nəyə baxırsan?", o: ["Müntəzəm interval + az byte + uzun müddət + nadir təyinat", "Çoxlu DNS səhvi", "Tək login", "Patch statusu"], a: 0, e: "Periodicity açardır." },
{ q: "Hunting üçün ən vacib ilkin şərt nədir?", o: ["Data görünürlüyü (keyfiyyətli loglar/telemetriya)", "Çox firewall", "Antivirus", "Backup"], a: 0, e: "Görünürlük olmadan hunting mümkün deyil." },
{ q: "LOLBin hunting nümunəsi hansıdır?", o: ["certutil qeyri-adi arqumentlərlə (URL endirmə)", "Normal ping", "Login", "Patch"], a: 0, e: "T1218 — legitim alət sui-istifadəsi." },
{ q: "Uğurlu hunt-un ən yaxşı nəticələrindən biri hansıdır?", o: ["Yeni detection qaydası yaratmaq", "Logları silmək", "Alert sayını artırmaq", "Firewall söndürmək"], a: 0, e: "Boşluğu bağlayır." },
{ q: "Baseline hunting nə tələb edir?", o: ["Normalın nə olduğunu bilmək (sonra kənarlaşma)", "Çox alert", "Malware", "Patch"], a: 0, e: "Normal → anomaliya." },
{ q: "Scripting (Python/pandas) hunting-də niyə faydalıdır?", o: ["Minlərlə hadisəni avtomatik analiz etmək (delta, aqreqasiya)", "Email göndərmək", "Firewall qurmaq", "Şifrələmək"], a: 0, e: "Böyük data analizi." },
{ q: "RITA nə edir?", o: ["Zeek üzərində beacon/C2 hunting avtomatlaşdırır", "Malware yazır", "Parol qırır", "Email filtrləyir"], a: 0, e: "Beacon analizi aləti." },
{ q: "Velociraptor nə üçündür?", o: ["Fleet-wide endpoint hunting və forensika", "Şəbəkə skanı", "DDoS", "Email"], a: 0, e: "Çox hostda eyni vaxtda sorğu." },
{ q: "Masquerading hunting nəyə baxır?", o: ["System proses adları System32-dən kənar yolda / imzasız", "Normal login", "DNS", "Patch"], a: 0, e: "T1036 — ad saxtalaşdırma." },
{ q: "Discovery fəaliyyəti hunt-u nəyi axtarır?", o: ["Qısa müddətdə çoxlu kəşfiyyat əmri (whoami, net group, nltest)", "Tək ping", "Backup", "Patch"], a: 0, e: "Hücumçu mühiti kəşf edir." },
{ q: "Hər hunt niyə sənədləşdirilməlidir?", o: ["Təkrarlanabilirlik və komanda bilgisi üçün", "Disk doldurmaq", "Alert yaratmaq", "Heç bir səbəb"], a: 0, e: "Təkrar hunt = playbook." }
],
tasks: [
{ t: "Fərziyyə qur", d: R`<p>TI hesabatı deyir: bir aktor <code>rundll32.exe</code>-ni JavaScript icra etmək üçün sui-istifadə edir (T1218.011). Sən bunu öz mühitində axtarmaq istəyirsən.</p>`, q: "Axtarış üçün rundll32-nin əmr sətrində hansı şübhəli açar söz olardı?", ans: ["javascript", "javascript:", "scrobj", "scrobj.dll"], hint: "rundll32 javascript:... və ya scrobj.dll.", sol: "Şübhəli: <code>rundll32.exe javascript:...</code> və ya <code>rundll32.exe ...scrobj.dll</code> (SCT/COM scriptlet). Normal rundll32 DLL,funksiya şəklində çağırılır. Fərziyyə: 'aktor rundll32 ilə JS icra edirsə, əmr sətrində javascript:/scrobj görərik'. Data: Sysmon 1 / 4688 (command line audit). Tapılarsa → IR; yoxsa → detection qaydası + coverage yenilə." },
{ t: "Beacon analizi", d: R`<p>Python/pandas ilə proxy loglarını analiz edirsən. Bir src-dst cütü üçün ardıcıl bağlantı vaxtları arasındakı fərqlər (delta, saniyə): [300, 301, 299, 300, 302, 298, 300].</p>`, q: "Bu delta nümunəsi nəyə işarədir? (bir söz)", ans: ["beacon", "beaconing", "c2", "c2 beacon"], hint: "Çox müntəzəm interval (~300s, az dispersiya).", sol: "C2 beaconing. Delta-lar ~300s ətrafında çox az dəyişir (standart sapma kiçik) = yüksək müntəzəmlik. İnsan trafiki belə müntəzəm olmaz. Həqiqi C2 jitter əlavə edə bilər, amma yenə statistik nümunə görünür. Addım: dst-i enrich et (domen yaşı, TI, JA3), host-u araşdır, təsdiqlənsə IR + beacon detection qaydası yarat." },
{ t: "Hunting nəticəsini çevir", d: R`<p>Hunt apardın, aktiv təhdid tapmadın, amma gördün ki, iş stansiyalarının yarısında PowerShell Script Block Logging (4104) aktiv deyil.</p>`, q: "Bu hunt-un əsas dəyərli nəticəsi nədir? (qısa)", ans: ["__any__"], hint: "Görünürlük/logging boşluğu.", sol: "Görünürlük (visibility) boşluğu aşkarlandı — iş stansiyalarının yarısında PowerShell loglaması söndürülüb, yəni orada PowerShell hücumlarını görə bilmirik. Təhdid tapılmasa da, bu çox dəyərli nəticədir: GPO ilə 4104-ü hər yerdə aktivləşdir, sonra hunt-u təkrarla. 'Heç nə tapmadım' uğursuzluq deyil — detection imkanını artırdın." },
{ t: "Threat hunting lab (praktika)", d: R`<p>Hunting bacarığını inkişaf etdir.</p>`, steps: ["TryHackMe 'Threat Hunting' / 'Hunt Me' otaqları və ya BOTS (Boss of the SOC) datasetini seç", "Splunk/Elastic-də stacking məşq et: nadir parent-child proses cütlərini tap", "Python + pandas ilə nümunə proxy logundan beacon delta analizi yaz", "RITA və ya Zeek nümunə pcap ilə beacon hunting sına", "Bir ATT&CK texnikası seç, fərziyyə qur, öz labında emulate et (Atomic), sonra ovla", "Hunt-u tam sənədləşdir (fərziyyə → metod → tapıntı → nəticə)"], sol: "Threat hunting senior SOC/blue team rolunun əsasıdır. Python data analizi + ATT&CK dərin biliyi + yaxşı sənədləşdirmə bu sahədə fərqləndirici bacarıqlardır." }
]
},
// =====================================================================
{
id: "l3-dfir", level: "L3", title: "DFIR: Disk və yaddaş forensikası",
intro: "Digital Forensics & Incident Response. Dəlil toplama, disk/yaddaş forensikası, timeline və artefaktlar.",
lessons: [
{ title: "Forensika prinsipləri və dəlil toplama", html: R`
<h3>Əsas prinsiplər</h3>
<ul><li><b>Order of Volatility</b> (dəyişkənlik sırası) — ən tez itən dəlili əvvəl topla: registrlər/keş → RAM → şəbəkə vəziyyəti → işləyən proseslər → disk → arxiv/backup. RAM söndürüləndə itir, ona görə canlı sistemdə əvvəl yaddaş.</li>
<li><b>Chain of Custody</b> — dəlilin kim, nə vaxt, necə toplandığı/saxlandığı sənədləşdirilir (hüquqi etibar).</li>
<li><b>Integrity</b> — dəlil toplananda hash alınır, dəyişməz saxlanır. Orijinalla deyil, <b>surətlə</b> işləyirsən (write-blocker).</li>
<li><b>Reproducibility</b> — nəticələr təkrarlana bilən olmalıdır.</li></ul>
<h3>Dəlil növləri</h3>
<ul><li><b>Volatile:</b> RAM, işləyən proseslər, şəbəkə bağlantıları, açıq fayllar</li>
<li><b>Non-volatile:</b> disk образları, loglar, registry, faylların metadata-sı</li></ul>
<h3>İmaging (surət alma)</h3>
<ul><li><b>Disk:</b> dd, FTK Imager, Guymager → bit-bit surət (E01/raw). Write-blocker istifadə et (orijinalı dəyişməmək üçün).</li>
<li><b>RAM:</b> WinPmem, DumpIt, FTK Imager (Windows); LiME, avml (Linux) → yaddaş dump-u</li>
<li>Hər surət üçün hash (MD5+SHA256) al və sənədləşdir.</li></ul>
<div class="warn">Canlı kompromis sistemdə sən artefaktları dəyişdirə bilərsən (Locard prinsipi — hər təmas iz qoyur). Mümkünsə triage alətlərini xarici mediadan işlət, nəyə toxunduğunu qeyd et. Ransomware/hüquqi işlərdə forensik dəqiqlik kritikdir.</div>`},
{ title: "Yaddaş (memory) forensikası", html: R`
<p>RAM dump-u işləyən sistemin "anlıq şəkli"dir — fileless malware, şifrələnməmiş açarlar, inject olunmuş kod, şəbəkə bağlantıları, process-lər burada görünür. Alət: <b>Volatility</b> (2/3) və ya MemProcFS.</p>
<h3>Volatility 3 əsas plugin-ləri</h3>
<table><tr><th>Plugin</th><th>Nə göstərir</th></tr>
<tr><td>windows.pslist / pstree</td><td>İşləyən proseslər / ağac</td></tr>
<tr><td>windows.psscan</td><td>Gizlədilmiş/çıxmış proseslər (DKOM)</td></tr>
<tr><td>windows.cmdline</td><td>Proseslərin əmr sətirləri</td></tr>
<tr><td>windows.netscan / netstat</td><td>Şəbəkə bağlantıları</td></tr>
<tr><td>windows.dlllist / ldrmodules</td><td>Yüklənmiş DLL-lər (inject aşkarlama)</td></tr>
<tr><td>windows.malfind</td><td>İnject olunmuş/şübhəli yaddaş sahələri (RWX)</td></tr>
<tr><td>windows.handles</td><td>Açıq handle-lar (fayl, mutex)</td></tr>
<tr><td>windows.hashdump / lsadump</td><td>Credential-lar</td></tr>
<tr><td>windows.registry.*</td><td>Yaddaşdakı registry</td></tr>
<tr><td>windows.filescan / dumpfiles</td><td>Yaddaşdakı fayllar</td></tr></table>
<h3>Yaddaş forensikası iş axını</h3>
<ol><li>Proses siyahısı (pslist vs psscan — fərq = gizlətmə)</li><li>Şübhəli proseslər (qeyri-adi ad/parent/yol)</li>
<li>Əmr sətirləri (cmdline)</li><li>Şəbəkə bağlantıları (netscan — C2)</li>
<li>Injection (malfind — RWX sahələr, shellcode)</li><li>Şübhəli DLL-lər</li><li>Credential/registry çıxar</li>
<li>Şübhəli proses yaddaşını dump et → statik analiz</li></ol>
<div class="tip">malfind — injection aşkarlamaq üçün ən güclü plugin: icra icazəli (RWX) anonim yaddaş sahələrini tapır, bunlar çox vaxt shellcode/inject olunmuş koddur. pslist (linked list) ilə psscan (pool scan) fərqi gizlədilmiş prosesi üzə çıxarır.</div>`},
{ title: "Disk forensikası və Windows artefaktları", html: R`
<p>Disk forensikası faylları, silinmiş məlumatı və fəaliyyət izlərini (artefaktları) bərpa edir. Alətlər: <b>Autopsy/Sleuth Kit</b> (pulsuz), FTK, X-Ways, EnCase, <b>plaso/log2timeline</b> (super timeline).</p>
<h3>Vacib Windows forensik artefaktları</h3>
<table><tr><th>Artefakt</th><th>Nə göstərir</th></tr>
<tr><td>$MFT (NTFS)</td><td>Bütün fayllar + MAC(B) vaxtları</td></tr>
<tr><td>Registry (SAM, SYSTEM, SOFTWARE, NTUSER.DAT)</td><td>Konfiqurasiya, istifadəçi fəaliyyəti, persistence (Run açarları)</td></tr>
<tr><td><b>Prefetch</b> (C:\Windows\Prefetch)</td><td>İcra olunmuş proqramlar + neçə dəfə + son icra vaxtı (proqram işləyib!)</td></tr>
<tr><td><b>Amcache / Shimcache</b></td><td>İcra edilmiş proqramların dəlili</td></tr>
<tr><td><b>Event Logs (.evtx)</b></td><td>Logon, proses, servis və s.</td></tr>
<tr><td><b>LNK / Jump Lists</b></td><td>Açılmış fayllar</td></tr>
<tr><td><b>ShellBags</b></td><td>Baxılmış qovluqlar</td></tr>
<tr><td><b>SRUM</b></td><td>Proses şəbəkə/resurs istifadəsi (exfil həcmi)</td></tr>
<tr><td><b>USN Journal / $LogFile</b></td><td>Fayl sistemi dəyişiklikləri</td></tr>
<tr><td><b>Browser artefaktları</b></td><td>Tarixçə, endirmələr, keş</td></tr>
<tr><td><b>Recycle Bin, Thumbcache</b></td><td>Silinmiş fayllar, şəkil izləri</td></tr>
<tr><td><b>WMI repository, Scheduled Tasks</b></td><td>Persistence</td></tr></table>
<h3>Timeline analizi</h3>
<p>Bütün artefaktların vaxt damğalarını birləşdirib (super timeline — plaso) hadisələrin ardıcıllığını qurmaq. "Nə vaxt nə oldu" — hücumun tam hekayəsi. Timeline DFIR-ın ürəyidir.</p>
<p><b>Timestomping aşkarlama:</b> $STANDARD_INFORMATION (SI) və $FILE_NAME (FN) vaxtlarının uyğunsuzluğu, sub-saniyə dəqiqliyinin "0" olması saxtalaşdırma əlamətidir.</p>`},
{ title: "Triage, KAPE və sürətli DFIR", html: R`
<p>Tam disk образı həmişə praktik deyil (vaxt, ölçü). <b>Triage collection</b> — yalnız ən dəyərli artefaktları tez toplamaq.</p>
<h3>KAPE (Kroll Artifact Parser and Extractor)</h3>
<p>Pulsuz, sürətli triage aləti: <b>Targets</b> (hansı artefaktları toplamaq) + <b>Modules</b> (onları parse etmək). Dəqiqələr içində əsas artefaktları (MFT, registry, event logs, prefetch, browser) toplayıb analiz edir. Velociraptor da fleet-wide triage üçün güclüdür.</p>
<h3>Eric Zimmerman alətləri (pulsuz, DFIR qızıl standartı)</h3>
<ul><li><b>MFTECmd</b> — $MFT parse</li><li><b>Registry Explorer / RECmd</b> — registry</li>
<li><b>PECmd</b> — Prefetch</li><li><b>EvtxECmd</b> — Event logs</li>
<li><b>Timeline Explorer</b> — CSV timeline analizi</li><li><b>JLECmd, LECmd, SBECmd, AmcacheParser</b></li></ul>
<h3>DFIR iş axını (insident)</h3>
<ol><li>Scope: hansı sistemlər təsirlənib?</li><li>Volatile topla (RAM) — kritik sistemlərdə</li>
<li>Triage topla (KAPE) — sürətli artefaktlar</li><li>Timeline qur (super timeline)</li>
<li>Root cause: ilkin giriş necə oldu? (patient zero)</li><li>Scope dəqiqləşdir: başqa harada?</li>
<li>IOC çıxar, digər sistemləri yoxla</li><li>Hesabat + remediation</li></ol>
<div class="note">Müsahibə (senior): "Kompromis olunmuş Windows host-u araşdırmaq üçün hansı artefaktlara baxarsan?" Güclü cavab: RAM (volatile) → Prefetch/Amcache (nə işləyib) → Event logs (logon/proses) → registry Run/services/tasks (persistence) → $MFT + timeline (nə vaxt) → browser/LNK (istifadəçi fəaliyyəti). Order of volatility və chain of custody-ni qeyd et.</div>`}
],
quiz: [
{ q: "Order of volatility-yə görə əvvəl nəyi toplamalısan?", o: ["RAM (yaddaş)", "Disk", "Backup", "DVD arxiv"], a: 0, e: "Ən tez itən dəlil əvvəl." },
{ q: "Chain of custody nə üçündür?", o: ["Dəlilin hüquqi etibarı (kim/nə vaxt/necə)", "Sürət", "Disk yeri", "Şifrələmə"], a: 0, e: "Məhkəmədə etibarlılıq." },
{ q: "Write-blocker nə üçündür?", o: ["Orijinal diski dəyişdirmədən surət almaq", "Diski şifrələmək", "Faylları silmək", "Sürəti artırmaq"], a: 0, e: "Dəlil bütövlüyü." },
{ q: "RAM forensikası üçün hansı alət istifadə olunur?", o: ["Volatility", "Wireshark", "nmap", "Autopsy"], a: 0, e: "Autopsy disk üçündür." },
{ q: "Volatility malfind plugin-i nə tapır?", o: ["İnject olunmuş/şübhəli (RWX) yaddaş sahələri", "Şəbəkə portları", "Registry açarları", "Logları"], a: 0, e: "Code injection aşkarlama." },
{ q: "pslist və psscan fərqi nəyi üzə çıxarır?", o: ["Gizlədilmiş prosesləri", "Şəbəkə trafikini", "Disk ölçüsünü", "Parolları"], a: 0, e: "DKOM ilə gizlədilmiş proseslər." },
{ q: "Prefetch faylı nəyi göstərir?", o: ["Proqramın icra olunduğunu + neçə dəfə + son vaxt", "Şəbəkə bağlantısını", "Parolu", "DNS-i"], a: 0, e: "Execution dəlili." },
{ q: "$MFT nədir?", o: ["NTFS-də bütün faylların qeydi + vaxt damğaları", "RAM dump", "Firewall log", "DNS keş"], a: 0, e: "Master File Table." },
{ q: "Super timeline nədir?", o: ["Bütün artefaktların vaxt damğalarını birləşdirən xronologiya", "Şəbəkə diaqramı", "Alert siyahısı", "Parol cədvəli"], a: 0, e: "plaso/log2timeline." },
{ q: "KAPE nə üçündür?", o: ["Sürətli forensik artefakt toplama və parse (triage)", "Malware yazmaq", "DDoS", "Email"], a: 0, e: "Triage collection." },
{ q: "SRUM artefaktı nəyə kömək edir?", o: ["Proses şəbəkə/resurs istifadəsi (exfil həcmi)", "Logon", "DNS", "Parol"], a: 0, e: "System Resource Usage Monitor." },
{ q: "Timestomping-i necə aşkarlayırsan?", o: ["$SI və $FN vaxtlarının uyğunsuzluğu", "Disk ölçüsü", "RAM miqdarı", "Port sayı"], a: 0, e: "NTFS atribut fərqi." },
{ q: "Eric Zimmerman-ın PECmd aləti nəyi parse edir?", o: ["Prefetch", "Registry", "RAM", "pcap"], a: 0, e: "MFTECmd=MFT, PECmd=Prefetch, EvtxECmd=logs." },
{ q: "'Patient zero' nədir (DFIR)?", o: ["İlk kompromis olunan sistem/giriş nöqtəsi", "Son host", "Backup serveri", "Firewall"], a: 0, e: "Root cause nöqtəsi." },
{ q: "Canlı sistemdən RAM niyə əvvəl toplanır?", o: ["Söndürüləndə itir (volatile)", "Çox böyükdür", "Şifrəlidir", "Faydasızdır"], a: 0, e: "Dəyişkən dəlil." },
{ q: "Autopsy/Sleuth Kit nə üçündür?", o: ["Disk forensikası (pulsuz)", "RAM forensikası", "Şəbəkə skanı", "Email"], a: 0, e: "Fayl/disk analizi." },
{ q: "Volatility netscan plugin-i nəyi göstərir?", o: ["Yaddaşdakı şəbəkə bağlantıları (C2 aşkarlama)", "Disk faylları", "Registry", "Prefetch"], a: 0, e: "Şəbəkə artefaktları RAM-dan." },
{ q: "Amcache/Shimcache nəyin dəlilidir?", o: ["Proqram icrası (execution)", "Login", "DNS sorğusu", "Parol dəyişikliyi"], a: 0, e: "Nə işləyib." }
],
tasks: [
{ t: "Volatility addımları", d: R`<p>Kompromis host-un RAM dump-u var. Code injection olub-olmadığını yoxlamaq istəyirsən.</p>`, q: "Hansı Volatility plugin-i inject olunmuş yaddaşı tapır?", ans: ["malfind", "windows.malfind", "malfind plugin"], hint: "RWX anonim sahələr.", sol: "malfind (windows.malfind) — icra icazəli (RWX/PAGE_EXECUTE_READWRITE) anonim yaddaş sahələrini tapır, bunlar çox vaxt shellcode/inject olunmuş koddur. Tam axın: pslist/pstree (proseslər) → psscan (gizli) → cmdline → netscan (C2) → malfind (injection) → şübhəli prosesi dump et → statik analiz. malfind tapıntısını VT/sandbox ilə təsdiqlə." },
{ t: "Artefakt seçimi", d: R`<p>Bir Windows host-da 'notepad.exe hücumçu tərəfindən işlədilibmi?' sualına cavab axtarırsan (fileless/EDR yoxdur).</p>`, q: "Proqramın icra olunub-olunmadığını göstərən artefaktlardan birini yaz:", ans: ["prefetch", "amcache", "shimcache", "srum", "userassist"], hint: "Execution artefaktları.", sol: "Prefetch (ən dəqiq: neçə dəfə + son icra vaxtı), həmçinin Amcache, Shimcache, UserAssist (GUI icra), SRUM. Bu 'execution artefaktları' EDR olmasa belə proqramın işlədiyini sübut edir. PECmd ilə Prefetch parse et, Timeline Explorer-də bax. Prefetch söndürülə bilər (SSD-lərdə bəzən), ona görə bir neçə mənbəni çarpaz yoxla." },
{ t: "Timeline məntiqi", d: R`<p>Super timeline-da bu ardıcıllığı görürsən:</p><pre>08:14  email əlavəsi 'cv.docm' endirildi (browser)
08:15  WINWORD.EXE cv.docm açdı (Prefetch)
08:15  powershell.exe icra (Prefetch + 4688)
08:16  update.exe yaradıldı C:\Users\Public (MFT)
08:17  Run registry açarına 'update' yazıldı
08:20  185.x.x.x:443 bağlantı (SRUM/netflow)</pre>`, q: "Bu hücumda 'patient zero' (ilkin giriş) nə oldu? (qısa)", ans: ["__any__"], hint: "İlk zərərli hadisə.", sol: "Patient zero: phishing email əlavəsi (cv.docm makro sənədi, 08:14-15). Root cause = istifadəçi zərərli əlavəni açdı. Timeline tam zənciri göstərir: phishing (T1566) → makro icra (Word→PowerShell, T1059.001) → payload drop (update.exe, T1105) → persistence (Run key, T1547.001) → C2 (T1071.001). Timeline DFIR-ın ürəyidir — 'nə vaxt nə oldu' sualına dəqiq cavab verir. IOC-ları çıxarıb digər hostları yoxla." },
{ t: "DFIR lab (praktika)", d: R`<p>Forensik bacarıq qazan — bu sahə yüksək maaşlıdır.</p>`, steps: ["Eric Zimmerman alətlərini və Autopsy-ni endir (pulsuz)", "Volatility 3 quraşdır və pulsuz nümunə RAM dump tap (məs. 'Volatility sample memory images', MemLabs)", "pslist, pstree, cmdline, netscan, malfind plugin-lərini bir nümunədə işlət", "CyberDefenders.org-da pulsuz 'Memory Forensics' və 'Disk Forensics' tapşırığı həll et", "KAPE ilə öz test VM-indən triage topla, Prefetch/MFT-ni parse et", "TryHackMe 'Volatility', 'Windows Forensics 1&2', 'Autopsy' otaqlarını et", "plaso ilə kiçik super timeline qur və Timeline Explorer-də analiz et"], sol: "DFIR (GCFA/GNFA sertifikatları) sahəsi yüksək tələbat və maaşa malikdir. CyberDefenders və MemLabs real forensik ssenariləri verir. Volatility + Eric Zimmerman alətləri + timeline analizi DFIR analitikin əsas silahlarıdır." }
]
},
// =====================================================================
{
id: "l3-re", level: "L3", title: "Malware Reverse Engineering (əsaslar)",
intro: "Zərərli kodu dərindən anlamaq: assembly, statik/dinamik RE, debugging, unpacking və C2 çıxarma.",
lessons: [
{ title: "RE üçün əsaslar: assembly və PE strukturu", html: R`
<p>Reverse engineering — kompilyasiya olunmuş kodu geri təhlil edib necə işlədiyini anlamaqdır. L3 üçün əsas bacarıq (xüsusən malware/detection engineering rollarında).</p>
<h3>x86/x64 assembly əsasları</h3>
<ul><li><b>Registrlər:</b> EAX/RAX (nəticə/akkumulyator), EBX, ECX (sayğac), EDX, ESI/EDI (mənbə/təyinat), ESP (stack pointer), EBP (base pointer), EIP/RIP (instruction pointer)</li>
<li><b>Əsas təlimatlar:</b> MOV (köçür), PUSH/POP (stack), CALL/RET (funksiya), JMP/JE/JNE/JZ (keçid), CMP/TEST (müqayisə), ADD/SUB/XOR, LEA</li>
<li><b>Calling conventions:</b> funksiyalara arqumentlərin necə ötürülməsi (stack/registr)</li>
<li><b>Stack:</b> LIFO; funksiya çağırışları, lokal dəyişənlər, qayıdış ünvanları</li></ul>
<h3>PE (Portable Executable) strukturu</h3>
<ul><li><b>DOS header</b> (MZ), <b>PE header</b>, <b>Optional header</b> (EntryPoint, ImageBase)</li>
<li><b>Sections:</b> .text (kod), .data (məlumat), .rdata (read-only, importlar/strings), .rsrc (resurslar), .reloc</li>
<li><b>Import Address Table (IAT)</b> — istifadə olunan API funksiyaları (niyyət göstərir)</li>
<li><b>Export Table</b> — DLL-in təqdim etdiyi funksiyalar</li></ul>
<div class="tip">Hər şeyi sətir-sətir anlamaq lazım deyil. Malware RE-də məqsəd çox vaxt: "bu nə edir, C2 haradadır, IOC-lar nələrdir, necə aşkarlayarıq?" — yüksək səviyyəli davranışı çıxarmaq. Dekompilyatorlar (Ghidra) assembly-ni C-yə bənzər koda çevirərək bunu asanlaşdırır.</div>`},
{ title: "Alətlər: Ghidra, IDA, x64dbg", html: R`
<table><tr><th>Alət</th><th>Növ</th><th>Qeyd</th></tr>
<tr><td><b>Ghidra</b></td><td>Disassembler + decompiler</td><td>Pulsuz (NSA), güclü — başlanğıc üçün ideal</td></tr>
<tr><td><b>IDA Pro / IDA Free</b></td><td>Disassembler + decompiler</td><td>Sənaye standartı (pullu; Free məhdud)</td></tr>
<tr><td><b>x64dbg / x32dbg</b></td><td>Debugger</td><td>Pulsuz, dinamik (Windows)</td></tr>
<tr><td><b>Binary Ninja, Radare2/Cutter</b></td><td>Disassembler</td><td>Alternativlər</td></tr>
<tr><td><b>dnSpy / ILSpy</b></td><td>.NET decompiler</td><td>C#/.NET malware üçün (demək olar ki, mənbə kod)</td></tr>
<tr><td><b>PEStudio, Detect It Easy (DIE)</b></td><td>PE analiz</td><td>Statik triage, packer aşkarlama</td></tr></table>
<h3>Statik RE iş axını</h3>
<ol><li>PEStudio/DIE: packer, imports, strings, entropiya</li><li>Packed-dirsə unpack et</li>
<li>Ghidra-da yüklə, entry point-dən başla</li><li>İmport olunan API-lərə görə əsas funksiyaları tap (şəbəkə, crypto, fayl)</li>
<li>String referanslarını izlə (C2 domen/URL, mutex, açarlar)</li><li>Decompiler ilə məntiqi anla</li>
<li>IOC-lar və davranışı çıxar</li></ol>
<h3>Dinamik RE / debugging</h3>
<p>x64dbg ilə malware-i addım-addım icra et: breakpoint qoy (API çağırışlarında — CreateProcess, WinHTTP, CryptEncrypt), registr/yaddaşa bax, şifrə/encoding real vaxtda açıl. Statik analiz çətin (obfuscated) olanda dinamik kömək edir.</p>`},
{ title: "Obfuscation, packing və unpacking", html: R`
<p>Malware müəllifləri analizi çətinləşdirmək üçün kodu gizlədir.</p>
<h3>Texnikalar</h3>
<ul><li><b>Packing:</b> kodu sıxışdırıb/şifrələyib runtime-da açmaq (UPX, Themida, VMProtect). Statik strings/imports gizlənir.</li>
<li><b>Obfuscation:</b> mənasız kod, string şifrələmə, control flow qarışdırma, junk təlimatlar</li>
<li><b>Anti-debugging:</b> IsDebuggerPresent, PEB yoxlaması, timing (RDTSC), int 2D/3</li>
<li><b>Anti-VM/sandbox:</b> VM artefaktları yoxlaması, sleep, istifadəçi fəaliyyəti gözləmə</li>
<li><b>API hashing:</b> API adlarını string yox, hash ilə çağırmaq (import gizlətmə)</li></ul>
<h3>Unpacking yanaşmaları</h3>
<ul><li><b>Məlum packer:</b> UPX → <code>upx -d</code>. Avtomatik unpacker-lər.</li>
<li><b>Manual:</b> x64dbg-də "OEP" (Original Entry Point)-ə qədər işlət (tail jump tap), sonra yaddaşdan dump et (Scylla ilə IAT bərpa).</li>
<li><b>Yaddaşdan çıxarma:</b> malware runtime-da öz gerçək kodunu açır — həmin anda RAM-dan dump et (yaddaş forensikası ilə də).</li></ul>
<h3>Anti-analizi aşmaq</h3>
<p>Debugger-i gizlət (ScyllaHide), VM artefaktlarını maskala, timing yoxlamalarını patch et (JMP ilə keç), API hashing-i həll et (hash → funksiya cədvəli). Bu, "pişik-siçan" oyunudur.</p>
<div class="warn">RE həmişə tam izolyasiya olunmuş labda. Dinamik analizdə malware real işləyir — şəbəkəni idarə et (INetSim/FakeNet), snapshot-dan istifadə et, host-u qoru.</div>`},
{ title: "RE-dən detection və IOC çıxarmaq", html: R`
<p>Malware RE-nin SOC məqsədi: <b>davamlı detection və IOC yaratmaq</b>.</p>
<h3>RE-dən nə çıxarırıq?</h3>
<ul><li><b>C2 infrastrukturu:</b> domen/IP/URL (hardcoded və ya DGA alqoritmi)</li>
<li><b>Konfiqurasiya:</b> malware config (açarlar, C2, kampaniya ID) — çox vaxt şifrəli, RE ilə açılır</li>
<li><b>Mutex, fayl adları, registry açarları:</b> host IOC-ları</li>
<li><b>Şifrələmə/encoding sxemi:</b> trafiki deşifrə etmək üçün</li>
<li><b>Davranış/TTP-lər:</b> necə persistence qurur, nə oğurlayır, necə yayılır</li>
<li><b>YARA imzaları:</b> unikal bayt/string nümunələri (digər nümunələri tutmaq)</li></ul>
<h3>DGA reversing</h3>
<p>Malware domen generasiya alqoritmini (DGA) RE ilə çıxarıb gələcək domenləri əvvəlcədən hesablamaq → onları bloklamaq/sinkhole etmək olar. Güclü proaktiv müdafiə.</p>
<h3>Config extraction</h3>
<p>Bir çox malware ailəsi üçün icma "config extractor"-ları var (nümunədən C2/açarları avtomatik çıxarır). RE biliyi öz extractor-unu yazmağa imkan verir.</p>
<h3>YARA qaydası yazmaq (RE-dən)</h3>
<pre>rule MALWARE_ExampleFamily {
  meta:
    description = "Example family detection"
    author = "SOC Mentor"
  strings:
    $mutex = "Global\\xZ9k_lock"
    $c2 = "c2-panel.top"
    $code = { 55 8B EC 83 EC ?? 56 57 8B 7D 08 }  // unikal funksiya başlanğıcı
  condition:
    uint16(0) == 0x5A4D and 2 of them    // MZ başlıq + 2 nümunə
}</pre>
<div class="note">Müsahibə (senior/RE): "Malware-dən nə çıxararsan?" Güclü cavab: C2 (hardcoded/DGA), config, host IOC-lar (mutex/fayl/registry), encoding sxemi, TTP-lər və bunlardan YARA/Sigma detection + bloklama. "RE-nin məqsədi təkcə anlamaq deyil, davamlı müdafiə yaratmaqdır" fikrini vurğula.</div>`}
],
quiz: [
{ q: "Reverse engineering nədir?", o: ["Kompilyasiya olunmuş kodu geri təhlil edib anlamaq", "Kod yazmaq", "Şəbəkə qurmaq", "Parol qırmaq"], a: 0, e: "Malware-in necə işlədiyini anlamaq." },
{ q: "x86-da EIP/RIP registri nədir?", o: ["Instruction pointer (növbəti təlimat)", "Stack pointer", "Nəticə", "Sayğac"], a: 0, e: "İcra axınını idarə edir." },
{ q: "PE faylında .text bölməsi nəyi saxlayır?", o: ["İcra olunan kodu", "Resursları", "İmportları", "Mətn sənədini"], a: 0, e: "Kod bölməsi." },
{ q: "IAT (Import Address Table) nəyi göstərir?", o: ["İstifadə olunan API funksiyaları (niyyət)", "Şifrələmə açarı", "Fayl hashini", "DNS qeydini"], a: 0, e: "Davranış haqqında ipucu." },
{ q: "Ghidra nədir?", o: ["Pulsuz disassembler + decompiler (NSA)", "Antivirus", "Firewall", "SIEM"], a: 0, e: "RE üçün başlanğıc aləti." },
{ q: ".NET malware üçün hansı alət 'demək olar ki mənbə kod' verir?", o: ["dnSpy / ILSpy", "Wireshark", "Volatility", "nmap"], a: 0, e: ".NET decompiler." },
{ q: "x64dbg nə üçündür?", o: ["Dinamik analiz / debugging", "Disk forensikası", "Şəbəkə skanı", "Email"], a: 0, e: "Addım-addım icra." },
{ q: "Packing nə edir?", o: ["Kodu sıxışdırıb/şifrələyib statik analizi çətinləşdirir", "Faylı silir", "Şəbəkə qurur", "Log yazır"], a: 0, e: "UPX, Themida." },
{ q: "OEP (Original Entry Point) nədir?", o: ["Unpack olunduqdan sonra əsl kodun başlanğıcı", "Son təlimat", "Şəbəkə portu", "Registry açarı"], a: 0, e: "Manual unpacking hədəfi." },
{ q: "API hashing nə üçündür?", o: ["API adlarını hash ilə çağırıb importları gizlətmək", "Faylı şifrələmək", "Sürəti artırmaq", "Log yazmaq"], a: 0, e: "Statik import gizlətmə." },
{ q: "Anti-debugging texnikası hansıdır?", o: ["IsDebuggerPresent / PEB yoxlaması", "Fayl endirmə", "DNS sorğusu", "Backup"], a: 0, e: "Təhlili çətinləşdirmək." },
{ q: "UPX-i unpack etmək üçün sadə yol?", o: ["upx -d", "upx -c", "rm upx", "upx -z"], a: 0, e: "Məlum packer avtomatik açılır." },
{ q: "DGA reversing nə verir?", o: ["Gələcək C2 domenlərini əvvəlcədən hesablayıb bloklamaq", "Faylı silmək", "RAM dump", "Parol"], a: 0, e: "Proaktiv müdafiə." },
{ q: "Malware config extraction nədir?", o: ["Nümunədən C2/açar/kampaniya ID çıxarmaq", "Faylı şifrələmək", "Backup almaq", "Log silmək"], a: 0, e: "Çox vaxt şifrəli config RE ilə açılır." },
{ q: "YARA qaydasında uint16(0) == 0x5A4D nəyi yoxlayır?", o: ["MZ (PE başlıq) imzasını", "Fayl ölçüsünü", "C2 domenini", "Hash-i"], a: 0, e: "Windows executable başlığı." },
{ q: "Malware RE-nin SOC məqsədi nədir?", o: ["Davamlı detection və IOC yaratmaq", "Malware yaymaq", "Sadəcə maraq", "Log silmək"], a: 0, e: "Müdafiəyə çevirmək." },
{ q: "Scylla nə üçündür?", o: ["Unpacking-dən sonra IAT bərpası", "Şəbəkə skanı", "Email", "DNS"], a: 0, e: "Manual unpacking köməkçisi." },
{ q: "RE labında şəbəkə niyə idarə olunur (INetSim/FakeNet)?", o: ["Malware real C2-yə çatmasın, amma davranışı görünsün", "Sürət üçün", "Pulsuz internet", "Backup"], a: 0, e: "Təhlükəsiz dinamik analiz." }
],
tasks: [
{ t: "Import-dan funksiya təyini", d: R`<p>Ghidra-da malware-in IAT-ında bunları görürsən: InternetOpenUrlA, HttpSendRequestA, CreateMutexA, RegCreateKeyExA.</p>`, q: "CreateMutexA hansı məqsədə xidmət edir (malware kontekstində)?", ans: ["__any__"], hint: "Təkrar işləməməyi təmin edən identifikator.", sol: "CreateMutexA — malware adətən unikal mutex yaradır ki, eyni maşında iki dəfə işləməsin (və ya 'artıq yoluxub' yoxlaması). Mutex adı dəyərli HOST IOC-dur (məs. 'Global\\\\xZ9k_lock' — YARA/EDR ilə tutula bilər). Digər importlar: InternetOpenUrl/HttpSendRequest = C2 əlaqə, RegCreateKeyEx = persistence. Bu import profili davranışı statik olaraq açır." },
{ t: "RE-dən IOC", d: R`<p>Malware-i RE etdin və tapdın: hardcoded C2 'api.weather-sync[.]cc', mutex 'Global\\WUpd_v3', config açarı XOR 0x42 ilə şifrəli, Run açarı 'WeatherUpdater'.</p>`, q: "Bu nümunədən neçə fərqli növ host/şəbəkə IOC çıxardın (C2, mutex, registry açarı)?", ans: ["3"], hint: "C2 domen, mutex, registry açarı.", sol: "3+ IOC: (1) şəbəkə — C2 domen api.weather-sync[.]cc; (2) host — mutex Global\\WUpd_v3; (3) host — Run açarı 'WeatherUpdater'. Əlavə: XOR 0x42 encoding sxemi (trafiki/config deşifrə etmək üçün). Bunlardan: firewall/proxy blok (C2), YARA (mutex/strings), Sigma (Run key persistence), EDR watchlist. RE davamlı, çoxqatlı detection verir." },
{ t: "YARA məntiqi", d: R`<pre>rule Example {
  strings:
    $a = "c2-panel.top"
    $b = "Global\\xZ9k"
  condition:
    uint16(0) == 0x5A4D and all of them
}</pre>`, q: "Bu qayda tutması üçün fayl hansı şərtlərin HAMISINI ödəməlidir? (qısa)", ans: ["__any__"], hint: "MZ başlıq + hər iki string.", sol: "Fayl: (1) PE/Windows executable olmalı (uint16(0)==0x5A4D = MZ başlığı) VƏ (2) HƏM 'c2-panel.top' HƏM 'Global\\xZ9k' stringlərini ehtiva etməli (all of them). İki unikal string + fayl tipi yoxlaması FP-ni azaldır. Əgər '2 of them' yox 'all of them' olsaydı daha dar olardı. YARA qaydaları RE-dən çıxarılan unikal nümunələrlə malware ailəsini tutur." },
{ t: "RE lab (praktika)", d: R`<p>Reverse engineering-ə giriş. Bu bacarıq nadir və yüksək dəyərlidir.</p>`, steps: ["Ghidra və x64dbg quraşdır (pulsuz), izolyasiya VM-də", "'Crackme' tapşırıqları ilə başla (crackmes.one) — zərərsiz RE məşqləri", "TryHackMe 'Intro to x86-64', 'Reversing ELF', 'Windows Reversing' otaqlarını et", "OpenSecurityTraining2 və ya 'Practical Malware Analysis' kitabı (sənaye klassiki) ilə öyrən", "Sadə bir .NET nümunəsini dnSpy ilə aç (demək olar ki mənbə kod)", "RE-dən YARA qaydası yazmağı məşq et", "QEYD: real malware yalnız tam izolyasiya + təcrübə ilə"], sol: "Malware RE (GREM sertifikatı) ən dərin və yüksək maaşlı blue team bacarıqlarındandır. 'Practical Malware Analysis' kitabı qızıl standartdır. Başlanğıcda crackme-lər və .NET nümunələri ilə başla — assembly-ni tədricən öyrən. Bu bacarıq detection engineering və DFIR-ı kəskin gücləndirir." }
]
},
// =====================================================================
{
id: "l3-leadership", level: "L3", title: "Purple Team, SOC idarəçiliyi və avtomatlaşdırma",
intro: "Senior səviyyə: purple teaming, adversary emulation, SOC metrikaları, avtomatlaşdırma, mentorluq və karyera.",
lessons: [
{ title: "Purple Teaming və Adversary Emulation", html: R`
<p><b>Purple teaming</b> — Red (hücum) və Blue (müdafiə) komandaların birgə, əməkdaşlıqlı işi: hücum texnikaları icra olunur, müdafiənin onları aşkar/bloklaya bildiyi yoxlanılır, boşluqlar düzəldilir.</p>
<h3>Adversary emulation</h3>
<p>Real təhdid aktorlarının (TTP-lərinin) ssenariyə əsaslanan təqlidi. Məqsəd: "bizim müdafiəmiz bu konkret aktora qarşı nə qədər effektivdir?"</p>
<ul><li><b>MITRE ATT&CK</b> ssenari əsası</li>
<li><b>Atomic Red Team</b> — tək texnikaların təhlükəsiz testi</li>
<li><b>CALDERA</b> (MITRE) — avtomatlaşdırılmış emulation platforması</li>
<li><b>Red Canary, Prelude, Vectr</b> — emulation/track alətləri</li>
<li><b>Caldera, Atomic</b> ilə detection validation</li></ul>
<h3>Purple team dövrü</h3>
<ol><li>Ssenari seç (ATT&CK/TI əsaslı aktor)</li><li>Red texnikanı icra edir (idarə olunan, sənədləşdirilmiş)</li>
<li>Blue aşkarlamağa çalışır (real vaxtda)</li><li>Nəticə: tutuldumu? Hansı mərhələdə? Alert yarandımı?</li>
<li>Boşluğu düzəlt (yeni detection/logging)</li><li>Təkrar test (regresiya)</li></ol>
<h3>Detection validation</h3>
<p>"Bizim detection-ımız həqiqətən işləyirmi?" sualına əmin cavab yalnız test ilə verilir. Purple team coverage-ı real, nəzəri yox, sübut edilmiş edir. ATT&CK Navigator ilə "yaşıl" (tutulur) / "qırmızı" (boşluq) texnikaları xəritələ.</p>
<div class="note">Purple team Red-ə qarşı "qalib gəlmək" deyil — <b>müdafiəni yaxşılaşdırmaq</b> məqsədi daşıyır. Ən yaxşı nəticə: hər boşluğun bağlanması. Əməkdaşlıq, rəqabət deyil.</div>`},
{ title: "SOC metrikaları, idarəçiliyi və yetkinlik", html: R`
<h3>Əsas SOC metrikaları (KPI)</h3>
<table><tr><th>Metrika</th><th>Nəyi ölçür</th></tr>
<tr><td><b>MTTD</b></td><td>Aşkarlamaya qədər orta vaxt</td></tr>
<tr><td><b>MTTR</b></td><td>Cavaba/bərpaya qədər orta vaxt</td></tr>
<tr><td><b>MTTA</b></td><td>Alertə reaksiyaya qədər orta vaxt</td></tr>
<tr><td><b>Alert həcmi / analitik</b></td><td>İş yükü, tükənmə riski</td></tr>
<tr><td><b>False positive nisbəti</b></td><td>Detection keyfiyyəti</td></tr>
<tr><td><b>Dwell time</b></td><td>Hücumçunun qalma müddəti</td></tr>
<tr><td><b>Coverage (ATT&CK)</b></td><td>Detection əhatəsi</td></tr>
<tr><td><b>Escalation accuracy</b></td><td>Eskalasiyaların düzgünlüyü</td></tr></table>
<p><b>Diqqət:</b> metrikalar düzgün istifadə olunmalıdır. "Daha çox alert bağlandı" yaxşı deyil əgər keyfiyyət aşağıdırsa. Metrikalar davranışı formalaşdırır — səhv metrika səhv davranış yaradır (məs. analitik tez bağlamaq üçün araşdırmadan close edər).</p>
<h3>SOC yetkinlik (maturity)</h3>
<p>Reaktiv (yalnız alert) → proaktiv (hunting, detection engineering) → optimallaşdırılmış (avtomatlaşdırma, threat-informed, davamlı təkmilləşmə). SOC-CMM yetkinlik modeli ilə qiymətləndirilir.</p>
<h3>Burnout və komanda sağlamlığı</h3>
<p>SOC yüksək stresli (növbə, alert fatigue, təzyiq). Senior analitik/lead burnout əlamətlərini tanımalı, iş yükünü balanslaşdırmalı, avtomatlaşdırma ilə təkrarlığı azaltmalı, komandaya mentorluq etməlidir. Yüksək kadr dövriyyəsi SOC-un əsas problemidir.</p>
<h3>Rəhbərliklə ünsiyyət</h3>
<p>Senior səviyyədə texniki detalı biznes dilinə çevirmək lazımdır: "risk nədir, biznesə təsiri nədir, nə qədər xərc/fayda?" CISO/rəhbərlik risk və resurs dilində düşünür, CVE/Event ID dilində yox.</p>`},
{ title: "Avtomatlaşdırma, SOAR və Detection-as-Code", html: R`
<h3>Niyə avtomatlaşdırma?</h3>
<p>İnsan vaxtı dəyərlidir. Təkrarlanan işləri (IOC yoxlama, FP triage, zənginləşdirmə, containment) avtomatlaşdırıb analitiki real təhlilə fokuslamaq.</p>
<h3>SOAR istifadə sahələri</h3>
<ul><li><b>Enrichment:</b> alert gələndə avtomatik IOC-ları TI/VT/AbuseIPDB-də yoxla, kontekst əlavə et</li>
<li><b>Auto-triage:</b> məlum FP nümunələrini avtomatik bağla; yüksək-etibarlı TP-ləri eskalasiya et</li>
<li><b>Response:</b> host izolyasiyası, hesab deaktiv, IP blok (insan təsdiqi ilə kritik olanlar)</li>
<li><b>Orchestration:</b> alətlər arası iş axını (SIEM → EDR → ticketing → chat)</li>
<li><b>Case management:</b> avtomatik ticket, IOC toplama</li></ul>
<h3>Scripting və API-lər</h3>
<p>Python senior SOC-un əsas dilidir: log parsing (pandas), API inteqrasiyası (SIEM, TI, EDR), avtomatlaşdırma, data analizi (hunting). PowerShell Windows/AD üçün. Nümunə: VT API ilə 1000 hash-i avtomatik yoxlayan skript; yeni IOC-ları bütün alətlərə push edən pipeline.</p>
<h3>Detection-as-Code (DaC)</h3>
<ul><li>Qaydalar Git-də (versiya, review, tarixçə)</li><li>CI/CD ilə test və deploy</li>
<li>Avtomatik test (Atomic ilə validation)</li><li>Sigma → çox SIEM-ə çevrilmə (pySigma)</li>
<li>Kod keyfiyyəti standartları (sənədləşdirmə, FP qeydləri, ATT&CK tags)</li></ul>
<div class="warn"><b>Avtomatlaşdırmada diqqət:</b> avtomatik response (host izolyasiyası, hesab blok) səhv işləsə biznesi poza bilər. Kritik tədbirlərdə "insan təsdiqi" (human-in-the-loop) saxla. Avtomatlaşdırmanı tədricən, etibar qazandıqca genişləndir.</div>`},
{ title: "Karyera, sertifikatlar və davamlı inkişaf", html: R`
<h3>Təbriklər — tam yolu keçdin!</h3>
<p>L1-dən L3-ə qədər: əsaslar → müstəqil təhqiqat/detection → threat hunting/forensika/RE/liderlik. İndi real inkişaf təcrübə, davamlı öyrənmə və ixtisaslaşma ilə davam edir.</p>
<h3>İxtisaslaşma yolları (L3+)</h3>
<ul><li><b>DFIR</b> (forensika/IR) — GCFA, GCFE, GNFA, GREM</li>
<li><b>Threat Hunting</b> — GCTI, eCTHPv2</li><li><b>Detection Engineering</b></li>
<li><b>Malware RE</b> — GREM</li><li><b>Threat Intelligence (CTI)</b> — GCTI</li>
<li><b>Red Team/Offensive</b> (müdafiəni anlamaq üçün) — OSCP, CRTO</li>
<li><b>Cloud Security</b> — cloud detection/forensics</li><li><b>SOC Lead/Management</b></li></ul>
<h3>Sertifikat yolu (ümumi)</h3>
<ul><li><b>Başlanğıc:</b> CompTIA Security+, Network+, BTL1 (Blue Team Level 1 — çox praktik), Google Cybersecurity Cert</li>
<li><b>Orta:</b> CySA+, BTL2, GCIH, GSEC, eJPT (offensive baxış)</li>
<li><b>Qabaqcıl:</b> GCFA, GNFA, GREM, GCTI, OSCP, CISSP (menecment)</li></ul>
<h3>Praktiki platformalar (sertifikatdan əlavə, bəzən daha dəyərli)</h3>
<p>TryHackMe, LetsDefend, Blue Team Labs Online, CyberDefenders, Hack The Box (Blue), RangeForce, Splunk BOTS, malware-traffic-analysis.net. Bu platformalardakı profil + GitHub portfeli işə götürənlər üçün real bacarıq sübutudur.</p>
<h3>Davamlı öyrənmə mədəniyyəti</h3>
<ul><li>Təhdidlər daim dəyişir — öyrənmə heç vaxt bitmir</li>
<li>İcma: Twitter/X infosec, Reddit (r/blueteamsec, r/cybersecurity), Discord-lar, yerli konfranslar/BSides</li>
<li>Blog yaz, CTF-lərdə iştirak et, öz lab-ını qur və genişləndir</li>
<li>Oxu: təhdid hesabatları (Mandiant, CrowdStrike, Talos), ATT&CK yenilikləri</li>
<li>Mentor ol və mentor tap</li></ul>
<div class="note"><b>Son söz:</b> Bu proqram sənə struktur və bilik verdi, amma əsl ustalıq <b>praktikada</b> gəlir. Hər gün bir az: oxu, lab-da sına, qeyd apar, icma ilə əlaqə saxla. Etikadan əsla çıxma — bu bacarıqlar güclüdür, yalnız qanuni və icazəli şəkildə istifadə et. Uğurlar, gələcək SOC analitiki! 🛡️</div>`}
],
quiz: [
{ q: "Purple teaming nədir?", o: ["Red və Blue komandaların birgə işi ilə müdafiəni yaxşılaşdırmaq", "Yeni hücum komandası", "Fiziki təhlükəsizlik", "Hüquqi komanda"], a: 0, e: "Əməkdaşlıq, rəqabət deyil." },
{ q: "Adversary emulation nə üçündür?", o: ["Real aktorun TTP-lərini təqlid edib müdafiəni yoxlamaq", "Real hücum etmək", "Malware yaymaq", "DDoS"], a: 0, e: "Müdafiə validasiyası." },
{ q: "CALDERA nədir?", o: ["MITRE-nin avtomatlaşdırılmış adversary emulation platforması", "Antivirus", "SIEM", "Firewall"], a: 0, e: "Emulation aləti." },
{ q: "MTTD nəyi ölçür?", o: ["Aşkarlamaya qədər orta vaxt", "Cavab vaxtı", "Alert sayı", "FP nisbəti"], a: 0, e: "Mean Time To Detect." },
{ q: "MTTR nəyi ölçür?", o: ["Cavaba/bərpaya qədər orta vaxt", "Aşkarlama vaxtı", "Log ölçüsü", "Alert rəngi"], a: 0, e: "Mean Time To Respond." },
{ q: "Metrikaların riski nədir?", o: ["Səhv metrika səhv davranış yaradır (keyfiyyətsiz tez bağlama)", "Risk yoxdur", "Çox yavaşdır", "Pulludur"], a: 0, e: "Metrikalar davranışı formalaşdırır." },
{ q: "SOAR-ın əsas faydası nədir?", o: ["Təkrarlanan işləri avtomatlaşdırıb analitiki real təhlilə fokuslamaq", "Malware yaratmaq", "Logları silmək", "Server qurmaq"], a: 0, e: "Orchestration & Automation." },
{ q: "Avtomatik response-da niyə 'human-in-the-loop' vacibdir?", o: ["Səhv avtomatik tədbir biznesi poza bilər (kritik hallarda)", "Daha sürətlidir", "Pulsuzdur", "Lazım deyil"], a: 0, e: "Kritik tədbirlərdə insan təsdiqi." },
{ q: "Senior SOC-da əsas scripting dili hansıdır?", o: ["Python", "HTML", "CSS", "PHP"], a: 0, e: "Log parsing, API, avtomatlaşdırma." },
{ q: "Detection-as-Code nə deməkdir?", o: ["Qaydaları Git + test + CI/CD ilə kod kimi idarə etmək", "Malware yazmaq", "Manual qayda", "Log silmək"], a: 0, e: "Versiya nəzarəti + avtomatik test." },
{ q: "Dwell time-ı azaltmaq niyə vacibdir?", o: ["Hücumçunun zərər vurma imkanı azalır", "Disk yeri", "Sürət", "Lisenziya"], a: 0, e: "Erkən aşkarlama = az zərər." },
{ q: "Burnout SOC-da niyə problem­dir?", o: ["Yüksək kadr dövriyyəsi və aşağı performans yaradır", "Problem deyil", "Sürəti artırır", "Logları silir"], a: 0, e: "Komanda sağlamlığı kritikdir." },
{ q: "Rəhbərliklə ünsiyyətdə senior analitik nə etməlidir?", o: ["Texniki detalı biznes/risk dilinə çevirmək", "Yalnız CVE nömrələri saymaq", "Jarqon işlətmək", "Heç nə izah etməmək"], a: 0, e: "CISO risk dilində düşünür." },
{ q: "Blue team üçün praktik başlanğıc sertifikatı hansıdır?", o: ["BTL1 (Blue Team Level 1) / Security+", "OSCP", "CISSP", "GREM"], a: 0, e: "Praktik, əlçatan." },
{ q: "Malware RE üçün sertifikat hansıdır?", o: ["GREM", "Security+", "Network+", "CCNA"], a: 0, e: "GIAC Reverse Engineering Malware." },
{ q: "Sertifikatdan əlavə iş tapmaqda nə çox dəyərlidir?", o: ["Praktiki platforma profili + GitHub portfeli (real bacarıq sübutu)", "Yalnız diplom", "Yaş", "Heç nə"], a: 0, e: "TryHackMe/LetsDefend/CyberDefenders + portfel." },
{ q: "Davamlı öyrənmə niyə SOC-da vacibdir?", o: ["Təhdidlər daim dəyişir — bilik köhnəlir", "Lazım deyil", "Yalnız sertifikat üçün", "Maaş üçün"], a: 0, e: "Öyrənmə heç vaxt bitmir." },
{ q: "Purple team-in ən yaxşı nəticəsi nədir?", o: ["Hər detection boşluğunun bağlanması", "Red-in məğlub olması", "Blue-nun qalib gəlməsi", "Daha çox alert"], a: 0, e: "Müdafiənin yaxşılaşması." }
],
tasks: [
{ t: "Purple team ssenarisi", d: R`<p>Red komanda T1003.001 (LSASS dump) texnikasını icra etdi. Blue komanda heç bir alert almadı.</p>`, q: "Bu purple team nəticəsinin əsas dəyəri nədir? (qısa)", ans: ["__any__"], hint: "Detection boşluğu aşkarlandı.", sol: "Detection boşluğu aşkarlandı — LSASS dump (kritik credential access texnikası) tutulmur! Bu çox dəyərli: dərhal Sysmon Event 10 (lsass ProcessAccess) detection qaydası yaz/aktivləşdir, sonra texnikanı təkrar icra edib tutulduğunu təsdiqlə (regression test). Purple team-in məqsədi məhz budur: boşluğu tap → bağla → doğrula. 'Alert almadıq' uğursuzluq deyil, öyrənmə fürsətidir." },
{ t: "Metrika təhlili", d: R`<p>SOC rəhbəri deyir: 'Analitiklərimiz gündə 500 alert bağlayır, əladır!' Amma dwell time artır və bir neçə real insident buraxılıb.</p>`, q: "Burada hansı metrika problemi var? (qısa)", ans: ["__any__"], hint: "Kəmiyyət vs keyfiyyət.", sol: "Problem: kəmiyyət metrikası (bağlanan alert sayı) keyfiyyəti gizlədir. Analitiklər çox alert bağlamaq üçün araşdırmadan/tələsik close edir → real insidentlər FP kimi bağlanır → dwell time artır. Düzgün metrikalar: detection accuracy, FN sayı, dwell time, escalation accuracy. 'Çox bağladıq' yaxşı deyil əgər doğru bağlamırıqsa. Metrika davranışı formalaşdırır — düzgün metrika seç." },
{ t: "Avtomatlaşdırma ideyası", d: R`<p>Analitiklər hər alertdə eyni işi edir: IOC-ları (IP, hash, domen) əl ilə VT, AbuseIPDB və urlscan-da yoxlayır. Bu, hər alertdə 5-10 dəqiqə alır.</p>`, q: "SOAR ilə bunu necə yaxşılaşdırardın? (qısa)", ans: ["__any__"], hint: "Avtomatik enrichment.", sol: "SOAR playbook: alert gələndə avtomatik IOC-ları çıxar → VT/AbuseIPDB/urlscan API-lərində yoxla → nəticələri (reputasiya, skor) alertə/ticketə əlavə et → yüksək-riskliləri prioritetlə, məlum-təmizləri aşağı sal. Analitik artıq hazır kontekstlə işə başlayır (5-10 dəq → saniyələr). Bu, 'enrichment automation' — SOAR-ın ən geniş istifadəsi. Analitik vaxtını real təhlilə yönəldir." },
{ t: "Capstone: karyera planı və portfel (praktika)", d: R`<p>Proqramın sonu — indi real karyera qur.</p>`, steps: ["Bu proqramı tamamladığını qeyd et və zəif olduğun mövzulara qayıt (axtarış funksiyasından istifadə et)", "Bir praktik platforma seç və yolu tamamla: TryHackMe SOC L1/L2, LetsDefend, və ya BTL1-ə hazırlaş", "GitHub portfeli qur: yazdığın detection qaydaları (Sigma), hunt sənədləri, lab qeydləri, analiz hesabatları", "Homelab-ını genişləndir: SIEM + AD + Sysmon + nümunə hücumlar (bax: Ev laboratoriyası bölməsi)", "LinkedIn profilini yenilə, infosec icmasına qoşul (Twitter/X, Discord, yerli BSides)", "Bir sertifikata hazırlaş (Security+ və ya BTL1), sonra ixtisaslaşma seç (DFIR/Hunting/Detection/RE/CTI)", "İş müraciətinə başla: 'Müsahibə sualları' bölməsini təkrarla, STAR metodunu məşq et"], sol: "🎉 TƏBRİKLƏR — bütün proqramı tamamladın! İndi bilik + struktur var. Qalan: ardıcıl praktika, portfel, icma və sertifikat. Etikanı əsla unutma. Bu yol uzundur, amma hər addım səni gücləndirir. SOC analitik olmaq üçün lazım olan hər şey artıq əlindədir — indi tətbiq et. Uğurlar! 🛡️" }
]
}
);
})();
