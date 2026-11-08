/* L1 — Hissə 1: Giriş, Kompüter/OS, Windows, Linux, Şəbəkə I */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;
SOC.modules.push(
// =====================================================================
{
id: "l1-intro", level: "L1", title: "Kibertəhlükəsizliyə və SOC-a giriş",
intro: "Kibertəhlükəsizliyin əsas anlayışları, SOC-un nə olduğu, L1/L2/L3 rolları və karyera yolu.",
lessons: [
{ title: "Kibertəhlükəsizlik nədir? CIA triadası", html: R`
<p><b>Kibertəhlükəsizlik</b> — informasiya sistemlərini, şəbəkələri, cihazları və məlumatları icazəsiz giriş, dəyişiklik, oğurluq və dağıdılmadan qorumaq üçün tətbiq olunan texnologiya, proses və insan fəaliyyətlərinin məcmusudur.</p>
<h3>CIA triadası — hər şeyin təməli</h3>
<table><tr><th>Prinsip</th><th>Mənası</th><th>Pozulma nümunəsi</th><th>Qoruma vasitəsi</th></tr>
<tr><td><b>Confidentiality</b> (Məxfilik)</td><td>Məlumatı yalnız icazəsi olanlar görə bilər</td><td>Müştəri bazasının sızması</td><td>Şifrələmə, giriş nəzarəti, MFA</td></tr>
<tr><td><b>Integrity</b> (Bütövlük)</td><td>Məlumat icazəsiz dəyişdirilməyib</td><td>Bank köçürməsində məbləğin dəyişdirilməsi</td><td>Hash, rəqəmsal imza, versiya nəzarəti</td></tr>
<tr><td><b>Availability</b> (Əlçatanlıq)</td><td>Sistem lazım olanda işləyir</td><td>DDoS, ransomware</td><td>Backup, redundancy, DDoS qoruması</td></tr></table>
<h3>AAA modeli</h3>
<ul><li><b>Authentication</b> (Autentifikasiya) — "Sən kimsən?" Parol, sertifikat, biometrika, MFA.</li>
<li><b>Authorization</b> (Avtorizasiya) — "Nə etməyə icazən var?" Rollar, ACL, icazələr.</li>
<li><b>Accounting</b> (Hesabatlılıq/Audit) — "Nə etdin?" Loglar. <i>SOC analitikin əsas işi məhz bu loglarla bağlıdır.</i></li></ul>
<h3>Autentifikasiya faktorları</h3>
<ul><li><b>Bildiyin bir şey</b> — parol, PIN</li><li><b>Sahib olduğun bir şey</b> — telefon, token, smart card</li><li><b>Olduğun bir şey</b> — barmaq izi, üz</li></ul>
<p><b>MFA</b> ən azı <b>iki fərqli</b> kateqoriyadan faktor tələb edir. Parol + gizli sual MFA deyil (hər ikisi "bildiyin").</p>
<div class="tip">Əlavə prinsiplər: <b>Non-repudiation</b> (inkaredilməzlik — rəqəmsal imza ilə əməliyyatı inkar etmək mümkün olmur), <b>Least Privilege</b> (minimum lazımi icazə), <b>Defense in Depth</b> (çoxqatlı müdafiə), <b>Zero Trust</b> ("heç vaxt etibar etmə, həmişə yoxla").</div>`},
{ title: "Əsas terminlər: Asset, Threat, Vulnerability, Risk", html: R`
<table><tr><th>Termin</th><th>Tərif</th><th>Nümunə</th></tr>
<tr><td><b>Asset</b> (Aktiv)</td><td>Dəyəri olan hər şey</td><td>Server, müştəri bazası, reputasiya</td></tr>
<tr><td><b>Vulnerability</b> (Zəiflik)</td><td>Sistemdəki boşluq/qüsur</td><td>Yamaqlanmamış proqram, zəif parol</td></tr>
<tr><td><b>Threat</b> (Təhdid)</td><td>Zəiflikdən istifadə edə biləcək potensial təhlükə</td><td>Ransomware qrupu, narazı işçi</td></tr>
<tr><td><b>Threat Actor</b></td><td>Təhdidi həyata keçirən subyekt</td><td>APT qrupları, kibercinayətkarlar, hacktivistlər, insider</td></tr>
<tr><td><b>Exploit</b></td><td>Zəiflikdən istifadə üsulu/kodu</td><td>—</td></tr>
<tr><td><b>Risk</b></td><td>Təhdidin zəiflikdən istifadə edib zərər vurma ehtimalı × təsiri</td><td>Risk = Ehtimal × Təsir</td></tr>
<tr><td><b>Control</b> (Nəzarət vasitəsi)</td><td>Riski azaldan tədbir</td><td>Firewall, təlim, siyasət</td></tr></table>
<h3>Nəzarət vasitələrinin növləri</h3>
<ul><li>Funksiyaya görə: <b>Preventive</b> (qarşısını alan — firewall), <b>Detective</b> (aşkar edən — IDS, SIEM), <b>Corrective</b> (düzəldən — backup bərpası), <b>Deterrent</b> (çəkindirən — xəbərdarlıq lövhəsi), <b>Compensating</b> (əvəzedici).</li>
<li>Təbiətinə görə: <b>Technical</b> (texniki), <b>Administrative</b> (siyasət, prosedur, təlim), <b>Physical</b> (kilid, kamera).</li></ul>
<h3>CVE, CVSS, CWE</h3>
<ul><li><b>CVE</b> (Common Vulnerabilities and Exposures) — məlum zəifliklərin unikal identifikatoru, məs. <code>CVE-2021-44228</code> (Log4Shell).</li>
<li><b>CVSS</b> — zəifliyin ciddiliyini 0.0–10.0 arası qiymətləndirən sistem. v3.x: 0.1–3.9 Low, 4.0–6.9 Medium, 7.0–8.9 High, 9.0–10.0 Critical.</li>
<li><b>CWE</b> — zəiflik <i>növlərinin</i> kataloqu (məs. CWE-79 XSS, CWE-89 SQL Injection).</li>
<li><b>Zero-day</b> — istehsalçının hələ xəbəri olmayan və ya yamağı olmayan zəiflik.</li></ul>`},
{ title: "SOC nədir və necə işləyir?", html: R`
<p><b>SOC (Security Operations Center)</b> — təşkilatın IT infrastrukturunu 7/24 monitorinq edən, təhlükəsizlik hadisələrini aşkar edən, təhlil edən və onlara cavab verən mərkəzləşdirilmiş komanda.</p>
<h3>SOC-un əsas funksiyaları</h3>
<ol><li><b>Monitorinq</b> — SIEM, EDR və digər alətlərdən gələn alertləri izləmək</li>
<li><b>Aşkarlama (Detection)</b> — şübhəli fəaliyyəti tapmaq</li>
<li><b>Triage</b> — alertin həqiqi olub-olmadığını və prioritetini müəyyən etmək</li>
<li><b>Təhqiqat (Investigation)</b> — nə baş verdiyini, əhatə dairəsini tapmaq</li>
<li><b>Cavab (Response)</b> — təhlükəni məhdudlaşdırmaq, aradan qaldırmaq</li>
<li><b>Hesabat</b> və <b>təkmilləşdirmə</b></li></ol>
<h3>SOC modelləri</h3>
<ul><li><b>In-house SOC</b> — şirkətin öz komandası</li><li><b>MSSP / MDR</b> — xarici provayder (Managed Security Service Provider / Managed Detection & Response). Yeni başlayanlar üçün MSSP-lər ən çox işə götürən yerlərdir.</li><li><b>Hybrid</b> — qarışıq</li></ul>
<h3>SOC alətləri ekosistemi (qısa)</h3>
<p>SIEM (Splunk, Microsoft Sentinel, QRadar, Elastic), EDR (CrowdStrike Falcon, Microsoft Defender for Endpoint, SentinelOne), SOAR (Cortex XSOAR, Splunk SOAR), Ticketing (ServiceNow, Jira, TheHive), Threat Intel (MISP, VirusTotal), Network (Zeek, Suricata, Wireshark).</p>
<h3>Növbə (shift) işi</h3>
<p>Əksər SOC-lar 7/24 işləyir: adətən 8 və ya 12 saatlıq növbələr. Növbə dəyişərkən <b>shift handover</b> (açıq insidentlər, davam edən təhqiqatlar, vacib qeydlər) mütləqdir.</p>`},
{ title: "SOC rolları: L1, L2, L3 və digərləri", html: R`
<table><tr><th>Rol</th><th>Əsas vəzifələr</th><th>Tələb olunan bacarıqlar</th></tr>
<tr><td><b>L1 — Triage Analyst</b></td><td>Alertləri izləmək, ilkin təhlil, false positive-ləri bağlamaq, həqiqi hadisələri L2-yə eskalasiya etmək, ticket sənədləşdirmə, phishing təhlili</td><td>Şəbəkə/OS əsasları, log oxuma, SIEM istifadəsi, prosedurlara (playbook) əməl etmək</td></tr>
<tr><td><b>L2 — Incident Responder</b></td><td>Dərin təhqiqat, əhatə dairəsinin müəyyən edilməsi, containment, L1-ə mentorluq, detection qaydalarının tənzimlənməsi</td><td>Hücum texnikaları, forensika əsasları, malware triage, AD, EDR, scripting</td></tr>
<tr><td><b>L3 — Threat Hunter / SME</b></td><td>Proaktiv threat hunting, böyük insidentlərin idarə edilməsi, forensika, reverse engineering, detection engineering</td><td>Dərin texniki bilik, DFIR, malware analizi, kodlaşdırma</td></tr>
<tr><td><b>SOC Manager</b></td><td>Komanda, proseslər, metrikalar, rəhbərliyə hesabat</td><td>Liderlik, risk idarəetməsi</td></tr>
<tr><td><b>Detection Engineer</b></td><td>Aşkarlama qaydaları yazmaq və test etmək</td><td>SIEM dilləri, Sigma, ATT&CK</td></tr>
<tr><td><b>CTI Analyst</b></td><td>Təhdid kəşfiyyatı</td><td>OSINT, analitik düşüncə</td></tr></table>
<h3>Red, Blue, Purple</h3>
<ul><li><b>Red Team</b> — icazəli şəkildə real hücumçunu təqlid edir, müdafiəni yoxlayır.</li>
<li><b>Blue Team</b> — müdafiə edir: SOC, IR, hardening. <i>Sən bu tərəfdəsən.</i></li>
<li><b>Purple Team</b> — Red və Blue birgə işləyir: hücum texnikası icra olunur, Blue onu aşkar edə bilib-bilmədiyini yoxlayır, boşluqlar düzəldilir.</li></ul>
<div class="note">Yaxşı Blue Team üzvü hücumçunun necə düşündüyünü bilməlidir. Ona görə də bu proqramda hücum texnikalarını <b>konseptual səviyyədə və aşkarlama baxımından</b> öyrənəcəksən: "Hücumçu nə edir → bu loglarda necə görünür → necə aşkar və bloklayırıq".</div>`},
{ title: "Karyera yolu və bu proqramın planı", html: R`
<h3>Realistik zaman çizelgesi</h3>
<ul><li><b>0–4 ay:</b> IT əsasları (OS, şəbəkə), təhlükəsizlik konseptləri → bu proqramın L1 modulları</li>
<li><b>4–6 ay:</b> SIEM praktikası, log analizi, homelab, TryHackMe SOC Level 1 / LetsDefend / Blue Team Labs Online, sertifikat (CompTIA Security+ və ya BTL1)</li>
<li><b>6+ ay:</b> İş axtarışı — Junior SOC Analyst / SOC L1 / MSSP Analyst</li>
<li><b>1–3 il iş təcrübəsi:</b> L2 səviyyəsi</li><li><b>3–5+ il:</b> L3, threat hunter, DFIR, detection engineer</li></ul>
<h3>İşə götürənlər L1-dən nə gözləyir?</h3>
<ol><li>TCP/IP, OSI, DNS, HTTP, portlar — dərin anlayış</li><li>Windows və Linux əsasları, Windows Event ID-lər</li><li>Ən azı bir SIEM-də sorğu yazmaq</li><li>Phishing təhlili</li><li>MITRE ATT&CK, Cyber Kill Chain bilgisi</li><li>Yaxşı yazılı ünsiyyət (ticket yazmaq!)</li><li>Öyrənmə həvəsi, növbə işinə hazırlıq</li><li>İngilis dili — sahədəki demək olar ki, bütün sənədlər ingiliscədir</li></ol>
<div class="tip">Bu proqramda terminləri həm Azərbaycanca, həm ingiliscə verirəm — çünki müsahibədə və işdə ingilis terminləri istifadə olunacaq.</div>`}
],
quiz: [
{ q: "CIA triadasında 'I' nəyi bildirir?", o: ["Integrity (Bütövlük)", "Identity", "Intelligence", "Isolation"], a: 0, e: "Integrity — məlumatın icazəsiz dəyişdirilməməsi." },
{ q: "Ransomware şirkətin fayllarını şifrələyib istifadəyə yararsız edir. CIA-nın hansı prinsipi birbaşa pozulur?", o: ["Availability", "Non-repudiation", "Authentication", "Accounting"], a: 0, e: "Fayllar əlçatan olmur — Availability. Müasir ransomware məlumatı həm də oğurlayır (double extortion) — o zaman Confidentiality də pozulur." },
{ q: "Hansı MFA nümunəsidir?", o: ["Parol + SMS kodu", "Parol + PIN", "Parol + gizli sual", "İki fərqli parol"], a: 0, e: "Parol (bildiyin) + telefon (sahib olduğun) — iki fərqli kateqoriya." },
{ q: "Risk adətən necə ifadə olunur?", o: ["Ehtimal × Təsir", "Zəiflik + Aktiv", "Təhdid − Nəzarət", "CVSS × 10"], a: 0, e: "Risk = Likelihood × Impact." },
{ q: "AAA-da 'Accounting' nəyə aiddir?", o: ["İstifadəçi fəaliyyətinin qeydə alınması (loglar)", "Maliyyə hesabatları", "İstifadəçi yaratmaq", "Parol siyasəti"], a: 0, e: "Accounting — kim nə vaxt nə etdi: audit logları." },
{ q: "IDS hansı növ nəzarət vasitəsidir?", o: ["Detective", "Preventive", "Corrective", "Deterrent"], a: 0, e: "IDS (Intrusion Detection System) yalnız aşkar edir və xəbərdarlıq verir. IPS isə preventive-dir." },
{ q: "CVSS v3 balı 9.8 olan zəiflik hansı kateqoriyadadır?", o: ["Critical", "High", "Medium", "Low"], a: 0, e: "9.0–10.0 Critical." },
{ q: "SOC-da L1 analitikin əsas vəzifəsi nədir?", o: ["Alert triage və eskalasiya", "Malware reverse engineering", "SOC büdcəsini idarə etmək", "Penetrasiya testi"], a: 0, e: "L1 alertləri ilkin təhlil edir, FP-ləri bağlayır, həqiqi insidentləri eskalasiya edir." },
{ q: "Purple Team nədir?", o: ["Red və Blue komandaların birgə işi ilə müdafiənin təkmilləşdirilməsi", "Yalnız fiziki təhlükəsizlik komandası", "Hüquqi komanda", "Hücumçu qrupun adı"], a: 0, e: "Purple = Red + Blue əməkdaşlığı." },
{ q: "'Least Privilege' prinsipi nəyi tələb edir?", o: ["İstifadəçiyə işi üçün minimum lazımi icazə verilməsini", "Bütün istifadəçilərə admin hüququ", "Parolsuz giriş", "Logların silinməsini"], a: 0, e: "Ən az imtiyaz prinsipi zərər radiusunu azaldır." },
{ q: "Zero-day zəiflik nədir?", o: ["Yamağı hələ olmayan / istehsalçının bilmədiyi zəiflik", "0 CVSS balı olan zəiflik", "Bir gündə yamaqlanan zəiflik", "Köhnə zəiflik"], a: 0, e: "Müdafiəçilərin hazırlaşmaq üçün '0 günü' var." },
{ q: "CVE nədir?", o: ["Məlum zəifliklər üçün unikal identifikator", "Antivirus proqramı", "Şifrələmə alqoritmi", "Firewall qaydası"], a: 0, e: "Məsələn CVE-2021-44228." },
{ q: "MSSP nəyin qısaltmasıdır?", o: ["Managed Security Service Provider", "Main Security System Platform", "Multi Signature Security Protocol", "Managed SIEM Storage Pool"], a: 0, e: "Bir çox müştəriyə SOC xidməti göstərən şirkət." },
{ q: "Rəqəmsal imza CIA-dan əlavə hansı prinsipi təmin edir?", o: ["Non-repudiation", "Availability", "Obscurity", "Redundancy"], a: 0, e: "Göndərən imzaladığını inkar edə bilməz." },
{ q: "Defense in Depth nə deməkdir?", o: ["Bir-birini tamamlayan çoxqatlı müdafiə", "Yalnız güclü firewall", "Dərin paket analizi", "Yalnız antivirus"], a: 0, e: "Bir qat keçilsə, digəri qoruyur." },
{ q: "Backup-dan bərpa hansı növ nəzarətdir?", o: ["Corrective", "Detective", "Deterrent", "Preventive"], a: 0, e: "Hadisədən sonra vəziyyəti düzəldir." },
{ q: "Şirkətin narazı işçisi məlumat oğurlayır. Bu hansı təhdid aktorudur?", o: ["Insider threat", "APT", "Hacktivist", "Script kiddie"], a: 0, e: "Daxili təhdid." },
{ q: "Zero Trust modelinin əsas şüarı hansıdır?", o: ["Never trust, always verify", "Trust but verify", "Daxili şəbəkəyə tam etibar et", "Perimetr hər şeydir"], a: 0, e: "Şəbəkədaxili olmaq avtomatik etibar demək deyil." }
],
tasks: [
{ t: "CIA təsnifatı", d: R`<p>Hadisə: Hücumçu şirkətin veb saytındakı məhsul qiymətlərini dəyişdirib (100 AZN → 1 AZN).</p>`, q: "CIA-nın hansı prinsipi pozulub? (ingiliscə bir söz)", ans: ["integrity", "bütövlük"], hint: "Məlumat oğurlanmayıb, sayt da işləyir — amma məlumat dəyişib.", sol: "Integrity — məlumat icazəsiz dəyişdirilib. Qoruma: fayl bütövlüyü monitorinqi (FIM), giriş nəzarəti, dəyişiklik idarəetməsi." },
{ t: "Risk hesablanması", d: R`<p>1–5 şkalası ilə: Ehtimal = 4, Təsir = 5.</p>`, q: "Risk balı neçədir?", ans: ["20"], hint: "Risk = Ehtimal × Təsir", sol: "4 × 5 = 20 (25 üzərindən) — yüksək risk, prioritet verilməlidir." },
{ t: "SOC notebook-u yarat", d: R`<p>Öz bilik bazanı qur. Bu, bütün karyeran boyu istifadə edəcəyin aləti olacaq.</p>`, steps: ["Obsidian, Notion və ya OneNote quraşdır", "L1, L2, L3 adlı qovluqlar yarat", "'Glossary' səhifəsi aç və bu moduldakı 15 termini öz sözlərinlə yaz", "'Commands' səhifəsi aç (Windows/Linux əmrləri üçün)", "Hər gün öyrəndiyin 3 şeyi qeyd etməyi vərdiş et"], sol: "Müsahibədə 'necə öyrənirsən?' sualına bu notebook-u göstərmək güclü təəssürat yaradır. GitHub-da public versiyasını saxlamaq portfelin ola bilər." }
]
},
// =====================================================================
{
id: "l1-os", level: "L1", title: "Kompüter və əməliyyat sistemi əsasları",
intro: "Hardware, proses, yaddaş, fayl sistemləri, istifadəçilər — hər şey bunun üzərində qurulur.",
lessons: [
{ title: "Kompüter necə işləyir?", html: R`
<h3>Əsas komponentlər</h3>
<ul><li><b>CPU</b> — təlimatları icra edir. Nüvələr (cores), saat tezliyi, registrlər.</li>
<li><b>RAM</b> — müvəqqəti (volatile) yaddaş. Kompüter söndürüləndə silinir. <i>Forensikada vacibdir: işləyən zərərli proqramların izləri yalnız RAM-da ola bilər.</i></li>
<li><b>Disk (HDD/SSD)</b> — daimi (non-volatile) yaddaş.</li>
<li><b>NIC (Network Interface Card)</b> — şəbəkə kartı, unikal MAC ünvanı var.</li>
<li><b>BIOS/UEFI</b> — kompüter açılanda ilk işə düşən firmware. UEFI Secure Boot imzasız bootloader-lərin yüklənməsinin qarşısını alır.</li></ul>
<h3>Boot prosesi (sadələşdirilmiş)</h3>
<ol><li>Power on → UEFI/BIOS → POST (hardware testi)</li><li>Bootloader (Windows Boot Manager / GRUB)</li><li>Kernel yüklənir</li><li>Sistem prosesləri və servislər başlayır</li><li>İstifadəçi girişi</li></ol>
<div class="note">Bootkit və rootkit-lər bu zəncirin erkən mərhələlərinə yerləşməyə çalışır — ona görə aşkarlanmaları çətindir.</div>
<h3>Rəqəm sistemləri (mütləq bil!)</h3>
<table><tr><th>Decimal</th><th>Binary</th><th>Hex</th></tr><tr><td>0</td><td>0000</td><td>0</td></tr><tr><td>5</td><td>0101</td><td>5</td></tr><tr><td>10</td><td>1010</td><td>A</td></tr><tr><td>15</td><td>1111</td><td>F</td></tr><tr><td>255</td><td>1111 1111</td><td>FF</td></tr></table>
<p>1 byte = 8 bit. Hex-də bir rəqəm 4 biti (nibble) təmsil edir, ona görə 1 byte = 2 hex rəqəm. Bu, IP ünvanları, MAC ünvanları, hash-lər və malware analizi üçün lazımdır.</p>
<p><b>Encoding ≠ Encryption:</b> Base64, URL encoding, Hex — <i>kodlaşdırmadır</i>, açar tələb etmir, hər kəs geri çevirə bilər. Hücumçular Base64-dən gizlətmə üçün çox istifadə edir (məs. PowerShell <code>-EncodedCommand</code>).</p>`},
{ title: "Proses, thread, yaddaş", html: R`
<ul><li><b>Program</b> — diskdəki icra olunan fayl (məs. <code>notepad.exe</code>).</li>
<li><b>Process</b> — yaddaşa yüklənmiş, işləyən proqram nüsxəsi. Hər prosesin unikal <b>PID</b>-i və onu yaradan <b>parent process</b>-i (PPID) var.</li>
<li><b>Thread</b> — proses daxilində icra vahidi. Bir prosesin çox thread-i ola bilər.</li>
<li><b>Process tree</b> — parent → child əlaqələri. <i>SOC-da ən vacib təhqiqat vasitələrindən biri!</i></li></ul>
<h3>Niyə process tree vacibdir?</h3>
<pre>Normal:      explorer.exe → winword.exe
Şübhəli:     winword.exe → cmd.exe → powershell.exe -enc ...
</pre>
<p>Word sənədinin cmd və ya PowerShell başlatması adətən zərərli makro əlamətidir. Bu tip "qeyri-adi parent-child" əlaqələri SOC detection qaydalarının böyük hissəsini təşkil edir.</p>
<h3>User mode və Kernel mode</h3>
<p>Adi proqramlar <b>user mode</b>-da işləyir və hardware-ə birbaşa çıxışı yoxdur. Əməliyyat sisteminin nüvəsi və drayverlər <b>kernel mode</b>-da işləyir. Proqramlar kernel xidmətlərinə <b>system call</b>-lar vasitəsilə müraciət edir. Kernel səviyyəsində işləyən zərərli kod (rootkit) çox təhlükəlidir.</p>
<h3>Virtual yaddaş</h3>
<p>Hər prosesin özünə məxsus virtual ünvan sahəsi var — OS bunları fiziki RAM-a xəritələyir. RAM çatmayanda məlumat diskə yazılır: Windows-da <code>pagefile.sys</code>, Linux-da swap. Bu fayllar forensikada dəyərli ola bilər.</p>`},
{ title: "Fayl sistemləri", html: R`
<table><tr><th>FS</th><th>OS</th><th>Xüsusiyyət</th></tr>
<tr><td>NTFS</td><td>Windows</td><td>İcazələr (ACL), jurnal, şifrələmə (EFS), Alternate Data Streams, $MFT</td></tr>
<tr><td>FAT32</td><td>USB, köhnə</td><td>Maks. fayl ölçüsü 4 GB, icazə yoxdur</td></tr>
<tr><td>exFAT</td><td>USB, SD</td><td>Böyük faylları dəstəkləyir</td></tr>
<tr><td>ext4</td><td>Linux</td><td>Jurnal, inode-lar</td></tr>
<tr><td>APFS</td><td>macOS</td><td>Snapshot, şifrələmə</td></tr></table>
<h3>Fayl metadata-sı — MAC(B) vaxtları</h3>
<ul><li><b>M</b>odified — məzmun dəyişdirilib</li><li><b>A</b>ccessed — oxunub</li><li><b>C</b>hanged — NTFS-də MFT qeydi dəyişib (Linux-da inode dəyişikliyi)</li><li><b>B</b>orn — yaradılma vaxtı</li></ul>
<p>Hücumçular <b>timestomping</b> ilə bu vaxtları saxtalaşdıra bilər (MITRE T1070.006). NTFS-də $STANDARD_INFORMATION və $FILE_NAME atributlarındakı vaxtların uyğunsuzluğu bunu aşkar etməyə kömək edir (L3-də).</p>
<h3>Alternate Data Streams (ADS)</h3>
<p>NTFS bir fayla əlavə gizli "axınlar" bağlamağa imkan verir. Brauzerlə endirilən fayllara Windows <code>Zone.Identifier</code> ADS-i əlavə edir (Mark-of-the-Web) — bu, faylın internetdən gəldiyini göstərir və təhqiqatda faydalıdır.</p>
<h3>Hash</h3>
<p>Faylın "barmaq izi". Faylda bir bit dəyişsə, hash tamamilə dəyişir. SOC-da faylları müəyyən etmək üçün SHA256 standartdır (MD5 və SHA1 kolliziyalara görə köhnəlib, amma IOC-larda hələ də görünür).</p>`},
{ title: "İstifadəçilər, icazələr və virtualizasiya", html: R`
<h3>Hesab növləri</h3>
<ul><li><b>Adi istifadəçi</b> — məhdud icazələr</li><li><b>Administrator / root</b> — tam nəzarət</li><li><b>Service account</b> — servislərin işləməsi üçün (hücumçuların sevimli hədəfi — çox vaxt güclü icazələri və köhnə parolları olur)</li><li><b>SYSTEM</b> (Windows) — ən yüksək lokal imtiyaz</li></ul>
<h3>Privilege Escalation (imtiyaz yüksəltmə)</h3>
<p>Hücumçu adi istifadəçi kimi daxil olub sonra admin/SYSTEM olmağa çalışır. <b>Vertical</b> — daha yüksək imtiyaz; <b>Horizontal</b> — eyni səviyyəli başqa istifadəçinin hesabı.</p>
<h3>Virtualizasiya</h3>
<ul><li><b>Hypervisor Type 1</b> (bare-metal): VMware ESXi, Hyper-V, Proxmox</li><li><b>Type 2</b> (hosted): VirtualBox, VMware Workstation</li><li><b>Snapshot</b> — VM-in vəziyyətini saxlamaq. Malware analizində təmiz vəziyyətə qayıtmaq üçün əvəzsizdir.</li><li><b>Container</b> (Docker) — OS kernelini paylaşır, VM-dən yüngüldür, amma izolyasiya zəifdir.</li></ul>
<div class="tip">Homelab üçün VirtualBox (pulsuz) kifayətdir. "🧪 Ev laboratoriyası" bölməsinə bax.</div>`}
],
quiz: [
{ q: "Kompüter söndürüləndə hansı yaddaş silinir?", o: ["RAM", "SSD", "HDD", "UEFI firmware"], a: 0, e: "RAM volatile yaddaşdır. Ona görə IR-da canlı sistemdən əvvəl yaddaş toplanır." },
{ q: "Hex-də 'FF' decimal-da neçədir?", o: ["255", "256", "15", "16"], a: 0, e: "15×16 + 15 = 255." },
{ q: "Binary 1010 decimal-da neçədir?", o: ["10", "12", "5", "8"], a: 0, e: "8+0+2+0 = 10." },
{ q: "Base64 nədir?", o: ["Kodlaşdırma (encoding)", "Şifrələmə (encryption)", "Hash alqoritmi", "Sıxışdırma"], a: 0, e: "Açar tələb etmir, istənilən şəxs decode edə bilər." },
{ q: "PID nədir?", o: ["Process Identifier", "Program Install Directory", "Primary Interface Device", "Packet ID"], a: 0, e: "Hər prosesin unikal nömrəsi." },
{ q: "Hansı process tree ən çox şübhə doğurur?", o: ["winword.exe → powershell.exe", "explorer.exe → chrome.exe", "services.exe → svchost.exe", "explorer.exe → notepad.exe"], a: 0, e: "Office proqramının shell başlatması tipik makro-malware əlamətidir." },
{ q: "FAT32-də maksimum fayl ölçüsü nə qədərdir?", o: ["4 GB", "2 TB", "16 GB", "Limitsiz"], a: 0, e: "4 GB (dəqiq: 4 GiB − 1 byte)." },
{ q: "Zone.Identifier ADS nəyi göstərir?", o: ["Faylın internetdən endirildiyini (Mark-of-the-Web)", "Faylın şifrələndiyini", "Faylın sahibini", "Faylın ölçüsünü"], a: 0, e: "ZoneId=3 — Internet zonası." },
{ q: "Timestomping nədir?", o: ["Faylın vaxt damğalarının saxtalaşdırılması", "Logların sıxışdırılması", "Sistem saatının sinxronizasiyası", "Faylın silinməsi"], a: 0, e: "Anti-forensik texnika, MITRE T1070.006." },
{ q: "Hansı hash alqoritmi müasir SOC-da fayl identifikasiyası üçün standartdır?", o: ["SHA256", "MD4", "CRC32", "Base64"], a: 0, e: "MD5/SHA1 kolliziyalara görə zəifdir." },
{ q: "Rootkit niyə təhlükəlidir?", o: ["Kernel səviyyəsində işləyib özünü və digər zərərli fəaliyyəti gizlədə bilir", "Çox disk yeri tutur", "Yalnız Linux-da işləyir", "İnterneti yavaşladır"], a: 0, e: "OS-un özünə yalan danışdıra bilir." },
{ q: "VirtualBox hansı hypervisor tipidir?", o: ["Type 2", "Type 1", "Type 0", "Container"], a: 0, e: "Mövcud OS üzərində işləyir." },
{ q: "Snapshot malware analizində niyə vacibdir?", o: ["VM-i yoluxmadan əvvəlki təmiz vəziyyətə qaytarmaq üçün", "Malware-i sürətləndirmək üçün", "Şəbəkəni şifrələmək üçün", "Lisenziya üçün"], a: 0, e: "Hər analizdən sonra təmiz vəziyyətə qayıdılır." },
{ q: "Adi istifadəçinin admin hüququ əldə etməsi necə adlanır?", o: ["Vertical privilege escalation", "Horizontal privilege escalation", "Lateral movement", "Exfiltration"], a: 0, e: "Daha yüksək imtiyaz səviyyəsinə keçid." },
{ q: "Windows-da virtual yaddaşın diskdəki faylı hansıdır?", o: ["pagefile.sys", "boot.ini", "ntuser.dat", "hosts"], a: 0, e: "pagefile.sys; hiberfil.sys isə hibernation faylıdır." },
{ q: "1 byte neçə bitdir?", o: ["8", "4", "16", "2"], a: 0, e: "8 bit." }
],
tasks: [
{ t: "Base64 decode", d: R`<p>PowerShell logunda bu sətri görürsən: <code>d2hvYW1p</code>. Bu Base64-dür. Decode et (məs. CyberChef: <a href="https://gchq.github.io/CyberChef/" target="_blank">gchq.github.io/CyberChef</a> → "From Base64").</p>`, q: "Decode edilmiş mətn nədir?", ans: ["whoami"], hint: "CyberChef-də 'From Base64' resepti.", sol: "<code>whoami</code> — hücumçular sistemə daxil olduqdan sonra ilk icra etdikləri kəşfiyyat əmrlərindən biridir (Discovery, T1033). Qeyd: PowerShell <code>-EncodedCommand</code> əslində UTF-16LE mətni Base64-ə çevirir, ona görə CyberChef-də 'Decode text (UTF-16LE)' əlavə etmək lazım ola bilər." },
{ t: "Hex → Decimal", d: R`<p>Paket analizində TTL sahəsini hex olaraq <code>0x80</code> görürsən.</p>`, q: "Decimal dəyəri nədir?", ans: ["128"], hint: "8×16 + 0", sol: "128. Windows sistemlərinin default TTL-i 128, Linux-un 64-dür — bu, OS-u təxmin etməyə kömək edir." },
{ t: "Hash hesabla (lab)", d: R`<p>Öz kompüterində fayl hash-ini hesabla.</p><pre>Windows (PowerShell):  Get-FileHash C:\Windows\System32\notepad.exe -Algorithm SHA256
Linux:                 sha256sum /bin/ls</pre>`, steps: ["notepad.exe və ya /bin/ls üçün SHA256 hesabla", "Bir mətn faylı yarat, hash-ini hesabla", "Faylda bir hərf dəyiş, yenidən hash hesabla və fərqi müşahidə et", "Hash-i virustotal.com-da axtar (fayl yükləmədən, yalnız hash ilə)"], sol: "Bir simvol dəyişikliyi tamamilə fərqli hash verir (avalanche effect). VirusTotal-da hash ilə axtarmaq faylı yükləməkdən təhlükəsizdir — həssas faylları VT-yə yükləmə, çünki yüklənən fayllar digər istifadəçilərə əlçatan olur!" },
{ t: "Process tree müşahidəsi (lab)", d: R`<p>Microsoft Sysinternals-dan <b>Process Explorer</b>-i endir (learn.microsoft.com/sysinternals).</p>`, steps: ["Process Explorer-i işə sal, ağac görünüşünə bax", "explorer.exe-nin child proseslərini tap", "services.exe altında svchost.exe-ləri gör", "Hər hansı prosesə sağ klik → Properties → Image path və Command line bax", "Options → VirusTotal.com → Check VirusTotal.com aktivləşdir"], sol: "Normal Windows process tree-ni tanımaq anomaliyanı görmək üçün şərtdir. Növbəti modulda normal Windows proseslərini ətraflı öyrənəcəyik." }
]
},
// =====================================================================
{
id: "l1-windows", level: "L1", title: "Windows əsasları (SOC baxışından)",
intro: "Normal Windows prosesləri, registry, servislər, Event Log-lar, PowerShell və Active Directory-yə giriş.",
lessons: [
{ title: "Normal Windows prosesləri — 'Know Normal, Find Evil'", html: R`
<p>Anomaliyanı görmək üçün əvvəlcə normalı bilmək lazımdır. Bu cədvəli əzbər bil:</p>
<table><tr><th>Proses</th><th>Normal parent</th><th>Nüsxə sayı</th><th>Yol</th><th>Qeyd</th></tr>
<tr><td>System (PID 4)</td><td>yoxdur</td><td>1</td><td>—</td><td>Kernel</td></tr>
<tr><td>smss.exe</td><td>System</td><td>1 (master)</td><td>C:\Windows\System32</td><td>Session Manager</td></tr>
<tr><td>csrss.exe</td><td>smss.exe (çıxır, parent görünmür)</td><td>adətən 2+</td><td>System32</td><td>Hər sessiya üçün</td></tr>
<tr><td>wininit.exe</td><td>smss.exe (çıxır)</td><td>1</td><td>System32</td><td>Session 0</td></tr>
<tr><td>services.exe</td><td>wininit.exe</td><td>1</td><td>System32</td><td>Service Control Manager</td></tr>
<tr><td>lsass.exe</td><td>wininit.exe</td><td><b>1</b></td><td>System32</td><td>Autentifikasiya, credential-lar. Hücumçuların əsas hədəfi!</td></tr>
<tr><td>svchost.exe</td><td><b>services.exe</b></td><td>çox</td><td>System32</td><td>Həmişə <code>-k</code> parametri ilə</td></tr>
<tr><td>winlogon.exe</td><td>smss.exe (çıxır)</td><td>sessiya başına 1</td><td>System32</td><td>İstifadəçi girişi</td></tr>
<tr><td>explorer.exe</td><td>userinit.exe (çıxır)</td><td>istifadəçi başına 1</td><td>C:\Windows</td><td>Desktop/shell</td></tr></table>
<h3>Şübhəli əlamətlər</h3>
<ul><li><b>Səhv yazılış:</b> <code>scvhost.exe</code>, <code>lsas.exe</code>, <code>svch0st.exe</code> (masquerading, T1036)</li>
<li><b>Səhv yol:</b> <code>C:\Users\Public\svchost.exe</code> və ya <code>C:\Windows\Temp\lsass.exe</code></li>
<li><b>Səhv parent:</b> svchost.exe-nin parent-i services.exe deyilsə</li>
<li><b>Birdən çox lsass.exe</b></li>
<li>İmzasız (unsigned) sistem faylları</li></ul>
<div class="tip">SANS-ın pulsuz "Hunt Evil" posteri bu cədvəlin ətraflı versiyasıdır — çap edib masanın üstünə qoy.</div>`},
{ title: "Registry", html: R`
<p>Windows Registry — OS və proqramların konfiqurasiyasını saxlayan iyerarxik verilənlər bazası. <code>regedit</code> ilə baxılır.</p>
<table><tr><th>Hive</th><th>Məzmun</th><th>Fiziki fayl</th></tr>
<tr><td>HKEY_LOCAL_MACHINE (HKLM)</td><td>Sistem səviyyəli</td><td>C:\Windows\System32\config\ (SYSTEM, SOFTWARE, SAM, SECURITY)</td></tr>
<tr><td>HKEY_CURRENT_USER (HKCU)</td><td>Cari istifadəçi</td><td>C:\Users\&lt;user&gt;\NTUSER.DAT</td></tr>
<tr><td>HKEY_USERS (HKU)</td><td>Bütün yüklənmiş istifadəçi profilləri</td><td>—</td></tr>
<tr><td>HKEY_CLASSES_ROOT (HKCR)</td><td>Fayl assosiasiyaları, COM</td><td>—</td></tr></table>
<h3>Persistence üçün ən çox istifadə olunan açarlar (T1547.001)</h3>
<pre>HKLM\Software\Microsoft\Windows\CurrentVersion\Run
HKLM\Software\Microsoft\Windows\CurrentVersion\RunOnce
HKCU\Software\Microsoft\Windows\CurrentVersion\Run
HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce
HKLM\SYSTEM\CurrentControlSet\Services          (servislər)
HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon  (Shell, Userinit dəyərləri)</pre>
<p>Malware sistem yenidən başlayanda yenidən işə düşmək üçün özünü bu açarlara yazır. SOC-da bu açarlara yazılış (Sysmon Event ID 13) mühüm siqnaldır.</p>
<div class="note">SAM hive-da lokal istifadəçilərin parol hash-ləri saxlanır. Bu fayla giriş cəhdi credential oğurluğu əlamətidir (T1003.002).</div>`},
{ title: "Servislər, Scheduled Tasks, WMI", html: R`
<h3>Servislər</h3>
<p>Arxa planda işləyən proqramlar. <code>services.msc</code>, <code>sc query</code>, <code>Get-Service</code>. Servislər çox vaxt SYSTEM hüququ ilə işləyir.</p>
<p>Yeni servis quraşdırılması: <b>System log Event ID 7045</b> və <b>Security log 4697</b> (audit aktivdirsə). Hücumçular persistence və uzaqdan icra üçün servislərdən istifadə edir (T1543.003). Şübhəli: <code>C:\Users\...\Temp</code> qovluğundan işləyən və ya təsadüfi adlı servislər.</p>
<h3>Scheduled Tasks (Planlaşdırılmış tapşırıqlar)</h3>
<p><code>taskschd.msc</code>, <code>schtasks /query</code>. Yeni tapşırıq: <b>Security Event ID 4698</b>, həmçinin <code>Microsoft-Windows-TaskScheduler/Operational</code> logu (Event 106). T1053.005.</p>
<h3>WMI</h3>
<p>Windows Management Instrumentation — sistem idarəetmə interfeysi. Adminlər istifadə edir, amma hücumçular da uzaqdan icra və fayl yazmadan persistence (WMI Event Subscription, T1546.003) üçün istifadə edir. Şübhəli işarə: <code>WmiPrvSE.exe</code> prosesinin <code>powershell.exe</code> və ya <code>cmd.exe</code> başlatması.</p>
<h3>Faydalı əmrlər (öz kompüterində yoxla)</h3>
<pre>whoami /all            :: istifadəçi, qruplar, privileges
net user               :: lokal istifadəçilər
net localgroup administrators
ipconfig /all
netstat -ano           :: aktiv bağlantılar və PID
tasklist /v
schtasks /query /fo LIST /v
systeminfo</pre>`},
{ title: "Windows Event Logs — SOC analitikin əsas silahı", html: R`
<p>Event Viewer (<code>eventvwr.msc</code>). Fayllar: <code>C:\Windows\System32\winevt\Logs\*.evtx</code>.</p>
<h3>Əsas log kanalları</h3>
<ul><li><b>Security</b> — logon, hesab dəyişiklikləri, audit</li><li><b>System</b> — servislər, drayverlər</li><li><b>Application</b></li><li><b>Microsoft-Windows-PowerShell/Operational</b> — 4104 Script Block Logging</li><li><b>Microsoft-Windows-Sysmon/Operational</b> — Sysmon quraşdırılıbsa</li></ul>
<h3>Əzbərlənməli Security Event ID-lər</h3>
<table><tr><th>ID</th><th>Mənası</th><th>SOC əhəmiyyəti</th></tr>
<tr><td>4624</td><td>Uğurlu logon</td><td>Logon Type-a bax!</td></tr>
<tr><td>4625</td><td>Uğursuz logon</td><td>Brute force, password spraying</td></tr>
<tr><td>4634 / 4647</td><td>Logoff / istifadəçi tərəfindən logoff</td><td>Sessiya müddəti</td></tr>
<tr><td>4648</td><td>Explicit credentials ilə logon</td><td>runas, lateral movement</td></tr>
<tr><td>4672</td><td>Xüsusi imtiyazlar təyin edildi</td><td>Admin logon</td></tr>
<tr><td>4688</td><td>Yeni proses yaradıldı</td><td>Command line audit aktiv olmalıdır</td></tr>
<tr><td>4697</td><td>Servis quraşdırıldı</td><td>Persistence</td></tr>
<tr><td>4698</td><td>Scheduled task yaradıldı</td><td>Persistence</td></tr>
<tr><td>4720</td><td>İstifadəçi hesabı yaradıldı</td><td>Persistence (T1136)</td></tr>
<tr><td>4722 / 4725 / 4726</td><td>Hesab aktivləşdirildi / deaktiv / silindi</td><td></td></tr>
<tr><td>4724</td><td>Parol sıfırlama cəhdi</td><td></td></tr>
<tr><td>4728 / 4732 / 4756</td><td>İstifadəçi qlobal / lokal / universal qrupa əlavə edildi</td><td>Admin qrupuna əlavə!</td></tr>
<tr><td>4740</td><td>Hesab bloklandı (lockout)</td><td>Brute force</td></tr>
<tr><td>4768</td><td>Kerberos TGT istəndi</td><td>AD autentifikasiya</td></tr>
<tr><td>4769</td><td>Kerberos service ticket istəndi</td><td>Kerberoasting (L2)</td></tr>
<tr><td>4771</td><td>Kerberos pre-auth uğursuz</td><td>Parol səhvi (DC-də)</td></tr>
<tr><td>4776</td><td>NTLM credential yoxlanışı</td><td></td></tr>
<tr><td>1102</td><td>Security audit logu silindi</td><td><b>Çox şübhəli!</b> (T1070.001)</td></tr>
<tr><td>7045 (System)</td><td>Yeni servis quraşdırıldı</td><td>Persistence / uzaqdan icra</td></tr></table>
<h3>Logon Types (4624/4625-də)</h3>
<table><tr><th>Type</th><th>Mənası</th></tr>
<tr><td>2</td><td>Interactive (klaviatura ilə lokal)</td></tr><tr><td>3</td><td>Network (SMB paylaşım, şəbəkə resursu)</td></tr>
<tr><td>4</td><td>Batch (scheduled task)</td></tr><tr><td>5</td><td>Service</td></tr><tr><td>7</td><td>Unlock (ekran kilidinin açılması)</td></tr>
<tr><td>8</td><td>NetworkCleartext (parol açıq mətnlə, məs. IIS Basic auth)</td></tr><tr><td>9</td><td>NewCredentials (runas /netonly)</td></tr>
<tr><td>10</td><td>RemoteInteractive (RDP)</td></tr><tr><td>11</td><td>CachedInteractive (DC əlçatan olmadan keşlənmiş credentials)</td></tr></table>
<h3>4625 Status/Sub Status kodları</h3>
<ul><li><code>0xC000006A</code> — parol səhvdir (istifadəçi mövcuddur)</li><li><code>0xC0000064</code> — belə istifadəçi yoxdur</li><li><code>0xC0000234</code> — hesab bloklanıb</li><li><code>0xC0000072</code> — hesab deaktivdir</li><li><code>0xC000006F</code> — icazə verilməyən vaxtda giriş</li><li><code>0xC0000071</code> — parolun müddəti bitib</li></ul>`},
{ title: "PowerShell və Active Directory-yə giriş", html: R`
<h3>PowerShell</h3>
<p>Güclü avtomatlaşdırma dili — adminlər üçün əvəzsiz, hücumçular üçün də sevimli (T1059.001). SOC baxımından:</p>
<ul><li><b>Event 4104</b> (Script Block Logging) — icra olunan skriptin məzmunu, deobfuscation-dan sonra da. Mütləq aktiv olmalıdır.</li>
<li><b>Event 4103</b> — Module Logging</li><li><b>Transcription</b> — bütün sessiyanın mətn qeydi</li></ul>
<p><b>Şübhəli PowerShell əlamətləri:</b> <code>-EncodedCommand</code>/<code>-enc</code>, <code>-WindowStyle Hidden</code>, <code>-NoProfile</code>, <code>-ExecutionPolicy Bypass</code>, <code>IEX</code>/<code>Invoke-Expression</code>, <code>DownloadString</code>, <code>Net.WebClient</code>, <code>FromBase64String</code>, qəribə böyük-kiçik hərf qarışığı (<code>InVoKe-ExPrEsSiOn</code>).</p>
<pre># Faydalı (müdafiə) PowerShell əmrləri
Get-Process | Sort-Object CPU -Descending | Select -First 10
Get-NetTCPConnection -State Established
Get-WinEvent -LogName Security -MaxEvents 20
Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4625} -MaxEvents 50
Get-LocalUser
Get-ScheduledTask | Where-Object {$_.State -eq 'Ready'}
Get-CimInstance Win32_StartupCommand</pre>
<h3>Active Directory (AD) — qısa giriş</h3>
<p>Korporativ şəbəkələrin ~90%-i AD istifadə edir. Mərkəzləşdirilmiş istifadəçi, kompüter və icazə idarəetməsi.</p>
<ul><li><b>Domain Controller (DC)</b> — AD verilənlər bazasını (<code>NTDS.dit</code>) saxlayan server. DC ələ keçirildisə, bütün domen ələ keçirilib.</li>
<li><b>Domain, Tree, Forest</b>, <b>OU</b> (Organizational Unit)</li>
<li><b>Group Policy (GPO)</b> — mərkəzləşdirilmiş konfiqurasiya</li>
<li><b>Kerberos</b> — default autentifikasiya protokolu (port 88). NTLM — köhnə, hələ də istifadə olunur.</li>
<li><b>Həssas qruplar:</b> Domain Admins, Enterprise Admins, Schema Admins, Administrators, Account Operators, Backup Operators. Bu qruplara üzv əlavə edilməsi həmişə yoxlanmalıdır.</li>
<li><b>krbtgt</b> hesabı — Kerberos biletlərini imzalayan xüsusi hesab.</li></ul>
<p>AD hücumlarını (Kerberoasting, Pass-the-Hash, DCSync və s.) və aşkarlanmasını L2-də dərindən öyrənəcəyik.</p>`}
],
quiz: [
{ q: "svchost.exe-nin normal parent prosesi hansıdır?", o: ["services.exe", "explorer.exe", "winlogon.exe", "lsass.exe"], a: 0, e: "Fərqli parent masquerading/injection əlamətidir." },
{ q: "Normal sistemdə neçə lsass.exe olmalıdır?", o: ["1", "2", "İstifadəçi sayı qədər", "0"], a: 0, e: "Birdən çox lsass.exe ciddi şübhə doğurur. (Credential Guard aktivdirsə LsaIso.exe də görünür — bu normaldır.)" },
{ q: "Uğursuz logon hansı Event ID-dir?", o: ["4625", "4624", "4634", "4672"], a: 0, e: "4625 — An account failed to log on." },
{ q: "RDP ilə giriş hansı Logon Type-dır?", o: ["10", "3", "2", "5"], a: 0, e: "10 — RemoteInteractive." },
{ q: "SMB paylaşımına qoşulma hansı Logon Type-dır?", o: ["3", "10", "7", "11"], a: 0, e: "3 — Network." },
{ q: "Event ID 1102 nəyi bildirir?", o: ["Security audit logu silindi", "İstifadəçi yaradıldı", "Servis quraşdırıldı", "Uğurlu logon"], a: 0, e: "Hücumçular izlərini silməyə çalışır — dərhal araşdırılmalıdır." },
{ q: "Yeni servis quraşdırılması System logunda hansı Event ID ilə görünür?", o: ["7045", "4688", "4720", "4104"], a: 0, e: "7045. Security logunda 4697." },
{ q: "4625-də Sub Status 0xC0000064 nə deməkdir?", o: ["Belə istifadəçi adı mövcud deyil", "Parol səhvdir", "Hesab bloklanıb", "Hesab deaktivdir"], a: 0, e: "Çoxlu 0xC0000064 — istifadəçi adı təxmin etmə / enumeration əlaməti ola bilər." },
{ q: "4625-də Sub Status 0xC000006A nə deməkdir?", o: ["İstifadəçi mövcuddur, parol səhvdir", "İstifadəçi yoxdur", "Parolun müddəti bitib", "Vaxt məhdudiyyəti"], a: 0, e: "Bad password." },
{ q: "PowerShell skriptlərinin məzmununu hansı Event ID qeyd edir?", o: ["4104", "4688", "7045", "4769"], a: 0, e: "Script Block Logging — PowerShell/Operational." },
{ q: "Hansı registry açarı persistence üçün ən çox istifadə olunur?", o: ["...\\CurrentVersion\\Run", "HKCR\\.txt", "HKLM\\HARDWARE", "HKCU\\Control Panel\\Colors"], a: 0, e: "Run/RunOnce açarları logon zamanı proqramı işə salır." },
{ q: "Lokal istifadəçilərin parol hash-ləri hansı hive-da saxlanır?", o: ["SAM", "SOFTWARE", "NTUSER.DAT", "HKCR"], a: 0, e: "SAM — Security Account Manager." },
{ q: "AD-də istifadəçi 'Domain Admins' qrupuna (qlobal qrup) əlavə edilir. Hansı Event ID?", o: ["4728", "4720", "4625", "4740"], a: 0, e: "4728 — global; 4732 — local; 4756 — universal." },
{ q: "Hansı prosesin adı masquerading əlamətidir?", o: ["scvhost.exe", "svchost.exe", "lsass.exe", "csrss.exe"], a: 0, e: "scvhost — hərflərin yeri dəyişdirilib." },
{ q: "Hesab bloklanması (lockout) hansı Event ID-dir?", o: ["4740", "4625", "4767", "4723"], a: 0, e: "4740. 4767 isə blokun açılmasıdır." },
{ q: "AD verilənlər bazası faylının adı nədir?", o: ["NTDS.dit", "SAM", "AD.db", "domain.mdb"], a: 0, e: "DC-də saxlanır, bütün domen hash-lərini ehtiva edir." },
{ q: "Kerberos hansı portdan istifadə edir?", o: ["88", "389", "445", "135"], a: 0, e: "88 TCP/UDP." },
{ q: "Hansı PowerShell parametri şübhəli sayılır?", o: ["-EncodedCommand", "-Help", "-Version", "-Command Get-Date"], a: 0, e: "Kodlaşdırılmış əmr məzmunu gizlədir." },
{ q: "WmiPrvSE.exe-nin powershell.exe başlatması nəyə işarə edə bilər?", o: ["WMI vasitəsilə uzaqdan icra", "Normal Windows Update", "Brauzer yeniləməsi", "Printer drayveri"], a: 0, e: "WMI lateral movement/execution əlaməti." },
{ q: "Scheduled task yaradılması hansı Security Event ID-dir?", o: ["4698", "4697", "4688", "4720"], a: 0, e: "4698." },
{ q: "Logon Type 4 nədir?", o: ["Batch (scheduled task)", "Interactive", "Service", "Unlock"], a: 0, e: "Batch." },
{ q: "explorer.exe hansı qovluqda yerləşir?", o: ["C:\\Windows", "C:\\Windows\\System32", "C:\\Program Files", "C:\\Users\\Public"], a: 0, e: "C:\\Windows\\explorer.exe." }
],
tasks: [
{ t: "Brute force aşkarla", d: R`<p>SIEM-dən çıxarış (Security log, DC01):</p><pre>2026-03-12 02:14:01  4625  Account: admin       Src: 185.220.101.45  LogonType: 3  SubStatus: 0xC000006A
2026-03-12 02:14:02  4625  Account: admin       Src: 185.220.101.45  LogonType: 3  SubStatus: 0xC000006A
2026-03-12 02:14:02  4625  Account: admin       Src: 185.220.101.45  LogonType: 3  SubStatus: 0xC000006A
... (eyni IP-dən 1,247 cəhd) ...
2026-03-12 02:31:44  4624  Account: admin       Src: 185.220.101.45  LogonType: 3
2026-03-12 02:31:45  4672  Account: admin       Privileges: SeDebugPrivilege, SeBackupPrivilege...
2026-03-12 08:02:11  4624  Account: j.smith     Src: 10.10.5.21      LogonType: 2</pre>`, q: "Hücumçu IP ünvanı hansıdır?", ans: ["185.220.101.45"], hint: "Çoxlu 4625-dən sonra 4624 gələn IP.", sol: "185.220.101.45 — 1247 uğursuz cəhddən sonra uğurlu giriş (4624) və dərhal admin imtiyazları (4672). Bu, <b>uğurlu brute force</b>-dur → TRUE POSITIVE, kritik! Addımlar: dərhal L2-yə eskalasiya, 'admin' hesabını deaktiv et/parolu dəyiş, IP-ni firewall-da blokla, 02:31-dən sonra bu hesabın bütün fəaliyyətini araşdır. Sual: niyə admin hesabı internetdən Logon Type 3 ilə əlçatandır? (Ekspozisiya problemi.)" },
{ t: "Şübhəli prosesi tap", d: R`<p>EDR proses siyahısı:</p><pre>PID   PPID  Name          Path
4     0     System
612   4     smss.exe      C:\Windows\System32\smss.exe
780   700   wininit.exe   C:\Windows\System32\wininit.exe
856   780   services.exe  C:\Windows\System32\services.exe
872   780   lsass.exe     C:\Windows\System32\lsass.exe
1004  856   svchost.exe   C:\Windows\System32\svchost.exe -k DcomLaunch
1188  856   svchost.exe   C:\Windows\System32\svchost.exe -k netsvcs
3320  3290  explorer.exe  C:\Windows\explorer.exe
5512  3320  svchost.exe   C:\Users\Public\svchost.exe
5640  3320  chrome.exe    C:\Program Files\Google\Chrome\Application\chrome.exe</pre>`, q: "Şübhəli prosesin PID-i nədir?", ans: ["5512"], hint: "Parent və yola bax.", sol: "PID 5512: svchost.exe-nin parent-i explorer.exe-dir (services.exe olmalı idi), yolu C:\\Users\\Public-dir (System32 olmalı idi), <code>-k</code> parametri yoxdur. Klassik masquerading (T1036.005). Növbəti addımlar: hash-i al, VirusTotal-da yoxla, şəbəkə bağlantılarına bax, hostu izolyasiya etməyi L2 ilə müzakirə et." },
{ t: "Logon type təhlili", d: R`<pre>EventID: 4624
Account Name: svc_backup
Logon Type: 10
Source Network Address: 10.20.30.15
Workstation Name: HR-LAPTOP-07</pre><p>svc_backup — backup servis hesabıdır.</p>`, q: "Bu hadisədə hansı əməliyyat növü ilə giriş edilib? (protokolun qısa adı)", ans: ["rdp", "remote desktop"], hint: "Logon Type 10.", sol: "RDP. Servis hesabının HR noutbukundan RDP ilə interaktiv girişi <b>çox şübhəlidir</b> — servis hesabları adətən Type 5 (service) və ya Type 3 ilə istifadə olunur. Ehtimal: oğurlanmış credentials ilə lateral movement. Eskalasiya et." },
{ t: "Öz Event Log-larını araşdır (lab)", d: R`<p>Windows kompüterində Event Viewer-i aç.</p>`, steps: ["eventvwr.msc → Windows Logs → Security", "Sağda 'Filter Current Log' → 4624 yaz, öz logon hadisələrini tap və Logon Type-ları qeyd et", "Kompüteri kilidlə (Win+L) və aç — Logon Type 7 hadisəsini tap", "Qəsdən səhv parol yazıb 4625 yarat və Sub Status-a bax", "PowerShell-də: Get-WinEvent -FilterHashtable @{LogName='Security';Id=4624} -MaxEvents 5 | Format-List"], sol: "Qeyd: Windows Home versiyalarında bəzi audit siyasətləri məhduddur. Security logu görmək üçün Event Viewer-i Administrator kimi açmaq lazımdır." }
]
},
// =====================================================================
{
id: "l1-linux", level: "L1", title: "Linux əsasları",
intro: "Serverlərin əksəriyyəti Linux-dur. Fayl strukturu, əmrlər, icazələr, loglar və SOC üçün mətn emalı.",
lessons: [
{ title: "Linux fayl strukturu və əsas əmrlər", html: R`
<h3>Filesystem Hierarchy Standard (FHS)</h3>
<table><tr><th>Qovluq</th><th>Məzmun</th></tr>
<tr><td>/</td><td>Kök</td></tr><tr><td>/etc</td><td>Konfiqurasiya faylları (passwd, shadow, ssh/sshd_config, crontab)</td></tr>
<tr><td>/var/log</td><td><b>Loglar</b> — SOC üçün ən vacib qovluq</td></tr><tr><td>/home</td><td>İstifadəçi qovluqları</td></tr>
<tr><td>/root</td><td>root istifadəçisinin qovluğu</td></tr><tr><td>/tmp, /var/tmp, /dev/shm</td><td>Müvəqqəti, hər kəs yaza bilər — <b>malware-in sevimli yeri</b></td></tr>
<tr><td>/bin, /usr/bin, /sbin</td><td>İcra olunan proqramlar</td></tr><tr><td>/proc</td><td>Virtual FS — işləyən proseslər haqqında məlumat</td></tr>
<tr><td>/opt</td><td>Əlavə proqramlar</td></tr></table>
<h3>Əsas əmrlər</h3>
<pre>pwd                    # cari qovluq
ls -la                 # gizli fayllar daxil, ətraflı
cd /var/log
cat, less, head -n 20, tail -n 50
tail -f /var/log/auth.log   # canlı izləmə
cp, mv, rm, mkdir, touch
find / -name "*.sh" -mtime -1 2>/dev/null   # son 1 gündə dəyişən .sh faylları
file suspicious.bin    # faylın real tipini göstərir
strings binary | less  # oxuna bilən mətnlər
sha256sum file
whoami; id; hostname; uname -a</pre>
<h3>Proses və şəbəkə</h3>
<pre>ps aux                 # bütün proseslər
ps -ef --forest        # ağac görünüşü
top / htop
ss -tulpn              # dinləyən portlar və proseslər (köhnə: netstat -tulpn)
ss -tanp               # bütün TCP bağlantıları
lsof -i                # şəbəkə istifadə edən fayllar/proseslər
ls -l /proc/1234/exe   # PID 1234-ün real icra faylı</pre>
<div class="tip">Silinmiş amma hələ işləyən fayl: <code>ls -l /proc/*/exe 2>/dev/null | grep deleted</code> — malware tez-tez özünü diskdən silir, amma yaddaşda işləməyə davam edir.</div>`},
{ title: "İstifadəçilər və icazələr", html: R`
<h3>/etc/passwd və /etc/shadow</h3>
<pre>/etc/passwd:  alice:x:1001:1001:Alice:/home/alice:/bin/bash
              user : parol(x=shadow-da) : UID : GID : şərh : home : shell
/etc/shadow:  alice:$6$salt$hash...:19500:0:99999:7:::
              ($6$ = SHA-512, $y$ = yescrypt — müasir Debian/Ubuntu default)</pre>
<ul><li><b>UID 0</b> = root. <code>/etc/passwd</code>-da UID 0 olan ikinci hesab — <b>backdoor əlaməti!</b></li>
<li>Servis hesabları adətən <code>/usr/sbin/nologin</code> shell-ə malikdir. www-data-nın <code>/bin/bash</code> shell-i varsa — şübhəli.</li>
<li><code>/etc/shadow</code> yalnız root tərəfindən oxuna bilər.</li></ul>
<h3>İcazələr</h3>
<pre>-rwxr-xr--  1 alice dev  4096 script.sh
 │└┬┘└┬┘└┬┘
 │ │  │  └─ others: r-- (oxu)
 │ │  └──── group:  r-x (oxu, icra)
 │ └─────── owner:  rwx (oxu, yaz, icra)
 └───────── tip: - fayl, d qovluq, l link</pre>
<p>Rəqəmlə: r=4, w=2, x=1. <code>chmod 750</code> = rwxr-x---. <code>chmod 777</code> = hər kəsə hər şey — təhlükəli.</p>
<h3>Xüsusi icazələr</h3>
<ul><li><b>SUID</b> (s, 4000) — fayl sahibinin hüququ ilə icra olunur. root-a məxsus SUID fayllar privilege escalation vektorudur. Axtarış: <code>find / -perm -4000 -type f 2>/dev/null</code></li>
<li><b>SGID</b> (2000), <b>Sticky bit</b> (t, 1000 — /tmp-də: yalnız sahibi silə bilər)</li></ul>
<h3>sudo</h3>
<p><code>/etc/sudoers</code> — kim hansı əmri root kimi icra edə bilər. <code>sudo -l</code> — cari istifadəçinin sudo hüquqları. sudo istifadəsi <code>auth.log</code>-da qeyd olunur.</p>`},
{ title: "Linux logları", html: R`
<table><tr><th>Log</th><th>Distro</th><th>Məzmun</th></tr>
<tr><td>/var/log/auth.log</td><td>Debian/Ubuntu</td><td>SSH, sudo, su, autentifikasiya</td></tr>
<tr><td>/var/log/secure</td><td>RHEL/CentOS/Rocky</td><td>Eyni (auth.log-un ekvivalenti)</td></tr>
<tr><td>/var/log/syslog</td><td>Debian/Ubuntu</td><td>Ümumi sistem</td></tr>
<tr><td>/var/log/messages</td><td>RHEL</td><td>Ümumi sistem</td></tr>
<tr><td>/var/log/apache2/access.log, /var/log/nginx/access.log</td><td></td><td>Veb server sorğuları</td></tr>
<tr><td>/var/log/audit/audit.log</td><td></td><td>auditd (L2)</td></tr>
<tr><td>/var/log/wtmp, btmp, lastlog</td><td></td><td>Binary: <code>last</code>, <code>lastb</code>, <code>lastlog</code> ilə oxunur</td></tr>
<tr><td>journalctl</td><td>systemd</td><td><code>journalctl -u ssh --since "1 hour ago"</code></td></tr></table>
<h3>auth.log nümunələri</h3>
<pre>Mar 12 03:11:02 web01 sshd[2211]: Failed password for root from 45.155.205.10 port 51234 ssh2
Mar 12 03:11:05 web01 sshd[2213]: Failed password for invalid user oracle from 45.155.205.10 port 51240 ssh2
Mar 12 03:15:40 web01 sshd[2301]: Accepted password for deploy from 45.155.205.10 port 52011 ssh2
Mar 12 03:16:01 web01 sudo:   deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/bin/bash
Mar 12 09:00:12 web01 sshd[3100]: Accepted publickey for alice from 10.0.0.5 port 50022 ssh2</pre>
<ul><li><code>Failed password</code> — səhv parol; <code>invalid user</code> — mövcud olmayan istifadəçi</li><li><code>Accepted password/publickey</code> — uğurlu giriş</li><li>Yuxarıdakı nümunədə: çoxlu uğursuzluqdan sonra eyni IP-dən uğurlu giriş və dərhal root shell — uğurlu brute force!</li></ul>
<h3>Persistence yerləri (Linux)</h3>
<ul><li><b>cron:</b> <code>/etc/crontab</code>, <code>/etc/cron.d/</code>, <code>/var/spool/cron/crontabs/</code>, <code>crontab -l</code> (T1053.003)</li>
<li><b>systemd servisləri:</b> <code>/etc/systemd/system/</code> (T1543.002)</li>
<li><b>SSH açarları:</b> <code>~/.ssh/authorized_keys</code> (T1098.004)</li>
<li><b>Shell init faylları:</b> <code>~/.bashrc</code>, <code>~/.profile</code>, <code>/etc/profile.d/</code> (T1546.004)</li>
<li><b>Yeni istifadəçi</b> və ya UID 0 hesabı</li></ul>`},
{ title: "SOC üçün mətn emalı: grep, awk, sort, uniq", html: R`
<p>Böyük log fayllarını tez təhlil etmək üçün bu əmrləri mükəmməl bilməlisən:</p>
<pre># "Failed password" sətirlərini say
grep -c "Failed password" /var/log/auth.log

# Ən çox uğursuz cəhd edən IP-lər (top 10)
grep "Failed password" auth.log | grep -oE "[0-9]{1,3}(\.[0-9]{1,3}){3}" | sort | uniq -c | sort -nr | head

# Uğurlu girişlər
grep "Accepted" auth.log

# Apache: ən çox sorğu göndərən IP-lər (1-ci sütun)
awk '{print $1}' access.log | sort | uniq -c | sort -nr | head

# Apache: HTTP status kodlarının paylanması (9-cu sütun)
awk '{print $9}' access.log | sort | uniq -c | sort -nr

# 404 qaytaran sorğular
awk '$9 == 404' access.log | head

# Böyük-kiçik hərfə həssas olmayan axtarış, birdən çox nümunə
grep -iE "union|select|<script|\.\./" access.log

# Bir sütunu ayırmaq
cut -d: -f1 /etc/passwd          # bütün istifadəçi adları
awk -F: '$3 == 0 {print $1}' /etc/passwd   # UID 0 olan hesablar</pre>
<table><tr><th>Əmr</th><th>Funksiya</th></tr>
<tr><td>grep</td><td>Nümunə axtarışı (-i case-insensitive, -v tərsinə, -c say, -o yalnız uyğun hissə, -E regex, -r rekursiv)</td></tr>
<tr><td>awk</td><td>Sütun əsaslı emal</td></tr><tr><td>cut</td><td>Ayırıcı ilə sahə kəsmək</td></tr>
<tr><td>sort</td><td>Sıralama (-n rəqəm, -r tərs)</td></tr><tr><td>uniq -c</td><td>Ardıcıl təkrarları sayır (əvvəlcə sort lazımdır!)</td></tr>
<tr><td>wc -l</td><td>Sətir sayı</td></tr><tr><td>sed</td><td>Mətn dəyişdirmə</td></tr></table>
<div class="note"><b>"Stacking" (yığma) texnikası:</b> <code>sort | uniq -c | sort -n</code> — ən az rast gəlinən dəyərlər (long tail) çox vaxt ən maraqlı olanlardır. Threat hunting-də (L3) bu əsas metodlardan biridir.</div>`}
],
quiz: [
{ q: "Debian/Ubuntu-da SSH giriş logları harada saxlanır?", o: ["/var/log/auth.log", "/etc/ssh/log", "/var/log/kern.log", "/home/ssh.log"], a: 0, e: "RHEL-də /var/log/secure." },
{ q: "RHEL/CentOS-da auth.log-un ekvivalenti hansıdır?", o: ["/var/log/secure", "/var/log/auth", "/var/log/messages", "/var/log/dmesg"], a: 0, e: "/var/log/secure." },
{ q: "/etc/passwd-da UID 0 olan 'backup2' hesabı tapdın. Bu nə deməkdir?", o: ["Hesabın root imtiyazları var — backdoor ola bilər", "Normal servis hesabıdır", "Hesab deaktivdir", "Hesab qonaq hesabıdır"], a: 0, e: "UID 0 = root hüquqları. root-dan başqa UID 0 ciddi şübhədir." },
{ q: "chmod 754 hansı icazələri verir?", o: ["rwxr-xr--", "rwxrwxr--", "rw-r-xr--", "rwxr--r-x"], a: 0, e: "7=rwx, 5=r-x, 4=r--." },
{ q: "SUID biti nə edir?", o: ["Faylı sahibinin hüquqları ilə icra edir", "Faylı gizlədir", "Faylı şifrələyir", "Faylın silinməsini qadağan edir"], a: 0, e: "root-a məxsus SUID fayllar privesc vektoru ola bilər." },
{ q: "Dinləyən portları və onlara aid prosesləri göstərən müasir əmr hansıdır?", o: ["ss -tulpn", "ls -la", "ps aux", "df -h"], a: 0, e: "ss netstat-ın müasir əvəzidir." },
{ q: "Hansı qovluq malware üçün tipik yerdir?", o: ["/tmp", "/etc", "/boot", "/usr/share/doc"], a: 0, e: "/tmp, /var/tmp, /dev/shm — hər kəs yaza bilir." },
{ q: "'uniq -c' düzgün işləməsi üçün əvvəlcə nə etmək lazımdır?", o: ["sort", "grep", "cut", "wc"], a: 0, e: "uniq yalnız ardıcıl təkrarları birləşdirir." },
{ q: "Apache combined log formatında IP ünvanı neçənci sütundadır?", o: ["1", "4", "7", "9"], a: 0, e: "$1 — IP, $9 — status kodu, $7 — URL." },
{ q: "Uğursuz giriş cəhdlərini (btmp) göstərən əmr hansıdır?", o: ["lastb", "last", "who", "w"], a: 0, e: "last — uğurlu (wtmp), lastb — uğursuz (btmp)." },
{ q: "SSH açarı ilə persistence üçün hücumçu hansı faylı dəyişir?", o: ["~/.ssh/authorized_keys", "~/.ssh/known_hosts", "/etc/hostname", "/etc/hosts"], a: 0, e: "T1098.004." },
{ q: "Hansı Linux persistence mexanizmi DEYİL?", o: ["Registry Run key", "cron", "systemd service", ".bashrc"], a: 0, e: "Registry Windows-a aiddir." },
{ q: "'Accepted publickey for alice' nə deməkdir?", o: ["alice SSH açarı ilə uğurla daxil oldu", "alice-in açarı rədd edildi", "alice parol dəyişdi", "alice sudo istifadə etdi"], a: 0, e: "Uğurlu açar autentifikasiyası." },
{ q: "/etc/shadow-da '$6$' prefiksi hansı alqoritmi göstərir?", o: ["SHA-512", "MD5", "bcrypt", "DES"], a: 0, e: "$1$ MD5, $5$ SHA-256, $6$ SHA-512, $y$ yescrypt, $2b$ bcrypt." },
{ q: "www-data istifadəçisinin shell-i /bin/bash olaraq dəyişdirilib. Bu nəyə işarədir?", o: ["Potensial kompromis / webshell fəaliyyəti", "Normal konfiqurasiya", "Apache yeniləməsi", "Heç nəyə"], a: 0, e: "Servis hesablarında adətən nologin olur." },
{ q: "'grep -v' nə edir?", o: ["Nümunəyə uyğun OLMAYAN sətirləri göstərir", "Versiya göstərir", "Ətraflı rejim", "Yalnız sayı göstərir"], a: 0, e: "invert match." },
{ q: "systemd jurnalında SSH servisinin loglarına baxmaq üçün hansı əmr?", o: ["journalctl -u ssh", "systemctl log ssh", "cat /var/ssh", "dmesg ssh"], a: 0, e: "RHEL-də servis adı sshd-dir." }
],
tasks: [
{ t: "auth.log təhlili", d: R`<pre>Mar 12 03:10:58 web01 sshd[2209]: Failed password for root from 45.155.205.10 port 51230 ssh2
Mar 12 03:11:02 web01 sshd[2211]: Failed password for root from 45.155.205.10 port 51234 ssh2
Mar 12 03:11:05 web01 sshd[2213]: Failed password for invalid user oracle from 45.155.205.10 port 51240 ssh2
Mar 12 03:11:09 web01 sshd[2215]: Failed password for invalid user test from 45.155.205.10 port 51244 ssh2
Mar 12 03:12:15 web01 sshd[2240]: Failed password for deploy from 45.155.205.10 port 51301 ssh2
Mar 12 03:15:40 web01 sshd[2301]: Accepted password for deploy from 45.155.205.10 port 52011 ssh2
Mar 12 03:16:01 web01 sudo:   deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/bin/bash
Mar 12 03:17:22 web01 useradd[2350]: new user: name=sysupdate, UID=0, GID=0, home=/root, shell=/bin/bash</pre>`, q: "Hücumçunun persistence üçün yaratdığı hesabın adı nədir?", ans: ["sysupdate"], hint: "Son sətirə bax.", sol: "<b>sysupdate</b>, UID=0 — root səviyyəli backdoor hesab (T1136.001). Hadisə zənciri: SSH brute force (T1110) → deploy hesabı ilə uğurlu giriş (T1078) → sudo ilə root shell → backdoor hesab. Cavab: hostu izolyasiya et, sysupdate-i sil, deploy parolunu dəyiş, SSH-da parol autentifikasiyasını söndür (yalnız açar), fail2ban, 45.155.205.10-u blokla, digər persistence-ləri yoxla (cron, authorized_keys, systemd)." },
{ t: "Top IP-ni tap", d: R`<p>Bu əmrin nəticəsi:</p><pre>$ awk '{print $1}' access.log | sort | uniq -c | sort -nr | head -5
  48211 203.0.113.77
   1520 198.51.100.4
    988 10.0.0.12
    402 192.0.2.33
     97 198.51.100.200</pre>`, q: "Ən çox sorğu göndərən IP hansıdır?", ans: ["203.0.113.77"], hint: "Birinci sətir.", sol: "203.0.113.77 — 48,211 sorğu digərlərindən kəskin çoxdur: veb skaner, brute force, scraping və ya DoS ola bilər. Növbəti addım: bu IP-nin hansı URL-lərə və hansı status kodları ilə sorğu göndərdiyinə bax: <code>grep 203.0.113.77 access.log | awk '{print $7, $9}' | sort | uniq -c | sort -nr | head</code>" },
{ t: "Linux lab qur", d: R`<p>VirtualBox-da Ubuntu Server quraşdır (və ya Windows-da WSL2).</p>`, steps: ["Ubuntu Server 24.04 LTS VM quraşdır", "sudo apt install openssh-server ilə SSH aktiv et", "Başqa terminaldan qəsdən 5 dəfə səhv parolla SSH qoşul", "sudo grep 'Failed password' /var/log/auth.log ilə izləri tap", "Top IP əmrini (grep -oE ... | sort | uniq -c) öz logunda icra et", "sudo lastb ilə uğursuz girişlərə bax", "find / -perm -4000 -type f 2>/dev/null ilə SUID faylları siyahıla"], sol: "Öz logunu yaratmaq və tapmaq — SOC işinin ən əsas vərdişidir. Ubuntu 24.04-də bəzi sistemlərdə loglar yalnız journald-dadırsa: <code>journalctl -u ssh</code>." },
{ t: "Bash bilik yoxlaması", d: R`<p>/etc/passwd-da UID-i 0 olan bütün hesabları göstərən awk əmrini yaz (sahə ayırıcı ':' və UID 3-cü sahədir).</p>`, q: "Əmri yaz (awk ilə):", ans: ["awk -F: '$3 == 0 {print $1}' /etc/passwd", "awk -F: '$3==0 {print $1}' /etc/passwd", "awk -F: '$3==0{print $1}' /etc/passwd", "awk -F: '$3 == 0' /etc/passwd", "awk -F: '$3==0' /etc/passwd", "awk -F ':' '$3 == 0 {print $1}' /etc/passwd", "awk -F':' '$3==0 {print $1}' /etc/passwd"], hint: "-F: ayırıcı, $3 üçüncü sahə.", sol: "<code>awk -F: '$3 == 0 {print $1}' /etc/passwd</code> — normalda yalnız <code>root</code> çıxmalıdır." }
]
},
// =====================================================================
{
id: "l1-net1", level: "L1", title: "Şəbəkə əsasları I: OSI, TCP/IP, IP ünvanlama",
intro: "SOC analitik üçün şəbəkə biliyi vacibdir. Bu modulu ən diqqətlə öyrən — müsahibələrin yarısı buradan olur.",
lessons: [
{ title: "OSI və TCP/IP modelləri", html: R`
<table><tr><th>#</th><th>OSI qatı</th><th>Funksiya</th><th>Protokol/nümunə</th><th>Vahid</th><th>Cihaz</th></tr>
<tr><td>7</td><td>Application</td><td>İstifadəçi tətbiqləri</td><td>HTTP, DNS, SMTP, FTP, SSH</td><td rowspan="3">Data</td><td rowspan="3">Proxy, WAF, NGFW</td></tr>
<tr><td>6</td><td>Presentation</td><td>Format, şifrələmə, sıxışdırma</td><td>TLS (qismən), JPEG, ASCII</td></tr>
<tr><td>5</td><td>Session</td><td>Sessiya idarəsi</td><td>NetBIOS, RPC</td></tr>
<tr><td>4</td><td>Transport</td><td>Uç-uca çatdırılma, portlar</td><td>TCP, UDP</td><td>Segment / Datagram</td><td>Firewall (stateful)</td></tr>
<tr><td>3</td><td>Network</td><td>Məntiqi ünvanlama, marşrutlaşdırma</td><td>IP, ICMP</td><td>Packet</td><td>Router</td></tr>
<tr><td>2</td><td>Data Link</td><td>Fiziki ünvanlama (MAC)</td><td>Ethernet, ARP, Wi-Fi (802.11)</td><td>Frame</td><td>Switch</td></tr>
<tr><td>1</td><td>Physical</td><td>Bitlər, kabel, siqnal</td><td>Kabel, fiber, radio</td><td>Bit</td><td>Hub, repeater</td></tr></table>
<p>Yadda saxlama: <b>"Please Do Not Throw Sausage Pizza Away"</b> (1→7).</p>
<h3>TCP/IP modeli (4 qat)</h3>
<ul><li><b>Application</b> (OSI 5–7)</li><li><b>Transport</b> (OSI 4)</li><li><b>Internet</b> (OSI 3)</li><li><b>Network Access / Link</b> (OSI 1–2)</li></ul>
<h3>Encapsulation (kapsullaşdırma)</h3>
<p>Məlumat göndərilərkən hər qat öz başlığını (header) əlavə edir: Data → [TCP header + Data] → [IP header + TCP + Data] → [Ethernet header + IP + TCP + Data + FCS]. Qəbul edən tərəf tərsinə açır (decapsulation). Wireshark-da paketə baxanda bu qatları ayrı-ayrı görürsən.</p>
<h3>Hücumlar qatlara görə (nümunə)</h3>
<ul><li>L2: ARP spoofing, MAC flooding</li><li>L3: IP spoofing, ICMP flood</li><li>L4: SYN flood, port skan</li><li>L7: SQL injection, phishing, HTTP flood</li></ul>`},
{ title: "MAC ünvanları, ARP və Switch", html: R`
<h3>MAC ünvanı</h3>
<p>48-bit fiziki ünvan, hex ilə: <code>00:1A:2B:3C:4D:5E</code>. İlk 24 bit <b>OUI</b> — istehsalçını göstərir (məs. <code>08:00:27</code> = VirtualBox). Broadcast MAC: <code>FF:FF:FF:FF:FF:FF</code>. MAC dəyişdirilə bilər (spoofing), ona görə tək başına etibarlı identifikator deyil.</p>
<h3>ARP (Address Resolution Protocol)</h3>
<p>IP ünvanını MAC ünvanına çevirir (eyni lokal şəbəkədə).</p>
<pre>PC-A: "Who has 192.168.1.1? Tell 192.168.1.10"   (broadcast)
Router: "192.168.1.1 is at aa:bb:cc:dd:ee:ff"     (unicast)</pre>
<p><code>arp -a</code> (Windows/Linux) ARP keşini göstərir.</p>
<h3>ARP Spoofing / Poisoning (T1557.002)</h3>
<p>ARP-da autentifikasiya yoxdur. Hücumçu saxta ARP cavabları göndərib özünü router kimi təqdim edə bilər → trafik onun üzərindən keçir (Man-in-the-Middle). <b>Aşkarlama:</b> eyni MAC-ın birdən çox IP üçün görünməsi, çoxlu tələb olunmamış (gratuitous) ARP cavabları, gateway-in MAC-ının dəyişməsi. Wireshark xəbərdarlığı: "duplicate use of IP detected". <b>Qoruma:</b> Dynamic ARP Inspection (DAI), statik ARP qeydləri kritik hostlar üçün.</p>
<h3>Switch və VLAN</h3>
<ul><li><b>Switch</b> MAC cədvəli (CAM table) əsasında frame-ləri yalnız lazımi porta göndərir. Hub isə hər porta göndərir.</li>
<li><b>VLAN</b> — bir fiziki switch-i məntiqi olaraq ayrı şəbəkələrə bölür (seqmentasiya). Məs: VLAN 10 — İşçilər, VLAN 20 — Serverlər, VLAN 99 — Qonaqlar. Seqmentasiya lateral movement-i çətinləşdirir.</li>
<li><b>802.1Q</b> — VLAN tag standartı. <b>Trunk</b> port — bir neçə VLAN daşıyır.</li>
<li><b>SPAN / port mirroring</b> — trafikin surətini IDS/sensor-a göndərmək üçün.</li></ul>`},
{ title: "IPv4 ünvanlama və Subnetting", html: R`
<p>IPv4 — 32 bit, 4 oktet: <code>192.168.1.10</code>. Hər oktet 0–255.</p>
<h3>Private (RFC 1918) diapazonlar — mütləq əzbərlə</h3>
<table><tr><th>Diapazon</th><th>CIDR</th></tr><tr><td>10.0.0.0 – 10.255.255.255</td><td>10.0.0.0/8</td></tr><tr><td>172.16.0.0 – 172.31.255.255</td><td>172.16.0.0/12</td></tr><tr><td>192.168.0.0 – 192.168.255.255</td><td>192.168.0.0/16</td></tr></table>
<p>Digər xüsusi ünvanlar: <code>127.0.0.0/8</code> loopback, <code>169.254.0.0/16</code> APIPA/link-local (DHCP alınmadıqda), <code>0.0.0.0</code> — "bütün interfeyslər" / təyin olunmamış, <code>100.64.0.0/10</code> — CGNAT, <code>224.0.0.0/4</code> multicast, <code>255.255.255.255</code> broadcast. Sənədlərdə nümunə üçün: <code>192.0.2.0/24</code>, <code>198.51.100.0/24</code>, <code>203.0.113.0/24</code>.</p>
<div class="note">SOC-da ilk sual: <b>IP daxili yoxsa xarici?</b> Xarici IP-dən daxili serverə RDP — çox fərqli risk səviyyəsidir, nəinki iki daxili host arasında.</div>
<h3>Subnet mask və CIDR</h3>
<p>Mask şəbəkə hissəsini host hissəsindən ayırır. <code>/24</code> = 255.255.255.0 = ilk 24 bit şəbəkə.</p>
<table><tr><th>CIDR</th><th>Mask</th><th>Ümumi ünvan</th><th>İstifadə edilə bilən host</th></tr>
<tr><td>/8</td><td>255.0.0.0</td><td>16,777,216</td><td>16,777,214</td></tr>
<tr><td>/16</td><td>255.255.0.0</td><td>65,536</td><td>65,534</td></tr>
<tr><td>/24</td><td>255.255.255.0</td><td>256</td><td>254</td></tr>
<tr><td>/25</td><td>255.255.255.128</td><td>128</td><td>126</td></tr>
<tr><td>/26</td><td>255.255.255.192</td><td>64</td><td>62</td></tr>
<tr><td>/27</td><td>255.255.255.224</td><td>32</td><td>30</td></tr>
<tr><td>/28</td><td>255.255.255.240</td><td>16</td><td>14</td></tr>
<tr><td>/29</td><td>255.255.255.248</td><td>8</td><td>6</td></tr>
<tr><td>/30</td><td>255.255.255.252</td><td>4</td><td>2</td></tr>
<tr><td>/32</td><td>255.255.255.255</td><td>1</td><td>tək host</td></tr></table>
<p><b>Düstur:</b> host sayı = 2<sup>(32−prefix)</sup> − 2 (network və broadcast ünvanları çıxılır).</p>
<h3>Nümunə: 192.168.10.77/26</h3>
<ul><li>/26 → blok ölçüsü 64 (256 − 192). Bloklar: 0, 64, 128, 192.</li><li>77 → 64–127 blokundadır.</li><li><b>Network:</b> 192.168.10.64, <b>Broadcast:</b> 192.168.10.127, <b>Hostlar:</b> .65 – .126 (62 host).</li></ul>
<h3>IPv6 (qısa)</h3>
<p>128 bit, hex: <code>2001:0db8:0000:0000:0000:0000:0000:0001</code> = <code>2001:db8::1</code>. Loopback <code>::1</code>, link-local <code>fe80::/10</code>, unique local <code>fc00::/7</code>. IPv6 çox vaxt default aktivdir və monitorinqdən kənarda qalır — hücumçular bundan istifadə edə bilər.</p>`},
{ title: "Routing, Gateway, NAT, ICMP", html: R`
<ul><li><b>Default Gateway</b> — lokal şəbəkədən çıxış nöqtəsi (adətən router). Hədəf öz subnetində deyilsə, paket gateway-ə göndərilir.</li>
<li><b>Router</b> — routing cədvəli əsasında paketləri şəbəkələr arasında yönləndirir. <code>route print</code> (Windows), <code>ip route</code> (Linux).</li>
<li><b>TTL (Time To Live)</b> — hər routerdə 1 azalır, 0 olanda paket atılır (sonsuz dövrəni önləyir). Default TTL: Linux/macOS 64, Windows 128, bir çox şəbəkə cihazı 255.</li></ul>
<h3>NAT (Network Address Translation)</h3>
<p>Çoxlu private IP-ləri bir public IP arxasında gizlədir. <b>PAT</b> (Port Address Translation / NAT overload) — ən geniş yayılan növ, port nömrələri ilə fərqləndirir.</p>
<div class="warn"><b>SOC üçün vacib nəticə:</b> Firewall/proxy logunda xarici tərəfdə yalnız NAT IP görünür. Hansı daxili hostun əlaqə qurduğunu tapmaq üçün NAT/firewall loglarını (daxili IP:port ↔ xarici IP:port) və ya proxy loglarını korrelyasiya etmək lazımdır. Eyni şəkildə, DHCP səbəbindən IP-lər dəyişir — hadisə zamanı hansı hostun həmin IP-yə sahib olduğunu DHCP logları ilə yoxla!</div>
<h3>ICMP</h3>
<p>Diaqnostika və xəta mesajları protokolu (portu yoxdur, L3). <code>ping</code> — Echo Request (Type 8) / Echo Reply (Type 0). Type 3 — Destination Unreachable, Type 11 — Time Exceeded (<code>traceroute/tracert</code> bundan istifadə edir).</p>
<p><b>Təhlükəsizlik:</b> ping sweep (host kəşfi), ICMP flood, ICMP tunneling (məlumatın ICMP payload-unda gizlədilməsi — qeyri-adi böyük ICMP paketləri və ya çox yüksək həcm şübhəlidir).</p>`}
],
quiz: [
{ q: "OSI modelinin 3-cü qatı hansıdır?", o: ["Network", "Transport", "Data Link", "Session"], a: 0, e: "IP, router, packet." },
{ q: "TCP və UDP hansı OSI qatındadır?", o: ["Transport (4)", "Network (3)", "Application (7)", "Data Link (2)"], a: 0, e: "Layer 4." },
{ q: "Switch hansı qatda işləyir (klassik)?", o: ["Layer 2", "Layer 1", "Layer 3", "Layer 7"], a: 0, e: "MAC ünvanlarla. L3 switch-lər routing də edir." },
{ q: "ARP nə edir?", o: ["IP ünvanını MAC ünvanına çevirir", "Domen adını IP-yə çevirir", "IP ünvanı paylayır", "Paketləri şifrələyir"], a: 0, e: "Domen → IP DNS-in işidir." },
{ q: "Hansı RFC 1918 private ünvan DEYİL?", o: ["172.32.1.1", "10.50.0.1", "172.20.5.5", "192.168.100.1"], a: 0, e: "172.16.0.0/12 = 172.16–172.31. 172.32 publicdir." },
{ q: "169.254.x.x ünvanı nəyi göstərir?", o: ["Host DHCP-dən IP ala bilməyib (APIPA)", "Loopback", "Multicast", "Public IP"], a: 0, e: "Link-local / APIPA." },
{ q: "/27 şəbəkədə neçə istifadə edilə bilən host var?", o: ["30", "32", "62", "14"], a: 0, e: "2^5 − 2 = 30." },
{ q: "192.168.1.130/25 hansı şəbəkəyə aiddir?", o: ["192.168.1.128", "192.168.1.0", "192.168.1.130", "192.168.1.255"], a: 0, e: "/25 blok 128: 0–127 və 128–255." },
{ q: "/24-ün subnet maskı hansıdır?", o: ["255.255.255.0", "255.255.0.0", "255.255.255.128", "255.0.0.0"], a: 0, e: "24 bit = 3 oktet." },
{ q: "Paketdə TTL=128 görürsən. Göndərən ehtimal ki hansı OS-dur?", o: ["Windows", "Linux", "Cisco router", "macOS"], a: 0, e: "Windows default 128. (Yolda azalır: 120 görsən, ~8 hop uzaqlıqda Windows.)" },
{ q: "ARP spoofing hansı hücuma imkan verir?", o: ["Man-in-the-Middle", "SQL injection", "Buffer overflow", "Phishing"], a: 0, e: "Trafik hücumçu üzərindən keçir." },
{ q: "MAC ünvanının ilk 24 biti nəyi göstərir?", o: ["İstehsalçını (OUI)", "Şəbəkə ünvanını", "VLAN-ı", "Portu"], a: 0, e: "Organizationally Unique Identifier." },
{ q: "ping hansı protokoldan istifadə edir?", o: ["ICMP", "TCP", "UDP", "ARP"], a: 0, e: "Echo Request Type 8, Reply Type 0." },
{ q: "traceroute hansı ICMP mesajından istifadə edir?", o: ["Time Exceeded (Type 11)", "Echo Reply (Type 0)", "Redirect (Type 5)", "Source Quench"], a: 0, e: "TTL artırılaraq hər hop Type 11 qaytarır." },
{ q: "NAT SOC təhqiqatını necə çətinləşdirir?", o: ["Xarici loglarda real daxili host görünmür", "Trafiki şifrələyir", "Logları silir", "MAC ünvanlarını dəyişir"], a: 0, e: "NAT/firewall loglarını korrelyasiya etmək lazımdır." },
{ q: "VLAN-ın təhlükəsizlik faydası nədir?", o: ["Şəbəkəni seqmentləşdirib lateral movement-i çətinləşdirir", "Trafiki şifrələyir", "Virusları silir", "Parolları qoruyur"], a: 0, e: "Seqmentasiya." },
{ q: "IPv6 loopback ünvanı hansıdır?", o: ["::1", "fe80::1", "127.0.0.1", "ff02::1"], a: 0, e: "::1." },
{ q: "Ethernet frame hansı OSI qatına aiddir?", o: ["Data Link", "Network", "Physical", "Transport"], a: 0, e: "Layer 2 PDU = frame." },
{ q: "Kapsullaşdırmada IP header hansı qatda əlavə olunur?", o: ["Network", "Transport", "Data Link", "Application"], a: 0, e: "L3." },
{ q: "10.0.0.0/8 şəbəkəsində neçə ümumi ünvan var?", o: ["16,777,216", "65,536", "256", "4,294,967,296"], a: 0, e: "2^24." },
{ q: "SPAN port nə üçündür?", o: ["Trafikin surətini monitorinq cihazına göndərmək", "İnternetə çıxış", "VLAN-ları birləşdirmək", "PoE"], a: 0, e: "Port mirroring — IDS/NDR sensorları üçün." }
],
tasks: [
{ t: "Subnetting 1", d: R`<p>Host: <code>10.10.20.200/27</code></p>`, q: "Bu hostun şəbəkə (network) ünvanı nədir?", ans: ["10.10.20.192"], hint: "/27 blok ölçüsü 32: 0,32,64,...,192,224", sol: "200 → 192–223 blokunda. Network 10.10.20.192, broadcast 10.10.20.223, hostlar .193–.222." },
{ t: "Subnetting 2", d: R`<p>Host: <code>172.16.5.77/26</code></p>`, q: "Broadcast ünvanı nədir?", ans: ["172.16.5.127"], hint: "/26 blok 64: 0, 64, 128, 192", sol: "77 → 64–127 bloku. Broadcast 172.16.5.127." },
{ t: "Daxili yoxsa xarici?", d: R`<p>Firewall logu:</p><pre>ALLOW TCP 172.31.4.9:51544 -> 10.0.8.15:3389
ALLOW TCP 172.33.4.9:51544 -> 10.0.8.15:3389</pre>`, q: "Hansı mənbə IP publik (xarici) ünvandır?", ans: ["172.33.4.9"], hint: "172.16.0.0/12 = 172.16.x.x – 172.31.x.x", sol: "172.33.4.9 — private diapazondan kənardadır (publikdir). Xarici IP-dən daxili hosta RDP (3389) icazəsi — ciddi ekspozisiya riski! RDP internetə heç vaxt birbaşa açıq olmamalıdır (VPN/RD Gateway + MFA)." },
{ t: "ARP spoofing aşkarla", d: R`<p><code>arp -a</code> nəticəsi istifadəçinin kompüterində:</p><pre>Interface: 192.168.1.50
  Internet Address      Physical Address
  192.168.1.1           08-00-27-aa-bb-cc     dynamic
  192.168.1.23          08-00-27-aa-bb-cc     dynamic
  192.168.1.40          3c-52-82-11-22-33     dynamic</pre><p>192.168.1.1 — gateway-dir.</p>`, q: "Hücumçu ehtimal ki hansı IP ünvanındadır?", ans: ["192.168.1.23"], hint: "Gateway ilə eyni MAC-ı paylaşan host.", sol: "192.168.1.23 — gateway (192.168.1.1) ilə eyni MAC (08-00-27-aa-bb-cc). Hücumçu ARP poisoning ilə gateway-in MAC-ını öz MAC-ı ilə əvəz edib → MITM. OUI 08:00:27 = VirtualBox — hücumçu VM-dən istifadə edir. Cavab: switch-də həmin portu tap və söndür, DAI aktiv et." },
{ t: "Öz şəbəkəni kəşf et (lab)", d: R`<p>Öz kompüterində icra et:</p><pre>Windows: ipconfig /all ; arp -a ; route print ; tracert 8.8.8.8
Linux:   ip a ; ip neigh ; ip route ; traceroute 8.8.8.8</pre>`, steps: ["Öz IP, subnet mask, gateway və DNS serverini yaz", "Öz subnetinin network və broadcast ünvanlarını hesabla", "ARP cədvəlində gateway-in MAC-ını tap, OUI-ni macvendors.com-da yoxla", "tracert/traceroute ilə 8.8.8.8-ə qədər neçə hop olduğunu say", "ping-də cavab gələn TTL dəyərinə bax"], sol: "Bu məlumatlar hər insident təhqiqatında lazım olan kontekstdir: hostun harada olduğu, hansı şəbəkədə, kimlə danışdığı." }
]
}
);
})();
