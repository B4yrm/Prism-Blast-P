/* L1 — Hissə 3: Loglama & SIEM, Alert Triage, Incident Response əsasları, Threat Intel & Endpoint */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;
SOC.modules.push(
// =====================================================================
{
id: "l1-logging", level: "L1", title: "Loglama, SIEM və log mənbələri",
intro: "SOC-un ürəyi SIEM-dir. Log mənbələri, normalizasiya, korrelyasiya və sorğu yazmağın əsasları.",
lessons: [
{ title: "Log nədir və niyə vacibdir?", html: R`
<p><b>Log</b> — sistemdə baş verən hadisənin vaxt damğalı qeydidir. SOC analitikin işinin böyük hissəsi logları oxumaq, əlaqələndirmək və onlardan hekayə qurmaqdır.</p>
<h3>Yaxşı logda nə olur? (5W)</h3>
<ul><li><b>When</b> — vaxt (timestamp, timezone ilə!)</li><li><b>Who</b> — istifadəçi/hesab/mənbə IP</li><li><b>What</b> — hadisə/əməliyyat</li><li><b>Where</b> — host/sistem/proses</li><li><b>Outcome</b> — uğurlu/uğursuz</li></ul>
<h3>Əsas log mənbələri</h3>
<table><tr><th>Mənbə</th><th>Nə verir</th></tr>
<tr><td>Windows Event Log / Sysmon</td><td>Logon, proses, registry, şəbəkə (endpoint)</td></tr>
<tr><td>Linux (syslog/auditd)</td><td>Auth, proses, əmrlər</td></tr>
<tr><td>EDR</td><td>Endpoint davranışı, proses ağacı, telemetriya</td></tr>
<tr><td>Firewall</td><td>İcazə/blok, bağlantılar, NAT</td></tr>
<tr><td>Proxy / Web Gateway</td><td>İstifadəçilərin ziyarət etdiyi URL-lər</td></tr>
<tr><td>DNS server</td><td>Domen sorğuları</td></tr>
<tr><td>IDS/IPS (Suricata/Snort)</td><td>Şəbəkə imza xəbərdarlıqları</td></tr>
<tr><td>Veb server (Apache/Nginx/IIS)</td><td>HTTP sorğuları</td></tr>
<tr><td>VPN</td><td>Uzaq girişlər</td></tr>
<tr><td>AD / Domain Controller</td><td>Autentifikasiya, Kerberos</td></tr>
<tr><td>Cloud (AWS CloudTrail, Azure AD/Entra, O365)</td><td>API çağırışları, girişlər, konfiqurasiya</td></tr>
<tr><td>Email Gateway</td><td>Mail axını, spam/phishing</td></tr></table>
<h3>Sysmon</h3>
<p>Microsoft Sysinternals-ın pulsuz aləti — standart Windows loglamasını kəskin gücləndirir. Vacib Sysmon Event ID-ləri:</p>
<table><tr><th>ID</th><th>Hadisə</th></tr>
<tr><td>1</td><td>Process Creation (command line, hash, parent ilə — qızıl!)</td></tr>
<tr><td>3</td><td>Network Connection</td></tr><tr><td>7</td><td>Image/DLL Loaded</td></tr>
<tr><td>8</td><td>CreateRemoteThread (code injection)</td></tr><tr><td>10</td><td>ProcessAccess (LSASS access!)</td></tr>
<tr><td>11</td><td>FileCreate</td></tr><tr><td>12/13/14</td><td>Registry hadisələri</td></tr>
<tr><td>15</td><td>FileCreateStreamHash (ADS/Mark-of-the-Web)</td></tr><tr><td>22</td><td>DNS Query</td></tr></table>
<p>SwiftOnSecurity-nin pulsuz Sysmon konfiqi sahədə məşhur başlanğıc nöqtəsidir.</p>`},
{ title: "SIEM necə işləyir?", html: R`
<p><b>SIEM</b> (Security Information and Event Management) müxtəlif mənbələrdən logları <b>toplayır</b>, <b>normalizasiya edir</b>, <b>əlaqələndirir (correlate)</b>, <b>alert yaradır</b> və <b>saxlayır</b>.</p>
<h3>Məlumat axını (pipeline)</h3>
<ol><li><b>Collection</b> — agent (Splunk UF, Winlogbeat, Wazuh agent), syslog, API</li>
<li><b>Parsing/Normalization</b> — xam logu sahələrə (fields) ayırmaq (src_ip, user, event_id...). Ümumi sxemlər: <b>ECS</b> (Elastic), <b>CIM</b> (Splunk), OSSEM.</li>
<li><b>Enrichment</b> — kontekst əlavə etmək (GeoIP, threat intel, asset məlumatı, istifadəçi şöbəsi)</li>
<li><b>Correlation & Detection</b> — qaydalar, əlaqələndirmə (məs. 5 dəqiqədə 50 uğursuz + 1 uğurlu login)</li>
<li><b>Alerting</b> — analitikə bildiriş</li>
<li><b>Storage / Retention</b> — saxlama (compliance üçün aylar/illər)</li></ol>
<h3>Məşhur SIEM-lər</h3>
<table><tr><th>SIEM</th><th>Sorğu dili</th></tr>
<tr><td>Splunk</td><td>SPL</td></tr><tr><td>Microsoft Sentinel</td><td>KQL</td></tr>
<tr><td>Elastic (ELK)</td><td>KQL / Lucene / ES|QL</td></tr><tr><td>IBM QRadar</td><td>AQL</td></tr>
<tr><td>Wazuh (pulsuz, açıq)</td><td>—</td></tr><tr><td>Chronicle / Google SecOps</td><td>YARA-L / UDM</td></tr></table>
<h3>Niyə korrelyasiya?</h3>
<p>Tək bir log çox vaxt mənasızdır. Güc əlaqələndirmədədir: <i>"VPN girişi Bakıdan, 3 dəqiqə sonra eyni hesab RDP ilə Moskvadan"</i> — ayrı-ayrı loglar normal görünür, birlikdə "impossible travel" alerti yaradır.</p>
<div class="note"><b>SOC metrikaları:</b> MTTD (Mean Time To Detect), MTTR (Mean Time To Respond), alert həcmi, false positive nisbəti, dwell time (hücumçunun aşkarlanana qədər sistemdə qaldığı müddət). L1 bu metrikaları yaxşılaşdırmağa birbaşa təsir edir.</div>`},
{ title: "Sorğu yazmağın əsasları (SPL və KQL)", html: R`
<p>Hər SIEM-in öz dili var, amma məntiq oxşardır: <b>filtrlə → qrupla → say → sırala</b>. İki ən çox işlənən dili göstərirəm.</p>
<h3>Splunk SPL nümunələri</h3>
<pre># Uğursuz loginlər, istifadəçiyə görə say
index=windows EventCode=4625
| stats count by Account_Name, src_ip
| sort -count

# Potensial password spraying (çox hesab, bir IP)
index=windows EventCode=4625
| stats dc(Account_Name) as users count by src_ip
| where users > 10

# PowerShell encoded command axtarışı
index=sysmon EventCode=1 (CommandLine="*-enc*" OR CommandLine="*-EncodedCommand*")
| table _time, host, User, CommandLine</pre>
<h3>Microsoft Sentinel / Defender KQL nümunələri</h3>
<pre>// Uğursuz loginlər
SecurityEvent
| where EventID == 4625
| summarize count() by TargetAccount, IpAddress
| sort by count_ desc

// Password spraying
SecurityEvent
| where EventID == 4625
| summarize Users = dcount(TargetAccount), Attempts = count() by IpAddress
| where Users > 10

// Şübhəli proses yaradılması
DeviceProcessEvents
| where FileName == "powershell.exe"
| where ProcessCommandLine has_any ("-enc","DownloadString","IEX","FromBase64String")
| project Timestamp, DeviceName, AccountName, ProcessCommandLine</pre>
<h3>Ümumi əməliyyatlar</h3>
<table><tr><th>Məqsəd</th><th>SPL</th><th>KQL</th></tr>
<tr><td>Filtr</td><td>search / where</td><td>where</td></tr>
<tr><td>Say/qruplaşdır</td><td>stats count by</td><td>summarize count() by</td></tr>
<tr><td>Unikal say</td><td>dc()</td><td>dcount()</td></tr>
<tr><td>Sırala</td><td>sort -field</td><td>sort by field desc</td></tr>
<tr><td>Sütun seç</td><td>table / fields</td><td>project</td></tr>
<tr><td>Vaxt</td><td>earliest=-24h</td><td>where Timestamp > ago(24h)</td></tr>
<tr><td>Saymaq (top)</td><td>top 10 field</td><td>top 10 by count_</td></tr></table>
<div class="tip">Müsahibədə çox vaxt "bu alertdə hansı sorğunu yazardın?" soruşulur. Dəqiq sintaksisdən çox <b>məntiqi</b> göstər: hansı index/cədvəl, hansı filtr, nəyə görə qrupladığın. Praktika üçün: Splunk "Boss of the SOC" (BOTS) pulsuz datasetləri, Microsoft Sentinel training lab.</div>`},
{ title: "True Positive, False Positive və alert keyfiyyəti", html: R`
<table><tr><th></th><th>Həqiqətən zərərli</th><th>Həqiqətən zərərsiz</th></tr>
<tr><td><b>Alert yarandı</b></td><td>✅ True Positive (TP)</td><td>⚠️ False Positive (FP)</td></tr>
<tr><td><b>Alert yaranmadı</b></td><td>❌ False Negative (FN) — ən təhlükəli!</td><td>✅ True Negative (TN)</td></tr></table>
<ul><li><b>True Positive:</b> real təhlükə düzgün aşkarlanıb → cavab ver.</li>
<li><b>False Positive:</b> yanlış həyəcan (məs. admin öz işini görür). Vaxt itkisi, "alert fatigue" səbəbi. L1-in böyük işi FP-ləri düzgün bağlamaqdır.</li>
<li><b>False Negative:</b> təhlükə buraxılıb, alert yaranmayıb. Ən qorxulusu — detection boşluğu.</li>
<li><b>Benign True Positive:</b> fəaliyyət həqiqətən baş verib (alert düzdür) amma səlahiyyətli/zərərsizdir (məs. icazəli pentest).</li></ul>
<h3>FP-ni necə qiymətləndirirsən? Soruş:</h3>
<ol><li>Bu fəaliyyət bu istifadəçi/host üçün normaldırmı? (baseline)</li><li>Vaxt məntiqlidirmi? (iş saatı, planlaşdırılmış iş)</li><li>Mənbə etibarlıdırmı? (daxili admin alət, məlum skaner)</li><li>Dəyişiklik idarəetmə/change ticket varmı?</li><li>Digər hadisələrlə korrelyasiya olunurmu?</li></ol>
<div class="warn">FP-ni bağlayarkən <b>heç vaxt baxmadan bağlama</b>. "Bu alert həmişə FP olur" düşüncəsi təhlükəlidir — hücumçular məhz adi görünən fəaliyyətin arxasında gizlənir. Hər bağlamanı sənədləşdir: niyə FP olduğunu yaz.</div>
<h3>Tuning (tənzimləmə)</h3>
<p>Təkrarlanan FP-ləri L2/detection engineer ilə birlikdə qaydanı dəqiqləşdirərək (whitelist, kontekst əlavəsi, threshold) azaltmaq lazımdır — amma bu, aşkarlamanı kor etməyəcək şəkildə.</p>`}
],
quiz: [
{ q: "SIEM-in əsas funksiyası nədir?", o: ["Logları toplamaq, əlaqələndirmək və alert yaratmaq", "Faylları şifrələmək", "Virusları silmək", "Şəbəkəni qurmaq"], a: 0, e: "Security Information and Event Management." },
{ q: "Sysmon Event ID 1 nəyi qeyd edir?", o: ["Process Creation (command line və hash ilə)", "Logon", "DNS sorğusu", "Registry dəyişikliyi"], a: 0, e: "Proses yaradılması — threat hunting üçün qızıl." },
{ q: "Sysmon Event ID 3 nədir?", o: ["Network Connection", "Process Creation", "File Create", "Image Load"], a: 0, e: "Şəbəkə bağlantısı." },
{ q: "LSASS prosesinə girişi hansı Sysmon Event ID qeyd edir?", o: ["10 (ProcessAccess)", "1", "11", "22"], a: 0, e: "Credential dump cəhdlərini görmək üçün." },
{ q: "Normalizasiya nə deməkdir?", o: ["Xam logu standart sahələrə ayırmaq", "Logları silmək", "Logları şifrələmək", "Logları sıxışdırmaq"], a: 0, e: "src_ip, user, event_id kimi strukturlaşdırmaq." },
{ q: "Enrichment nədir?", o: ["Loga əlavə kontekst (GeoIP, TI, asset) əlavə etmək", "Logu qısaltmaq", "Alert yaratmaq", "Logu arxivləmək"], a: 0, e: "Kontekst analizi asanlaşdırır." },
{ q: "'Impossible travel' alerti nəyi aşkarlayır?", o: ["Qısa müddətdə coğrafi cəhətdən mümkünsüz iki giriş", "Çox parol", "Böyük fayl", "DNS sorğusu"], a: 0, e: "Korrelyasiya nümunəsi." },
{ q: "Splunk-un sorğu dili necə adlanır?", o: ["SPL", "KQL", "AQL", "SQL"], a: 0, e: "Search Processing Language." },
{ q: "Microsoft Sentinel-in sorğu dili hansıdır?", o: ["KQL", "SPL", "AQL", "YARA-L"], a: 0, e: "Kusto Query Language." },
{ q: "KQL-də unikal dəyərləri saymaq üçün hansı funksiya?", o: ["dcount()", "count()", "sum()", "distinct()"], a: 0, e: "SPL-də dc()." },
{ q: "False Negative nədir?", o: ["Real təhlükə buraxıldı, alert yaranmadı", "Yanlış həyəcan", "Düzgün aşkarlama", "Normal fəaliyyət"], a: 0, e: "Ən təhlükəli hal — detection boşluğu." },
{ q: "False Positive nədir?", o: ["Zərərsiz fəaliyyətə yanlış alert", "Buraxılmış təhlükə", "Düzgün aşkarlanmış hücum", "Log silinməsi"], a: 0, e: "Alert fatigue səbəbi." },
{ q: "İcazəli pentest komandasının fəaliyyətinə yaranan düzgün alert necə təsnif olunur?", o: ["Benign True Positive", "False Positive", "False Negative", "True Negative"], a: 0, e: "Fəaliyyət real, amma səlahiyyətli." },
{ q: "FP-ni bağlamazdan əvvəl ən vacib nədir?", o: ["Araşdırıb səbəbini sənədləşdirmək", "Dərhal bağlamaq", "Qaydanı silmək", "Logu silmək"], a: 0, e: "Baxmadan bağlamaq təhlükəlidir." },
{ q: "MTTD nəyi ölçür?", o: ["Aşkarlamaya qədər orta vaxt", "Cavaba qədər orta vaxt", "Alert sayı", "FP nisbəti"], a: 0, e: "Mean Time To Detect." },
{ q: "Dwell time nədir?", o: ["Hücumçunun aşkarlanana qədər sistemdə qaldığı müddət", "Alert müddəti", "Log saxlama müddəti", "Patch müddəti"], a: 0, e: "Nə qədər az, bir o qədər yaxşı." },
{ q: "Hansı alət pulsuz açıq mənbə SIEM/XDR-dir?", o: ["Wazuh", "Splunk Enterprise", "QRadar", "Sentinel"], a: 0, e: "Homelab üçün ideal." },
{ q: "Sysmon Event ID 22 nəyi qeyd edir?", o: ["DNS Query", "Process Creation", "Logon", "File Delete"], a: 0, e: "DNS tunneling aşkarlanması üçün faydalı." }
],
tasks: [
{ t: "SPL sorğusu yaz", d: R`<p>Windows Security loglarında (index=windows) bir IP-dən 10-dan çox fərqli hesaba uğursuz login (EventCode 4625) edən mənbələri tapmaq istəyirsən (password spraying).</p>`, q: "Qruplaşdırmadan sonra hansı funksiya unikal hesab sayını verir? (SPL funksiyası)", ans: ["dc", "dc()", "distinct_count", "dc(account_name)"], hint: "distinct count.", sol: "<code>index=windows EventCode=4625 | stats dc(Account_Name) as users count by src_ip | where users > 10</code> — dc() unikal hesabları sayır. Çox hesab + bir IP = spraying." },
{ t: "KQL sorğusu təhlili", d: R`<pre>DeviceProcessEvents
| where FileName == "powershell.exe"
| where ProcessCommandLine has "FromBase64String"
| project Timestamp, DeviceName, AccountName, ProcessCommandLine</pre>`, q: "Bu sorğu nəyi axtarır? (qısa: hansı şübhəli davranış)", ans: ["encoded powershell", "base64 powershell", "kodlaşdırılmış powershell", "obfuscated powershell", "base64", "powershell base64"], hint: "FromBase64String = Base64 decode.", sol: "Base64 ilə kodlaşdırılmış/gizlədilmiş PowerShell icrası (T1059.001 + T1027 obfuscation). Hücumçular əmrlərini gizlətmək üçün Base64 istifadə edir. Tapılan CommandLine-ı CyberChef ilə decode edib həqiqi əmri görmək lazımdır." },
{ t: "FP yoxsa TP?", d: R`<p>Alert: "certutil.exe ilə fayl endirildi" — <code>certutil -urlcache -f http://10.0.0.50/update.exe C:\temp\update.exe</code>. Kontekst: mənbə 10.0.0.50 daxili WSUS/software paylaşım serveri deyil; həmin host-da change ticket yoxdur; istifadəçi adi işçidir, admin deyil.</p>`, q: "Bu TP yoxsa FP? (iki hərf)", ans: ["tp", "true positive"], hint: "certutil LOLBin, naməlum daxili IP, admin deyil, ticket yox.", sol: "True Positive (şübhəli). certutil LOLBin kimi fayl endirmək üçün sui-istifadə olunur (T1105 Ingress Tool Transfer). Naməlum mənbə, dəyişiklik qeydi yoxdur, adi istifadəçi. Addım: endirilən faylın hash-ini al, VT-də yoxla, host-u araşdır, L2-yə eskalasiya. Qeyd: əgər mənbə təsdiqlənmiş daxili yeniləmə serveri olsaydı və change ticket olsaydı, bu benign ola bilərdi — ona görə kontekst həmişə yoxlanır." },
{ t: "Pulsuz SIEM lab qur (praktika)", d: R`<p>Real SIEM təcrübəsi qazanmaq üçün ən yaxşı yollardan biri.</p>`, steps: ["Seçim A: LetsDefend.io və ya TryHackMe 'SOC Level 1' pathway-ə başla (brauzerdə, quraşdırma yox)", "Seçim B: Homelab-da Wazuh (tək node) və ya Splunk Free quraşdır", "Windows VM-ə Sysmon quraşdır (SwiftOnSecurity konfiqi ilə)", "VM- də qəsdən 'powershell -enc ...' işə sal və SIEM/Event Log-da tap", "Yazdığın ilk detection sorğusunu SOC notebook-una qeyd et"], sol: "Real SIEM-də sorğu yazmaq müsahibədə ən çox soruşulan praktiki bacarıqdır. LetsDefend və TryHackMe real alertlər üzərində işləməyə imkan verir." }
]
},
// =====================================================================
{
id: "l1-triage", level: "L1", title: "Alert Triage və təhqiqat metodologiyası",
intro: "L1-in gündəlik işi: alert gələndə addım-addım nə etmək. Bu modul sənin əsas iş prosesindir.",
lessons: [
{ title: "Triage prosesi: addım-addım", html: R`
<p>Alert gələndə panika yoxdur — strukturlu yanaşma var. Bu axını əzbərlə:</p>
<ol><li><b>Oxu və anla:</b> Alert nə deyir? Hansı qayda işə düşüb? Hansı ATT&CK texnikası?</li>
<li><b>Kontekst topla:</b> Hansı host/istifadəçi? Daxili yoxsa xarici? Kritik aktivdirmi (DC, server)? İş saatıdırmı?</li>
<li><b>5W1H sualları ver:</b> Who, What, When, Where, Why, How.</li>
<li><b>Göstəriciləri (IOC) çıxar:</b> IP, domen, hash, istifadəçi, fayl adı.</li>
<li><b>Zənginləşdir (enrich):</b> IP/domen/hash-i threat intel-də yoxla (VirusTotal, AbuseIPDB, urlscan). GeoIP. Reputasiya.</li>
<li><b>Korrelyasiya:</b> Bu host/istifadəçi ilə bağlı başqa hadisələr varmı? Timeline qur.</li>
<li><b>Qərar ver:</b> False Positive? True Positive? Daha çox məlumat lazım?</li>
<li><b>Hərəkət et:</b> FP-ni sənədləşdirib bağla, TP-ni eskalasiya et/playbook icra et.</li>
<li><b>Sənədləşdir:</b> Ticket-də hər şeyi yaz — nə gördün, nə etdin, nəticə.</li></ol>
<h3>Prioritetləşdirmə (hansını əvvəl?)</h3>
<p>Həcm çoxdur, hamısına eyni vaxt verə bilməzsən. Prioritet = <b>təsir (severity) × etibarlılıq (fidelity) × aktivin kritikliyi</b>.</p>
<table><tr><th>Yüksək prioritet</th><th>Aşağı prioritet</th></tr>
<tr><td>Kritik serverdə (DC, DB) aktiv hücum</td><td>Bloklanmış tək bir skan cəhdi</td></tr>
<tr><td>Ransomware/encryption əlaməti</td><td>Köhnəlmiş imza xəbərdarlığı</td></tr>
<tr><td>Uğurlu credential access</td><td>Test mühitində səs-küy</td></tr>
<tr><td>Data exfiltration</td><td>Məlum FP nümunəsi (sənədləşdirilmiş)</td></tr></table>
<div class="tip">Zərərli görünən hər şey dərhal eskalasiya DEYİL — amma şübhə varsa və öz səviyyəndə həll edə bilmirsənsə, eskalasiya et. "Yanlış eskalasiya" buraxılmış hücumdan yaxşıdır. Komanda prosedurunu izlə.</div>`},
{ title: "Threat Intelligence alətləri ilə zənginləşdirmə", html: R`
<p>IOC-u (göstərici) öyrənmək üçün pulsuz OSINT alətləri. L1 bunları gündə dəfələrlə istifadə edir.</p>
<table><tr><th>Alət</th><th>Nə üçün</th></tr>
<tr><td><b>VirusTotal</b></td><td>Fayl hash, URL, domen, IP — çoxlu AV mühərriki + kontekst. Faylı YOX, hash-i axtar (həssas fayllar yüklənməməlidir)</td></tr>
<tr><td><b>AbuseIPDB</b></td><td>IP reputasiyası, şikayət tarixçəsi</td></tr>
<tr><td><b>urlscan.io</b></td><td>URL-i təhlükəsiz "ziyarət" edib skrinшот, resurslar, əlaqələr</td></tr>
<tr><td><b>Shodan</b></td><td>İnternetə açıq cihaz/xidmət axtarışı</td></tr>
<tr><td><b>AlienVault OTX</b></td><td>Threat intel icması, IOC pulse-ları</td></tr>
<tr><td><b>Hybrid Analysis / Joe Sandbox / any.run</b></td><td>Malware davranış analizi (sandbox)</td></tr>
<tr><td><b>MXToolbox</b></td><td>DNS, email, blacklist yoxlaması</td></tr>
<tr><td><b>GreyNoise</b></td><td>IP "internet fon səsi"dirmi (kütləvi skaner) yoxsa hədəflənmiş?</td></tr>
<tr><td><b>Censys</b></td><td>Host/sertifikat kəşfiyyatı</td></tr>
<tr><td><b>ThreatFox / MalwareBazaar (abuse.ch)</b></td><td>Məlum malware IOC-ları və nümunələri</td></tr>
<tr><td><b>Whois / DomainTools</b></td><td>Domenin yaşı, qeydiyyatçısı (yeni domen = şübhə)</td></tr></table>
<h3>IOC növləri (və "Pyramid of Pain")</h3>
<p>David Bianco-nun piramidası: hücumçu üçün dəyişdirilməsi nə qədər çətindir?</p>
<ol><li>Hash (ən asan dəyişir — bir bit kifayətdir)</li><li>IP ünvanları</li><li>Domen adları</li><li>Şəbəkə/host artefaktları</li><li>Alətlər</li><li><b>TTP</b> (ən çətin — davranışı dəyişmək hücumçuya ən bahadır)</li></ol>
<p>Nəticə: hash/IP bloklamaq asandır amma müvəqqəti; davranışa (TTP) əsaslanan aşkarlama daha davamlıdır.</p>
<div class="warn"><b>OPSEC qaydası:</b> Bəzi alətlərdə IOC-u birbaşa axtarmaq hücumçuya "aşkarlandım" siqnalı verə bilər (məs. onların C2 domenini aktiv ziyarət etmək). Təşkilatın prosedurunu izlə — passiv mənbələri (VT, passive DNS) üstün tut, aktiv probing üçün icazə al.</div>`},
{ title: "Ticket yazma və eskalasiya", html: R`
<p>SOC-da "sənədləşdirilməyən iş = görülməyən iş". Yaxşı ticket yazmaq L1-in ən vacib bacarıqlarından biridir — işə götürənlər bunu çox qiymətləndirir.</p>
<h3>Yaxşı ticketin strukturu</h3>
<ul><li><b>Başlıq:</b> qısa, dəqiq ("Possible successful brute-force on DC01 — admin account from 185.220.101.45")</li>
<li><b>Severity/Priority:</b> (Low/Medium/High/Critical)</li>
<li><b>Xülasə:</b> 2-3 cümlə — nə baş verib</li>
<li><b>Timeline:</b> vaxt damğalı hadisələr ardıcıllığı</li>
<li><b>IOC-lar:</b> IP, domen, hash, hesab, host</li>
<li><b>Dəlillər:</b> log çıxarışları, sorğu nəticələri, skrinшотlar, enrichment nəticələri (VT skoru və s.)</li>
<li><b>ATT&CK:</b> aidiyyəti texnikalar</li>
<li><b>Təhlil/Qiymət:</b> niyə TP/FP düşünürsən</li>
<li><b>Görülən tədbirlər:</b> nə etdin</li>
<li><b>Tövsiyə/Növbəti addım:</b> eskalasiya? containment?</li></ul>
<h3>Yaxşı yazı prinsipləri</h3>
<ul><li>Fakt və rəyi ayır ("185.220.101.45-dən 1247 uğursuz login <b>müşahidə olundu</b>" vs "bu <b>ehtimal ki</b> brute force-dur")</li>
<li>Aydın, qısa, jarqonsuz (növbəti analitik/menecer oxuyacaq)</li><li>UTC vaxt zonasını göstər</li><li>Təxmin etmə — bilmədiyini "naməlum" kimi qeyd et</li></ul>
<h3>Eskalasiya nə vaxt?</h3>
<ul><li>Öz səviyyəndə həll edə bilmirsən / əlavə icazə/alət lazımdır</li><li>Təsdiqlənmiş və ya yüksək ehtimallı TP</li><li>Kritik aktiv təsirlənib</li><li>Aktiv/davam edən hücum əlaməti</li><li>Containment qərarı tələb olunur (host izolyasiyası, hesab bloklama)</li></ul>
<p>Eskalasiyada: aydın xülasə, nə etdiyin, niyə eskalasiya etdiyin, hansı dəstəyin lazım olduğu. L2 sıfırdan başlamamalıdır — sənin işin üzərində qurmalıdır.</p>`},
{ title: "SOC-da ünsiyyət, növbə və peşəkar davranış", html: R`
<h3>Shift handover (növbə təhvili)</h3>
<p>Növbə dəyişəndə növbəti analitik bilməlidir: açıq/davam edən insidentlər, gözlənilən fəaliyyət (planlaşdırılmış iş, maintenance), yoxlanmalı alertlər, mühüm kontekst. Yaxşı handover olmasa, hücum "çatlaqlardan sürüşür".</p>
<h3>Analitikin dəyərli xüsusiyyətləri</h3>
<ul><li><b>Maraq və şübhəçilik:</b> "niyə?" soruşmaq, hər şeyi dəyərincə qəbul etməmək</li>
<li><b>Diqqət:</b> kiçik anomaliyalar böyük insidentlərin ilk əlamətidir</li>
<li><b>Sakitlik:</b> təzyiq altında strukturlu düşünmək</li>
<li><b>Ünsiyyət:</b> texniki şeyi aydın izah etmək</li>
<li><b>Davamlı öyrənmə:</b> təhlükələr daim dəyişir</li>
<li><b>Komanda:</b> köməyini istəmək və kömək etmək</li></ul>
<h3>Bilişsel tələlər (bunlardan qaç)</h3>
<ul><li><b>Alert fatigue:</b> çox alertdən kütləşib hamısını FP saymaq</li>
<li><b>Confirmation bias:</b> yalnız öz fərziyyəni təsdiqləyən dəlilə baxmaq</li>
<li><b>Tunnel vision:</b> bir izə o qədər fokuslanmaq ki, böyük şəkli itirmək</li>
<li><b>Normalcy bias:</b> "bizdə heç vaxt belə olmayıb, deməli indi də deyil"</li></ul>
<h3>Etika və məxfilik</h3>
<p>SOC analitik həssas məlumata (işçi fəaliyyəti, şəxsi data) çıxış əldə edir. Bu gücdən yalnız iş məqsədilə istifadə et. Araşdırdığın məlumatı sui-istifadə etmə. Hadisə məlumatını kənar şəxslərlə paylaşma. İcazəsiz sistemə heç vaxt "maraq üçün" belə girmə.</p>
<div class="note">Müsahibədə davranış sualları (behavioral): "Təzyiq altında necə işləyirsən?", "Bilmədiyin alertlə qarşılaşsan nə edərsən?", "Bir dəfə səhv etdiyin vəziyyət?" Cavablarında struktur, təvazökarlıq, öyrənmə həvəsi göstər. STAR metodu (Situation, Task, Action, Result).</div>`}
],
quiz: [
{ q: "Alert gələndə ilk addım nədir?", o: ["Alerti oxuyub nə dediyini anlamaq", "Dərhal host-u söndürmək", "Alerti bağlamaq", "L3-ə zəng etmək"], a: 0, e: "Anlamadan hərəkət etmə." },
{ q: "IOC nə deməkdir?", o: ["Indicator of Compromise", "Internal Operations Center", "Incident Order Code", "IP Over Cable"], a: 0, e: "Kompromis göstəricisi: IP, hash, domen və s." },
{ q: "Bir fayl hash-ini təhlükəsiz yoxlamaq üçün hansı alət?", o: ["VirusTotal", "Wireshark", "nmap", "John the Ripper"], a: 0, e: "Hash ilə axtar, faylı yükləmə." },
{ q: "IP ünvanının kütləvi internet skaneri olub-olmadığını hansı alət göstərir?", o: ["GreyNoise", "CyberChef", "Hashcat", "Burp"], a: 0, e: "İnternet 'fon səsi'ni ayırır." },
{ q: "URL-i təhlükəsiz təhlil etmək üçün hansı alət?", o: ["urlscan.io", "notepad", "ping", "netstat"], a: 0, e: "Real brauzerdə açmadan analiz." },
{ q: "Pyramid of Pain-də hücumçu üçün dəyişdirilməsi ən çətin olan nədir?", o: ["TTP (davranış)", "Hash", "IP ünvanı", "Domen"], a: 0, e: "Davranışı dəyişmək ən bahalıdır." },
{ q: "Hansı IOC-u dəyişdirmək hücumçu üçün ən asandır?", o: ["Fayl hash-i", "TTP", "Alətlər", "Host artefaktları"], a: 0, e: "Bir bit dəyişsə hash dəyişir." },
{ q: "Yeni qeydiyyatdan keçmiş domen niyə şübhəlidir?", o: ["Phishing/C2 domenləri çox vaxt yeni olur", "Həmişə təhlükəsizdir", "Köhnə domenlər təhlükəlidir", "Domen yaşının önəmi yoxdur"], a: 0, e: "Whois ilə yaşı yoxlanır." },
{ q: "Ticket yazarkən ən vacib prinsip nədir?", o: ["Fakt və rəyi aydın ayırmaq, sənədləşdirmək", "Qısa olsun deyə təfərrüatları buraxmaq", "Yalnız başlıq yazmaq", "Jarqonla doldurmaq"], a: 0, e: "Başqası oxuyub davam edə bilməlidir." },
{ q: "Eskalasiya nə vaxt uyğundur?", o: ["Yüksək ehtimallı TP və ya öz səviyyəndə həll edə bilmədikdə", "Hər alertdə", "Heç vaxt", "Yalnız növbə sonunda"], a: 0, e: "Şübhə + öz imkanından kənar." },
{ q: "'Benign True Positive' nümunəsi hansıdır?", o: ["İcazəli pentest komandasının skanı", "Uğurlu ransomware", "Buraxılmış hücum", "Zərərsiz fəaliyyətə yanlış alert"], a: 0, e: "Fəaliyyət real, amma səlahiyyətli." },
{ q: "Alert fatigue nədir?", o: ["Çox alertdən kütləşib diqqəti itirmək", "Serverin yorulması", "Şəbəkə gecikməsi", "Log çatışmazlığı"], a: 0, e: "Təhlükəli bilişsel tələ." },
{ q: "Confirmation bias nədir?", o: ["Yalnız fərziyyəni təsdiqləyən dəlilə baxmaq", "Çox log toplamaq", "Alerti bağlamaq", "Sürətli yazmaq"], a: 0, e: "Əks dəlili görməzlikdən gəlmək." },
{ q: "Shift handover niyə vacibdir?", o: ["Açıq insidentlər növbələr arası itməsin deyə", "Maaş hesablamaq üçün", "Server restartı üçün", "Lisenziya üçün"], a: 0, e: "Davamlılıq təmin edir." },
{ q: "Prioritetləşdirmədə nə nəzərə alınır?", o: ["Severity × etibarlılıq × aktivin kritikliyi", "Yalnız alert vaxtı", "Yalnız alert rəngi", "Analitikin əhvalı"], a: 0, e: "Risk-əsaslı prioritet." },
{ q: "FP-ni bağlayarkən nə etməlisən?", o: ["Səbəbini araşdırıb sənədləşdirmək", "Heç nə yazmadan bağlamaq", "Qaydanı dərhal silmək", "Logları təmizləmək"], a: 0, e: "Hər bağlama əsaslandırılmalıdır." },
{ q: "Davranış müsahibəsində STAR nəyi bildirir?", o: ["Situation, Task, Action, Result", "Scan, Test, Alert, Report", "Start,Ток, Attack, Resolve", "Security Threat Analysis Report"], a: 0, e: "Strukturlu cavab metodu." }
],
tasks: [
{ t: "IOC çıxar", d: R`<p>Alert mətni:</p><pre>[ALERT] Suspicious outbound connection
Host: FIN-WKS-14 (10.20.5.33)
User: r.aliyev
Process: C:\Users\r.aliyev\AppData\Local\Temp\invoice.exe
Dest: 193.42.33.17:443
Domain: secure-doc-viewer[.]xyz
SHA256: 3f8a...e21c</pre>`, q: "Bu alertdə neçə fərqli IOC növü var (IP, domen, hash, fayl yolu daxil)?", ans: ["4"], hint: "IP, domen, hash, fayl yolu/adı.", sol: "4 növ IOC: (1) IP 193.42.33.17; (2) domen secure-doc-viewer[.]xyz (defang edilmiş — nöqtə köşəli mötərizədə); (3) SHA256 hash; (4) fayl yolu/adı (Temp-dən işləyən invoice.exe). Təhqiqat: hash-i VT-də yoxla, IP-ni AbuseIPDB/GreyNoise-da, domeni urlscan/whois-da (yeni .xyz domeni şübhəli). Temp-dən 'invoice.exe' işləməsi — klassik phishing payload nümunəsi." },
{ t: "Ticket başlığı yaz", d: R`<p>Hadisə: DC01 serverində admin hesabına 185.220.101.45 IP-sindən 1200+ uğursuz login, sonra 1 uğurlu login və admin imtiyazları. Vaxt: 2026-03-12 02:31 UTC.</p>`, q: "Yaxşı bir ticket başlığı yaz (azı: nə, harada, kim):", ans: ["__any__"], hint: "Qısa, dəqiq, actionable. Məs: 'Possible successful brute-force — admin on DC01 from 185.220.101.45'", sol: "Yaxşı nümunə: <b>'[High] Possible successful brute-force — admin account on DC01 from 185.220.101.45 (2026-03-12 02:31 UTC)'</b>. Severity, hadisə növü, hesab, host, mənbə IP və vaxt var. Pis nümunə: 'alert var', 'login problemi', 'yoxlanmalıdır'. (İstənilən cavab qəbul edilir — özünü yoxla: başlıq oxuyan şəxs baxmadan nə baş verdiyini anlayırmı?)" },
{ t: "Təhqiqat ardıcıllığı", d: R`<p>'powershell.exe DownloadString ilə xarici IP-yə bağlandı' alerti gəldi.</p>`, q: "Enrichment mərhələsində xarici IP-ni yoxlamaq üçün adını çəkdiyimiz alətlərdən birini yaz:", ans: ["virustotal", "abuseipdb", "greynoise", "censys", "shodan", "otx", "alienvault otx", "threatfox"], hint: "IP reputasiyası üçün.", sol: "AbuseIPDB (reputasiya/şikayət), VirusTotal (IP/domen kontekst), GreyNoise (kütləvi skaner yoxsa hədəflənmiş). Tam axın: alerti oxu → host/user kontekst → IOC çıxar (IP, əmr sətri) → IP-ni TI-də yoxla → PowerShell əmrini decode et → host-da digər hadisələrlə korrelyasiya → TP/FP qərar → sənədləşdir/eskalasiya." },
{ t: "Praktiki triage (lab)", d: R`<p>Real alertlər üzərində triage məşq et.</p>`, steps: ["LetsDefend.io-da pulsuz hesab aç və 'Monitoring' bölməsindəki ilk alerti götür", "Alerti yuxarıdakı 9 addımlı prosesə görə işlə", "IOC-ları VirusTotal və AbuseIPDB-də yoxla", "TP/FP qərarını əsaslandıraraq ver və 'close/escalate' et", "TryHackMe-də 'Phishing Analysis' və ya 'Intro to SIEM' otağını tamamla"], sol: "LetsDefend real SOC iş axınını simulyasiya edir — CV-də 'LetsDefend SOC Analyst' yolunu tamamlamaq güclü siqnaldır. Hər həll etdiyin alerti notebook-una qeyd et." }
]
},
// =====================================================================
{
id: "l1-ir-endpoint", level: "L1", title: "Incident Response əsasları və endpoint təhlükəsizliyi",
intro: "İnsident həyat dövrü (NIST), containment, EDR/antivirus, firewall və endpoint hardening əsasları.",
lessons: [
{ title: "Incident Response həyat dövrü (NIST SP 800-61)", html: R`
<p>İnsident — təhlükəsizlik siyasətinin pozulması və ya real/potensial zərər. <b>Event</b> (hər hansı müşahidə) ≠ <b>Alert</b> ≠ <b>Incident</b> (təsdiqlənmiş təhlükə).</p>
<h3>NIST IR dövrü (4 faza)</h3>
<ol><li><b>Preparation (Hazırlıq):</b> alətlər, playbook-lar, komanda, təlim, loglama. İnsidentdən əvvəl.</li>
<li><b>Detection & Analysis (Aşkarlama və Təhlil):</b> alert, triage, əhatə dairəsini müəyyən etmək, təsdiqləmək. <i>L1 əsasən burada işləyir.</i></li>
<li><b>Containment, Eradication & Recovery (Məhdudlaşdırma, Təmizləmə, Bərpa):</b>
  <ul><li><b>Containment:</b> yayılmanı dayandır (host izolyasiyası, hesab blok, şəbəkə seqmentasiyası). Short-term və long-term.</li>
  <li><b>Eradication:</b> təhlükəni kökündən sil (malware, backdoor, persistence təmizlə).</li>
  <li><b>Recovery:</b> sistemləri təhlükəsiz şəkildə bərpa et, monitorinqi gücləndir.</li></ul></li>
<li><b>Post-Incident Activity (Dərslər):</b> "lessons learned", hesabat, detection/proseslərin yaxşılaşdırılması.</li></ol>
<p>SANS modeli oxşardır, 6 addım: <b>PICERL</b> — Preparation, Identification, Containment, Eradication, Recovery, Lessons Learned.</p>
<h3>Containment qərarları (balans)</h3>
<p>Həmişə balans var: çox tez host-u söndürsən, hücumçu gizlənə və ya yaddaş dəlili itə bilər; çox gözləsən, zərər artar. Kritik sistemlərdə biznesə təsir də nəzərə alınır. Bu qərarlar adətən L2/L3 və rəhbərliklə birgə verilir — amma L1 dəlilləri toplayıb kontekst verir.</p>
<div class="warn"><b>Dəlil bütövlüyü:</b> təhqiqatda sistemləri dəyişdirmək (restart, fayl silmək) dəlili məhv edə bilər. Mümkünsə əvvəl yaddaş/disk образını al, chain of custody saxla. Bu, hüquqi proses üçün vacibdir.</div>`},
{ title: "Endpoint təhlükəsizliyi: Antivirus, EDR, XDR", html: R`
<table><tr><th></th><th>Antivirus (AV)</th><th>EDR</th><th>XDR</th></tr>
<tr><td>Yanaşma</td><td>İmza-əsaslı (məlum malware)</td><td>Davranış + telemetriya + cavab</td><td>EDR + şəbəkə, email, cloud, identity korrelyasiyası</td></tr>
<tr><td>Aşkarlama</td><td>Məlum hash/imza</td><td>Naməlum/fileless, proses ağacı</td><td>Çox mənbə</td></tr>
<tr><td>Cavab</td><td>Karantin/sil</td><td>Host izolyasiyası, proses öldürmə, uzaq araşdırma</td><td>Avtomatlaşdırılmış, geniş</td></tr></table>
<h3>EDR nə verir (L1 üçün)</h3>
<ul><li>Real-vaxt proses ağacı və əmr sətirləri</li><li>Fayl/registry/şəbəkə telemetriyası</li><li>Host izolyasiyası (bir kliklə şəbəkədən ayırmaq, amma EDR əlaqəsini saxlamaq)</li><li>Uzaq shell/forensik toplama</li><li>Detection (davranış əsaslı), IOC axtarışı</li></ul>
<p>Məşhur EDR-lər: CrowdStrike Falcon, Microsoft Defender for Endpoint, SentinelOne, Carbon Black, Cortex XDR. Pulsuz/açıq: Wazuh, Velociraptor (forensik), OSQuery.</p>
<h3>AV/EDR-in məhdudiyyətləri</h3>
<p>İmza-əsaslı AV yeni/obfuscated malware-i buraxa bilər. EDR güclüdür amma hücumçular onu söndürməyə/bypass etməyə çalışır (BYOVD — Bring Your Own Vulnerable Driver, EDR unhooking). EDR-in söndürülməsi və ya "tamper" alerti çox ciddidir.</p>
<div class="tip">L1 alertlərinin böyük hissəsi EDR-dən gəlir. EDR konsolunda proses ağacını oxumaq, əmr sətrini təhlil etmək və host izolyasiyası etmək əsas praktiki bacarıqdır.</div>`},
{ title: "Firewall, IDS/IPS, Proxy və şəbəkə müdafiəsi", html: R`
<h3>Firewall</h3>
<ul><li><b>Stateless</b> — hər paketi ayrı qiymətləndirir (ACL).</li><li><b>Stateful</b> — bağlantının vəziyyətini izləyir.</li>
<li><b>NGFW</b> (Next-Gen) — tətbiq-səviyyəli yoxlama, IPS, TLS inspection, istifadəçi identifikasiyası.</li>
<li><b>WAF</b> — veb tətbiqlərini L7 hücumlardan (SQLi, XSS) qoruyur.</li></ul>
<p>Firewall logları: icazə/blok, src/dst IP:port, protokol. "Deny" logları port skan və C2 cəhdlərini, "allow" logları isə normal və gizlənmiş trafiki göstərir.</p>
<h3>IDS vs IPS</h3>
<ul><li><b>IDS</b> (Detection) — aşkarlayır və xəbərdarlıq verir, bloklamır (passiv, SPAN portunda).</li>
<li><b>IPS</b> (Prevention) — inline, zərərli trafiki bloklayır.</li>
<li><b>Signature-based</b> (məlum nümunələr) vs <b>anomaly-based</b> (normaldan kənarlaşma).</li>
<li>Alətlər: <b>Snort</b>, <b>Suricata</b> (imza), <b>Zeek/Bro</b> (şəbəkə metadata/protokol loglama — NSM), <b>Security Onion</b> (hamısı bir yerdə, pulsuz).</li></ul>
<h3>Proxy / Secure Web Gateway</h3>
<p>İstifadəçi veb trafikini vasitəçi kimi keçirir: URL filtrləmə, kateqoriya blok, malware yoxlama, log. Proxy logları "istifadəçi hansı sayta getdi" sualının cavabıdır — phishing/C2 təhqiqatında əvəzsiz.</p>
<h3>Digər müdafiə qatları</h3>
<ul><li><b>DLP</b> (Data Loss Prevention) — həssas məlumatın çıxarılmasının qarşısını alır.</li>
<li><b>NAC</b> (Network Access Control) — şəbəkəyə qoşulan cihazları yoxlayır.</li>
<li><b>Honeypot</b> — hücumçunu cəlb edən tələ sistem (hər toxunuş şübhəlidir).</li>
<li><b>Email security gateway</b> — phishing/spam/malware filtrləmə.</li></ul>`},
{ title: "Endpoint hardening və müdafiə təcrübələri", html: R`
<p>Blue Team yalnız aşkarlamır — hücum səthini azaldır. L1 olaraq bu təcrübələri bilmək vacibdir, çünki alertləri kontekstə qoyur.</p>
<h3>Əsas hardening tədbirləri</h3>
<ul><li><b>Patch management:</b> OS və proqramları yenilə (ən çox istismar edilən vektor köhnə proqramdır)</li>
<li><b>Least privilege:</b> istifadəçilər admin olmasın; servis hesabları minimal hüquq</li>
<li><b>MFA hər yerdə:</b> xüsusən uzaq giriş (VPN, RDP, email)</li>
<li><b>Güclü parol siyasəti</b> və parol menecerləri; default parolları dəyiş</li>
<li><b>Lazımsız xidmətləri/portları söndür</b> (hücum səthini azalt)</li>
<li><b>Application whitelisting</b> (AppLocker, WDAC) — yalnız icazəli proqramlar işləsin</li>
<li><b>Makro məhdudiyyəti:</b> internetdən gələn Office makrolarını blokla (phishing #1 müdafiəsi)</li>
<li><b>Disk şifrələmə</b> (BitLocker/LUKS)</li>
<li><b>Backup (3-2-1 qaydası):</b> 3 nüsxə, 2 fərqli media, 1 offline/offsite — ransomware-ə qarşı ən yaxşı müdafiə</li>
<li><b>Network segmentation</b> və Zero Trust</li>
<li><b>Mərkəzi loglama</b> və monitorinq (SOC bunsuz kordur)</li></ul>
<h3>Attack surface və reduksiya</h3>
<p><b>Attack surface</b> — hücumçunun hədəf ala biləcəyi bütün nöqtələrin cəmi (açıq portlar, xidmətlər, istifadəçilər, tətbiqlər). Hardening bunu azaldır. ASR (Attack Surface Reduction) qaydaları (Microsoft Defender) ümumi hücum texnikalarını bloklayır.</p>
<h3>Vulnerability management dövrü</h3>
<p>Discover (asset inventory) → Scan (Nessus, OpenVAS, Qualys) → Prioritize (CVSS + istismar + aktivin kritikliyi) → Remediate (patch/mitigate) → Verify → Təkrar. SOC bəzən bu prosesə cəlb olunur.</p>
<div class="note">Müsahibə sualı: "Ransomware-dən ən yaxşı müdafiə nədir?" Güclü cavab: çoxqatlı — offline backup (3-2-1), MFA, patch, least privilege, makro blok, EDR, istifadəçi təlimi, network segmentation, və sürətli detection/response. Tək bir həll yoxdur.</div>`}
],
quiz: [
{ q: "NIST IR dövründə L1 əsasən hansı fazada işləyir?", o: ["Detection & Analysis", "Preparation", "Recovery", "Eradication"], a: 0, e: "Aşkarlama və ilkin təhlil." },
{ q: "Containment nə deməkdir?", o: ["Təhlükənin yayılmasını dayandırmaq", "Malware-i silmək", "Sistemi bərpa etmək", "Hesabat yazmaq"], a: 0, e: "Məhdudlaşdırma — host izolyasiyası, hesab blok." },
{ q: "SANS PICERL-də 'E' hansı addımdır (ilk E)?", o: ["Eradication", "Escalation", "Enrichment", "Evaluation"], a: 0, e: "Preparation, Identification, Containment, Eradication, Recovery, Lessons." },
{ q: "Event, Alert və Incident arasındakı fərq nədir?", o: ["Incident təsdiqlənmiş təhlükədir, event sadəcə müşahidədir", "Hamısı eynidir", "Event ən ciddisidir", "Alert insidentdən böyükdür"], a: 0, e: "Hər alert insident deyil." },
{ q: "Antivirus əsasən nəyə əsaslanır?", o: ["İmza (məlum malware)", "Davranış təhlili", "Şəbəkə korrelyasiyası", "Yaddaş forensikası"], a: 0, e: "İmza-əsaslı; yeni malware-i buraxa bilər." },
{ q: "EDR AV-dən nə ilə üstündür?", o: ["Davranış əsaslı aşkarlama və cavab imkanları (izolyasiya)", "Daha ucuzdur", "Yalnız imza yoxlayır", "İnternet lazım deyil"], a: 0, e: "Fileless/naməlum təhlükələri də görür." },
{ q: "XDR nəyi əlavə edir?", o: ["Endpoint + şəbəkə, email, cloud, identity korrelyasiyası", "Yalnız antivirus", "Yalnız firewall", "Yalnız email"], a: 0, e: "Çox mənbəli genişləndirilmiş aşkarlama." },
{ q: "IDS və IPS arasındakı əsas fərq nədir?", o: ["IPS bloklayır (inline), IDS yalnız xəbərdarlıq verir", "IDS daha sürətlidir", "IPS passivdir", "Fərq yoxdur"], a: 0, e: "Prevention vs Detection." },
{ q: "Zeek (Bro) nə üçündür?", o: ["Şəbəkə metadata/protokol loglama (NSM)", "Disk şifrələmə", "Parol qırma", "Email göndərmə"], a: 0, e: "Network Security Monitoring." },
{ q: "Proxy logları hansı suala cavab verir?", o: ["İstifadəçi hansı sayta getdi", "Hansı fayl silindi", "Kim login etdi", "Hansı port açıqdır"], a: 0, e: "Veb trafik görünürlüyü." },
{ q: "Honeypot nədir?", o: ["Hücumçunu cəlb edən tələ sistem", "Firewall növü", "Şifrələmə alqoritmi", "Backup serveri"], a: 0, e: "Hər toxunuş şübhəlidir." },
{ q: "DLP nə edir?", o: ["Həssas məlumatın çıxarılmasının qarşısını alır", "Virusları silir", "Parol yaradır", "Şəbəkə qurur"], a: 0, e: "Data Loss Prevention." },
{ q: "3-2-1 backup qaydası nədir?", o: ["3 nüsxə, 2 media növü, 1 offsite/offline", "3 parol, 2 server, 1 admin", "3 gün, 2 saat, 1 dəqiqə", "3 firewall"], a: 0, e: "Ransomware-ə qarşı əsas müdafiə." },
{ q: "Ən çox istismar edilən ilkin giriş vektorlarından biri nədir?", o: ["Köhnə/yamaqlanmamış proqram", "Çox güclü parol", "Şifrələnmiş disk", "MFA"], a: 0, e: "Patch management kritikdir." },
{ q: "Application whitelisting nə edir?", o: ["Yalnız icazəli proqramların işləməsinə imkan verir", "Bütün proqramları bloklayır", "Virusları siyahıya alır", "Şəbəkəni şifrələyir"], a: 0, e: "AppLocker/WDAC." },
{ q: "Phishing-ə qarşı ən təsirli texniki müdafiələrdən biri nədir?", o: ["İnternetdən gələn Office makrolarını bloklamaq", "RAM artırmaq", "Daha çox monitor", "Diski formatlamaq"], a: 0, e: "Makro-əsaslı malware çox yayılıb." },
{ q: "Dəlil bütövlüyü (chain of custody) niyə vacibdir?", o: ["Hüquqi proses və etibarlı təhqiqat üçün", "Sürət üçün", "Disk yeri üçün", "Lisenziya üçün"], a: 0, e: "Dəlil məhkəmədə etibarlı olmalıdır." },
{ q: "Attack surface reduction nə deməkdir?", o: ["Hücum nöqtələrinin sayını azaltmaq", "Alertləri silmək", "Logları sıxışdırmaq", "Daha çox port açmaq"], a: 0, e: "Lazımsız xidmət/portları söndür." },
{ q: "EDR-in söndürülməsi/tamper alerti niyə ciddidir?", o: ["Hücumçu müdafiəni kor etməyə çalışır", "Normal yeniləmədir", "Performans üçün", "Önəmsizdir"], a: 0, e: "Aşkarlamanı aradan qaldırmaq cəhdi." }
],
tasks: [
{ t: "IR fazasını təyin et", d: R`<p>Komanda ransomware-ə yoluxmuş 3 serveri şəbəkədən ayırdı ki, digər sistemlərə yayılmasın.</p>`, q: "Bu hansı NIST IR fazasıdır? (bir söz, ingiliscə)", ans: ["containment"], hint: "Yayılmanı dayandırmaq.", sol: "Containment. Ardıcıllıq: aşkarlandı (Detection) → serverlər izolyasiya olundu (Containment) → malware/persistence silinəcək (Eradication) → təmiz backup-dan bərpa (Recovery) → dərslər çıxarılacaq (Lessons Learned)." },
{ t: "EDR proses ağacı təhlili", d: R`<pre>outlook.exe
 └─ WINWORD.EXE  (Invoice_Mart2026.docm)
     └─ cmd.exe  /c powershell -w hidden -enc JABz...
         └─ powershell.exe
             └─ 185.100.33.9:443 bağlantısı</pre>`, q: "Bu ağacda şübhəli zənciri başladan ilk zərərli addım hansı prosesdir? (fayl adı)", ans: ["winword.exe", "word", "winword", "invoice_mart2026.docm", "docm"], hint: "Office sənədi shell başlatmamalıdır.", sol: "WINWORD.EXE (makrolu .docm faylı) cmd/powershell başladıb — klassik phishing makro zənciri. Email (outlook) → makro sənəd (Word) → gizli encoded PowerShell → C2 (185.100.33.9:443). ATT&CK: T1566.001 → T1204.002 → T1059.001 → T1071.001. Addım: host-u EDR-də izolyasiya et, PowerShell əmrini decode et, hash-ləri topla, eyni maili alan digər istifadəçiləri tap, L2-yə eskalasiya." },
{ t: "Müdafiə tövsiyəsi", d: R`<p>Kiçik şirkət ransomware hücumundan sonra səndən tövsiyə istəyir.</p>`, q: "Ransomware-ə qarşı ən kritik bərpa imkanı verən tədbiri yaz (bir söz/ifadə):", ans: ["backup", "offline backup", "3-2-1 backup", "backups", "ehtiyat nüsxə"], hint: "Şifrələnmiş fayllardan bərpa üçün.", sol: "Offline/immutable backup (3-2-1 qaydası) — şifrələnmiş faylları fidyə ödəmədən bərpa etməyin yeganə etibarlı yolu. Amma tam müdafiə çoxqatlıdır: MFA, patch, least privilege, makro blok, EDR, segmentation, istifadəçi təlimi, sürətli detection. Müsahibədə 'tək həll yoxdur, defense in depth' yanaşmasını göstər." },
{ t: "Endpoint müdafiə lab (praktika)", d: R`<p>Müdafiə alətlərini praktikada gör.</p>`, steps: ["Windows VM-ə Sysmon + Wazuh agent quraşdır (və ya Microsoft Defender-i aktiv saxla)", "Security Onion və ya Wazuh üçün pulsuz demo/VM-i araşdır", "VM-də qəsdən EICAR test faylı yarat (echo X5O!P%@AP[4\\PZX54(P^)7CC)7}\$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!\$H+H* > eicar.com) — AV-nin reaksiyasını gör (bu zərərsiz test faylıdır)", "TryHackMe 'Incident Response', 'Intro to Endpoint Security' otaqlarını et", "Öz VM-ində əsas hardening et: makroları blokla, lazımsız xidmətləri söndür, parol siyasəti qur"], sol: "EICAR təhlükəsiz standart test faylıdır — AV-nin işlədiyini yoxlamaq üçün dünyada qəbul edilir. Real malware ilə heç vaxt belə sınaq etmə. L1-i bitirdin! İndi L2-yə keçə bilərsən — amma əvvəl 'Ev laboratoriyası' və 'Resurslar' bölmələrinə bax və bir sertifikata (Security+ / BTL1) hazırlaşmağa başla." }
]
}
);
})();
