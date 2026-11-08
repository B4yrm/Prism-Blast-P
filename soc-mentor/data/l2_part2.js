/* L2 — Hissə 2: Malware triage, Threat Intelligence, Detection Engineering, IR Playbooklar & Phishing */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;
SOC.modules.push(
// =====================================================================
{
id: "l2-malware", level: "L2", title: "Malware triage və əsas analiz",
intro: "Şübhəli faylı təhlükəsiz şəkildə təhlil etmək: statik, dinamik (sandbox) analiz və IOC çıxarmaq.",
lessons: [
{ title: "Analiz mühiti və təhlükəsizlik qaydaları", html: R`
<div class="warn"><b>ÇOX VACİB — qızıl qaydalar:</b>
<ul><li>Malware-i yalnız <b>izolyasiya olunmuş VM-də</b> təhlil et (host-dan ayrı, snapshot-lı).</li>
<li>Şəbəkəni ayır və ya nəzarətli şəkildə (INetSim/FakeNet ilə) idarə et.</li>
<li>VM "guest additions" / paylaşılan qovluqları söndür (escape riski).</li>
<li>Həssas faylı VirusTotal-a <b>YÜKLƏMƏ</b> — yalnız hash-i axtar (yüklənən fayllar başqalarına əlçatan olur, məxfilik pozulur).</li>
<li>Təhlildən sonra snapshot-a qayıt (təmiz vəziyyət).</li></ul></div>
<h3>Analiz növləri</h3>
<table><tr><th>Növ</th><th>Təsvir</th><th>Risk</th></tr>
<tr><td><b>Statik</b></td><td>Faylı işə salmadan təhlil (metadata, strings, hash, imports)</td><td>Aşağı</td></tr>
<tr><td><b>Dinamik</b></td><td>Faylı nəzarətli mühitdə işə salıb davranışı izləmək</td><td>Orta</td></tr>
<tr><td><b>Sandbox (avtomatlaşdırılmış)</b></td><td>any.run, Joe Sandbox, Hybrid Analysis, Cuckoo</td><td>Aşağı (onlar işlədir)</td></tr>
<tr><td><b>Reverse Engineering</b></td><td>Disassembly/decompile (Ghidra, IDA) — L3 səviyyəsi</td><td>—</td></tr></table>
<p><b>L2 üçün fokus:</b> triage — "bu zərərlidirmi, nə edir, hansı IOC-lar var, nə qədər təhlükəli?" sualına tez cavab vermək. Dərin reverse engineering L3-dür.</p>
<h3>Lab alətləri</h3>
<p>Pulsuz: <b>FLARE-VM</b> (Windows malware analiz paketi), <b>REMnux</b> (Linux malware analiz distrosu), <b>INetSim/FakeNet-NG</b> (saxta internet), Wireshark, Procmon, Process Hacker.</p>`},
{ title: "Statik analiz", html: R`
<h3>Addımlar</h3>
<ol><li><b>Hash:</b> SHA256 hesabla → VirusTotal/MalwareBazaar-da axtar (məlumdursa, iş bitdi).</li>
<li><b>Fayl tipi:</b> <code>file</code> (Linux), PE olub-olmadığı. Uzantı aldada bilər (invoice.pdf.exe).</li>
<li><b>Strings:</b> <code>strings -n 8 file.exe</code> / FLOSS (obfuscated strings). Axtar: IP, URL, domen, registry açarları, əmrlər, Base64, şübhəli API adları.</li>
<li><b>PE başlıq/importlar:</b> PEStudio, pefile. İmport olunan funksiyalar niyyəti göstərir:
  <ul><li><code>URLDownloadToFile, WinHTTP, InternetOpen</code> → şəbəkə/endirmə</li>
  <li><code>CreateProcess, ShellExecute, WinExec</code> → icra</li>
  <li><code>RegSetValue</code> → persistence</li>
  <li><code>VirtualAlloc, WriteProcessMemory, CreateRemoteThread</code> → injection</li>
  <li><code>CryptEncrypt</code> → ransomware ehtimalı</li>
  <li><code>IsDebuggerPresent, GetTickCount</code> → anti-analiz</li></ul></li>
<li><b>Packer:</b> UPX, Themida — yüksək entropiya, az strings. PEiD/DIE ilə təyin et, UPX-i unpack et.</li>
<li><b>Sertifikat/metadata:</b> imzalıdırmı? Kompilyasiya vaxtı?</li></ol>
<h3>YARA ilə təsnifat</h3>
<p>YARA qaydaları faylları string/bayt nümunələrinə görə tutur. Statik analizdə məlum malware ailələrini tanımaq üçün istifadə olunur.</p>
<pre>rule Suspicious_PowerShell_Downloader {
  strings:
    $a = "DownloadString" nocase
    $b = "FromBase64String" nocase
    $c = "-enc" nocase
  condition:
    2 of them
}</pre>
<div class="tip">Office sənədləri üçün: <b>oletools</b> (olevba — makro çıxarır), <b>oledump</b>. PDF üçün: <b>pdfid, pdf-parser</b>. Bu sənəd-əsaslı malware phishing-də çox yayılıb.</div>`},
{ title: "Dinamik analiz və sandbox", html: R`
<h3>Dinamik analizdə nə izlənir?</h3>
<ul><li><b>Proseslər:</b> hansı child proseslər yaranır (Process Hacker, Procmon, Process Tree)</li>
<li><b>Fayl sistemi:</b> hansı fayllar yaradılır/silinir/dəyişir (Procmon)</li>
<li><b>Registry:</b> hansı açarlar dəyişir (persistence — Run açarları)</li>
<li><b>Şəbəkə:</b> hansı domen/IP-lərə bağlanır (Wireshark + FakeNet/INetSim)</li>
<li><b>API çağırışları:</b> davranış (API Monitor)</li></ul>
<h3>Sandbox nəticəsini oxumaq (any.run / Joe Sandbox / Hybrid Analysis)</h3>
<p>Avtomatlaşdırılmış sandbox-lar faylı işlədib hesabat verir. Bunlara bax:</p>
<ul><li><b>Verdict/score</b> (zərərli/şübhəli/təmiz)</li><li><b>Process tree</b></li>
<li><b>Network IOCs</b> (C2 domenləri, IP-lər, URL-lər)</li><li><b>Dropped files</b> (yaradılan fayllar + hashlər)</li>
<li><b>Registry/persistence dəyişiklikləri</b></li><li><b>MITRE ATT&CK mapping</b></li>
<li><b>Mutex</b> adları (eyni malware-in təkrar işləməməsini təmin edən unikal identifikator — IOC kimi faydalı)</li></ul>
<h3>Anti-analiz (evasion)</h3>
<p>Müasir malware VM/sandbox aşkar edirsə işləmir: VM artefaktları (VMware/VBox prosesləri, MAC OUI), az CPU/RAM, istifadəçi fəaliyyəti yoxluğu, debugger yoxlaması, vaxt gecikmələri (sleep), coğrafi/dil yoxlaması. Ona görə bəzən sandbox "təmiz" göstərir amma fayl zərərlidir — kontekst və birdən çox mənbə vacibdir.</p>
<div class="note"><b>Triage qərar axını:</b> hash məlumdur? → bitdi. Yox? → sandbox-a göndər + statik strings/imports → IOC çıxar → davranışa görə ailə/niyyət təyin et (downloader? stealer? ransomware?) → təhlükə səviyyəsi → detection/bloklama tövsiyəsi → sənədləşdir. Qeyd: məxfi/daxili faylı publik sandbox-a göndərmə.</div>`},
{ title: "IOC çıxarmaq və paylaşmaq", html: R`
<h3>IOC növləri və formatları</h3>
<ul><li><b>Faylı:</b> hash (MD5/SHA1/SHA256), fayl adı, yolu, ölçüsü</li>
<li><b>Şəbəkə:</b> IP, domen, URL, JA3, SSL sertifikat</li>
<li><b>Host:</b> registry açarları, mutex, servis adları, scheduled task adları</li>
<li><b>Davranış:</b> ATT&CK texnikaları (ən davamlı)</li></ul>
<h3>Defanging (təhlükəsiz paylaşım)</h3>
<p>IOC-ları paylaşarkən təsadüfən kliklənməsin deyə "defang" edilir: <code>http://evil.com</code> → <code>hxxp://evil[.]com</code>, <code>1.2.3.4</code> → <code>1[.]2[.]3[.]4</code>, <code>bad@mail.com</code> → <code>bad[@]mail[.]com</code>. CyberChef-də "Defang URL/IP" resepti var.</p>
<h3>Standartlar və paylaşım</h3>
<ul><li><b>STIX/TAXII</b> — struktur TI mübadiləsi formatı/protokolu</li>
<li><b>MISP</b> — açıq threat intel paylaşım platforması (icma, IOC pulse-ları)</li>
<li><b>OpenIOC, Sigma (detection), YARA (fayl)</b></li>
<li><b>TLP (Traffic Light Protocol):</b> paylaşım məhdudiyyəti — RED (yalnız alıcılar), AMBER (təşkilat daxili), GREEN (icma), CLEAR/WHITE (açıq)</li></ul>
<h3>Detection-a çevirmək</h3>
<p>Çıxarılan IOC-lar əməl gətirməlidir: firewall/proxy blok (IP/domen), EDR IOC watchlist (hash), SIEM detection qaydası (davranış), email gateway blok. Amma yadda saxla: hash/IP müvəqqəti, TTP-əsaslı detection davamlı (Pyramid of Pain).</p>
<div class="tip">Müsahibə sualı: "Bir malware nümunəsi aldın — necə təhlil edərsən?" Güclü cavab: təhlükəsizlik qaydaları (izolyasiya) → statik (hash/VT, strings, imports) → sandbox/dinamik → IOC çıxar → ailə/niyyət → detection/containment → sənədləşdir. Struktur göstər.</div>`
}
],
quiz: [
{ q: "Malware təhlil edərkən ən vacib təhlükəsizlik qaydası nədir?", o: ["İzolyasiya olunmuş snapshot-lı VM-də işlətmək", "Antivirus-u söndürmək", "İş kompüterində açmaq", "İnterneti açıq saxlamaq"], a: 0, e: "Host-u qorumaq əsasdır." },
{ q: "Statik analiz nədir?", o: ["Faylı işə salmadan təhlil", "Faylı işlədib izləmək", "Faylı silmək", "Faylı şifrələmək"], a: 0, e: "Metadata, strings, imports." },
{ q: "Niyə həssas faylı VirusTotal-a yükləmək olmaz?", o: ["Yüklənən fayllar başqa istifadəçilərə əlçatan olur", "Çox yavaşdır", "Pulludur", "VT faylları silir"], a: 0, e: "Yalnız hash axtar." },
{ q: "URLDownloadToFile import-u nəyi göstərir?", o: ["Fayl endirmə qabiliyyəti", "Şifrələmə", "Persistence", "Anti-debug"], a: 0, e: "Şəbəkə/downloader davranışı." },
{ q: "CreateRemoteThread + WriteProcessMemory nəyə işarədir?", o: ["Code/process injection", "Fayl endirmə", "Backup", "DNS"], a: 0, e: "Başqa prosesə kod yeritmək." },
{ q: "UPX nədir?", o: ["Packer (faylı sıxışdırıb gizlədir)", "Antivirus", "Sandbox", "Şifrələmə alqoritmi"], a: 0, e: "Yüksək entropiya, az strings." },
{ q: "YARA qaydaları nə üçündür?", o: ["Faylları string/bayt nümunələrinə görə təsnif etmək", "Şəbəkə tutmaq", "Parol qırmaq", "Log yazmaq"], a: 0, e: "Malware ailələrini tanımaq." },
{ q: "olevba nə edir?", o: ["Office sənədlərindən makroları çıxarır", "PE importları oxuyur", "Şəbəkə tutur", "Registry oxuyur"], a: 0, e: "Makro-malware analizi." },
{ q: "Mutex nədir (malware kontekstində)?", o: ["Malware-in təkrar işləməməsi üçün unikal identifikator (IOC ola bilər)", "Şifrələmə açarı", "Firewall qaydası", "Fayl formatı"], a: 0, e: "Host IOC kimi faydalı." },
{ q: "Sandbox niyə bəzən malware-i 'təmiz' göstərir?", o: ["Malware VM/sandbox aşkar edib işləmir (anti-analiz)", "Sandbox pisdir", "Fayl həqiqətən təmizdir həmişə", "İnternet yoxdur"], a: 0, e: "Evasion texnikaları." },
{ q: "IsDebuggerPresent API-si nəyi göstərir?", o: ["Anti-analiz (debugger yoxlaması)", "Şəbəkə", "Şifrələmə", "Persistence"], a: 0, e: "Təhlili çətinləşdirmək." },
{ q: "Defanging nə üçündür?", o: ["IOC-ları təsadüfən kliklənməməsi üçün zərərsizləşdirmək", "Şifrələmək", "Sıxışdırmaq", "Silmək"], a: 0, e: "hxxp://evil[.]com formatı." },
{ q: "STIX/TAXII nədir?", o: ["Struktur threat intel mübadilə formatı/protokolu", "Malware növü", "Sandbox", "Firewall"], a: 0, e: "TI paylaşım standartları." },
{ q: "TLP:RED nə deməkdir?", o: ["Yalnız birbaşa alıcılarla paylaşıla bilər", "Hamıya açıq", "İnternetdə dərc oluna bilər", "Təşkilat daxili"], a: 0, e: "Ən məhdud paylaşım." },
{ q: "MISP nədir?", o: ["Açıq threat intel paylaşım platforması", "Antivirus", "SIEM", "Firewall"], a: 0, e: "IOC-ları icma ilə paylaşmaq." },
{ q: "REMnux nədir?", o: ["Linux malware analiz distrosu", "Windows oyunu", "Firewall", "SIEM"], a: 0, e: "FLARE-VM Windows üçün, REMnux Linux üçün." },
{ q: "Pyramid of Pain-ə görə hansı IOC ən davamlı detection verir?", o: ["TTP (davranış)", "Hash", "IP", "Domen"], a: 0, e: "Davranışı dəyişmək hücumçuya ən bahadır." }
],
tasks: [
{ t: "Import-lardan niyyəti oxu", d: R`<p>PEStudio bir .exe-də bu import-ları göstərir:</p><pre>InternetOpenA, InternetReadFile
CryptEncrypt, CryptGenKey
FindFirstFileW, FindNextFileW
RegSetValueExA (Run key)
DeleteFileW</pre>`, q: "Bu malware ehtimal ki hansı növdür? (bir söz)", ans: ["ransomware"], hint: "CryptEncrypt + fayl axtarma + endirmə.", sol: "Ransomware. İpuçları: CryptEncrypt/CryptGenKey (şifrələmə), FindFirstFile/FindNextFile (faylları sayır), InternetRead (C2/açar), RegSetValue Run (persistence), DeleteFile (orijinalı/backup silir). Bu import profili klassik ransomware davranışıdır. Statik analiz işə salmadan niyyət haqqında güclü fikir verir." },
{ t: "Sandbox hesabatı oxu", d: R`<p>any.run hesabatı (xülasə):</p><pre>Verdict: Malicious (score 100)
Process: invoice.exe → powershell.exe → svchost.exe (injected)
Network: POST to 193.42.33.17 / c2-panel[.]top
Dropped: C:\Users\...\AppData\Roaming\winlog.exe (SHA256: a1b2...)
Registry: HKCU\...\Run\WinUpdate = winlog.exe
MITRE: T1059.001, T1055, T1071.001, T1547.001</pre>`, q: "Persistence üçün istifadə olunan texnikanın ATT&CK ID-si nədir?", ans: ["T1547.001", "t1547.001", "T1547"], hint: "Run registry açarı.", sol: "T1547.001 (Registry Run Key). Hesabatdan çıxarılan IOC-lar: C2 IP 193[.]42[.]33[.]17, domen c2-panel[.]top, dropped fayl winlog.exe + hash, Run açarı 'WinUpdate'. Texnikalar: PowerShell icra (T1059.001), process injection (T1055), HTTPS C2 (T1071.001), persistence (T1547.001). Bu IOC-ları blok siyahısına və EDR watchlist-ə əlavə et." },
{ t: "IOC-ları defang et", d: R`<p>Hesabatda paylaşmaq üçün bu IOC-ları təhlükəsizləşdir: C2 IP 193.42.33.17, domen c2-panel.top, URL http://c2-panel.top/gate.php</p>`, q: "193.42.33.17-nin defang edilmiş forması nədir?", ans: ["193[.]42[.]33[.]17"], hint: "Nöqtələri köşəli mötərizəyə al.", sol: "193[.]42[.]33[.]17. Domen: c2-panel[.]top. URL: hxxp://c2-panel[.]top/gate[.]php. Defanging IOC-ların təsadüfən kliklənməsinin/aktivləşməsinin qarşısını alır — hesabatlarda, email-lərdə, ticketlerde standartdır. CyberChef 'Defang URL/IP' resepti bunu avtomatlaşdırır." },
{ t: "Malware triage lab (praktika)", d: R`<p>Təhlükəsiz nümunələrlə malware analizi öyrən.</p>`, steps: ["VirtualBox-da izolyasiya olunmuş Windows VM qur (snapshot al, şəbəkəni Host-Only et)", "FLARE-VM və ya minimum PEStudio + Process Hacker + Wireshark quraşdır", "MalwareBazaar-dan (abuse.ch) bir TƏHLÜKƏSİZ test nümunəsi VƏ YA EICAR test faylı ilə addımları məşq et (real malware yalnız izolyasiya + təcrübə ilə!)", "any.run-da pulsuz public sandbox təqdimatlarına bax və hesabatları oxumağı öyrən", "TryHackMe 'Intro to Malware Analysis', 'MalDoc', 'Basic Static Analysis' otaqlarını et", "Çıxardığın IOC-ları defang edib notebook-a yaz"], sol: "Malware triage L2-nin vacib bacarığıdır. Başlanğıcda any.run public hesabatlarını oxumaq və TryHackMe/CyberDefenders tapşırıqları ən təhlükəsiz öyrənmə yoludur. Real nümunələrlə yalnız tam izolyasiya olunmuş labda işlə." }
]
},
// =====================================================================
{
id: "l2-ti", level: "L2", title: "Cyber Threat Intelligence (CTI)",
intro: "Təhdid kəşfiyyatı: TI növləri, kəşfiyyat dövrü, təhdid aktorları, Diamond Model və TI-nin SOC-da tətbiqi.",
lessons: [
{ title: "Threat Intelligence növləri və dövrü", html: R`
<h3>CTI nədir?</h3>
<p>Təhdidlər haqqında <b>təhlil edilmiş, kontekstli</b> məlumat — qərar verməyə kömək edir. Sadəcə IOC siyahısı deyil; "kim, niyə, necə, nə ilə" sualına cavabdır.</p>
<h3>Dörd səviyyə</h3>
<table><tr><th>Növ</th><th>Auditoriya</th><th>Nümunə</th></tr>
<tr><td><b>Strategic</b></td><td>Rəhbərlik</td><td>Sənaye təhdid trendləri, geosiyasi risk, uzunmüddətli</td></tr>
<tr><td><b>Operational</b></td><td>IR/SOC menecmenti</td><td>Konkret kampaniya, aktor, gözlənilən hücum</td></tr>
<tr><td><b>Tactical</b></td><td>SOC analitikləri</td><td>TTP-lər, aşkarlama imkanları</td></tr>
<tr><td><b>Technical</b></td><td>Alətlər/SOC</td><td>IOC-lar (IP, hash, domen) — qısaömürlü</td></tr></table>
<h3>Threat Intelligence dövrü</h3>
<ol><li><b>Direction/Planning:</b> hansı suallara cavab lazımdır (requirements)</li>
<li><b>Collection:</b> məlumat toplama (OSINT, feeds, dark web, daxili telemetriya)</li>
<li><b>Processing:</b> normalizasiya, tərcümə, deduplication</li>
<li><b>Analysis:</b> kontekst, qiymətləndirmə, nəticə</li>
<li><b>Dissemination:</b> uyğun auditoriyaya çatdırmaq (hesabat, feed, alert)</li>
<li><b>Feedback:</b> faydalı oldumu? Təkmilləşdirmə</li></ol>
<h3>IOC vs IOA</h3>
<ul><li><b>IOC</b> (Indicator of Compromise) — kompromis <i>olduğunu</i> göstərən artefakt (hash, IP). Reaktiv.</li>
<li><b>IOA</b> (Indicator of Attack) — hücum <i>davranışı/niyyəti</i> (məs. "proses LSASS-a girir"). Proaktiv, davamlı.</li></ul>`},
{ title: "Təhdid aktorları və atribusiya", html: R`
<h3>Aktor növləri</h3>
<table><tr><th>Növ</th><th>Motivasiya</th><th>İmkan</th></tr>
<tr><td><b>Nation-state / APT</b></td><td>Casusluq, sabotaj, geosiyasi</td><td>Çox yüksək, resurslu, səbirli</td></tr>
<tr><td><b>Cybercrime (organized)</b></td><td>Maliyyə (ransomware, fraud)</td><td>Yüksək, peşəkar (RaaS)</td></tr>
<tr><td><b>Hacktivist</b></td><td>İdeoloji/siyasi</td><td>Dəyişkən (DDoS, defacement, leak)</td></tr>
<tr><td><b>Insider</b></td><td>İntiqam, pul, səhlənkarlıq</td><td>Daxili giriş — təhlükəli</td></tr>
<tr><td><b>Script kiddie</b></td><td>Əyləncə, status</td><td>Aşağı (hazır alətlər)</td></tr>
<tr><td><b>Cyber-mercenary</b></td><td>Pul (sifarişlə)</td><td>Yüksək</td></tr></table>
<h3>APT adlandırma</h3>
<p>Fərqli təchizatçılar eyni qrupu fərqli adlandırır: APT29 = Cozy Bear = Midnight Blizzard (Microsoft) = NOBELIUM. CrowdStrike heyvan adları (Bear=Rusiya, Panda=Çin, Kitten=İran, Chollima=Şimali Koreya), Mandiant APTxx, Microsoft hava hadisələri. <b>MITRE ATT&CK Groups</b> bu adları əlaqələndirir.</p>
<h3>Atribusiya (kim etdi?)</h3>
<p>Çətin və diqqət tələb edir. Göstəricilər: TTP-lər, malware ailələri, infrastruktur, dil/iş saatları, hədəf seçimi, kod oxşarlıqları. <b>Yanlış bayraq (false flag)</b> riski var — aktorlar qəsdən başqasına bənzəyə bilər. SOC L2 adətən atribusiyadan çox <b>aşkarlama və cavaba</b> fokuslanır; atribusiya CTI komandasının işidir.</p>
<div class="note"><b>Diamond Model:</b> hər hadisəni 4 təpə ilə təsvir et: <b>Adversary</b> (kim), <b>Capability</b> (nə ilə — malware/alət), <b>Infrastructure</b> (hardan — C2/domen), <b>Victim</b> (kimə). Bir təpəni bilsən, digərlərini kəşf edə bilərsən (pivoting). CTI təhlilinin əsas çərçivəsidir.</div>`},
{ title: "TI mənbələri və pivoting", html: R`
<h3>OSINT və feed mənbələri</h3>
<ul><li><b>Pulsuz feeds:</b> abuse.ch (URLhaus, ThreatFox, MalwareBazaar, Feodo Tracker), AlienVault OTX, Spamhaus, Emerging Threats, CISA alerts</li>
<li><b>Platformalar:</b> MISP, VirusTotal (Intelligence), MITRE ATT&CK</li>
<li><b>Hesabatlar:</b> Mandiant, CrowdStrike, Microsoft, Cisco Talos, Unit 42, Recorded Future, sektoral ISAC-lar</li>
<li><b>OSINT:</b> Shodan, Censys, passive DNS, WHOIS, crt.sh, GitHub (sızmış açarlar)</li></ul>
<h3>Pivoting (bir göstəricidən digərlərinə)</h3>
<p>Bir IOC-dan başlayıb əlaqəli infrastruktur/nümunələri tapmaq:</p>
<ul><li>Domen → passive DNS → həmin IP-də digər domenlər → həmin aktorun digər C2-ləri</li>
<li>Hash → VT → eyni imza/kod olan digər nümunələr → malware ailəsi</li>
<li>SSL sertifikat/JA3 → eyni barmaq izli digər serverlər (Shodan/Censys)</li>
<li>Email → istifadə olunan infrastruktur → kampaniya</li></ul>
<h3>Analitik mülahizə (ACH)</h3>
<p>Analysis of Competing Hypotheses — bir nəticəyə atılmamaq üçün bir neçə fərziyyəni dəlillərlə qiymətləndirmək. Confirmation bias-dan qaçmaq üçün. Qiymətləndirmədə etibarlılıq dilindən istifadə et: "yüksək etibarla", "orta etibarla", "aşağı etibarla" (admiralty scale).</p>
<div class="tip">TI-ni həddindən artıq IOC feed-ə endirmə. Dəyərli TI "bu bizə necə aiddir, nə etməliyik?" sualına cavab verir. Pis TI: kontekstsiz 10,000 IP bloklamaq (FP partlayışı). Yaxşı TI: "bu aktor bizim sektoru hədəfləyir, bu TTP-ni işlədir, bu detection-ı qur."</div>`},
{ title: "TI-nin SOC-da tətbiqi və proaktiv müdafiə", html: R`
<h3>TI SOC iş axınına necə qoşulur?</h3>
<ul><li><b>Alert zənginləşdirmə:</b> IOC-ları avtomatik TI ilə yoxlamaq (SOAR). "Bu IP məlum C2-dirmi?"</li>
<li><b>Prioritetləşdirmə:</b> məlum aktor/kampaniya ilə əlaqəli alertlər daha yüksək prioritet</li>
<li><b>Bloklama:</b> yüksək-etibarlı IOC-ları firewall/proxy/EDR-ə</li>
<li><b>Detection engineering:</b> TTP-lərdən Sigma/detection qaydaları</li>
<li><b>Threat hunting:</b> "bu aktor bu texnikanı işlədir — bizdə izi varmı?" (L3)</li>
<li><b>Proaktiv müdafiə:</b> gözlənilən təhdidlərə qarşı hardening</li></ul>
<h3>Threat modeling və prioritetləşdirmə</h3>
<ul><li><b>Threat-informed defense:</b> müdafiəni real təhdidlərə görə qur (ATT&CK mapping).</li>
<li><b>MITRE ATT&CK Navigator:</b> hansı texnikaları izləyə bildiyini (coverage) xəritələ, boşluqları tap.</li>
<li><b>Crown jewels:</b> ən kritik aktivləri müəyyən et, onlara qarşı təhdidlərə fokuslan.</li></ul>
<h3>CTI çərçivələri</h3>
<ul><li><b>Cyber Kill Chain</b> — hücum mərhələləri</li><li><b>MITRE ATT&CK</b> — TTP taksonomiyası</li>
<li><b>Diamond Model</b> — hadisə təhlili</li><li><b>F3EAD</b> — Find, Fix, Finish, Exploit, Analyze, Disseminate (hərbi IR/TI dövrü)</li>
<li><b>Pyramid of Pain</b> — IOC dəyəri</li></ul>
<div class="note">Müsahibə: "Diamond Model-i izah et" və ya "APT ilə cybercrime fərqi nədir?" tez-tez soruşulur. APT = səbirli, hədəfli, casusluq, resurslu (dövlət); cybercrime = sürətli, maliyyə məqsədli, geniş. Hər ikisi ciddi, amma fərqli davranış və detection yanaşması tələb edir.</div>`}
],
quiz: [
{ q: "Threat Intelligence IOC siyahısından nə ilə fərqlənir?", o: ["Təhlil edilmiş, kontekstli məlumatdır (kim/niyə/necə)", "Daha çox IP-dir", "Daha ucuzdur", "Yalnız hashdir"], a: 0, e: "Kontekst və analiz əsasdır." },
{ q: "Strategic TI kimin üçündür?", o: ["Rəhbərlik (uzunmüddətli, trend)", "SOC analitiki", "Firewall", "Antivirus"], a: 0, e: "Yüksək səviyyəli qərarlar." },
{ q: "Technical TI nümunəsi hansıdır?", o: ["IOC-lar (IP, hash, domen)", "Geosiyasi trend", "Büdcə planı", "Hüquqi məsləhət"], a: 0, e: "Qısaömürlü texniki göstəricilər." },
{ q: "IOA (Indicator of Attack) IOC-dan nə ilə fərqlənir?", o: ["Davranış/niyyəti göstərir, daha proaktiv və davamlı", "Daha qısaömürlüdür", "Yalnız hashdir", "Fərq yoxdur"], a: 0, e: "Davranış-əsaslı." },
{ q: "APT nədir?", o: ["Advanced Persistent Threat — resurslu, səbirli (çox vaxt dövlət)", "Antivirus Protection Tool", "Automated Patch Technology", "Application Test"], a: 0, e: "Hədəfli, uzunmüddətli." },
{ q: "Diamond Model-in 4 təpəsi hansıdır?", o: ["Adversary, Capability, Infrastructure, Victim", "Who, What, When, Where", "IP, Hash, Domain, URL", "Detect, Respond, Recover, Report"], a: 0, e: "Hadisə təhlili çərçivəsi." },
{ q: "APT29-un digər adlarından biri hansıdır?", o: ["Cozy Bear / Midnight Blizzard", "Lazarus", "Fancy Bear", "Sandworm"], a: 0, e: "Fərqli təchizatçı, fərqli ad." },
{ q: "Pivoting nədir?", o: ["Bir IOC-dan əlaqəli infrastruktur/nümunələri kəşf etmək", "Firewall qurmaq", "Log silmək", "Parol qırmaq"], a: 0, e: "passive DNS, VT, Shodan ilə." },
{ q: "'False flag' nədir?", o: ["Aktorun qəsdən başqasına bənzəməsi (atribusiyanı çaşdırmaq)", "Yanlış alert", "Firewall qaydası", "Test faylı"], a: 0, e: "Atribusiya riski." },
{ q: "TLP:AMBER nə deməkdir?", o: ["Təşkilat daxilində paylaşıla bilər", "Hamıya açıq", "Yalnız alıcı", "İnternetdə dərc"], a: 0, e: "Məhdud daxili paylaşım." },
{ q: "abuse.ch hansı xidmətləri verir?", o: ["URLhaus, ThreatFox, MalwareBazaar (pulsuz TI)", "Antivirus", "SIEM", "Firewall"], a: 0, e: "Pulsuz malware/IOC mənbələri." },
{ q: "Threat Intelligence dövrünün ilk mərhələsi hansıdır?", o: ["Direction/Planning (requirements)", "Dissemination", "Collection", "Analysis"], a: 0, e: "Hansı suala cavab lazımdır?" },
{ q: "ACH (Analysis of Competing Hypotheses) nə üçündür?", o: ["Bir neçə fərziyyəni dəlillərlə qiymətləndirib bias-dan qaçmaq", "Firewall qurmaq", "Parol saxlamaq", "Log sıxışdırmaq"], a: 0, e: "Confirmation bias-a qarşı." },
{ q: "Nation-state (APT) aktorunu cybercrime-dən fərqləndirən əsas xüsusiyyət?", o: ["Səbirli, casusluq məqsədli, yüksək resurs", "Daha sürətli", "Yalnız DDoS edir", "Həmişə görünür"], a: 0, e: "Fərqli motivasiya/davranış." },
{ q: "MITRE ATT&CK Navigator nə üçündür?", o: ["Detection coverage-ı xəritələyib boşluqları tapmaq", "Malware işlətmək", "Parol qırmaq", "Email göndərmək"], a: 0, e: "Threat-informed defense." },
{ q: "Yaxşı TI-nin əsas xüsusiyyəti nədir?", o: ["Actionable və relevant (bizə necə aiddir, nə etməli)", "Çox sayda IP", "Ucuzluq", "Avtomatik bloklama"], a: 0, e: "Kontekstsiz IOC feed FP yaradır." },
{ q: "Threat-informed defense nədir?", o: ["Müdafiəni real təhdid TTP-lərinə görə qurmaq", "Bütün portları bağlamaq", "Yalnız antivirus", "Logları silmək"], a: 0, e: "ATT&CK əsaslı." }
],
tasks: [
{ t: "TI səviyyəsini təyin et", d: R`<p>Hesabat: "Maliyyə sektoruna qarşı FIN7 qrupu növbəti rübdə POS malware kampaniyası gözlənilir; CISO büdcə və resurs planlaması aparmalıdır."</p>`, q: "Bu hansı TI səviyyəsidir? (bir söz, ingiliscə)", ans: ["strategic"], hint: "Rəhbərlik, uzunmüddətli, planlaşdırma.", sol: "Strategic — rəhbərlik (CISO) üçün, uzunmüddətli planlaşdırma və resurs qərarları. Müqayisə: 'FIN7 bu C2 IP-lərini işlədir' = Technical; 'FIN7 bu TTP ilə hücum edir, bu detection-ı qur' = Tactical; 'bu konkret kampaniya bizə yönəlib' = Operational." },
{ t: "Diamond Model tətbiqi", d: R`<p>Hadisə: APT qrupu (Lazarus) Cobalt Strike (malware) ilə, c2-panel[.]top (C2) üzərindən bir bankı (victim) hədəflədi.</p>`, q: "Bu hadisədə 'Infrastructure' təpəsi hansıdır?", ans: ["c2-panel.top", "c2-panel[.]top", "c2 domain", "c2-panel"], hint: "Hardan — C2/domen.", sol: "Infrastructure = c2-panel[.]top (C2 domeni/serveri). Diamond Model: Adversary=Lazarus, Capability=Cobalt Strike, Infrastructure=c2-panel[.]top, Victim=bank. Pivoting imkanı: c2-panel[.]top-un IP-sindən passive DNS ilə həmin aktorun digər domenlərini, Cobalt Strike imzasından digər nümunələri tapmaq olar." },
{ t: "IOC-u kontekstə çevir", d: R`<p>TI feed-dən 500 IP gəldi, hamısı 'malicious' etiketli, kontekst yoxdur. Komanda hamısını firewall-da bloklamaq istəyir.</p>`, q: "Bloklamadan əvvəl ən vacib sual nədir? (qısa)", ans: ["__any__"], hint: "FP riski, kontekst, etibarlılıq, bu bizə aidmı?", sol: "Kritik suallar: (1) Bu IP-lər nə qədər etibarlıdır (mənbə, yaş, false positive riski)? (2) Hansıları hələ aktivdir (köhnə IOC-lar başqasına aid ola bilər — məs. paylaşılan hosting/CDN IP-si)? (3) Bu təhdid bizim mühitə aiddirmi? (4) Bloklama legitim xidmətə təsir edəcəkmi? Kor-koranə 500 IP bloklamaq FP partlayışı və biznes pozulması yarada bilər. Yaxşı TI = kontekst + etibarlılıq qiymətləndirməsi + relevance." },
{ t: "CTI praktikası (lab)", d: R`<p>TI bacarıqlarını inkişaf etdir.</p>`, steps: ["MITRE ATT&CK saytında bir APT qrupu seç (məs. APT29) və onların TTP-lərini oxu", "Həmin qrupun 1-2 texnikasını ATT&CK Navigator-da işarələ", "AlienVault OTX-də pulsuz hesab aç, bir 'pulse' (IOC dəsti) araşdır", "abuse.ch ThreatFox-da bir aktiv C2 IOC-u tap və pivoting təcrübə et (VT/passive DNS)", "TryHackMe 'Threat Intelligence Tools', 'Cyber Threat Intelligence', 'Diamond Model' otaqlarını et", "Seçdiyin APT üçün Diamond Model diaqramı çək"], sol: "CTI getdikcə daha vacib sahədir. MITRE ATT&CK-i dərindən bilmək və TI-ni detection/hunting-ə çevirmək L2→L3 keçidinin əsasıdır." }
]
},
// =====================================================================
{
id: "l2-detection", level: "L2", title: "Detection Engineering: Sigma, qaydalar və ATT&CK",
intro: "Alertləri istehlak etməkdən onları yaratmağa keçid. Sigma qaydaları, detection məntiqi və tuning.",
lessons: [
{ title: "Detection engineering əsasları", html: R`
<p>Detection engineering — aşkarlama qaydalarını <b>dizayn etmək, yazmaq, test etmək və idarə etmək</b> prosesidir. L2-nin L3-ə doğru böyüməsinin əsas yoludur.</p>
<h3>Yaxşı detection-un xüsusiyyətləri</h3>
<ul><li><b>Dəqiq:</b> real təhlükəni tutur (az FN)</li><li><b>Spesifik:</b> az FP yaradır</li>
<li><b>Davamlı:</b> davranışa (TTP) əsaslanır, asanlıqla bypass edilmir</li>
<li><b>Sənədləşdirilmiş:</b> nə tutur, niyə, necə cavab vermək</li>
<li><b>Test edilmiş:</b> həm işləyir, həm səs-küy yaratmır</li></ul>
<h3>Detection yaratma dövrü</h3>
<ol><li><b>Fərziyyə:</b> hansı təhdid/TTP-ni tutmaq istəyirik? (ATT&CK texnikası)</li>
<li><b>Data mənbəyi:</b> bunu görmək üçün hansı log lazımdır? (log source)</li>
<li><b>Məntiq:</b> hansı nümunə təhlükəni göstərir?</li>
<li><b>Yaz:</b> qaydanı yaz (Sigma/SIEM dili)</li>
<li><b>Test:</b> emulate et (Atomic Red Team) — tutursanmı?</li>
<li><b>Tune:</b> FP-ləri azalt (kontekst, whitelist, threshold)</li>
<li><b>Sənədləşdir və deploy</b></li></ol>
<h3>Detection piramidası / "alert quality"</h3>
<p>Balans: çox geniş qayda = FP seli (alert fatigue); çox dar qayda = FN (buraxılan təhlükə). Məqsəd yüksək <b>fidelity</b> (etibarlılıq) ilə geniş <b>coverage</b> (əhatə).</p>
<div class="note"><b>Detection as Code:</b> müasir komandalar qaydaları versiya nəzarətində (Git) saxlayır, test edir, CI/CD ilə deploy edir. Qayda bir kod artefaktı kimi idarə olunur.</div>`},
{ title: "Sigma — universal detection dili", html: R`
<p><b>Sigma</b> SIEM-dən asılı olmayan, YAML əsaslı detection qaydası formatıdır. "Detection üçün YARA". Bir dəfə yaz, müxtəlif SIEM-lərə çevir (sigmac/pySigma).</p>
<pre>title: Suspicious PowerShell Encoded Command
id: a1b2c3d4-...
status: experimental
description: Base64 ilə kodlaşdırılmış PowerShell icrası
references:
  - https://attack.mitre.org/techniques/T1059/001/
author: SOC Mentor
logsource:
  product: windows
  category: process_creation
detection:
  selection:
    Image|endswith: '\powershell.exe'
    CommandLine|contains:
      - '-enc'
      - '-EncodedCommand'
      - 'FromBase64String'
  condition: selection
falsepositives:
  - Legitimate admin scripts using encoded commands
level: high
tags:
  - attack.execution
  - attack.t1059.001</pre>
<h3>Əsas Sigma elementləri</h3>
<ul><li><b>logsource:</b> hansı log (product, category, service)</li>
<li><b>detection:</b> selection blokları + condition</li>
<li><b>modifiers:</b> <code>contains</code>, <code>startswith</code>, <code>endswith</code>, <code>all</code>, <code>re</code> (regex), <code>base64</code></li>
<li><b>condition:</b> məntiq (<code>selection and not filter</code>, <code>1 of them</code>, <code>all of selection*</code>)</li>
<li><b>falsepositives, level, tags (ATT&CK)</b></li></ul>
<h3>Sigma repozitoriyası</h3>
<p>SigmaHQ GitHub-da minlərlə hazır qayda var — öyrənmək və uyğunlaşdırmaq üçün əla mənbə. Bir qaydanı oxuyub nəyi, niyə tutduğunu anlamaq güclü təlimdir.</p>`},
{ title: "Detection məntiqi və nümunələr", html: R`
<h3>Detection yanaşmaları</h3>
<table><tr><th>Yanaşma</th><th>Nümunə</th><th>Zəiflik</th></tr>
<tr><td><b>Atomic</b> (tək göstərici)</td><td>Məlum pis hash/IP</td><td>Asan bypass (dəyişir)</td></tr>
<tr><td><b>Behavioral</b> (davranış)</td><td>Word → PowerShell başlatması</td><td>Daha davamlı</td></tr>
<tr><td><b>Correlation</b> (əlaqələndirmə)</td><td>50 uğursuz + 1 uğurlu login/5dəq</td><td>Tuning tələb edir</td></tr>
<tr><td><b>Anomaly/baseline</b></td><td>İstifadəçi ilk dəfə DC-yə RDP</td><td>Baseline lazımdır, FP riski</td></tr>
<tr><td><b>Threshold</b></td><td>10 dəqiqədə 100+ fayl dəyişdi (ransomware)</td><td>Həddin düzgün seçimi</td></tr></table>
<h3>Faydalı detection ideyaları (ATT&CK ilə)</h3>
<ul><li><b>T1059.001:</b> powershell + (-enc / IEX / DownloadString / hidden)</li>
<li><b>T1003.001:</b> lsass.exe-yə qeyri-adi proses girişi (Sysmon 10)</li>
<li><b>T1547.001:</b> Run registry açarına yazılış (Sysmon 13)</li>
<li><b>T1053.005:</b> schtasks yaradılması / Event 4698</li>
<li><b>T1036:</b> System32-dən kənar yolda sistem proses adı (svchost, lsass)</li>
<li><b>T1055:</b> CreateRemoteThread / qeyri-adi process memory yazma</li>
<li><b>T1486 (ransomware):</b> qısa müddətdə kütləvi fayl dəyişikliyi + shadow copy silmə (vssadmin delete shadows)</li>
<li><b>Parent-child anomaliyaları:</b> office→shell, webserver→shell, svchost yanlış parent</li></ul>
<h3>Atomic Red Team ilə test</h3>
<p>Atomic Red Team — ATT&CK texnikalarını təhlükəsiz emulate edən pulsuz test kitabxanası. Bir texnikanı lab-da icra et → detection-ın tutub-tutmadığını yoxla. Purple teaming-in əsasıdır.</p>
<div class="warn">Atomic testləri yalnız öz lab mühitində icra et. İstehsalat sistemlərində icazəsiz icra problem yaradar.</div>`},
{ title: "Tuning, FP idarəetməsi və detection ömürü", html: R`
<h3>False Positive tuning</h3>
<p>Hər yeni qayda ilkin olaraq səs-küy yaradır. Tuning — aşkarlamanı kor etmədən FP-ləri azaltmaq.</p>
<ul><li><b>Kontekst əlavə et:</b> "powershell -enc" + <i>amma yalnız</i> qeyri-admin istifadəçidən / qeyri-IT host-dan</li>
<li><b>Whitelist:</b> təsdiqlənmiş legitim alətlər/hesablar (ehtiyatla — hücumçu whitelist-i sui-istifadə edə bilər)</li>
<li><b>Threshold/aggregation:</b> tək hadisə yox, nümunə (N dəfə / vaxt)</li>
<li><b>Enrichment:</b> asset kritikliyi, istifadəçi rolu, TI ilə zənginləşdir</li>
<li><b>Allowlist-i sənədləşdir:</b> nə, niyə icazəlidir</li></ul>
<h3>Detection metrikaları</h3>
<ul><li><b>True/False Positive nisbəti</b> (precision)</li><li><b>Coverage</b> (ATT&CK Navigator-da nə qədər texnika)</li>
<li><b>Alert həcmi</b> (analitik yükü)</li><li><b>Time to detect</b></li></ul>
<h3>Detection-ın ömrü</h3>
<p>Qaydalar "canlı"dır: mühit dəyişir, hücumçular bypass tapır, yeni TTP-lər çıxır. Müntəzəm nəzərdən keçir: hələ işləyirmi? Hələ lazımdırmı? FP artdımı? Yeni bypass varmı?</p>
<h3>SOAR və avtomatlaşdırma (qısa)</h3>
<p><b>SOAR</b> (Security Orchestration, Automation and Response) təkrarlanan işləri avtomatlaşdırır: alert zənginləşdirmə (IOC-u TI-də yoxla), məlum FP-ni avtomatik bağla, host izolyasiyası, ticket yaratma. L2/L3 playbook-ları (avtomatlaşdırma iş axınları) dizayn edir. Məqsəd: analitiki təkrarlıq işdən azad edib real təhlilə fokuslamaq.</p>
<div class="note">Müsahibə: "FP çox olan qaydanı necə tune edərsən?" Güclü cavab: əvvəl FP-lərin ortaq xüsusiyyətini tap (hansı host/user/proses), sonra kontekst/threshold/allowlist əlavə et — amma aşkarlamanı tamamilə kor etmədən. Hər dəyişikliyi sənədləşdir və test et.</div>`
}
],
quiz: [
{ q: "Detection engineering nədir?", o: ["Aşkarlama qaydalarını dizayn, yazma, test və idarə etmək", "Malware yazmaq", "Firewall qurmaq", "Parol qırmaq"], a: 0, e: "Alert istehlakından yaratmağa keçid." },
{ q: "Sigma nədir?", o: ["SIEM-dən asılı olmayan YAML detection qaydası formatı", "Antivirus", "Şəbəkə protokolu", "Şifrələmə"], a: 0, e: "'Detection üçün YARA'." },
{ q: "Yaxşı detection-un əsas balansı nədir?", o: ["Yüksək coverage + yüksək fidelity (az FP, az FN)", "Çox alert", "Az log", "Sürət"], a: 0, e: "Geniş əhatə + etibarlılıq." },
{ q: "Behavioral detection atomic-dən niyə üstündür?", o: ["Daha davamlıdır, asanlıqla bypass edilmir", "Daha ucuzdur", "Daha sürətlidir", "Log lazım deyil"], a: 0, e: "Hash/IP dəyişir, davranış çətin dəyişir." },
{ q: "Sigma-da 'logsource' nəyi təyin edir?", o: ["Hansı log mənbəsi (product, category)", "Alert rəngini", "Severity-ni", "FP-ləri"], a: 0, e: "Qaydanın hansı loga tətbiq olunduğu." },
{ q: "Sigma 'condition'-da 'selection and not filter' nə edir?", o: ["Selection-u tutur amma filter-i istisna edir (FP azaltma)", "Hər şeyi tutur", "Heç nə tutmur", "Logu silir"], a: 0, e: "Filter whitelist məntiqi." },
{ q: "Atomic Red Team nə üçündür?", o: ["ATT&CK texnikalarını təhlükəsiz emulate edib detection-ı test etmək", "Malware yaymaq", "Parol qırmaq", "DDoS"], a: 0, e: "Purple teaming testi." },
{ q: "Ransomware-i aşkarlayan davranış detection ideyası hansıdır?", o: ["Qısa müddətdə kütləvi fayl dəyişikliyi + shadow copy silmə", "Tək login", "DNS sorğusu", "Ping"], a: 0, e: "vssadmin delete shadows + mass encryption." },
{ q: "Tuning nədir?", o: ["Aşkarlamanı kor etmədən FP-ləri azaltmaq", "Qaydanı silmək", "Logu artırmaq", "Alert yaratmaq"], a: 0, e: "Kontekst/threshold/allowlist." },
{ q: "FP çox olan qaydanı tune edərkən ilk addım nədir?", o: ["FP-lərin ortaq xüsusiyyətini tapmaq", "Qaydanı silmək", "Hamısını whitelist etmək", "Logu söndürmək"], a: 0, e: "Nümunəni anla, sonra dəqiqləşdir." },
{ q: "Whitelist-in riski nədir?", o: ["Hücumçu whitelist edilmiş yolu/hesabı sui-istifadə edə bilər", "Çox yavaşdır", "Risk yoxdur", "Çox log yaradır"], a: 0, e: "Ehtiyatla və sənədləşdirilmiş." },
{ q: "SOAR nə edir?", o: ["Təkrarlanan təhlükəsizlik işlərini avtomatlaşdırır", "Malware analiz edir", "Şəbəkə qurur", "Şifrələyir"], a: 0, e: "Orchestration, Automation, Response." },
{ q: "'Detection as Code' nə deməkdir?", o: ["Qaydaları versiya nəzarəti + test + CI/CD ilə idarə etmək", "Kod yazmaq malware üçün", "Logları silmək", "Manual qayda"], a: 0, e: "Qayda kod artefaktı kimi." },
{ q: "MITRE ATT&CK Navigator detection-da necə istifadə olunur?", o: ["Coverage-ı xəritələyib boşluqları görmək", "Malware işlətmək", "Parol qırmaq", "Email"], a: 0, e: "Hansı texnikaları tuturuq?" },
{ q: "Parent-child anomaliyası detection nümunəsi hansıdır?", o: ["office → shell/powershell", "chrome → explorer", "services → svchost", "explorer → notepad"], a: 0, e: "Qeyri-adi proses əlaqəsi." },
{ q: "Correlation detection nümunəsi hansıdır?", o: ["50 uğursuz + 1 uğurlu login / 5 dəqiqə", "Tək hadisə", "Hash yoxlaması", "Port skanı"], a: 0, e: "Hadisələri əlaqələndirmək." },
{ q: "Çox dar (spesifik) detection qaydasının riski nədir?", o: ["False Negative (təhlükəni buraxmaq)", "Çox alert", "Yavaşlıq", "Risk yoxdur"], a: 0, e: "Kiçik dəyişiklik qaydanı keçə bilər." }
],
tasks: [
{ t: "Sigma məntiqini oxu", d: R`<pre>logsource:
  category: process_creation
  product: windows
detection:
  selection:
    ParentImage|endswith: '\winword.exe'
    Image|endswith:
      - '\cmd.exe'
      - '\powershell.exe'
  condition: selection
level: high</pre>`, q: "Bu qayda nəyi aşkarlayır? (qısa təsvir)", ans: ["__any__"], hint: "Word-ün cmd/powershell başlatması.", sol: "Bu qayda Microsoft Word-ün (winword.exe) cmd.exe və ya powershell.exe başlatmasını tutur — klassik makro-malware/phishing davranışı (T1566 → T1059). Normal istifadədə Word shell başlatmır, ona görə bu yüksək-fidelity davranış detection-udur. FP mənbəyi: nadir legitim Word əlavələri/avtomatlaşdırma — tuning üçün nəzərə al." },
{ t: "Detection fərziyyəsi qur", d: R`<p>Hücumçular credential oğurlamaq üçün lsass.exe-dən yaddaş dump edir (T1003.001). Sən bunu aşkarlamaq istəyirsən.</p>`, q: "Bunu görmək üçün hansı Sysmon Event ID-yə baxmalısan?", ans: ["10", "event id 10", "sysmon 10", "eventid 10"], hint: "ProcessAccess.", sol: "Sysmon Event ID 10 (ProcessAccess) — lsass.exe-yə hansı prosesin, hansı GrantedAccess ilə girdiyini göstərir. Detection məntiqi: TargetImage = lsass.exe VƏ qeyri-adi SourceImage (adi proseslər lsass-a girməməlidir) VƏ şübhəli GrantedAccess (0x1010, 0x1410). FP: bəzi legitim təhlükəsizlik/sistem alətləri lsass-a girir — onları allowlist et." },
{ t: "Atomic test ideyası", d: R`<p>Yeni yazdığın 'powershell -enc' detection qaydasının işlədiyini yoxlamaq istəyirsən.</p>`, q: "Qaydanı test etmək üçün ümumi yanaşma nədir? (qısa)", ans: ["__any__"], hint: "Lab-da texnikanı emulate et, tutub-tutmadığını yoxla.", sol: "Yanaşma: lab mühitində texnikanı təhlükəsiz icra et (məs. Atomic Red Team T1059.001 testi, və ya sadəcə <code>powershell -enc <base64></code> işlət) → SIEM/EDR-də alertin yaranıb-yaranmadığını yoxla → yaranmadısa qaydanı/log mənbəsini düzəlt → yaranan FP-ləri qeyd et → tune et. Bu, 'detection validation' prosesidir. Yalnız öz labında icra et." },
{ t: "Detection engineering lab (praktika)", d: R`<p>Qayda yazmağı praktika et.</p>`, steps: ["SigmaHQ GitHub repozitoriyasını aç, 3 qaydanı oxu və nəyi/niyə tutduğunu anla", "sigconverter.io və ya pySigma ilə bir Sigma qaydasını Splunk/KQL-ə çevir", "Öz labında (Sysmon + Wazuh/Splunk) 'powershell -enc' işlət və alert yaranmasını təmin et", "Atomic Red Team-i araşdır (invoke-atomictest), bir atomic testi lab-da icra et", "Öz ilk Sigma qaydanı yaz (məs. certutil download) və test et", "MITRE ATT&CK Navigator-da tutduğun texnikaları işarələ (coverage map)"], sol: "Detection engineering L2→L3 keçidinin əsasıdır və bazarda çox tələb olunur. Öz qaydalarını yazıb test etmək (və GitHub-da portfel kimi saxlamaq) müsahibədə çox güclü siqnaldır. L2-ni bitirmək üzrəsən!" }
]
},
// =====================================================================
{
id: "l2-ir-phishing", level: "L2", title: "Incident Response playbookları və dərin phishing analizi",
intro: "Real IR iş axınları, playbook-lar, phishing kampaniyasının tam analizi və insident koordinasiyası.",
lessons: [
{ title: "IR playbook-ları (runbook)", html: R`
<p><b>Playbook</b> — konkret insident növü üçün addım-addım prosedur. Təzyiq altında struktur verir, heç bir addım unudulmur, nəticələr ardıcıl olur.</p>
<h3>Ümumi playbook strukturu</h3>
<ol><li><b>Trigger/scope:</b> bu playbook nə vaxt işə düşür</li>
<li><b>Severity/prioritet təyini</b></li>
<li><b>Detection & Analysis addımları</b> (nə yoxlamalı, hansı sorğular)</li>
<li><b>Containment addımları</b> (nəyi izolyasiya etməli)</li>
<li><b>Eradication & Recovery</b></li>
<li><b>Communication</b> (kimi xəbərdar etməli, eskalasiya yolu)</li>
<li><b>Sənədləşdirmə və lessons learned</b></li></ol>
<h3>Ən çox istifadə olunan playbook-lar</h3>
<table><tr><th>İnsident növü</th><th>Əsas addımlar</th></tr>
<tr><td><b>Phishing</b></td><td>Başlıq/URL/əlavə analizi → təsirlənən istifadəçiləri tap → məktubu karantinə al → IOC blok → kliklənibsə host/credential yoxla</td></tr>
<tr><td><b>Malware/EDR alert</b></td><td>Proses ağacı → IOC → sandbox → host izolyasiyası → eradication → root cause</td></tr>
<tr><td><b>Ransomware</b></td><td>Dərhal izolyasiya → yayılmanı dayandır → şifrələmə vektorunu tap → backup yoxla → bərpa → forensika</td></tr>
<tr><td><b>Compromised account</b></td><td>Parol sıfırla/deaktiv → sessiyaları ləğv et → fəaliyyət audit → lateral movement yoxla → MFA</td></tr>
<tr><td><b>Brute force</b></td><td>Mənbə IP blok → uğurlu login yoxla → hesab qoru → ekspozisiyanı düzəlt</td></tr>
<tr><td><b>Data exfiltration</b></td><td>Trafik analizi → nə getdi → mənbəni tap → DLP → hüquqi/compliance</td></tr>
<tr><td><b>Insider threat</b></td><td>Diqqətli, HR/hüquq ilə → fəaliyyət audit → dəlil qoru</td></tr></table>
<div class="tip">Playbook-lar sərt deyil — rəhbərlik üçün çərçivədir. Hər insident unikaldır; playbook başlanğıc nöqtəsidir, kritik düşüncəni əvəz etmir.</div>`},
{ title: "Phishing insidentinin tam analizi", html: R`
<p>Phishing L1/L2-nin ən çox qarşılaşdığı insidentdir. Tam iş axını:</p>
<h3>1. Email analizi</h3>
<ul><li><b>Başlıqlar:</b> From, Return-Path, Reply-To uyğunluğu; Received zənciri; Authentication-Results (SPF/DKIM/DMARC); göndərən IP reputasiyası</li>
<li><b>Məzmun:</b> təcililik/sosial mühəndislik, display name vs real domen, qrammatika</li>
<li><b>URL-lər:</b> real href vs mətn; defang et; urlscan.io/VT-də analiz (REAL brauzerdə AÇMA); yönləndirmə zəncirini izlə</li>
<li><b>Əlavələr:</b> fayl tipi; hash → VT; makro varsa olevba; sandbox</li></ul>
<h3>2. Scope (əhatə dairəsi)</h3>
<ul><li>Eyni/oxşar məktubu <b>başqa kim aldı</b>? (email gateway/SIEM-də göndərən/mövzu/URL üzrə axtar)</li>
<li>Neçə nəfər <b>açdı</b>? <b>Kliklədi</b>? (proxy/email loglarında URL)</li>
<li><b>Credential daxil etdimi?</b> (saxta login səhifəsi)</li>
<li><b>Əlavəni işlətdi?</b> (EDR-də host fəaliyyəti)</li></ul>
<h3>3. Containment & Response</h3>
<ul><li>Məktubu <b>bütün poçt qutularından</b> karantinə al (purge)</li>
<li>Göndərən/domen/URL/hash-i <b>blok siyahısına</b> (email gateway, proxy, firewall, EDR)</li>
<li>Kliklənibsə: təsirlənən host-u yoxla/izolyasiya, credential daxil edilsə parol sıfırla + sessiya ləğv + MFA</li>
<li>İstifadəçiləri xəbərdar et (farkındalıq)</li></ul>
<h3>4. Sənədləşdirmə</h3>
<p>IOC-lar, təsirlənən istifadəçilər, görülən tədbirlər, timeline, ATT&CK (T1566). Lessons: necə keçdi filtri? Fərkındalıq lazımdırmı?</p>
<div class="note">Phishing müsahibə ssenarisi çox yayılıb: "İstifadəçi phishing report etdi — addımların nələrdir?" Yuxarıdakı 4 mərhələni (analiz → scope → containment → sənədləşdirmə) struktur kimi söylə. "URL-i real brauzerdə açmaram, sandbox/urlscan istifadə edərəm" demək güclü siqnaldır.</div>`},
{ title: "İnsident koordinasiyası və kommunikasiya", html: R`
<h3>İnsident rolları</h3>
<ul><li><b>Incident Commander (IC):</b> insidenti idarə edir, qərar verir, koordinasiya</li>
<li><b>Analyst/Investigator:</b> texniki təhqiqat (sən)</li><li><b>Scribe:</b> timeline/qeydləri saxlayır</li>
<li><b>Communications:</b> daxili/xarici kommunikasiya</li><li><b>SME-lər:</b> sistem sahibləri, şəbəkə, hüquq</li></ul>
<h3>Kommunikasiya prinsipləri</h3>
<ul><li><b>Faktları rəydən ayır,</b> etibarlılıq səviyyəsini göstər</li>
<li><b>Ehtiyatlı kanallar:</b> hücumçu daxili sistemdə ola bilər — kompromis ola biləcək kanallarda (adi email) həssas məlumat müzakirə etmə (out-of-band)</li>
<li><b>Vaxtında, qısa, dəqiq statuslar</b></li><li><b>Need-to-know:</b> məlumatı yalnız lazım olanlarla paylaş</li></ul>
<h3>Hüquqi və tənzimləyici (compliance)</h3>
<ul><li><b>Data breach bildirişi:</b> bir çox qanun (GDPR, yerli qanunlar) müəyyən müddətdə bildiriş tələb edir (GDPR-da 72 saat)</li>
<li><b>Dəlil bütövlüyü (chain of custody)</b> — hüquqi proses üçün</li>
<li>Standartlar: <b>ISO 27001</b> (ISMS), <b>NIST CSF</b> (Identify, Protect, Detect, Respond, Recover), <b>PCI-DSS</b> (kart), <b>SOC 2</b>, <b>HIPAA</b> (sağlamlıq)</li></ul>
<h3>Post-incident (lessons learned)</h3>
<p>Blame-free (günahlandırmayan) retrospektiv: nə baş verdi, necə aşkarladıq, nə yaxşı getdi, nə pis, nəyi yaxşılaşdırmalı (detection, proses, hardening). "Blameless postmortem" mədəniyyəti öyrənməni təşviq edir. Nəticələr konkret tədbirlərə (action items) çevrilir.</p>`},
{ title: "L2-dən L3-ə: böyümə yolu və threat hunting-ə giriş", html: R`
<h3>L2-də möhkəmlənmək</h3>
<ul><li>Hər insident növü üçün playbook-u rahat icra et</li><li>AD/Linux/web/malware/network təhqiqatında dərinləş</li>
<li>Öz detection qaydalarını yaz və tune et</li><li>Kiçik insidentləri müstəqil idarə et, L1-ə mentorluq et</li>
<li>Bir SIEM-də (Splunk/Sentinel) güvənli sorğu yaz</li><li>Scripting öyrən (Python/PowerShell — avtomatlaşdırma, parsing)</li></ul>
<h3>Threat Hunting-ə giriş (L3-ün əsası)</h3>
<p>Alert gözləmək əvəzinə <b>proaktiv</b> təhdid axtarmaq. Fərziyyə-əsaslı: "Əgər hücumçu X texnikasını işlətsəydi, bizdə belə iz olardı — var mı?"</p>
<ul><li><b>Fərziyyə mənbələri:</b> TI (yeni TTP), ATT&CK, böyük insident sonrası, "crown jewels"</li>
<li><b>Metodlar:</b> stacking (nadir dəyərlər — long tail), baseline-dən kənarlaşma, IOA axtarışı, data aqreqasiyası</li>
<li><b>Nəticə:</b> ya təhdid tapırsan (→ IR), ya da yeni detection qaydası yaradırsan (boşluğu bağla), ya da görünürlük boşluğunu aşkarlayırsan</li></ul>
<h3>Scripting — L2/L3 üçün vacib</h3>
<p>Python (log parsing, API, avtomatlaşdırma, pandas ilə data analizi) və PowerShell (Windows təhqiqat, AD) öyrən. Nümunə: minlərlə log sətrini əl ilə yox, skriptlə təhlil et; VT/AbuseIPDB API ilə kütləvi IOC yoxlaması; pcap-dan IOC çıxarma.</p>
<div class="tip">L3-ə keçid üçün: DFIR (disk/yaddaş forensikası), reverse engineering, threat hunting, detection engineering sahələrindən birində dərinləş. Sertifikatlar: BTL2, GCIH, GCFA, GNFA, GREM (RE), eCTHPv2 (hunting). "Resurslar" bölməsinə bax.</div>
<h3>Təbriklər!</h3>
<p>L2-ni başa vurmaqla sən artıq müstəqil təhqiqat apara, insidentlərə cavab verə və detection yarada bilən analitiksən. L3 modulları threat hunting, forensika və qabaqcıl mövzuları əhatə edir.</p>`}
],
quiz: [
{ q: "Playbook nə üçündür?", o: ["Konkret insident növü üçün struktur addım-addım prosedur", "Malware yazmaq", "Firewall qurmaq", "Parol saxlamaq"], a: 0, e: "Təzyiq altında ardıcıllıq." },
{ q: "Phishing insidentində 'scope' müəyyən etmək nə deməkdir?", o: ["Eyni məktubu başqa kimin aldığını/kliklədiyini tapmaq", "Məktubu silmək", "Serveri söndürmək", "Parol dəyişmək"], a: 0, e: "Əhatə dairəsi." },
{ q: "Phishing URL-ini necə analiz etməlisən?", o: ["urlscan.io/sandbox-da (real brauzerdə AÇMADAN)", "İş kompüterində açaraq", "Klikləyərək", "Heç cür"], a: 0, e: "Təhlükəsiz analiz." },
{ q: "Compromised account playbook-unun əsas addımı hansıdır?", o: ["Parol sıfırla/deaktiv + sessiyaları ləğv et", "Serveri formatla", "Log sil", "Heç nə"], a: 0, e: "Girişi dayandır." },
{ q: "Ransomware insidentində İLK addım nədir?", o: ["Təsirlənən sistemləri izolyasiya et (yayılmanı dayandır)", "Fidyə ödə", "Backup sil", "Gözlə"], a: 0, e: "Containment prioritetdir." },
{ q: "Incident Commander kimdir?", o: ["İnsidenti idarə edən və koordinasiya edən şəxs", "Malware analitiki", "Sistem admini", "İstifadəçi"], a: 0, e: "Qərar verən rol." },
{ q: "'Out-of-band' kommunikasiya niyə vacibdir?", o: ["Hücumçu kompromis olunmuş kanalda ola bilər", "Daha sürətlidir", "Pulsuzdur", "Rahatdır"], a: 0, e: "Həssas müzakirə təhlükəsiz kanalda." },
{ q: "GDPR-da data breach bildiriş müddəti nə qədərdir?", o: ["72 saat", "24 saat", "30 gün", "1 il"], a: 0, e: "Tənzimləyici tələb." },
{ q: "NIST CSF-in 5 funksiyası hansıdır?", o: ["Identify, Protect, Detect, Respond, Recover", "Scan, Test, Fix, Report, Close", "Red, Blue, Purple, Green, Gold", "Plan, Do, Check, Act, Review"], a: 0, e: "Cybersecurity Framework." },
{ q: "Blameless postmortem nə üçündür?", o: ["Günahlandırmadan öyrənmək və təkmilləşdirmək", "Kimisə işdən çıxarmaq", "Logları silmək", "Alert yaratmaq"], a: 0, e: "Öyrənmə mədəniyyəti." },
{ q: "Threat hunting nədir?", o: ["Proaktiv, fərziyyə-əsaslı təhdid axtarışı", "Alert gözləmək", "Firewall qurmaq", "Patch tətbiqi"], a: 0, e: "Alertdən əvvəl axtarmaq." },
{ q: "Threat hunting fərziyyəsi nümunəsi hansıdır?", o: ["'Hücumçu LSASS dump etsəydi, Sysmon 10 izi olardı — var mı?'", "'Alert gözləyim'", "'Patch edim'", "'Log silim'"], a: 0, e: "If-then məntiqi." },
{ q: "Stacking (threat hunting) nədir?", o: ["Nadir dəyərləri (long tail) tapmaq üçün aqreqasiya", "Logları silmək", "Alert yaratmaq", "Parol qırmaq"], a: 0, e: "sort | uniq -c | sort -n." },
{ q: "Uğurlu threat hunt-un nəticəsi nə ola bilər?", o: ["Təhdid tapmaq VƏ YA yeni detection yaratmaq VƏ YA boşluq aşkarlamaq", "Heç nə", "Yalnız alert", "Log silmək"], a: 0, e: "Hər üçü dəyərlidir." },
{ q: "L2/L3 üçün hansı scripting dilləri ən faydalıdır?", o: ["Python və PowerShell", "HTML və CSS", "SQL və PHP", "Java və C++"], a: 0, e: "Avtomatlaşdırma, parsing, AD." },
{ q: "ISO 27001 nədir?", o: ["Informasiya təhlükəsizliyi idarəetmə sistemi (ISMS) standartı", "Malware növü", "Şəbəkə protokolu", "Antivirus"], a: 0, e: "Compliance standartı." },
{ q: "Phishing insidentinin ATT&CK texnikası hansıdır?", o: ["T1566 (Phishing)", "T1486", "T1003", "T1071"], a: 0, e: "Initial Access." }
],
tasks: [
{ t: "Phishing scope sorğusu", d: R`<p>İstifadəçi 'invoice@paypa1-secure.com'-dan gələn phishing məktubu report etdi. Sən başqa kimin bu məktubu aldığını tapmaq istəyirsən.</p>`, q: "Email gateway/SIEM-də hansı sahəyə görə axtarardın ki, eyni göndərəni tapasan? (sahə adı)", ans: ["sender", "from", "sender address", "göndərən", "from address", "sender_address"], hint: "Göndərən ünvanı.", sol: "Göndərən ünvanı (sender/From: invoice@paypa1-secure.com), həmçinin mövzu (subject) və məktubdakı URL/domen üzrə axtararsan — çünki hücumçu göndərən ünvanını dəyişib eyni kampaniyanı davam etdirə bilər. Tam scope: sender + subject + URL + attachment hash üzrə axtar. Sonra bu məktubu alan HAMINI tap və hamısından karantinə al (purge)." },
{ t: "IR playbook ardıcıllığı", d: R`<p>Ransomware alerti: bir server qısa müddətdə yüzlərlə faylı .locked uzantısı ilə dəyişdi və vssadmin delete shadows işlətdi.</p>`, q: "Bu insidentdə İLK görülməli addım nədir? (bir söz)", ans: ["izolyasiya", "containment", "isolate", "izolasiya", "izole"], hint: "Yayılmanı dayandır.", sol: "İzolyasiya (containment) — serveri dərhal şəbəkədən ayır ki, ransomware digər sistemlərə/share-lərə yayılmasın. Sonra: yayılma vektorunu tap (necə girdi — RDP? phishing?), digər təsirlənən hostları müəyyən et, backup bütövlüyünü yoxla, forensik dəlil qoru, bərpa planla, rəhbərlik/hüquq xəbərdar et. vssadmin delete shadows = shadow copy-ləri silib bərpanı çətinləşdirmək (T1490) — ona görə offline backup kritikdir." },
{ t: "Kommunikasiya qərarı", d: R`<p>Böyük insident gedir. Hücumçunun hələ şəbəkədə aktiv olduğundan şübhələnirsən. Komanda adi korporativ email-də insidenti müzakirə etmək istəyir.</p>`, q: "Bu niyə problemlidir? (qısa)", ans: ["__any__"], hint: "Hücumçu email-i oxuya bilər.", sol: "Hücumçu şəbəkədə aktivdirsə, korporativ email/chat-i də kompromis etmiş ola bilər — insident müzakirəsini oxuyub planlarınızı öyrənə və reaksiya verə (dəlil silə, daha sürətli zərər verə) bilər. Həll: 'out-of-band' kommunikasiya — ayrı, təmiz kanal (şəxsi cihaz, fərqli platforma, telefon). Bu, IR-ın əsas prinsiplərindəndir." },
{ t: "Capstone: tam IR praktikası", d: R`<p>L2-nin yekun praktiki məşqi.</p>`, steps: ["TryHackMe 'SOC Level 2' pathway və ya CyberDefenders tam DFIR ssenarisini seç", "Verilən loglardan/pcap-dan tam insident timeline qur (initial access → impact)", "Hər mərhələni ATT&CK texnikası ilə etiketlə", "Bütün IOC-ları çıxar və defang et", "Tam IR hesabatı yaz: xülasə, timeline, IOC, ATT&CK, görülən tədbirlər, tövsiyələr", "Bir detection qaydası (Sigma) təklif et ki, bu hücumu gələcəkdə tutsun", "LetsDefend/TryHackMe SOC L2 yolunu tamamlamağı hədəflə"], sol: "Təbriklər — L2-ni bitirdin! İndi tam insident təhqiqatı apara, hesabat yaza və detection yarada bilərsən. İş bazarında L1/junior L2 vəzifələrinə tam hazırsan. L3 modulları (threat hunting, forensika, RE) səni senior səviyyəyə aparacaq. Portfelini (GitHub, TryHackMe/LetsDefend profil, yazdığın detection qaydaları, blog) qurmağa davam et — bu, iş tapmaqda sertifikatdan az əhəmiyyətli deyil." }
]
}
);
})();
