/* more.js — mövcud modulları daha dolğun məlumat və daha çox sual ilə zənginləşdirir.
   Bu fayl app.js-dən ƏVVƏL, bütün data fayllarından SONRA yüklənir. */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;
const M = {}; (window.SOC.modules || []).forEach(m => M[m.id] = m);
function addQ(id, arr) { if (M[id]) M[id].quiz.push.apply(M[id].quiz, arr); }
function addLesson(id, lesson) { if (M[id]) M[id].lessons.push(lesson); }
function addTask(id, t) { if (M[id]) M[id].tasks.push(t); }

/* ============================ L1 ============================ */

// ---- l1-intro ----
addLesson("l1-intro", { title: "Təhlükəsizlik çərçivələri və standartlar (dərin)", html: R`
<p>SOC analitik gündəlik işində çərçivə və standartlara istinad edir. Bunları tanımaq müsahibədə və real işdə vacibdir.</p>
<h3>Əsas çərçivələr</h3>
<table><tr><th>Çərçivə</th><th>Nə üçündür</th></tr>
<tr><td><b>NIST Cybersecurity Framework (CSF)</b></td><td>5 funksiya: Identify, Protect, Detect, Respond, Recover. Təşkilatın təhlükəsizlik duruşunu qurmaq üçün.</td></tr>
<tr><td><b>NIST SP 800-61</b></td><td>Incident Handling bələdçisi (IR dövrü).</td></tr>
<tr><td><b>ISO/IEC 27001</b></td><td>İnformasiya Təhlükəsizliyi İdarəetmə Sistemi (ISMS) standartı.</td></tr>
<tr><td><b>CIS Controls</b></td><td>18 praktiki təhlükəsizlik nəzarəti (prioritetləşdirilmiş).</td></tr>
<tr><td><b>MITRE ATT&CK</b></td><td>Hücumçu TTP taksonomiyası.</td></tr>
<tr><td><b>OWASP Top 10</b></td><td>Veb tətbiq riskləri.</td></tr>
<tr><td><b>PCI-DSS</b></td><td>Ödəniş kartı məlumatlarının qorunması.</td></tr>
<tr><td><b>GDPR</b></td><td>Şəxsi məlumatların qorunması (AB); data breach bildirişi 72 saat.</td></tr></table>
<h3>Governance, Risk, Compliance (GRC)</h3>
<ul><li><b>Governance</b> — siyasət, rol, məsuliyyət</li><li><b>Risk</b> — risklərin müəyyən edilməsi və idarəsi</li><li><b>Compliance</b> — qanun/standartlara uyğunluq</li></ul>
<h3>Siyasət iyerarxiyası</h3>
<p><b>Policy</b> (nə — yüksək səviyyə) → <b>Standard</b> (hansı texnologiya/konfiqurasiya) → <b>Procedure</b> (addım-addım necə) → <b>Guideline</b> (tövsiyə). SOC playbook-ları prosedurlardır.</p>
<div class="tip">Müsahibə: "Hansı təhlükəsizlik çərçivələrini bilirsən?" sualına NIST CSF, MITRE ATT&CK və ISO 27001-i adlandırıb qısa izah vermək güclü təəssürat yaradır.</div>`});
addQ("l1-intro", [
{ q: "NIST CSF-in 5 funksiyası hansıdır?", o: ["Identify, Protect, Detect, Respond, Recover", "Plan, Build, Run, Test, Deploy", "Scan, Patch, Monitor, Report, Close", "Red, Blue, Purple, White, Gold"], a: 0, e: "Cybersecurity Framework-ün nüvəsi." },
{ q: "ISO/IEC 27001 nəyə aiddir?", o: ["İnformasiya Təhlükəsizliyi İdarəetmə Sistemi (ISMS)", "Veb tətbiq hücumları", "Şəbəkə kabel standartı", "Şifrələmə alqoritmi"], a: 0, e: "Təşkilati idarəetmə standartı." },
{ q: "Siyasət iyerarxiyasında ən detallı, addım-addım sənəd hansıdır?", o: ["Procedure", "Policy", "Standard", "Guideline"], a: 0, e: "Policy ən yüksək, procedure ən konkret." },
{ q: "GRC nəyin qısaltmasıdır?", o: ["Governance, Risk, Compliance", "Global Response Center", "General Risk Control", "Group Resource Config"], a: 0, e: "Üç sütun." },
{ q: "PCI-DSS nəyi qoruyur?", o: ["Ödəniş kartı məlumatlarını", "Tibbi məlumatları", "Dövlət sirlərini", "Email-ləri"], a: 0, e: "Kart sənayesi standartı." },
{ q: "CIS Controls nədir?", o: ["Prioritetləşdirilmiş praktiki təhlükəsizlik nəzarətləri", "Antivirus proqramı", "Şifrələmə protokolu", "Firewall markası"], a: 0, e: "18 nəzarət." },
{ q: "'Accountability' (hesabatlılıq) hansı AAA komponenti ilə bağlıdır?", o: ["Accounting (audit/log)", "Authentication", "Authorization", "Availability"], a: 0, e: "Kim nə etdi — loglar." },
{ q: "Təhlükəsizlikdə 'baseline' nə deməkdir?", o: ["Sistemin təsdiqlənmiş normal/təhlükəsiz konfiqurasiyası", "Ən zəif parol", "Maksimum trafik", "Firewall qaydası"], a: 0, e: "Kənarlaşma anomaliyadır." },
{ q: "Qualitative risk analizi nədir?", o: ["Riski təsvir/kateqoriya (yüksək/orta/aşağı) ilə qiymətləndirmək", "Yalnız pul ilə ölçmək", "Kod yazmaq", "Patch tətbiqi"], a: 0, e: "Quantitative isə rəqəmlə (ALE və s.)." },
{ q: "ALE (Annualized Loss Expectancy) necə hesablanır?", o: ["SLE × ARO", "Ehtimal + Təsir", "CVSS × 10", "Risk − Control"], a: 0, e: "SLE (tək hadisə itkisi) × ARO (illik baş vermə dərəcəsi)." },
{ q: "Due care və due diligence fərqi nədir?", o: ["Due care — tədbir görmək; due diligence — davamlı araşdırıb yoxlamaq", "Eynidir", "Due care hüquqidir yalnız", "Due diligence texnikidir yalnız"], a: 0, e: "Care = hərəkət, diligence = araşdırma/nəzarət." },
{ q: "Separation of duties (vəzifə bölgüsü) nəyin qarşısını alır?", o: ["Bir şəxsin tək başına kritik prosesi sui-istifadə etməsini", "Yavaş şəbəkəni", "Disk dolmasını", "DNS səhvini"], a: 0, e: "Fırıldaq/səhvi azaldır." },
{ q: "Risk üçün 4 əsas cavab strategiyası hansıdır?", o: ["Avoid, Transfer, Mitigate, Accept", "Scan, Patch, Block, Report", "Detect, Deny, Delay, Deter", "Plan, Do, Check, Act"], a: 0, e: "Qaç, ötür (sığorta), azalt, qəbul et." },
{ q: "Risk transfer nümunəsi hansıdır?", o: ["Kiber sığorta almaq", "Serveri söndürmək", "Patch tətbiqi", "Firewall qurmaq"], a: 0, e: "Riski üçüncü tərəfə ötürmək." }
]);

// ---- l1-os ----
addLesson("l1-os", { title: "Proseslər, servislər və sistem komponentləri (dərin)", html: R`
<h3>İcra kontekstləri</h3>
<ul><li><b>Foreground</b> — istifadəçi ilə interaktiv proses</li><li><b>Background / daemon / service</b> — arxa planda işləyən (Linux: daemon, Windows: service)</li>
<li><b>Scheduler</b> — CPU-nu proseslər arasında bölür (preemptive multitasking)</li></ul>
<h3>Proses vəziyyətləri</h3>
<p>Running (icra olunur), Ready (növbədə), Blocked/Waiting (resurs gözləyir), Terminated (bitib), Zombie (bitib amma parent hələ oxumayıb — Linux).</p>
<h3>IPC (Inter-Process Communication)</h3>
<p>Proseslər bir-biri ilə əlaqə üçün: pipe, socket, shared memory, message queue, mutex/semaphore istifadə edir. Malware injection və C2 bu mexanizmlərdən istifadə edə bilər.</p>
<h3>Driver və kernel modulları</h3>
<p>Drayverlər kernel səviyyəsində işləyir — zərərli/zəif drayver (BYOVD — Bring Your Own Vulnerable Driver) hücumçuya kernel icrası verir. İmzalanmamış drayver yüklənməsi şübhəlidir.</p>
<h3>Simvolik keçid (symlink) və hardlink</h3>
<p>Symlink başqa yola işarə edir; hücumçular symlink ilə fayl yazma zəifliklərini (TOCTOU) istismar edə bilər.</p>
<h3>Mühit dəyişənləri (environment variables)</h3>
<p>PATH, LD_PRELOAD (Linux — kitabxana inyeksiyası!), TEMP və s. LD_PRELOAD ilə zərərli kitabxana yükləmə persistence/hijack üsuludur.</p>`});
addQ("l1-os", [
{ q: "Zombie proses nədir (Linux)?", o: ["Bitmiş, amma parent hələ status oxumadığı proses", "Yüksək CPU istifadə edən proses", "Virus", "Gizli proses"], a: 0, e: "Parent wait() etməyib." },
{ q: "LD_PRELOAD mühit dəyişəni nə üçün sui-istifadə oluna bilər?", o: ["Zərərli paylaşılan kitabxananı yükləmək (hijack/persistence)", "DNS həll", "Disk şifrələmə", "Email"], a: 0, e: "Linux kitabxana inyeksiyası." },
{ q: "BYOVD hücumu nədir?", o: ["Zəif/imzalı drayver gətirib kernel icrası əldə etmək", "Brute force", "Phishing", "SQL injection"], a: 0, e: "Bring Your Own Vulnerable Driver." },
{ q: "Preemptive multitasking nədir?", o: ["Scheduler CPU-nu proseslər arasında zorla bölür", "Bir proses CPU-nu tam tutur", "Yalnız bir proses işləyir", "Proseslər növbə gözləmir"], a: 0, e: "OS idarə edir." },
{ q: "Daemon (Linux) nəyin ekvivalentidir (Windows)?", o: ["Service", "Registry", "Driver", "Shell"], a: 0, e: "Arxa plan servisi." },
{ q: "TOCTOU zəifliyi nədir?", o: ["Time-of-check to time-of-use yarış şərti", "Şifrələmə növü", "Port skanı", "DNS tunneling"], a: 0, e: "Yoxlama və istifadə arasında vəziyyət dəyişir." },
{ q: "Hansı IPC mexanizmi deyil?", o: ["TTL", "Pipe", "Socket", "Shared memory"], a: 0, e: "TTL şəbəkə sahəsidir." },
{ q: "İmzalanmamış kernel drayverinin yüklənməsi niyə şübhəlidir?", o: ["Kernel səviyyəsində zərərli kod icra oluna bilər", "Çox yer tutur", "İnterneti yavaşladır", "Normaldır"], a: 0, e: "Rootkit/BYOVD riski." },
{ q: "Context switching nədir?", o: ["CPU-nun bir prosesdən digərinə keçməsi", "Faylı silmək", "Şifrələmə", "Login"], a: 0, e: "Scheduler əməliyyatı." },
{ q: "Semaphore/mutex nə üçündür?", o: ["Resursa eyni vaxtda girişi idarə etmək (sinxronizasiya)", "Şəbəkə routing", "Disk şifrələmə", "Log yazmaq"], a: 0, e: "Yarış şərtlərinin qarşısını alır." },
{ q: "ASLR (Address Space Layout Randomization) nə edir?", o: ["Yaddaş ünvanlarını təsadüfiləşdirib exploit-i çətinləşdirir", "Faylı şifrələyir", "DNS həll edir", "Parol yaradır"], a: 0, e: "Exploit mitigation." },
{ q: "DEP/NX biti nə edir?", o: ["Data sahələrindən kod icrasını bloklayır", "Diski şifrələyir", "Trafik filtrləyir", "Log saxlayır"], a: 0, e: "Buffer overflow mitigation." }
]);

// ---- l1-windows ----
addQ("l1-windows", [
{ q: "Event ID 4634 və 4647 fərqi nədir?", o: ["4634 logoff, 4647 istifadəçi-başlatmalı logoff", "Hər ikisi logon", "4634 login, 4647 logout", "Fərq yoxdur"], a: 0, e: "Hər ikisi sessiya sonu ilə bağlı." },
{ q: "UAC (User Account Control) nə edir?", o: ["Yüksəldilmiş əməliyyatlar üçün təsdiq istəyir", "Parol saxlayır", "Şəbəkə qurur", "Log silir"], a: 0, e: "İmtiyaz yüksəltməyə nəzarət." },
{ q: "Windows-da 'Pass-the-Hash' hansı autentifikasiya protokolunu hədəf alır?", o: ["NTLM", "Kerberos pre-auth", "TLS", "RADIUS"], a: 0, e: "NTLM hash ilə autentifikasiya." },
{ q: "AppLocker/WDAC nə üçündür?", o: ["Application whitelisting (yalnız icazəli proqramlar)", "Antivirus", "Firewall", "Backup"], a: 0, e: "İcra nəzarəti." },
{ q: "Hansı qovluqdan işləyən 'svchost.exe' normaldır?", o: ["C:\\Windows\\System32", "C:\\Users\\Public", "C:\\Temp", "C:\\ProgramData"], a: 0, e: "System32-dən kənar = şübhəli." },
{ q: "Windows Defender-in EDR versiyası necə adlanır?", o: ["Microsoft Defender for Endpoint", "Windows Firewall", "BitLocker", "AppLocker"], a: 0, e: "MDE — EDR/XDR." },
{ q: "Event ID 4688-in faydalı olması üçün nə aktiv olmalıdır?", o: ["Command line process auditing", "DNS loglama", "Firewall", "BitLocker"], a: 0, e: "Əmr sətri audit siyasəti." },
{ q: "'net localgroup administrators' əmri nə göstərir?", o: ["Lokal admin qrupunun üzvlərini", "Şəbəkə portlarını", "Prosesləri", "DNS qeydlərini"], a: 0, e: "Admin üzvlüyü enumeration." },
{ q: "Hansı Sysmon konfiqi sahədə məşhur başlanğıcdır?", o: ["SwiftOnSecurity", "EICAR", "Mimikatz", "rockyou"], a: 0, e: "Pulsuz, yaxşı tənzimlənmiş." },
{ q: "LOLBin 'regsvr32' hansı hücumda sui-istifadə olunur?", o: ["Uzaq scriptlet icrası (Squiblydoo)", "Disk şifrələmə", "Email", "DNS"], a: 0, e: "scrobj.dll ilə." },
{ q: "Event ID 4720 nəyə işarədir?", o: ["Yeni istifadəçi hesabı yaradıldı", "Login uğursuz", "Servis quraşdırıldı", "Log silindi"], a: 0, e: "Persistence (T1136)." },
{ q: "Windows-da 'Scheduled Task' yaratmaq üçün CLI əmri hansıdır?", o: ["schtasks", "crontab", "systemctl", "taskkill"], a: 0, e: "crontab/systemctl Linux-dur." },
{ q: "Credential Guard nə qoruyur?", o: ["LSASS credential-larını izolyasiya edir", "Diski şifrələyir", "Trafik filtrləyir", "DNS həll edir"], a: 0, e: "Pass-the-Hash-i çətinləşdirir." },
{ q: "AMSI (Antimalware Scan Interface) nə edir?", o: ["Skript/yaddaş məzmununu AV-yə yoxlatdırır (deobfuscated)", "Firewall qurur", "Backup alır", "Email filtrləyir"], a: 0, e: "PowerShell/script malware aşkarlanması." },
{ q: "Event ID 1102 görəndə ilk fikir nə olmalıdır?", o: ["Hücumçu izləri silir — araşdır", "Normal yeniləmə", "Disk dolub", "Printer işi"], a: 0, e: "Security log təmizlənib (T1070.001)." }
]);

// ---- l1-linux ----
addQ("l1-linux", [
{ q: "Hansı əmr aktiv şəbəkə bağlantılarını və dinləyən portları prosesləri ilə göstərir?", o: ["ss -tulpn", "ls -la", "cat /etc/hosts", "df -h"], a: 0, e: "netstat-ın müasir əvəzi." },
{ q: "Linux-da 'setuid root' binary niyə təhlükəlidir?", o: ["İstismar edilsə root imtiyazı verir", "Çox yer tutur", "Yavaşdır", "Normaldır həmişə"], a: 0, e: "Privesc vektoru." },
{ q: "crontab-da '* * * * *' nə deməkdir?", o: ["Hər dəqiqə", "Hər saat", "Gündə bir dəfə", "Həftədə bir"], a: 0, e: "Dəqiqə saat gün ay həftə-günü." },
{ q: "Hansı fayl systemd servislərinin yeri deyil?", o: ["/etc/passwd", "/etc/systemd/system/", "/lib/systemd/system/", "~/.config/systemd/user/"], a: 0, e: "passwd istifadəçi faylıdır." },
{ q: "'chmod +x script.sh' nə edir?", o: ["Faylı icra olunabilən edir", "Faylı silir", "Şifrələyir", "Sahibini dəyişir"], a: 0, e: "x = execute biti." },
{ q: "Hansı əmr istifadəçinin sudo hüquqlarını göstərir?", o: ["sudo -l", "whoami", "id -a", "last"], a: 0, e: "İcazəli sudo əmrləri." },
{ q: "/dev/shm nədir və niyə izlənməlidir?", o: ["Yaddaşda fayl sistemi — malware gizlənə bilər", "Disk bölməsi", "Log faylı", "DNS keş"], a: 0, e: "Hər kəs yaza bilir, volatile." },
{ q: "'journalctl -u sshd' nə göstərir?", o: ["SSH servisinin systemd loglarını", "Bütün faylları", "Şəbəkə portlarını", "Parolları"], a: 0, e: "Servis-spesifik loglar." },
{ q: "Hansı fayl hücumçunun əmr tarixçəsini göstərə bilər?", o: ["~/.bash_history", "/etc/hostname", "/proc/cpuinfo", "/etc/resolv.conf"], a: 0, e: "Boş olması da şübhədir." },
{ q: "'netcat (nc) -e /bin/sh' nə yaradır?", o: ["Reverse/bind shell", "Web server", "DNS sorğusu", "Backup"], a: 0, e: "Uzaq shell." },
{ q: "Linux-da UID 0 kimdir?", o: ["root (super istifadəçi)", "ilk adi istifadəçi", "qonaq", "servis"], a: 0, e: "0 = tam hüquq." },
{ q: "'find / -mtime -1' nə tapır?", o: ["Son 1 gündə dəyişdirilmiş faylları", "Böyük faylları", "SUID faylları", "Gizli faylları"], a: 0, e: "Yaxınlarda dəyişənlər — kompromis izi." },
{ q: "Hansı əmr uğursuz giriş cəhdlərini (btmp) göstərir?", o: ["lastb", "last", "w", "who"], a: 0, e: "btmp = uğursuz, wtmp = uğurlu." },
{ q: "auditd nə üçün istifadə olunur?", o: ["Linux-da detallı əmr/fayl/proses audit loglaması", "Disk şifrələmə", "Firewall", "DNS"], a: 0, e: "Forensik görünürlük." },
{ q: "'grep -r password /etc/' nəyə kömək edə bilər?", o: ["Konfiqurasiyalarda açıq parol axtarmaq", "Parol dəyişmək", "İstifadəçi silmək", "Şəbəkə qurmaq"], a: 0, e: "Credential hunting." }
]);

// ---- l1-net1 ----
addQ("l1-net1", [
{ q: "192.168.1.200/28 şəbəkəsinin broadcast ünvanı nədir?", o: ["192.168.1.207", "192.168.1.192", "192.168.1.255", "192.168.1.208"], a: 0, e: "/28 blok 16: 192–207 bloku, broadcast .207." },
{ q: "/30 şəbəkədə neçə istifadə edilə bilən host var?", o: ["2", "4", "6", "1"], a: 0, e: "2^2−2=2 (point-to-point linklər üçün)." },
{ q: "MAC ünvanı neçə bitdir?", o: ["48", "32", "64", "128"], a: 0, e: "6 oktet × 8 = 48 bit." },
{ q: "OSI-də frame hansı qatın PDU-sudur?", o: ["Data Link (2)", "Network (3)", "Transport (4)", "Physical (1)"], a: 0, e: "L2 = frame, L3 = packet, L4 = segment." },
{ q: "Switch MAC cədvəlini doldurub bütün portlara flood etməyə məcbur edən hücum?", o: ["MAC flooding (CAM table overflow)", "ARP spoofing", "SYN flood", "DNS tunneling"], a: 0, e: "Switch hub kimi davranır → sniffing." },
{ q: "VLAN hopping hücumu nəyə imkan verir?", o: ["Bir VLAN-dan digərinə icazəsiz keçid", "Parol qırmaq", "DNS dəyişmək", "Disk silmək"], a: 0, e: "Seqmentasiyanı aşmaq." },
{ q: "169.254.x.x ünvanı nə vaxt təyin olunur?", o: ["DHCP serveri cavab vermədikdə (APIPA)", "Normal internetdə", "Loopback üçün", "Multicast üçün"], a: 0, e: "Link-local avtomatik." },
{ q: "Default gateway nə üçündür?", o: ["Yerli şəbəkədən kənara trafiki yönləndirmək", "DNS həll etmək", "IP paylamaq", "Şifrələmək"], a: 0, e: "Router çıxış nöqtəsi." },
{ q: "CIDR /23 neçə istifadə edilə bilən host verir?", o: ["510", "512", "254", "1022"], a: 0, e: "2^9−2=510." },
{ q: "ARP hansı OSI qatları arasında işləyir?", o: ["L2 və L3 (IP↔MAC)", "L3 və L4", "L4 və L7", "L1 və L2"], a: 0, e: "IP ünvanını MAC-a bağlayır." },
{ q: "192.168.5.33/27 hostunun şəbəkə ünvanı nədir?", o: ["192.168.5.32", "192.168.5.0", "192.168.5.33", "192.168.5.64"], a: 0, e: "/27 blok 32: 32–63 bloku, network .32." },
{ q: "Loopback ünvanı hansıdır?", o: ["127.0.0.1", "192.168.0.1", "0.0.0.0", "255.255.255.255"], a: 0, e: "Öz-özünə — localhost." },
{ q: "Gratuitous ARP sui-istifadəsi nəyə işarə edə bilər?", o: ["ARP spoofing / MITM", "Normal DHCP", "DNS sorğusu", "Port skan"], a: 0, e: "Tələb olunmamış ARP cavabı." },
{ q: "Trunk port nə daşıyır?", o: ["Birdən çox VLAN trafikini (802.1Q tag ilə)", "Yalnız bir VLAN", "Yalnız DNS", "Yalnız broadcast"], a: 0, e: "Switch-lər arası." },
{ q: "Full-duplex nə deməkdir?", o: ["Eyni anda həm göndərmə, həm qəbul", "Yalnız göndərmə", "Növbə ilə", "Broadcast yalnız"], a: 0, e: "İki istiqamətli eyni vaxtda." }
]);

// ---- l1-net2 ----
addLesson("l1-net2", { title: "VPN, proxy və şəbəkə perimetri (dərin)", html: R`
<h3>VPN növləri</h3>
<table><tr><th>Növ</th><th>İzah</th></tr>
<tr><td><b>Site-to-Site</b></td><td>İki şəbəkəni (ofislər) birləşdirir (IPsec)</td></tr>
<tr><td><b>Remote Access</b></td><td>İşçi uzaqdan korporativ şəbəkəyə qoşulur</td></tr>
<tr><td><b>SSL/TLS VPN</b></td><td>Brauzer əsaslı (məs. portal)</td></tr></table>
<p>Protokollar: <b>IPsec</b> (IKE, ESP), <b>WireGuard</b> (müasir, sürətli), <b>OpenVPN</b>, köhnə: PPTP/L2TP. VPN girişləri mütləq MFA ilə qorunmalıdır — oğurlanmış VPN credential tipik ilkin giriş vektorudur.</p>
<h3>Proxy növləri</h3>
<ul><li><b>Forward proxy</b> — daxili istifadəçiləri internetə çıxarır (URL filtr, log)</li>
<li><b>Reverse proxy</b> — xarici istifadəçiləri daxili serverə yönləndirir (yük balansı, WAF)</li>
<li><b>Transparent proxy</b> — istifadəçi bilmədən</li></ul>
<h3>Perimetr və DMZ</h3>
<p><b>DMZ</b> (Demilitarized Zone) — internetə baxan serverlər (veb, mail) üçün izolyasiya olunmuş aralıq zona. Kompromis olunsa, daxili şəbəkəyə birbaşa keçid olmur.</p>
<h3>Şifrəli trafik və görünürlük</h3>
<p>Trafikin əksəriyyəti TLS-dir. SOC görünürlük üçün: <b>TLS inspection</b> (proxy açıb yenidən şifrələyir — məxfilik/hüquqi məsələlər), <b>SNI/JA3 metadata</b>, <b>sertifikat analizi</b>, DNS logları.</p>`});
addQ("l1-net2", [
{ q: "WireGuard nədir?", o: ["Müasir, sürətli VPN protokolu", "Firewall markası", "DNS serveri", "Antivirus"], a: 0, e: "IPsec/OpenVPN alternativi." },
{ q: "DMZ nə üçündür?", o: ["İnternetə baxan serverləri izolyasiya etmək", "Parol saxlamaq", "VPN qurmaq", "DNS həll"], a: 0, e: "Perimetr seqmentasiyası." },
{ q: "Reverse proxy nə edir?", o: ["Xarici istifadəçiləri daxili serverə yönləndirir", "Daxili istifadəçiləri internetə çıxarır", "Faylları şifrələyir", "Log silir"], a: 0, e: "Yük balansı, WAF." },
{ q: "POP3 və IMAP fərqi nədir?", o: ["IMAP serverdə saxlayıb sinxronlaşdırır, POP3 adətən endirib silir", "Eynidir", "POP3 şifrəlidir yalnız", "IMAP göndərir"], a: 0, e: "IMAP çox cihaz üçün." },
{ q: "HTTP 301 və 302 fərqi nədir?", o: ["301 daimi, 302 müvəqqəti yönləndirmə", "Eynidir", "301 xətadır", "302 uğurdur"], a: 0, e: "Redirect növləri." },
{ q: "SMTP hansı portda şifrəli submission istifadə edir?", o: ["587 (STARTTLS) / 465 (SMTPS)", "25 yalnız", "110", "143"], a: 0, e: "25 server-server, 587 submission." },
{ q: "X-Forwarded-For başlığı nəyi göstərir?", o: ["Proxy arxasındakı real müştəri IP-sini", "Server versiyasını", "Şifrələmə növünü", "DNS serverini"], a: 0, e: "Proxy təhqiqatında vacib." },
{ q: "HSTS nə edir?", o: ["Brauzeri yalnız HTTPS istifadəyə məcbur edir", "Faylı şifrələyir", "DNS həll edir", "Parol yaradır"], a: 0, e: "SSL stripping-ə qarşı." },
{ q: "DNS üzərində TXT qeydi phishing təhlilində niyə vacibdir?", o: ["SPF/DKIM qeydləri TXT-də saxlanır", "IP verir", "Mail serveri göstərir", "Port açır"], a: 0, e: "Email autentifikasiyası." },
{ q: "'User-Agent: python-requests' nəyə işarə edə bilər?", o: ["Avtomatlaşdırılmış skript/bot", "Normal brauzer", "Mobil cihaz", "Email klienti"], a: 0, e: "Skanlama/scraping əlaməti." },
{ q: "Transparent proxy nədir?", o: ["İstifadəçinin konfiqurasiya etmədən keçdiyi proxy", "Şifrəli VPN", "DNS serveri", "Firewall"], a: 0, e: "İstifadəçi bilmir." },
{ q: "Çoxlu HTTP 500 xətaları nəyə işarə edə bilər?", o: ["İnjeksiya cəhdi serveri pozur / server problemi", "Uğurlu login", "Normal trafik", "DNS keş"], a: 0, e: "Server-side error." },
{ q: "Email başlığında 'Received' sətirləri necə oxunur?", o: ["Aşağıdan yuxarı (ilk göndərən altda)", "Yuxarıdan aşağı", "Təsadüfi", "Yalnız birincisi vacibdir"], a: 0, e: "Ən alt = mənbə." },
{ q: "SSL stripping hücumu nə edir?", o: ["HTTPS-i HTTP-yə endirib trafik oxuyur", "Sertifikat oğurlayır", "DNS dəyişir", "Parol qırır"], a: 0, e: "MITM; HSTS qoruyur." }
]);

// ---- l1-threats ----
addQ("l1-threats", [
{ q: "Keylogger nə edir?", o: ["Klaviatura girişlərini qeyd edir", "Faylları şifrələyir", "Şəbəkə skan edir", "DNS dəyişir"], a: 0, e: "Credential oğurluğu." },
{ q: "Wiper malware ransomware-dən nə ilə fərqlənir?", o: ["Məlumatı bərpa niyyəti olmadan məhv edir", "Fidyə istəyir", "Şifrələyir və açar verir", "Reklam göstərir"], a: 0, e: "NotPetya nümunədir." },
{ q: "Watering hole hücumu nədir?", o: ["Hədəfin ziyarət etdiyi sayta malware yerləşdirmək", "Telefon fırıldaqçılığı", "USB atmaq", "Email spam"], a: 0, e: "Dolayı hədəfləmə." },
{ q: "Drive-by download nədir?", o: ["Sayta girməklə avtomatik (istifadəçi fəaliyyətsiz) yoluxma", "Faylı əl ilə endirmək", "USB-dən köçürmək", "Email əlavəsi"], a: 0, e: "Brauzer/plugin exploit." },
{ q: "Botnet nə üçün istifadə olunur?", o: ["DDoS, spam, crypto mining (kütləvi ələ keçirilmiş cihazlar)", "Disk şifrələmə", "DNS həll", "Backup"], a: 0, e: "C2 ilə idarə olunan şəbəkə." },
{ q: "Supply chain hücumu nədir?", o: ["Etibarlı təchizatçı/proqram vasitəsilə hədəfə çatmaq", "Birbaşa brute force", "Fiziki oğurluq", "DNS flood"], a: 0, e: "SolarWinds nümunədir." },
{ q: "Rootkit niyə təhlükəlidir?", o: ["Özünü və fəaliyyəti kernel səviyyəsində gizlədir", "Çox yer tutur", "Yavaşdır", "Reklam göstərir"], a: 0, e: "Aşkarlanması çətin." },
{ q: "Fileless malware harada yaşayır?", o: ["Yaddaş və legitim skriptlər/LOLBins", "Diskdə .exe kimi", "USB-də", "Printer-də"], a: 0, e: "Diskə yazılmır." },
{ q: "Smishing nədir?", o: ["SMS ilə phishing", "Telefon zəngi ilə", "Email ilə", "USB ilə"], a: 0, e: "SMS + phishing." },
{ q: "SSRF hücumu nəyə məcbur edir?", o: ["Serveri daxili/metadata resurslara sorğu göndərməyə", "İstifadəçini login etməyə", "Diski silməyə", "DNS dəyişməyə"], a: 0, e: "169.254.169.254 cloud metadata." },
{ q: "CSRF hücumu nədən istifadə edir?", o: ["İstifadəçinin autentifikasiya sessiyasından saxta sorğu üçün", "SQL sorğusundan", "DNS keşindən", "ARP cədvəlindən"], a: 0, e: "Cross-Site Request Forgery." },
{ q: "Insecure deserialization riski nədir?", o: ["Zərərli obyekt məlumatı kod icrasına səbəb ola bilər", "Yavaş şəbəkə", "Disk dolması", "DNS səhvi"], a: 0, e: "OWASP riski." },
{ q: "Cryptojacking (cryptominer) əlaməti nədir?", o: ["Davamlı yüksək CPU istifadəsi", "Disk şifrələnməsi", "Faylların silinməsi", "DNS səhvləri"], a: 0, e: "Resurs oğurluğu." },
{ q: "Living-off-the-Land (LOTL) nə deməkdir?", o: ["Sistemin öz legitim alətləri ilə hücum (LOLBins)", "Yeni malware yükləmək", "Fiziki giriş", "Sosial mühəndislik"], a: 0, e: "Aşkarlanmamaq üçün." },
{ q: "MITRE ATT&CK-də 'Exfiltration' nədir?", o: ["Oğurlanmış məlumatın çıxarılması", "İlkin giriş", "Persistence", "Kəşfiyyat"], a: 0, e: "Data çıxışı taktikası." },
{ q: "Typosquatting nədir?", o: ["Oxşar/səhv yazılmış domenlə aldatma (micros0ft.com)", "Parol qırmaq", "DNS flood", "Port skan"], a: 0, e: "Phishing/malware yayımı." }
]);

// ---- l1-crypto ----
addQ("l1-crypto", [
{ q: "Diffie-Hellman nə üçündür?", o: ["Təhlükəsiz açar mübadiləsi", "Fayl silmək", "Hash hesablamaq", "Parol saxlamaq"], a: 0, e: "Açarı açıq kanalda razılaşdırmaq." },
{ q: "Perfect Forward Secrecy (PFS) nə təmin edir?", o: ["Bir sessiya açarı sızsa, keçmiş sessiyalar qorunur", "Daha sürətli şifrələmə", "Parolsuz giriş", "Backup"], a: 0, e: "Hər sessiyaya unikal açar." },
{ q: "Nonce nədir?", o: ["Bir dəfə istifadə olunan təsadüfi/sayğac dəyəri", "Şifrələmə açarı", "Hash növü", "Sertifikat"], a: 0, e: "Replay hücumlarının qarşısını alır." },
{ q: "Rainbow table hücumuna qarşı ən yaxşı müdafiə nədir?", o: ["Unikal salt + yavaş hash (bcrypt/Argon2)", "MD5 istifadə etmək", "Qısa parol", "Base64"], a: 0, e: "Əvvəlcədən hesablanmış cədvəlləri faydasız edir." },
{ q: "AES blok ölçüsü neçə bitdir?", o: ["128", "256", "64", "512"], a: 0, e: "Açar 128/192/256, blok həmişə 128." },
{ q: "Hansı rejim (mode) eyni blokları eyni cür şifrələyir və təhlükəsiz deyil?", o: ["ECB", "GCM", "CBC", "CTR"], a: 0, e: "ECB nümunə sızdırır." },
{ q: "GCM rejimi nə əlavə edir?", o: ["Autentifikasiya (bütövlük yoxlaması)", "Daha yavaş şifrələmə", "Sıxışdırma", "Backup"], a: 0, e: "AEAD — şifrələmə + autentifikasiya." },
{ q: "Rəqəmsal sertifikatda 'Subject' nəyi göstərir?", o: ["Sertifikatın kimə verildiyini", "Kim imzaladığını", "Açar uzunluğunu", "Portu"], a: 0, e: "Issuer isə imzalayandır." },
{ q: "Hansı disk şifrələmə macOS üçündür?", o: ["FileVault", "BitLocker", "LUKS", "EFS"], a: 0, e: "BitLocker=Windows, LUKS=Linux." },
{ q: "ECC-nin RSA üzərində üstünlüyü nədir?", o: ["Qısa açarla eyni təhlükəsizlik", "Daha zəifdir", "Açar lazım deyil", "Hash-dir"], a: 0, e: "Elliptik əyri — effektiv." },
{ q: "Hash kolliziyası nədir?", o: ["İki fərqli girişin eyni hash verməsi", "Hash-in uzun olması", "Şifrə açarı", "Fayl silinməsi"], a: 0, e: "MD5/SHA1 zəifdir." },
{ q: "PBKDF2/Argon2 niyə parol saxlama üçün yaxşıdır?", o: ["Qəsdən yavaşdır — brute force-u çətinləşdirir", "Çox sürətlidir", "Açarsızdır", "Sıxışdırır"], a: 0, e: "Key derivation function." },
{ q: "TLS 1.3 əvvəlki versiyalardan nə ilə yaxşıdır?", o: ["Daha sürətli handshake, zəif şifrələri atıb", "Daha yavaş", "Şifrəsiz", "Yalnız RSA"], a: 0, e: "Təhlükəsizlik və performans." },
{ q: "Self-signed sertifikat nə vaxt şübhəlidir?", o: ["Publik xidmət/C2-də görünəndə", "Daxili test labında", "Heç vaxt", "Yalnız HTTP-də"], a: 0, e: "Daxili test üçün normaldır." }
]);

// ---- l1-logging ----
addQ("l1-logging", [
{ q: "Log normalizasiyası nə edir?", o: ["Müxtəlif formatları standart sahələrə gətirir", "Logları silir", "Şifrələyir", "Sıxışdırır"], a: 0, e: "src_ip, user, event kimi." },
{ q: "Elastic-in sahə sxemi necə adlanır?", o: ["ECS (Elastic Common Schema)", "CIM", "AQL", "SPL"], a: 0, e: "Splunk-da CIM." },
{ q: "Log retention (saxlama) niyə vacibdir?", o: ["Compliance və sonrakı təhqiqat üçün", "Sürət üçün", "Reklam üçün", "Lazım deyil"], a: 0, e: "Hadisələr aylar sonra aşkarlana bilər." },
{ q: "Parsing nədir?", o: ["Xam logu strukturlu sahələrə ayırmaq", "Alert yaratmaq", "Logu silmək", "Backup"], a: 0, e: "SIEM pipeline addımı." },
{ q: "Log mənbələrində 'single source of time' niyə kritikdir?", o: ["Korrelyasiya üçün bütün saatlar sinxron olmalıdır (NTP)", "Disk yeri", "Sürət", "Reklam"], a: 0, e: "Fərqli vaxtlar timeline-ı pozar." },
{ q: "Winlogbeat nə edir?", o: ["Windows Event loglarını Elastic-ə göndərir", "Firewall qurur", "Disk şifrələyir", "DNS həll"], a: 0, e: "Log shipper." },
{ q: "Hansı log mənbəsi 'istifadəçi hansı sayta getdi' sualına cavab verir?", o: ["Proxy / Web gateway", "DHCP", "NTP", "DNS yalnız"], a: 0, e: "URL görünürlüyü." },
{ q: "CloudTrail hansı buludun log mənbəsidir?", o: ["AWS", "Azure", "GCP", "On-prem"], a: 0, e: "API çağırış logları." },
{ q: "Log aggregation nədir?", o: ["Çox mənbədən logları bir mərkəzə toplamaq", "Logu şifrələmək", "Alert yaratmaq", "Silmək"], a: 0, e: "Mərkəzi görünürlük." },
{ q: "Sysmon Event 11 nəyi qeyd edir?", o: ["FileCreate (fayl yaradılması)", "Process creation", "Network", "DNS"], a: 0, e: "Fayl izləmə." },
{ q: "EPS (Events Per Second) nəyi ölçür?", o: ["SIEM-ə daxil olan log həcmi", "CPU sürəti", "Disk ölçüsü", "Alert sayı"], a: 0, e: "Lisenziya/ölçüləndirmə metrikası." },
{ q: "'Log source coverage' niyə vacibdir?", o: ["Loglanmayan sistem kor nöqtədir — hücum görünməz", "Disk yeri", "Sürət", "Reklam"], a: 0, e: "Görünürlük boşluğu." },
{ q: "KQL-də son 24 saatı filtrləmək üçün?", o: ["where Timestamp > ago(24h)", "earliest=-24h", "last 24", "time 24"], a: 0, e: "SPL-də earliest=-24h." },
{ q: "Enrichment-də GeoIP nə əlavə edir?", o: ["IP-nin coğrafi yerləşməsini", "Parolu", "Hash-i", "Portu"], a: 0, e: "Impossible travel üçün faydalı." }
]);

// ---- l1-triage ----
addQ("l1-triage", [
{ q: "Alert triage-da 'enrichment' addımı nədir?", o: ["IOC-lara kontekst/reputasiya əlavə etmək (VT, TI)", "Alerti silmək", "Serveri söndürmək", "Parol dəyişmək"], a: 0, e: "Qərarı asanlaşdırır." },
{ q: "Hansı alət IP-nin kütləvi internet skaneri olduğunu göstərir?", o: ["GreyNoise", "CyberChef", "Hashcat", "Burp"], a: 0, e: "Hədəflənmiş vs fon səsi." },
{ q: "Defanging niyə edilir?", o: ["IOC-ların təsadüfən kliklənməməsi üçün", "Şifrələmək", "Sürət", "Backup"], a: 0, e: "hxxp://evil[.]com." },
{ q: "WHOIS məlumatı təhqiqatda nəyə kömək edir?", o: ["Domenin yaşı/qeydiyyatçısı (yeni domen = şübhə)", "Parol", "Port", "Hash"], a: 0, e: "Yeni domenlər phishing/C2." },
{ q: "Ticket yazarkən ən vacib prinsip nədir?", o: ["Fakt və rəyi ayırıb sənədləşdirmək", "Qısa olsun deyə təfərrüatı buraxmaq", "Yalnız başlıq", "Jarqon"], a: 0, e: "Təkrarlanabilir təhqiqat." },
{ q: "urlscan.io nə edir?", o: ["URL-i təhlükəsiz 'ziyarət' edib skrinшот/resurs göstərir", "Fayl şifrələyir", "Parol qırır", "DNS flood"], a: 0, e: "Real brauzerdə açmadan." },
{ q: "Pyramid of Pain-də ən davamlı detection hansıdır?", o: ["TTP (davranış)", "Hash", "IP", "Domen"], a: 0, e: "Davranışı dəyişmək bahadır." },
{ q: "Alert prioritetləşdirməsində nə nəzərə alınır?", o: ["Severity × etibarlılıq × aktivin kritikliyi", "Alert rəngi", "Analitikin əhvalı", "Alert uzunluğu"], a: 0, e: "Risk-əsaslı." },
{ q: "Benign True Positive nümunəsi hansıdır?", o: ["İcazəli pentest komandasının fəaliyyəti", "Uğurlu ransomware", "Buraxılmış hücum", "Yanlış alert"], a: 0, e: "Real amma səlahiyyətli." },
{ q: "VirusTotal-da faylı deyil, hash-i axtarmaq niyə vacibdir?", o: ["Həssas faylın başqalarına əlçatan olmaması üçün", "Daha sürətlidir yalnız", "Pulsuzdur", "Fərq yoxdur"], a: 0, e: "Məxfilik/OPSEC." },
{ q: "AbuseIPDB nə verir?", o: ["IP reputasiyası və şikayət tarixçəsi", "Fayl hash", "DNS qeydi", "Port siyahısı"], a: 0, e: "IP enrichment." },
{ q: "OPSEC baxımından C2 domenini aktiv ziyarət etmək niyə riskli ola bilər?", o: ["Hücumçuya 'aşkarlandım' siqnalı verə bilər", "Çox yavaşdır", "Pulludur", "Heç bir risk yoxdur"], a: 0, e: "Passiv mənbələri üstün tut." },
{ q: "Timeline qurmaq nə üçündür?", o: ["Hadisələrin ardıcıllığını və əlaqəsini görmək", "Disk yeri", "Sürət", "Reklam"], a: 0, e: "Korrelyasiya." }
]);

// ---- l1-ir-endpoint ----
addQ("l1-ir-endpoint", [
{ q: "NIST IR dövründə 'Lessons Learned' hansı fazadır?", o: ["Post-Incident Activity", "Preparation", "Containment", "Detection"], a: 0, e: "Təkmilləşdirmə." },
{ q: "Short-term və long-term containment fərqi nədir?", o: ["Qısa: dərhal izolyasiya; uzun: davamlı həll quraşdırma", "Eynidir", "Qısa daha yaxşıdır həmişə", "Uzun həmişə lazımsızdır"], a: 0, e: "Mərhələli məhdudlaşdırma." },
{ q: "EDR-in host izolyasiyası nə edir?", o: ["Host-u şəbəkədən ayırır, amma EDR nəzarətini saxlayır", "Host-u silir", "Diski şifrələyir", "Parol dəyişir"], a: 0, e: "Yayılmanı dayandırır." },
{ q: "Order of volatility-ə görə RAM nə vaxt toplanmalıdır?", o: ["Diskdən ƏVVƏL (tez itir)", "Diskdən sonra", "Heç vaxt", "Ən son"], a: 0, e: "Volatile dəlil." },
{ q: "Honeypot-un faydası nədir?", o: ["Hər toxunuş şübhəli olduğundan yüksək-fidelity alert verir", "Daha çox trafik", "Sürət", "Backup"], a: 0, e: "Hücumçu tələsi." },
{ q: "3-2-1 backup qaydasının '1'-i nəyi bildirir?", o: ["1 nüsxə offsite/offline", "1 server", "1 admin", "1 gün"], a: 0, e: "Ransomware-ə qarşı." },
{ q: "XDR EDR-dən nə ilə fərqlənir?", o: ["Şəbəkə, email, cloud, identity-ni də korrelyasiya edir", "Daha ucuzdur", "Yalnız imza", "Yalnız firewall"], a: 0, e: "Genişləndirilmiş." },
{ q: "WAF nəyi qoruyur?", o: ["Veb tətbiqləri L7 hücumlardan (SQLi, XSS)", "Diski", "Email-i", "DNS-i"], a: 0, e: "Web Application Firewall." },
{ q: "Suricata/Snort nə növ alətdir?", o: ["IDS/IPS (imza-əsaslı)", "Antivirus", "SIEM", "Backup"], a: 0, e: "Şəbəkə aşkarlama." },
{ q: "Security Onion nədir?", o: ["Pulsuz NSM/monitorinq paketi (Zeek, Suricata, Elastic)", "Antivirus", "Firewall markası", "Malware"], a: 0, e: "Hamısı bir ISO." },
{ q: "Patch management niyə kritikdir?", o: ["Yamaqlanmamış proqram ən çox istismar edilən vektordur", "Sürət üçün", "Disk yeri", "Reklam"], a: 0, e: "Zəiflikləri bağlayır." },
{ q: "Chain of custody niyə vacibdir?", o: ["Dəlilin hüquqi etibarı üçün", "Sürət", "Disk yeri", "Reklam"], a: 0, e: "Kim/nə vaxt/necə." },
{ q: "ASR (Attack Surface Reduction) qaydaları nə edir?", o: ["Ümumi hücum texnikalarını bloklayır (Defender)", "Logları silir", "DNS həll edir", "Parol yaradır"], a: 0, e: "Hücum səthini azaldır." },
{ q: "İnsident zamanı sistemi restart etmək niyə riskli ola bilər?", o: ["Volatile dəlili (RAM, işləyən malware) məhv edə bilər", "Sürəti artırır", "Faydalıdır həmişə", "Risk yoxdur"], a: 0, e: "Əvvəl yaddaş topla." }
]);

/* ============================ L2 ============================ */

// ---- l2-pcap ----
addQ("l2-pcap", [
{ q: "Wireshark-da yalnız DNS trafikini göstərən filtr?", o: ["dns", "port 53", "tcp.dns", "filter dns"], a: 0, e: "Display filtri. 'port 53' BPF-dir." },
{ q: "tcpdump-da fayla yazmaq üçün hansı flag?", o: ["-w", "-r", "-A", "-nn"], a: 0, e: "-r oxuyur, -w yazır." },
{ q: "'Follow TCP Stream' nə üçün faydalıdır?", o: ["Bütün bağlantını bir axın kimi (credential/komanda) görmək", "Filtr yaratmaq", "Fayl silmək", "Şifrələmək"], a: 0, e: "Açıq mətn məzmunu." },
{ q: "Zeek-in hansı logu bütün bağlantıları (müddət, byte) göstərir?", o: ["conn.log", "dns.log", "http.log", "ssl.log"], a: 0, e: "Connection metadata." },
{ q: "Beaconing-in əsas statistik əlaməti nədir?", o: ["Aşağı interval dispersiyası (müntəzəmlik)", "Böyük tək transfer", "Çoxlu 404", "RST paketlər"], a: 0, e: "Periodicity." },
{ q: "Şifrəli trafikdə C2-ni tanımağa kömək edən 'barmaq izi'?", o: ["JA3/JA3S", "MD5", "Base64", "TTL"], a: 0, e: "TLS handshake imzası." },
{ q: "Exfiltration-ın trafik imzası nədir?", o: ["Anormal böyük OUTBOUND (upload) həcm", "Çoxlu SYN", "Qısa bağlantı", "ICMP echo"], a: 0, e: "Download çox olur normalda." },
{ q: "Wireshark 'Export Objects → HTTP' nə verir?", o: ["Ötürülən faylları (endirilən malware) çıxarır", "Şifrələyir", "Filtr yaradır", "Logu silir"], a: 0, e: "Fayl bərpası." },
{ q: "Capture filtri ilə display filtri harada tətbiq olunur?", o: ["Capture tutma zamanı, display göstərmə zamanı", "Eynidir", "Hər ikisi tutmada", "Hər ikisi göstərmədə"], a: 0, e: "BPF vs Wireshark sintaksisi." },
{ q: "RITA aləti nə edir?", o: ["Zeek loglarında C2 beacon aşkarlanmasını avtomatlaşdırır", "Paket tutur", "Firewall qurur", "Email göndərir"], a: 0, e: "Beacon analizi." },
{ q: "TLS SNI sahəsi SOC üçün niyə faydalıdır?", o: ["Şifrəli trafikdə belə host adını göstərir", "Parolu açır", "IP verir", "Faylı çıxarır"], a: 0, e: "ESNI/ECH olmasa açıq görünür." },
{ q: "Statistics → Conversations nə göstərir?", o: ["Kim kiminlə nə qədər danışıb (top talkers)", "Paket məzmununu", "Şifrə açarını", "DNS keşini"], a: 0, e: "Həcm analizi." }
]);

// ---- l2-ad ----
addQ("l2-ad", [
{ q: "Golden Ticket hansı hesabın hash-i ilə yaradılır?", o: ["krbtgt", "Administrator", "Guest", "SYSTEM"], a: 0, e: "Saxta TGT imzalamaq." },
{ q: "AS-REP Roasting hansı hesabları hədəf alır?", o: ["Kerberos pre-auth söndürülmüş hesablar", "Bütün hesablar", "Yalnız admin", "Guest"], a: 0, e: "Pre-auth yoxsa offline qırılır." },
{ q: "BloodHound nə üçündür?", o: ["AD hücum yollarını qrafik xəritələmək", "Parol qırmaq", "Firewall", "Email"], a: 0, e: "Həm hücumçu həm müdafiəçi." },
{ q: "Pass-the-Ticket (PtT) nə istifadə edir?", o: ["Oğurlanmış Kerberos biletini", "NTLM hash-i", "Açıq parolu", "TLS sertifikatını"], a: 0, e: "PtH hash, PtT bilet." },
{ q: "LAPS nəyə kömək edir?", o: ["Lokal admin parollarını unikallaşdırıb lateral movement-i çətinləşdirir", "Kerberos söndürür", "Log silir", "DNS qoruyur"], a: 0, e: "Local Admin Password Solution." },
{ q: "Zerologon (CVE-2020-1472) nəyi hədəf alır?", o: ["Netlogon protokolu — DC ələ keçirilə bilər", "Veb server", "Email", "DNS"], a: 0, e: "Kritik AD zəifliyi." },
{ q: "Event 4769-da RC4 (0x17) tələbi nəyə işarə edə bilər?", o: ["Kerberoasting", "Normal login", "Logoff", "Patch"], a: 0, e: "Zəif şifrə — offline qırmaq üçün." },
{ q: "Tiered admin model nə üçündür?", o: ["Yüksək imtiyazlı hesabların istifadəsini izolyasiya etmək", "Çox admin yaratmaq", "Parol silmək", "Sürət"], a: 0, e: "Tier 0 = DC." },
{ q: "DCSync-i aşkarlayan Event ID anomaliyası hansıdır?", o: ["4662 (Replicating Directory Changes, qeyri-DC)", "4625", "7045", "4720"], a: 0, e: "Replikasiya hüququ." },
{ q: "gMSA nə üçündür?", o: ["İdarə olunan, güclü parollu servis hesabları", "DNS həll", "Backup", "Firewall"], a: 0, e: "Kerberoasting-ə qarşı." },
{ q: "krbtgt parolunu niyə İKİ dəfə rotasiya etmək lazımdır?", o: ["Həm cari həm əvvəlki açarı etibarsızlaşdırmaq üçün", "Sürət", "Disk yeri", "Reklam"], a: 0, e: "Golden Ticket-i söndürür." },
{ q: "WinRM lateral movement hansı prosesi yaradır?", o: ["wsmprovhost.exe", "WmiPrvSE.exe", "explorer.exe", "notepad.exe"], a: 0, e: "PowerShell Remoting." },
{ q: "Microsoft Defender for Identity nə edir?", o: ["AD hücumlarını (Kerberoast, DCSync və s.) aşkarlayır", "Disk şifrələyir", "Email filtrləyir", "Backup alır"], a: 0, e: "AD təhlükəsizlik monitorinqi." }
]);

// ---- l2-linuxweb ----
addQ("l2-linuxweb", [
{ q: "www-data istifadəçisinin /bin/sh başlatması nəyə işarədir?", o: ["Webshell / veb server kompromisi", "Normal iş", "Sistem yeniləməsi", "Backup"], a: 0, e: "Veb proses shell başlatmamalı." },
{ q: "access.log-da 'UNION SELECT' nəyə işarədir?", o: ["SQL injection cəhdi", "XSS", "Path traversal", "Normal sorğu"], a: 0, e: "DB-dən məlumat çıxarma." },
{ q: "Reverse shell-in bash variantında hansı yol görünür?", o: ["/dev/tcp/IP/PORT", "/etc/passwd", "/var/log", "/proc/cpuinfo"], a: 0, e: "Şəbəkə bağlantısı." },
{ q: "Veb forensikada ən vacib sual nədir?", o: ["Hansı hücum sorğuları 200 (uğurlu) oldu", "Neçə sorğu gəldi", "Server markası", "RAM ölçüsü"], a: 0, e: "Uğurlu hücumu ayırmaq." },
{ q: "Container escape nəyə imkan verir?", o: ["Container-dan host sisteminə çıxış", "Image endirmək", "Pod yaratmaq", "Log oxumaq"], a: 0, e: "Privileged/docker.sock/kernel." },
{ q: "169.254.169.254-ə cloud VM-dən sorğu nəyə işarədir?", o: ["SSRF ilə metadata credential oğurluğu", "Normal DNS", "Backup", "Patch"], a: 0, e: "Cloud metadata endpoint." },
{ q: "CloudTrail StopLogging niyə kritikdir?", o: ["Hücumçu audit loglarını söndürür (defense evasion)", "Normal", "Backup", "Performans"], a: 0, e: "İzləri gizlətmək." },
{ q: "Falco nə üçündür?", o: ["Container/Kubernetes runtime təhlükəsizlik monitorinqi", "Image qurmaq", "DNS", "Backup"], a: 0, e: "Container üçün Sysmon kimi." },
{ q: "GitHub-a sızmış AWS access key niyə təhlükəlidir?", o: ["Botlar dəqiqələr içində tapıb resurs sui-istifadə edir", "Risk yoxdur", "Yalnız yavaşlama", "Disk dolması"], a: 0, e: "Crypto mining, data oğurluğu." },
{ q: "Webshell faylını fayl sistemində necə axtarırsan?", o: ["Veb kök qovluqda yeni/dəyişmiş .php/.aspx/.jsp", "/etc/passwd-da", "RAM-da yalnız", "DNS-də"], a: 0, e: "mtime + YARA." },
{ q: "auditd logları harada saxlanır?", o: ["/var/log/audit/audit.log", "/etc/passwd", "/tmp", "/proc"], a: 0, e: "ausearch ilə sorğu." },
{ q: "Kubernetes-də 'kubectl exec' anomaliyası nəyə işarə edə bilər?", o: ["Pod-a icazəsiz interaktiv giriş (lateral movement)", "Normal deploy", "Backup", "DNS"], a: 0, e: "K8s audit logda izlənir." }
]);

// ---- l2-malware ----
addQ("l2-malware", [
{ q: "Statik analizdə 'strings' nə verir?", o: ["Fayldakı oxuna bilən mətnlər (URL, IP, API)", "Faylı işlədir", "Şifrələyir", "Silir"], a: 0, e: "İşə salmadan ipucu." },
{ q: "PEStudio əsasən nə üçündür?", o: ["PE fayl statik triage (imports, strings, imza)", "Dinamik icra", "Şəbəkə tutma", "Disk forensikası"], a: 0, e: "Statik analiz." },
{ q: "Yüksək entropiya + az strings nəyə işarədir?", o: ["Packed/şifrəli fayl", "Təmiz fayl", "Mətn faylı", "Şəkil"], a: 0, e: "UPX/Themida." },
{ q: "any.run nə növ alətdir?", o: ["İnteraktiv onlayn sandbox (dinamik analiz)", "Disassembler", "Firewall", "SIEM"], a: 0, e: "Davranış hesabatı." },
{ q: "olevba nə çıxarır?", o: ["Office sənədlərindən makroları", "PE importları", "RAM dump", "Şəbəkə paketi"], a: 0, e: "Makro-malware." },
{ q: "Mutex adı niyə dəyərlidir?", o: ["Host IOC kimi malware-i tanıdır", "Şifrə açarıdır", "Firewall qaydası", "DNS qeydi"], a: 0, e: "YARA/EDR ilə tutula bilər." },
{ q: "Sandbox malware-i niyə bəzən 'təmiz' göstərir?", o: ["Malware VM/sandbox aşkar edib işləmir (anti-analiz)", "Sandbox pisdir", "Həmişə təmizdir", "İnternet yoxdur"], a: 0, e: "Evasion." },
{ q: "STIX/TAXII nədir?", o: ["Struktur TI mübadilə formatı/protokolu", "Malware növü", "Sandbox", "Firewall"], a: 0, e: "IOC paylaşımı." },
{ q: "TLP:RED nə deməkdir?", o: ["Yalnız birbaşa alıcılarla paylaşıla bilər", "Hamıya açıq", "İnternetdə dərc", "Təşkilat daxili"], a: 0, e: "Ən məhdud." },
{ q: "FLARE-VM nədir?", o: ["Windows malware analiz alət paketi", "Linux distrosu", "Antivirus", "Firewall"], a: 0, e: "REMnux Linux üçün." },
{ q: "İmport 'VirtualAlloc + WriteProcessMemory + CreateRemoteThread' nəyə işarədir?", o: ["Process injection", "Fayl endirmə", "Şifrələmə", "Backup"], a: 0, e: "Kod yeritmə." },
{ q: "Config extractor nə edir?", o: ["Malware nümunəsindən C2/açarları avtomatik çıxarır", "Image qurur", "DNS həll", "Firewall"], a: 0, e: "RE biliyi ilə yazılır." }
]);

// ---- l2-ti ----
addQ("l2-ti", [
{ q: "Operational TI kimin üçündür?", o: ["IR/SOC menecmenti (konkret kampaniya)", "Yalnız firewall", "Son istifadəçi", "Mühasibat"], a: 0, e: "Strategic rəhbərlik, tactical analitik, technical alət." },
{ q: "IOA (Indicator of Attack) IOC-dan nə ilə fərqlənir?", o: ["Davranış/niyyəti göstərir, daha davamlı", "Daha qısaömürlü", "Yalnız hash", "Fərq yoxdur"], a: 0, e: "Proaktiv." },
{ q: "Diamond Model-in təpələri hansıdır?", o: ["Adversary, Capability, Infrastructure, Victim", "Who, What, When, Where", "IP, Hash, Domain, URL", "Detect, Respond, Recover, Report"], a: 0, e: "Hadisə təhlili." },
{ q: "abuse.ch hansı xidməti vermir?", o: ["Antivirus mühərriki", "ThreatFox", "MalwareBazaar", "URLhaus"], a: 0, e: "Pulsuz IOC/malware mənbələri." },
{ q: "Pivoting nədir?", o: ["Bir IOC-dan əlaqəli infrastruktur/nümunələri kəşf etmək", "Firewall qurmaq", "Log silmək", "Parol"], a: 0, e: "passive DNS, VT." },
{ q: "'False flag' nədir?", o: ["Aktorun qəsdən başqasına bənzəməsi (atribusiyanı çaşdırmaq)", "Yanlış alert", "Firewall qaydası", "Test faylı"], a: 0, e: "Atribusiya riski." },
{ q: "TI dövrünün ilk mərhələsi hansıdır?", o: ["Direction/Planning (requirements)", "Dissemination", "Collection", "Analysis"], a: 0, e: "Hansı suala cavab?" },
{ q: "MISP nədir?", o: ["Açıq threat intel paylaşım platforması", "Antivirus", "SIEM", "Firewall"], a: 0, e: "IOC icması." },
{ q: "APT-ni cybercrime-dən fərqləndirən əsas xüsusiyyət?", o: ["Səbirli, casusluq məqsədli, resurslu", "Daha sürətli", "Yalnız DDoS", "Həmişə görünür"], a: 0, e: "Fərqli motivasiya." },
{ q: "Admiralty/etibarlılıq dilinin məqsədi nədir?", o: ["Nəticənin nə qədər əmin olduğunu ifadə etmək", "Sürət", "Şifrələmə", "Backup"], a: 0, e: "Yüksək/orta/aşağı etibar." },
{ q: "Threat-informed defense nədir?", o: ["Müdafiəni real TTP-lərə görə qurmaq (ATT&CK)", "Bütün portları bağlamaq", "Yalnız antivirus", "Log silmək"], a: 0, e: "Navigator ilə coverage." },
{ q: "STIX nə saxlayır?", o: ["Strukturlaşdırılmış təhdid məlumatı (IOC, TTP, aktor)", "Şifrə açarı", "Disk образı", "Firewall qaydası"], a: 0, e: "TAXII ilə ötürülür." }
]);

// ---- l2-detection ----
addQ("l2-detection", [
{ q: "Sigma nədir?", o: ["SIEM-dən asılı olmayan YAML detection formatı", "Antivirus", "Protokol", "Şifrələmə"], a: 0, e: "'Detection üçün YARA'." },
{ q: "Behavioral detection atomic-dən niyə üstündür?", o: ["Daha davamlı, asanlıqla bypass edilmir", "Daha ucuz", "Daha sürətli", "Log lazım deyil"], a: 0, e: "Hash/IP dəyişir." },
{ q: "Atomic Red Team nə üçündür?", o: ["ATT&CK texnikalarını təhlükəsiz emulate edib detection test etmək", "Malware yaymaq", "DDoS", "Parol qırmaq"], a: 0, e: "Purple team." },
{ q: "Sigma 'condition: selection and not filter' nə edir?", o: ["Selection-u tutur, filter-i istisna (FP azaltma)", "Hər şeyi tutur", "Heç nə", "Log silir"], a: 0, e: "Allowlist məntiqi." },
{ q: "Detection-as-Code nə deməkdir?", o: ["Qaydaları Git + test + CI/CD ilə idarə etmək", "Malware yazmaq", "Manual qayda", "Log silmək"], a: 0, e: "Versiya nəzarəti." },
{ q: "Çox dar detection qaydasının riski nədir?", o: ["False Negative (təhlükəni buraxmaq)", "Çox alert", "Yavaşlıq", "Risk yoxdur"], a: 0, e: "Kiçik dəyişiklik keçər." },
{ q: "FP tuning-də ilk addım nədir?", o: ["FP-lərin ortaq xüsusiyyətini tapmaq", "Qaydanı silmək", "Hamısını whitelist", "Logu söndürmək"], a: 0, e: "Nümunəni anla." },
{ q: "pySigma/sigconverter nə edir?", o: ["Sigma qaydasını SIEM dilinə (SPL/KQL) çevirir", "Malware işlədir", "DNS həll", "Backup"], a: 0, e: "Universal qayda." },
{ q: "Ransomware davranış detection ideyası hansıdır?", o: ["Kütləvi fayl dəyişikliyi + shadow copy silmə", "Tək login", "DNS sorğusu", "Ping"], a: 0, e: "vssadmin delete shadows." },
{ q: "MITRE ATT&CK Navigator detection-da nə üçündür?", o: ["Coverage-ı xəritələyib boşluqları görmək", "Malware işlətmək", "Parol", "Email"], a: 0, e: "Threat-informed." },
{ q: "Whitelist-in riski nədir?", o: ["Hücumçu icazəli yolu/hesabı sui-istifadə edə bilər", "Yavaşlıq", "Risk yoxdur", "Çox log"], a: 0, e: "Ehtiyatlı." },
{ q: "SOAR-ın əsas faydası nədir?", o: ["Təkrarlanan işləri (enrichment, triage) avtomatlaşdırmaq", "Malware yaratmaq", "Şəbəkə qurmaq", "Şifrələmək"], a: 0, e: "Analitik vaxtını azad edir." }
]);

// ---- l2-ir-phishing ----
addQ("l2-ir-phishing", [
{ q: "Phishing insidentində 'scope' nə deməkdir?", o: ["Eyni məktubu başqa kimin aldığını/kliklədiyini tapmaq", "Məktubu silmək", "Serveri söndürmək", "Parol dəyişmək"], a: 0, e: "Əhatə dairəsi." },
{ q: "Phishing URL-ini necə analiz etməlisən?", o: ["urlscan.io/sandbox-da (real brauzerdə açmadan)", "İş kompüterində açaraq", "Klikləyərək", "Heç cür"], a: 0, e: "Təhlükəsiz." },
{ q: "Compromised account playbook-unun əsas addımı hansıdır?", o: ["Parol sıfırla + sessiyaları ləğv et", "Serveri formatla", "Log sil", "Heç nə"], a: 0, e: "Girişi dayandır." },
{ q: "Ransomware insidentində İLK addım nədir?", o: ["Təsirlənən sistemləri izolyasiya et", "Fidyə ödə", "Backup sil", "Gözlə"], a: 0, e: "Containment." },
{ q: "Out-of-band kommunikasiya niyə vacibdir?", o: ["Hücumçu kompromis kanalda ola bilər", "Daha sürətli", "Pulsuz", "Rahat"], a: 0, e: "Təhlükəsiz müzakirə." },
{ q: "GDPR-da data breach bildiriş müddəti nə qədərdir?", o: ["72 saat", "24 saat", "30 gün", "1 il"], a: 0, e: "Tənzimləyici tələb." },
{ q: "Blameless postmortem nə üçündür?", o: ["Günahlandırmadan öyrənmək", "Kimisə işdən çıxarmaq", "Log silmək", "Alert yaratmaq"], a: 0, e: "Öyrənmə mədəniyyəti." },
{ q: "Threat hunting nədir?", o: ["Proaktiv, fərziyyə-əsaslı təhdid axtarışı", "Alert gözləmək", "Firewall qurmaq", "Patch"], a: 0, e: "Alertdən əvvəl." },
{ q: "Phishing-də 'Authentication-Results: dmarc=fail' nəyə işarədir?", o: ["Göndərən domen ehtimal ki saxtalaşdırılıb", "Mail təhlükəsiz", "Server offline", "Normal daxili mail"], a: 0, e: "Spoofing." },
{ q: "Incident Commander kimdir?", o: ["İnsidenti idarə edib koordinasiya edən", "Malware analitiki", "Sistem admini", "İstifadəçi"], a: 0, e: "Qərar verən rol." },
{ q: "Phishing məktubunu 'purge' etmək nə deməkdir?", o: ["Bütün poçt qutularından karantin/silmə", "Oxumaq", "Cavablamaq", "Çap etmək"], a: 0, e: "Containment." },
{ q: "Python/PowerShell SOC-da niyə faydalıdır?", o: ["Avtomatlaşdırma, log parsing, API, data analizi", "Oyun üçün", "Dizayn üçün", "Faydasızdır"], a: 0, e: "Scripting." }
]);

/* ============================ L3 ============================ */

// ---- l3-hunting ----
addQ("l3-hunting", [
{ q: "Yaxşı hunting fərziyyəsinin xüsusiyyəti nədir?", o: ["Spesifik, test edilə bilən, ATT&CK-ə bağlı", "Ümumi və qeyri-müəyyən", "Yalnız hash", "Alert sayı"], a: 0, e: "'Bəlkə malware var' zəifdir." },
{ q: "Stacking (frequency analysis) nə tapır?", o: ["Nadir dəyərləri (long tail)", "Ən çox rast gəlinəni", "Logları silir", "Alert"], a: 0, e: "Nadir = maraqlı." },
{ q: "Hunting üçün ən vacib ilkin şərt nədir?", o: ["Data görünürlüyü (keyfiyyətli telemetriya)", "Çox firewall", "Antivirus", "Backup"], a: 0, e: "Görünürlük olmadan mümkün deyil." },
{ q: "'Heç nə tapmadım' hunting-də nə deməkdir?", o: ["Yenə dəyərli — detection/boşluq/baseline bilik", "Tam uğursuzluq", "Vaxt itkisi", "Alert yaradılmalı"], a: 0, e: "Nəticə faydalıdır." },
{ q: "C2 beacon hunting-də nəyə baxırsan?", o: ["Müntəzəm interval + az byte + uzun müddət + nadir təyinat", "Çoxlu DNS səhvi", "Tək login", "Patch"], a: 0, e: "Periodicity." },
{ q: "Velociraptor nə üçündür?", o: ["Fleet-wide endpoint hunting və forensika", "Şəbəkə skanı", "DDoS", "Email"], a: 0, e: "Çox hostda sorğu." },
{ q: "Hunting Maturity Model-də HM0 nədir?", o: ["Yalnız avtomatik alert (hunting yoxdur)", "Avtomatlaşdırılmış", "Yeni prosedur", "TI axtarışı"], a: 0, e: "Ən aşağı." },
{ q: "LOLBin hunting nümunəsi hansıdır?", o: ["certutil qeyri-adi arqumentlərlə (URL endirmə)", "Normal ping", "Login", "Patch"], a: 0, e: "T1218." },
{ q: "Uğurlu hunt-un ən yaxşı nəticələrindən biri hansıdır?", o: ["Yeni detection qaydası yaratmaq", "Log silmək", "Alert artırmaq", "Firewall söndürmək"], a: 0, e: "Boşluğu bağlayır." },
{ q: "Python/pandas hunting-də niyə faydalıdır?", o: ["Minlərlə hadisəni avtomatik analiz (delta, aqreqasiya)", "Email", "Firewall", "Şifrələmə"], a: 0, e: "Böyük data." },
{ q: "Masquerading hunting nəyə baxır?", o: ["System proses adları System32-dən kənar / imzasız", "Normal login", "DNS", "Patch"], a: 0, e: "T1036." },
{ q: "Baseline hunting nə tələb edir?", o: ["Normalın nə olduğunu bilmək", "Çox alert", "Malware", "Patch"], a: 0, e: "Normal → anomaliya." }
]);

// ---- l3-dfir ----
addQ("l3-dfir", [
{ q: "Order of volatility-yə görə ən əvvəl nə toplanır?", o: ["RAM/registrlər (ən tez itən)", "Disk", "Backup", "DVD"], a: 0, e: "Volatile əvvəl." },
{ q: "Write-blocker nə üçündür?", o: ["Orijinal diski dəyişmədən surət almaq", "Şifrələmək", "Silmək", "Sürət"], a: 0, e: "Dəlil bütövlüyü." },
{ q: "Volatility malfind nə tapır?", o: ["İnject olunmuş (RWX) yaddaş sahələri", "Portları", "Registry", "Logları"], a: 0, e: "Code injection." },
{ q: "Prefetch artefaktı nəyi sübut edir?", o: ["Proqramın icra olunduğunu (+ neçə dəfə, son vaxt)", "Login", "DNS", "Parol"], a: 0, e: "Execution artefaktı." },
{ q: "$MFT nədir?", o: ["NTFS-də bütün faylların qeydi + vaxtlar", "RAM dump", "Firewall log", "DNS keş"], a: 0, e: "Master File Table." },
{ q: "Super timeline (plaso) nə edir?", o: ["Bütün artefaktların vaxt damğalarını birləşdirir", "Şəbəkə diaqramı", "Alert siyahısı", "Parol"], a: 0, e: "Xronologiya." },
{ q: "KAPE nə üçündür?", o: ["Sürətli forensik artefakt toplama/parse (triage)", "Malware yazmaq", "DDoS", "Email"], a: 0, e: "Triage collection." },
{ q: "pslist və psscan fərqi nəyi üzə çıxarır?", o: ["Gizlədilmiş prosesləri", "Şəbəkə trafikini", "Disk ölçüsünü", "Parolları"], a: 0, e: "DKOM gizlətmə." },
{ q: "Eric Zimmerman-ın EvtxECmd nəyi parse edir?", o: ["Windows Event logları (.evtx)", "RAM", "Prefetch", "MFT"], a: 0, e: "PECmd=Prefetch, MFTECmd=MFT." },
{ q: "SRUM artefaktı nəyə kömək edir?", o: ["Proses şəbəkə/resurs istifadəsi (exfil həcmi)", "Login", "DNS", "Parol"], a: 0, e: "System Resource Usage Monitor." },
{ q: "Patient zero nədir (DFIR)?", o: ["İlk kompromis olunan sistem/giriş nöqtəsi", "Son host", "Backup serveri", "Firewall"], a: 0, e: "Root cause." },
{ q: "Timestomping-i necə aşkarlayırsan?", o: ["$SI və $FN vaxtlarının uyğunsuzluğu", "Disk ölçüsü", "RAM", "Port"], a: 0, e: "NTFS atribut fərqi." }
]);

// ---- l3-re ----
addQ("l3-re", [
{ q: "Ghidra nədir?", o: ["Pulsuz disassembler + decompiler (NSA)", "Antivirus", "Firewall", "SIEM"], a: 0, e: "RE başlanğıc aləti." },
{ q: "x64dbg nə üçündür?", o: ["Dinamik analiz / debugging", "Disk forensikası", "Şəbəkə skanı", "Email"], a: 0, e: "Addım-addım icra." },
{ q: ".NET malware üçün hansı alət 'demək olar ki mənbə kod' verir?", o: ["dnSpy / ILSpy", "Wireshark", "Volatility", "nmap"], a: 0, e: ".NET decompiler." },
{ q: "IAT (Import Address Table) nəyi göstərir?", o: ["İstifadə olunan API funksiyaları (niyyət)", "Şifrə açarı", "Hash", "DNS"], a: 0, e: "Davranış ipucu." },
{ q: "OEP (Original Entry Point) nədir?", o: ["Unpack-dən sonra əsl kodun başlanğıcı", "Son təlimat", "Port", "Registry"], a: 0, e: "Manual unpacking hədəfi." },
{ q: "API hashing nə üçündür?", o: ["API adlarını hash ilə çağırıb importları gizlətmək", "Şifrələmək", "Sürət", "Log"], a: 0, e: "Statik gizlətmə." },
{ q: "DGA reversing nə verir?", o: ["Gələcək C2 domenlərini əvvəlcədən hesablamaq/bloklamaq", "Fayl silmək", "RAM dump", "Parol"], a: 0, e: "Proaktiv müdafiə." },
{ q: "Malware RE-nin SOC məqsədi nədir?", o: ["Davamlı detection və IOC yaratmaq", "Malware yaymaq", "Maraq", "Log silmək"], a: 0, e: "Müdafiəyə çevirmək." },
{ q: "x86-da EIP/RIP registri nədir?", o: ["Növbəti təlimatın ünvanı (instruction pointer)", "Stack pointer", "Nəticə", "Sayğac"], a: 0, e: "İcra axını." },
{ q: "Anti-debugging texnikası hansıdır?", o: ["IsDebuggerPresent / PEB yoxlaması", "Fayl endirmə", "DNS", "Backup"], a: 0, e: "Təhlili çətinləşdirmək." },
{ q: "YARA-da uint16(0) == 0x5A4D nəyi yoxlayır?", o: ["MZ (PE başlıq) imzasını", "Fayl ölçüsünü", "C2 domenini", "Hash-i"], a: 0, e: "Windows executable." },
{ q: "RE labında şəbəkə niyə idarə olunur (FakeNet/INetSim)?", o: ["Malware real C2-yə çatmasın, davranış görünsün", "Sürət", "Pulsuz internet", "Backup"], a: 0, e: "Təhlükəsiz dinamik analiz." }
]);

// ---- l3-leadership ----
addQ("l3-leadership", [
{ q: "Purple teaming-in məqsədi nədir?", o: ["Red və Blue birgə işi ilə müdafiəni yaxşılaşdırmaq", "Red-i məğlub etmək", "Yeni hücum komandası", "Hüquq"], a: 0, e: "Əməkdaşlıq." },
{ q: "CALDERA nədir?", o: ["MITRE-nin avtomatlaşdırılmış adversary emulation platforması", "Antivirus", "SIEM", "Firewall"], a: 0, e: "Emulation." },
{ q: "MTTD nəyi ölçür?", o: ["Aşkarlamaya qədər orta vaxt", "Cavab vaxtı", "Alert sayı", "FP nisbəti"], a: 0, e: "Mean Time To Detect." },
{ q: "Metrikaların riski nədir?", o: ["Səhv metrika səhv davranış yaradır", "Risk yoxdur", "Yavaşlıq", "Pulludur"], a: 0, e: "Kəmiyyət ≠ keyfiyyət." },
{ q: "Avtomatik response-da 'human-in-the-loop' niyə vacibdir?", o: ["Səhv avtomatik tədbir biznesi poza bilər", "Sürət", "Pulsuz", "Lazım deyil"], a: 0, e: "Kritik tədbirlərdə təsdiq." },
{ q: "Detection validation (purple team) nə sübut edir?", o: ["Detection-ın həqiqətən işlədiyini (nəzəri yox)", "Alert sayını", "Disk yerini", "Sürəti"], a: 0, e: "Test ilə əmin olmaq." },
{ q: "Dwell time-ı azaltmaq niyə vacibdir?", o: ["Hücumçunun zərər imkanı azalır", "Disk yeri", "Sürət", "Reklam"], a: 0, e: "Erkən aşkarlama." },
{ q: "Burnout SOC-da niyə problemdir?", o: ["Yüksək kadr dövriyyəsi və aşağı performans", "Problem deyil", "Sürət artırır", "Log silir"], a: 0, e: "Komanda sağlamlığı." },
{ q: "Rəhbərliklə ünsiyyətdə senior analitik nə etməlidir?", o: ["Texniki detalı biznes/risk dilinə çevirmək", "Yalnız CVE saymaq", "Jarqon işlətmək", "İzah etməmək"], a: 0, e: "CISO risk dilində." },
{ q: "Sertifikatdan əlavə iş tapmaqda nə dəyərlidir?", o: ["Praktiki platforma profili + GitHub portfeli", "Yalnız diplom", "Yaş", "Heç nə"], a: 0, e: "Real bacarıq sübutu." },
{ q: "Adversary emulation nə üçündür?", o: ["Real aktorun TTP-lərini təqlid edib müdafiəni yoxlamaq", "Real hücum", "Malware yaymaq", "DDoS"], a: 0, e: "Müdafiə validasiyası." },
{ q: "SOC yetkinliyinin (maturity) ən yüksək səviyyəsi hansıdır?", o: ["Optimallaşdırılmış (avtomatlaşdırma, davamlı təkmilləşmə)", "Reaktiv", "Heç nə", "Yalnız antivirus"], a: 0, e: "Reaktiv → proaktiv → optimal." }
]);

})();
