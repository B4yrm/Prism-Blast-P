/* Əlavələr: müsahibə sualları, homelab, resurslar, port/event cədvəli, lüğət */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;

// ---------- Müsahibə sualları ----------
SOC.interview = [
{ title: "Əsas konseptlər", items: [
["CIA triadasını izah et və hər biri üçün nümunə ver.", "Confidentiality (məxfilik — yalnız icazəlilər görür; şifrələmə/MFA), Integrity (bütövlük — məlumat dəyişilməyib; hash/imza), Availability (əlçatanlıq — sistem işləyir; backup/DDoS qoruma). Nümunə: ransomware availability-ni (və müasir versiyada confidentiality-ni) pozur."],
["Risk nədir və necə hesablanır?", "Risk = Təhdidin zəiflikdən istifadə edib zərər vurma ehtimalı × təsiri. Asset, threat, vulnerability anlayışlarını birləşdirir. Nəzarət vasitələri (controls) riski azaldır."],
["IDS və IPS fərqi nədir?", "IDS aşkarlayıb xəbərdarlıq verir (passiv), IPS inline işləyib zərərli trafiki bloklayır (aktiv). Hər ikisi signature və ya anomaly əsaslı ola bilər."],
["Simmetrik və asimmetrik şifrələmə fərqi?", "Simmetrik: eyni açar, sürətli, böyük data (AES). Asimmetrik: public/private cüt, açar mübadiləsi və imza (RSA/ECC). TLS hibrid istifadə edir: asimmetrik ilə simmetrik sessiya açarını mübadilə edir."],
["Encoding, hashing və encryption fərqi?", "Encoding (Base64) açarsız geri çevrilir. Hashing birtərəflidir (geri çevrilməz, SHA256). Encryption açarla geri çevrilir (AES). Hücumçular Base64-ü gizlətmə üçün istifadə edir."]
]},
{ title: "Şəbəkə", items: [
["TCP 3-way handshake-i izah et.", "SYN (client) → SYN/ACK (server) → ACK (client). Bundan sonra bağlantı ESTABLISHED olur. Bağlanma: FIN/ACK/FIN/ACK və ya RST."],
["TCP və UDP fərqi? Hansı protokollar hansını istifadə edir?", "TCP connection-oriented, etibarlı, sıralı (HTTP, SSH, RDP, SMTP). UDP connectionless, sürətli, zəmanətsiz (DNS sorğu, DHCP, SNMP, VoIP)."],
["DNS necə işləyir və SOC üçün niyə vacibdir?", "Domen → IP həlli (recursive resolver → root → TLD → authoritative). SOC üçün: demək olar hər hücumun DNS izi var; tunneling, DGA, exfiltration, C2 aşkarlanması DNS loglarından gəlir."],
["Bir host-dan '8.8.8.8-ə bağlana bilmirəm' deyilsə, addım-addım necə diaqnoz edərsən?", "Lokal: ipconfig/ip a (IP varmı), gateway ping, DNS yoxla (nslookup), IP ilə ping (DNS problemi?), traceroute (harada kəsilir), firewall/proxy. OSI qatları üzrə aşağıdan yuxarı."],
["Portları say: 22, 80, 443, 445, 3389, 53, 25, 88.", "22 SSH, 80 HTTP, 443 HTTPS, 445 SMB, 3389 RDP, 53 DNS, 25 SMTP, 88 Kerberos."],
["Daxili (private) IP diapazonları hansılardır?", "10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16. 127.0.0.0/8 loopback, 169.254 APIPA."]
]},
{ title: "Windows & Linux", items: [
["Uğursuz login hansı Windows Event ID-dir? Logon Type-ların mənası?", "4625. Type 2 interactive, 3 network (SMB), 10 RDP, 5 service, 7 unlock. 4624 uğurlu login."],
["svchost.exe-nin normal parent-i nədir? Masquerading-i necə tapırsan?", "services.exe. Masquerading: səhv yazılış (scvhost), səhv yol (System32-dən kənar), səhv parent, imzasız. 'Know normal, find evil'."],
["Linux-da brute force SSH hücumunu loglarda necə tapırsan?", "/var/log/auth.log (Debian) və ya /var/log/secure (RHEL). grep 'Failed password' | IP çıxar | sort | uniq -c | sort -nr. Çoxlu Failed-dən sonra Accepted = uğurlu brute force."],
["Windows-da persistence yerlərini say.", "Run/RunOnce registry açarları, servislər (7045), scheduled tasks (4698), startup qovluğu, WMI subscription, yeni hesab. Linux: cron, systemd, .bashrc, authorized_keys."],
["Şübhəli PowerShell-i necə tanıyırsan?", "-enc/-EncodedCommand, -w hidden, -nop, Bypass, IEX, DownloadString, FromBase64String, qəribə hərf qarışığı. Event 4104 script block logging ilə izlənir."]
]},
{ title: "SOC & Təhqiqat", items: [
["Bir alert gəldi — addım-addım nə edərsən?", "Oxu/anla → kontekst topla (host/user, daxili/xarici, kritiklik) → 5W → IOC çıxar → enrich (VT/AbuseIPDB) → korrelyasiya/timeline → TP/FP qərar → hərəkət (bağla/eskalasiya) → sənədləşdir."],
["False Positive, True Positive, False Negative fərqi?", "TP: real təhlükə düzgün tutuldu. FP: yanlış həyəcan. FN: təhlükə buraxıldı (ən təhlükəli). Benign TP: fəaliyyət real amma səlahiyyətli (pentest)."],
["İstifadəçi phishing məktubu report etdi — nə edərsən?", "Email analizi (başlıq/SPF/DKIM, URL, əlavə — urlscan/VT, real brauzerdə AÇMADAN) → scope (başqa kim aldı/kliklədi) → containment (karantin/purge, IOC blok) → kliklənibsə host/credential yoxla → sənədləşdir (T1566)."],
["Eskalasiya nə vaxt edərsən?", "Yüksək ehtimallı/təsdiqlənmiş TP, öz səviyyəndə həll edə bilmədikdə, kritik aktiv təsirlənəndə, aktiv hücum, containment qərarı lazım olanda. 'Şübhə varsa eskalasiya' yanlış bağlamadan yaxşıdır."],
["MITRE ATT&CK nədir və necə istifadə edirsən?", "Real müşahidə olunmuş hücum taktika və texnikalarının kataloqu (TTP). Hər texnikanın ID-si var (T1059.001 PowerShell). Alertləri etiketləmək, detection coverage xəritələmək, hunting fərziyyələri qurmaq üçün."],
["Cyber Kill Chain-i izah et.", "Recon → Weaponization → Delivery → Exploitation → Installation → C2 → Actions on Objectives. Zənciri nə qədər erkən qırsan, zərər az olar."]
]},
{ title: "Praktiki/ssenari", items: [
["'185.x.x.x-dən 1000 uğursuz login, sonra 1 uğurlu' — nə baş verir, nə edirsən?", "Uğurlu brute force (TP, kritik). Addım: IP blok, hesab deaktiv/parol dəyiş, 4672 ilə imtiyaz yoxla, uğurlu girişdən sonrakı fəaliyyəti araşdır, eskalasiya, ekspozisiyanı düzəlt (niyə internetdən əlçatandır?)."],
["Malware nümunəsi aldın — necə təhlil edərsən?", "Təhlükəsizlik qaydaları (izolyasiya VM, snapshot) → statik (hash→VT, strings, imports, packer) → dinamik/sandbox → IOC çıxar → ailə/niyyət → detection/containment → sənədləşdir. Həssas faylı VT-yə yükləmə."],
["C2 beaconing-i necə aşkarlayarsan?", "Müntəzəm interval (periodicity, az dispersiya) + kiçik sabit ölçü + uzun müddət + nadir/yeni təyinat. Proxy/Zeek conn.log-da delta analizi, JA3, domen yaşı. RITA aləti."],
["Ransomware insidenti — ilk 3 addım?", "1) İzolyasiya (yayılmanı dayandır), 2) yayılma vektorunu/əhatəni tap, 3) backup bütövlüyünü yoxla. Fidyə ödəmə tövsiyə olunmur; offline backup kritikdir; forensik dəlil qoru."],
["Həssas sistemdə IOC-u birbaşa C2-də yoxlamalısan — nə nəzərə alırsan?", "OPSEC: aktiv probing hücumçuya 'aşkarlandım' siqnalı verə bilər. Passiv mənbələri (VT, passive DNS) üstün tut, aktiv yoxlama üçün icazə al, təşkilat prosedurunu izlə."]
]},
{ title: "Davranış (behavioral)", items: [
["Niyə SOC analitik olmaq istəyirsən?", "Səmimi, konkret cavab ver: problem həll etmə həvəsi, daim öyrənmə, təhlükəsizliyə maraq, mühafizəçi rolu. Klişedən qaç, öz hekayəni danış (homelab, CTF, öyrəndiklərin)."],
["Bilmədiyin bir alertlə qarşılaşsan nə edərsən?", "Panika yox — strukturlu yanaşma: oxu/araşdır, sənədləşdirilmiş prosedura bax, OSINT ilə öyrən, komandadan/kollektiv bilikdən soruş, lazım olsa eskalasiya et. Öyrənmə həvəsi və təvazökarlıq göstər."],
["Təzyiq altında necə işləyirsən?", "STAR metodu ilə real nümunə ver. Strukturlu düşüncə, prioritetləşdirmə, sakitlik, komanda ilə ünsiyyət. Çoxlu alert gələndə prioritet (severity × kritiklik) ver."],
["Bir dəfə səhv etdiyin vəziyyət?", "Dürüst ol, məsuliyyət götür, nəyi öyrəndiyini vurğula (blame-free öyrənmə mədəniyyəti). Məs: bir alerti FP sandım amma TP idi → indi həmişə sənədləşdirirəm/çarpaz yoxlayıram."],
["Özünü necə yeni saxlayırsan (öyrənmə)?", "Konkret mənbələr: ATT&CK, təhdid hesabatları (Mandiant/Talos), TryHackMe/LetsDefend, infosec Twitter/Reddit, homelab, bloglar, konfranslar. Öyrənmənin heç vaxt bitmədiyini göstər."]
]}
];

// ---------- Ev laboratoriyası ----------
SOC.lab = R`
<p>Nəzəriyyə kifayət deyil — SOC bacarıqları praktikada formalaşır. Öz ev laboratoriyanı qurmaq müsahibədə ən güclü siqnallardandır: "öz SIEM-imi qurdum, hücum edib loglarda izlədim" demək sertifikatdan dəyərli ola bilər.</p>

<h2>Seçim A: Brauzerdə (quraşdırma yox — ən asan başlanğıc)</h2>
<div class="card"><ul>
<li><b>TryHackMe</b> (tryhackme.com) — 'Cyber Security 101', 'SOC Level 1', 'SOC Level 2' pathway-ləri. Rəhbərli, əyləncəli, pulsuz məzmun çox.</li>
<li><b>LetsDefend</b> (letsdefend.io) — real SOC alert triage simulyasiyası, pulsuz başlanğıc.</li>
<li><b>Blue Team Labs Online</b> (blueteamlabs.online) — mavi komanda ssenariləri və təhqiqatlar.</li>
<li><b>CyberDefenders</b> (cyberdefenders.org) — pulsuz DFIR/blue team tapşırıqları (pcap, memory, disk).</li>
<li><b>PortSwigger Web Security Academy</b> — veb hücumları (pulsuz, qızıl standart).</li>
<li><b>RangeForce, Splunk BOTS</b> — SIEM praktikası.</li>
</ul></div>

<h2>Seçim B: Öz virtual laboratoriyan (daha dərin)</h2>
<div class="card">
<h3>1. Virtualizasiya</h3>
<p><b>VirtualBox</b> (pulsuz) və ya VMware Workstation Player. Ən azı 16 GB RAM tövsiyə olunur (8 GB-la minimal mümkündür). Hər VM-i qurduqdan sonra <b>snapshot</b> al.</p>
<h3>2. Əsas VM-lər</h3>
<ul>
<li><b>Ubuntu Server</b> — Linux log analizi, SSH brute force təcrübəsi</li>
<li><b>Windows 10/11</b> (Evaluation) + <b>Sysmon</b> (SwiftOnSecurity konfigi) — endpoint telemetriya</li>
<li><b>Windows Server</b> — Active Directory lab (DC)</li>
<li>İstəyə görə: <b>Kali Linux</b> (hücum tərəfi — yalnız öz labında!)</li>
</ul>
<h3>3. SIEM/monitorinq (birini seç)</h3>
<ul>
<li><b>Wazuh</b> (pulsuz, açıq XDR/SIEM) — tək node qurmaq asan, agent-lər əlavə et</li>
<li><b>Splunk Free</b> — gündə 500 MB limit, SPL öyrənmək üçün</li>
<li><b>Elastic (ELK) / Security Onion</b> — tam NSM paketi (Zeek, Suricata, Elastic — bir ISO)</li>
</ul>
<h3>4. Hazır laboratoriya layihələri (avtomatlaşdırılmış)</h3>
<ul>
<li><b>GOAD (Game of Active Directory)</b> — hazır zəif AD mühiti (hücum/müdafiə təcrübəsi)</li>
<li><b>DetectionLab</b> — Windows + Sysmon + SIEM avtomatik qurulumu</li>
<li><b>BlueTeam.Lab</b></li>
</ul>
</div>

<h2>Praktiki məşq ideyaları (addım-addım)</h2>
<div class="card"><ol>
<li><b>SSH brute force:</b> Ubuntu-da SSH aç, başqa VM-dən (və ya hydra ilə öz labında) səhv parollar yaz, auth.log-da izləri tap, top IP əmrini işlət, fail2ban qur.</li>
<li><b>PowerShell detection:</b> Windows-da <code>powershell -enc</code> işlət, Sysmon Event 1 və 4104-də tap, SIEM-də detection qaydası yaz.</li>
<li><b>Phishing simulyasiyası:</b> makrolu Word sənədi yarat (öz labında), açanda cmd başlatsın, process tree-də (Word→cmd) gör.</li>
<li><b>AD hücumu:</b> GOAD-da Kerberoasting et (Rubeus/Impacket), 4769 loglarında tap.</li>
<li><b>Pcap analizi:</b> malware-traffic-analysis.net tapşırığını Wireshark ilə həll et.</li>
<li><b>Memory forensics:</b> MemLabs/CyberDefenders RAM dump-unu Volatility ilə araşdır.</li>
<li><b>Detection yaz:</b> SigmaHQ-dan qayda oxu, öz qaydanı yaz, Atomic Red Team ilə test et.</li>
</ol></div>

<div class="warn"><b>Etika və qanun:</b> Bütün hücum texnikalarını YALNIZ öz izolyasiya olunmuş laboratoriyanda və ya icazəli təlim platformalarında (TryHackMe, HTB, PortSwigger) sına. İcazəsiz sistemə müdaxilə — skan belə — bir çox ölkədə, o cümlədən Azərbaycanda (Cinayət Məcəlləsi Maddə 271–273) cinayətdir. Lab şəbəkəni real şəbəkədən izolyasiya et (Host-Only/Internal network).</div>

<div class="tip"><b>Portfel:</b> Hər etdiyin lab-ı sənədləşdir (GitHub/blog): nə qurdun, nə hücum etdin, loglarda necə göründü, hansı detection yazdın. Bu portfel müsahibədə "praktiki təcrübən var?" sualına ən yaxşı cavabdır.</div>
`;

// ---------- Resurslar ----------
SOC.resources = R`
<h2>Pulsuz öyrənmə platformaları</h2>
<div class="card"><ul>
<li><b>TryHackMe</b> — rəhbərli öyrənmə yolları (SOC L1/L2, Blue Team). Başlanğıc üçün ən yaxşı.</li>
<li><b>LetsDefend</b> — real SOC alert simulyasiyası (blue team fokuslu).</li>
<li><b>Blue Team Labs Online (BTLO)</b> — mavi komanda ssenariləri.</li>
<li><b>CyberDefenders</b> — DFIR/forensik tapşırıqları (pulsuz).</li>
<li><b>Hack The Box</b> — HTB Academy, Sherlocks (blue team DFIR).</li>
<li><b>PortSwigger Web Security Academy</b> — veb hücumları (pulsuz).</li>
<li><b>Microsoft Learn, AWS Skill Builder</b> — cloud təhlükəsizliyi.</li>
<li><b>Splunk Education (Free), Boss of the SOC (BOTS)</b> — SIEM praktikası.</li>
<li><b>OpenSecurityTraining2, Malware Unicorn</b> — RE/malware (pulsuz, dərin).</li>
</ul></div>

<h2>Sertifikatlar (yol xəritəsi)</h2>
<div class="card">
<p><b>Başlanğıc (L1 hədəfi):</b></p>
<ul><li><b>CompTIA Security+</b> — sahəyə giriş standartı, geniş qəbul</li>
<li><b>CompTIA Network+</b> — şəbəkə əsasları</li>
<li><b>BTL1 (Blue Team Level 1)</b> — çox praktik, əlçatan, SOC-a birbaşa aid (tövsiyə!)</li>
<li><b>Google Cybersecurity Certificate</b> — başlanğıc, Coursera</li>
<li><b>Microsoft SC-200</b> (Security Operations Analyst) — Sentinel/Defender</li></ul>
<p><b>Orta (L1→L2):</b></p>
<ul><li><b>CompTIA CySA+</b> — analitik fokuslu</li><li><b>BTL2</b> — qabaqcıl blue team</li>
<li><b>GIAC GCIH</b> (Incident Handler), <b>GSEC</b></li><li><b>eJPT</b> — offensive baxış (müdafiəni anlamaq üçün)</li></ul>
<p><b>Qabaqcıl (L2→L3, ixtisaslaşma):</b></p>
<ul><li><b>GCFA/GCFE</b> (forensika), <b>GNFA</b> (network forensics), <b>GREM</b> (malware RE)</li>
<li><b>GCTI</b> (threat intel), <b>GCDA</b> (detection)</li><li><b>OSCP</b> (offensive, prestijli), <b>CRTO</b></li>
<li><b>CISSP</b> (menecment/geniş, təcrübə tələb edir)</li></ul>
<p class="muted">Qeyd: Sertifikat faydalıdır, amma <b>praktiki bacarıq + portfel</b> çox vaxt daha vacibdir. Hər ikisini birləşdir.</p>
</div>

<h2>TI, alət və arayış mənbələri</h2>
<div class="card"><ul>
<li><b>MITRE ATT&CK</b> (attack.mitre.org) — TTP kataloqu, hər gün istifadə edəcəksən</li>
<li><b>MITRE D3FEND, CAR (Cyber Analytics Repository)</b></li>
<li><b>SigmaHQ</b> (GitHub) — detection qaydaları</li><li><b>Atomic Red Team</b> — texnika testi</li>
<li><b>LOLBAS / GTFOBins</b> — legitim alətlərin sui-istifadəsi</li>
<li><b>abuse.ch</b> (URLhaus, ThreatFox, MalwareBazaar, Feodo) — pulsuz TI</li>
<li><b>VirusTotal, AbuseIPDB, urlscan.io, GreyNoise, Shodan, Censys</b> — IOC yoxlama</li>
<li><b>CyberChef</b> — "swiss army knife" (decode, defang, analiz)</li>
<li><b>Eric Zimmerman tools, Volatility, Autopsy, KAPE</b> — forensika</li>
<li><b>SANS posters/cheat sheets</b> (Hunt Evil, Find Evil, DFIR) — çap et, masana as</li>
</ul></div>

<h2>Oxumalı mənbələr və icma</h2>
<div class="card"><ul>
<li><b>Təhdid hesabatları:</b> Mandiant, CrowdStrike, Microsoft Security, Cisco Talos, Unit 42 (Palo Alto)</li>
<li><b>Kitablar:</b> "Practical Malware Analysis", "The Practice of Network Security Monitoring" (Bejtlich), "Blue Team Handbook", "Applied Incident Response" (Steve Anson)</li>
<li><b>İcma:</b> r/blueteamsec, r/cybersecurity, infosec Twitter/X, DFIR Discord-ları, yerli BSides/konfranslar</li>
<li><b>Bloglar:</b> SANS Internet Storm Center, The DFIR Report, Red Canary blog, Microsoft/Google TI blogları</li>
</ul></div>

<div class="tip"><b>Mentor məsləhəti:</b> Çox mənbə seni boğmasın. Bir öyrənmə yolu seç (məs. TryHackMe SOC L1 + Security+/BTL1), onu bitir, homelab qur, portfel yarat. Dərinlik genişlikdən vacibdir. Ardıcıllıq hər şeydir — gündə 1-2 saat, hər gün.</div>
`;

// ---------- Port & Event ID cədvəli ----------
SOC.ports = R`
<h2>Mütləq əzbərlənməli portlar</h2>
<table class="tbl"><tr><th>Port</th><th>Protokol</th><th>SOC qeydi</th></tr>
<tr><td>20/21</td><td>FTP</td><td>Açıq mətn credential</td></tr>
<tr><td>22</td><td>SSH</td><td>Şifrəli giriş, brute force hədəfi</td></tr>
<tr><td>23</td><td>Telnet</td><td>Açıq mətn — istifadə etmə</td></tr>
<tr><td>25 / 465 / 587</td><td>SMTP / SMTPS / Submission</td><td>Email göndərmə, spam/exfil</td></tr>
<tr><td>53</td><td>DNS</td><td>Tunneling, DGA, exfil — həmişə izlə</td></tr>
<tr><td>67/68</td><td>DHCP</td><td>IP təyinatı (DHCP log = hansı host hansı IP)</td></tr>
<tr><td>80</td><td>HTTP</td><td>Şifrəsiz veb</td></tr>
<tr><td>88</td><td>Kerberos</td><td>AD autentifikasiya</td></tr>
<tr><td>110 / 143</td><td>POP3 / IMAP</td><td>Email alma</td></tr>
<tr><td>123</td><td>NTP</td><td>Vaxt sinxronizasiyası (log korrelyasiyası)</td></tr>
<tr><td>135 / 137-139</td><td>MSRPC / NetBIOS</td><td>Windows, lateral movement</td></tr>
<tr><td>161/162</td><td>SNMP</td><td>Cihaz idarəetmə, zəif community string</td></tr>
<tr><td>389 / 636</td><td>LDAP / LDAPS</td><td>Directory sorğuları</td></tr>
<tr><td>443</td><td>HTTPS</td><td>Şifrəli veb (əksər C2 də burada)</td></tr>
<tr><td>445</td><td>SMB</td><td>Fayl paylaşım, ransomware, EternalBlue, lateral</td></tr>
<tr><td>514</td><td>Syslog</td><td>Log toplama</td></tr>
<tr><td>1433 / 3306</td><td>MSSQL / MySQL</td><td>Verilənlər bazası</td></tr>
<tr><td>3389</td><td>RDP</td><td>Ransomware giriş vektoru #1</td></tr>
<tr><td>5985/5986</td><td>WinRM</td><td>PowerShell Remoting, lateral movement</td></tr>
<tr><td>4444 / 1337 / 31337</td><td>(qeyri-standart)</td><td>Metasploit/backdoor klişesi — şübhəli</td></tr></table>

<h2>Mütləq əzbərlənməli Windows Security Event ID-ləri</h2>
<table class="tbl"><tr><th>ID</th><th>Mənası</th><th>Niyə vacib</th></tr>
<tr><td>4624</td><td>Uğurlu logon</td><td>Logon Type-a bax (2 local, 3 network, 10 RDP)</td></tr>
<tr><td>4625</td><td>Uğursuz logon</td><td>Brute force, spraying (Sub Status koduna bax)</td></tr>
<tr><td>4634/4647</td><td>Logoff</td><td>Sessiya müddəti</td></tr>
<tr><td>4648</td><td>Explicit credentials ilə logon</td><td>runas, lateral movement</td></tr>
<tr><td>4672</td><td>Xüsusi imtiyazlar təyin edildi</td><td>Admin logon</td></tr>
<tr><td>4688</td><td>Yeni proses yaradıldı</td><td>Command line audit (aktiv olmalı)</td></tr>
<tr><td>4697 / 7045</td><td>Servis quraşdırıldı</td><td>Persistence, lateral movement (7045 System log)</td></tr>
<tr><td>4698</td><td>Scheduled task yaradıldı</td><td>Persistence</td></tr>
<tr><td>4720</td><td>İstifadəçi hesabı yaradıldı</td><td>Persistence (T1136)</td></tr>
<tr><td>4728/4732/4756</td><td>Qrupa üzv əlavə edildi</td><td>Admin qrupuna əlavə (global/local/universal)</td></tr>
<tr><td>4740</td><td>Hesab bloklandı (lockout)</td><td>Brute force</td></tr>
<tr><td>4768 / 4769</td><td>Kerberos TGT / TGS</td><td>4769 = Kerberoasting (RC4/0x17)</td></tr>
<tr><td>4771</td><td>Kerberos pre-auth uğursuz</td><td>DC-də parol səhvi</td></tr>
<tr><td>4776</td><td>NTLM credential yoxlanışı</td><td>Pass-the-Hash</td></tr>
<tr><td>4662</td><td>Directory object girişi</td><td>DCSync (Replicating Directory Changes)</td></tr>
<tr><td>1102</td><td>Security log silindi</td><td>Çox şübhəli! (T1070.001)</td></tr>
<tr><td>4104</td><td>PowerShell Script Block</td><td>Skript məzmunu (deobfuscated)</td></tr></table>

<h2>Vacib Sysmon Event ID-ləri</h2>
<table class="tbl"><tr><th>ID</th><th>Hadisə</th></tr>
<tr><td>1</td><td>Process Creation (command line + hash + parent — qızıl!)</td></tr>
<tr><td>3</td><td>Network Connection</td></tr><tr><td>7</td><td>Image/DLL Loaded</td></tr>
<tr><td>8</td><td>CreateRemoteThread (injection)</td></tr><tr><td>10</td><td>ProcessAccess (LSASS dump!)</td></tr>
<tr><td>11</td><td>FileCreate</td></tr><tr><td>12/13/14</td><td>Registry (persistence)</td></tr>
<tr><td>15</td><td>FileCreateStreamHash (ADS/Mark-of-the-Web)</td></tr><tr><td>22</td><td>DNS Query</td></tr></table>

<h2>Default TTL dəyərləri (OS təxmini)</h2>
<table class="tbl"><tr><th>OS/Cihaz</th><th>Default TTL</th></tr>
<tr><td>Linux / macOS</td><td>64</td></tr><tr><td>Windows</td><td>128</td></tr><tr><td>Şəbəkə cihazları (bəzi)</td><td>255</td></tr></table>
`;

// ---------- Lüğət ----------
SOC.glossary = [
["APT", "Advanced Persistent Threat — resurslu, səbirli, hədəfli təhdid aktoru (çox vaxt dövlət dəstəkli)."],
["ACL", "Access Control List — giriş icazələri siyahısı."],
["ADS", "Alternate Data Streams — NTFS-də fayla bağlı gizli axınlar."],
["Beaconing", "Malware-in C2 serverinə müntəzəm 'check-in' bağlantıları."],
["BEC", "Business Email Compromise — rəhbər adından saxta əməliyyat tələbi."],
["BloodHound", "AD hücum yollarını qrafik göstərən alət."],
["Brute force", "Bütün kombinasiyaları sınayaraq parol tapma hücumu."],
["C2 (C&C)", "Command and Control — hücumçunun malware ilə əlaqə infrastrukturu."],
["Chain of custody", "Dəlilin toplanma/saxlanma zəncirinin sənədləşdirilməsi (hüquqi etibar)."],
["CIA", "Confidentiality, Integrity, Availability — təhlükəsizliyin üç təməli."],
["Containment", "İnsidentdə təhlükənin yayılmasının dayandırılması."],
["Credential stuffing", "Sızmış user:parol cütlərinin kütləvi sınanması."],
["CVE", "Common Vulnerabilities and Exposures — zəiflik identifikatoru."],
["CVSS", "Zəifliyin ciddiliyini 0-10 qiymətləndirən sistem."],
["DCSync", "Hücumçunun DC kimi davranıb replikasiya ilə hash çıxarması."],
["Defang", "IOC-u təhlükəsizləşdirmə (hxxp://evil[.]com)."],
["DGA", "Domain Generation Algorithm — malware-in təsadüfi C2 domenləri yaratması."],
["DFIR", "Digital Forensics & Incident Response."],
["DLP", "Data Loss Prevention — məlumat sızmasının qarşısını alma."],
["DMARC", "Email domen qoruması (SPF/DKIM əsaslı siyasət)."],
["DKIM", "Email-in rəqəmsal imzası (bütövlük/autentifikasiya)."],
["Dwell time", "Hücumçunun aşkarlanmadan sistemdə qaldığı müddət."],
["EDR", "Endpoint Detection and Response — endpoint davranış aşkarlama/cavab."],
["Encoding", "Açarsız geri çevrilən məlumat formatı (Base64)."],
["Exfiltration", "Məlumatın icazəsiz çıxarılması/oğurlanması."],
["False Positive", "Zərərsiz fəaliyyətə yaranan yanlış alert."],
["False Negative", "Buraxılmış real təhlükə (alert yaranmır) — ən təhlükəli."],
["Fileless malware", "Diskə yazılmayan, yaddaş/skriptlərdə işləyən zərərli kod."],
["Hash", "Faylın birtərəfli 'barmaq izi' (SHA256)."],
["Hardening", "Hücum səthini azaltmaq üçün sistem möhkəmləndirmə."],
["Honeypot", "Hücumçunu cəlb edən tələ sistem."],
["IOA", "Indicator of Attack — hücum davranışı/niyyəti göstəricisi."],
["IOC", "Indicator of Compromise — kompromis artefaktı (IP, hash, domen)."],
["IDS/IPS", "Intrusion Detection/Prevention System."],
["Kerberoasting", "SPN servis biletlərini offline qırmaq hücumu."],
["Kill Chain", "Hücum mərhələlərinin modeli (Lockheed Martin)."],
["Lateral movement", "Şəbəkə daxilində bir sistemdən digərinə keçid."],
["Least Privilege", "İşə lazım olan minimum icazə prinsipi."],
["LOLBin", "Living-off-the-Land Binary — sui-istifadə edilən legitim sistem aləti."],
["LSASS", "Windows autentifikasiya prosesi — credential oğurluğu hədəfi."],
["MFA", "Multi-Factor Authentication — çoxfaktorlu autentifikasiya."],
["MITRE ATT&CK", "Hücum taktika və texnikalarının (TTP) kataloqu."],
["MTTD/MTTR", "Mean Time To Detect / Respond — SOC metrikaları."],
["Mutex", "Malware-in təkrar işləməməsini təmin edən unikal identifikator."],
["NAT", "Network Address Translation — IP ünvanlarının çevrilməsi."],
["NSM", "Network Security Monitoring (Zeek, Suricata)."],
["Non-repudiation", "İnkaredilməzlik (rəqəmsal imza ilə)."],
["OSINT", "Open Source Intelligence — açıq mənbə kəşfiyyatı."],
["Pass-the-Hash", "Parol əvəzinə NTLM hash ilə autentifikasiya."],
["Persistence", "Hücumçunun sistemdə qalıcılıq təmin etməsi."],
["Phishing", "Aldadıcı email ilə məlumat/giriş əldə etmə."],
["PII", "Personally Identifiable Information — şəxsi məlumat."],
["Playbook", "İnsident növü üçün addım-addım prosedur."],
["Privilege Escalation", "İmtiyaz yüksəltmə (adi → admin/root)."],
["Purple Team", "Red və Blue komandaların birgə müdafiə təkmilləşdirməsi."],
["Pyramid of Pain", "IOC-ların hücumçu üçün dəyişdirilmə çətinliyi iyerarxiyası."],
["RAT", "Remote Access Trojan — uzaq nəzarət malware-i."],
["RCE", "Remote Code Execution — uzaqdan kod icrası."],
["Reverse shell", "Hədəfin hücumçuya geri bağlanması."],
["Ransomware", "Faylları şifrələyib fidyə tələb edən malware."],
["SIEM", "Security Information and Event Management — log toplama/korrelyasiya."],
["Sigma", "SIEM-dən asılı olmayan detection qaydası formatı."],
["SOAR", "Security Orchestration, Automation and Response."],
["SOC", "Security Operations Center."],
["SPF", "Email göndərən serverləri təyin edən DNS qeydi."],
["Sysmon", "Windows telemetriyasını gücləndirən Sysinternals aləti."],
["TLP", "Traffic Light Protocol — paylaşım məhdudiyyəti (RED/AMBER/GREEN/CLEAR)."],
["TTP", "Tactics, Techniques, Procedures — hücumçu davranışı."],
["True Positive", "Düzgün aşkarlanmış real təhlükə."],
["Triage", "Alertin ilkin qiymətləndirilməsi və prioritetləşdirilməsi."],
["Volatility", "Yaddaş (RAM) forensikası aləti."],
["Webshell", "Serverdə uzaqdan əmr icrasına imkan verən zərərli skript."],
["XDR", "Extended Detection and Response — çox mənbəli aşkarlama."],
["YARA", "Faylları string/bayt nümunələrinə görə təsnif edən qayda dili."],
["Zero-day", "Yamağı hələ olmayan / naməlum zəiflik."],
["Zero Trust", "'Heç vaxt etibar etmə, həmişə yoxla' təhlükəsizlik modeli."]
];
})();
