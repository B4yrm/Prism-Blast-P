/* L1 — Hissə 2: Şəbəkə II (protokollar, portlar, DNS, HTTP/TLS, email), Təhdidlər/Malware, Kriptografiya */
window.SOC = window.SOC || { modules: [] };
(function () {
const R = String.raw;
SOC.modules.push(
// =====================================================================
{
id: "l1-net2", level: "L1", title: "Şəbəkə əsasları II: TCP/UDP, portlar, DNS, HTTP/S, email",
intro: "Protokollar, portlar və onların necə sui-istifadə edildiyi. Bu biliklər paket analizi və log oxumanın təməlidir.",
lessons: [
{ title: "TCP, UDP və 3-way handshake", html: R`
<table><tr><th></th><th>TCP</th><th>UDP</th></tr>
<tr><td>Bağlantı</td><td>Connection-oriented</td><td>Connectionless</td></tr>
<tr><td>Etibarlılıq</td><td>Zəmanətli çatdırılma (ACK, retransmit)</td><td>Zəmanətsiz</td></tr>
<tr><td>Sıra</td><td>Sequence number ilə</td><td>Yoxdur</td></tr>
<tr><td>Sürət</td><td>Daha yavaş</td><td>Daha sürətli</td></tr>
<tr><td>Nümunə</td><td>HTTP, HTTPS, SSH, SMTP, FTP, RDP</td><td>DNS (sorğu), DHCP, SNMP, TFTP, VoIP, QUIC</td></tr></table>
<h3>TCP 3-Way Handshake (əzbər bil!)</h3>
<pre>Client ──SYN──────────────▶ Server     (seq=x)
Client ◀────────SYN, ACK──── Server     (seq=y, ack=x+1)
Client ──ACK──────────────▶ Server     (ack=y+1)
       [bağlantı quruldu: ESTABLISHED]</pre>
<p>Bağlantının bağlanması: FIN → ACK → FIN → ACK (4-way) və ya RST (kobud kəsmə).</p>
<h3>TCP flaqları</h3>
<ul><li><b>SYN</b> — bağlantı başlat</li><li><b>ACK</b> — təsdiq</li><li><b>FIN</b> — nizamlı bağlanma</li><li><b>RST</b> — bağlantını sıfırla (rədd)</li><li><b>PSH</b> — dərhal çatdır</li><li><b>URG</b> — təcili məlumat</li></ul>
<h3>Port skanı növləri (paketdə necə görünür)</h3>
<ul><li><b>Açıq port:</b> SYN → SYN/ACK</li><li><b>Bağlı port:</b> SYN → RST/ACK</li><li><b>Filtrlənən (firewall):</b> SYN → cavab yox</li><li><b>SYN scan</b> (yarımaçıq): handshake tamamlanmır (SYN göndər, SYN/ACK gələndə RST at)</li><li><b>Çoxlu SYN, müxtəlif portlara, qısa müddətdə</b> = port skan əlaməti (Nmap və s.)</li></ul>`},
{ title: "Portlar — mütləq əzbərlənməlilər", html: R`
<table><tr><th>Port</th><th>Protokol</th><th>Təhlükəsizlik qeydi</th></tr>
<tr><td>20/21 TCP</td><td>FTP</td><td>Açıq mətn! Credentials sniff oluna bilər</td></tr>
<tr><td>22 TCP</td><td>SSH</td><td>Şifrəli uzaq giriş. Brute force hədəfi</td></tr>
<tr><td>23 TCP</td><td>Telnet</td><td>Açıq mətn — istifadə edilməməlidir</td></tr>
<tr><td>25 TCP</td><td>SMTP</td><td>Email göndərmə. Spam/exfil</td></tr>
<tr><td>53 TCP/UDP</td><td>DNS</td><td>Tunneling, exfil — həmişə izlə</td></tr>
<tr><td>67/68 UDP</td><td>DHCP</td><td>IP təyinatı</td></tr>
<tr><td>69 UDP</td><td>TFTP</td><td>Açıq mətn, autentifikasiyasız</td></tr>
<tr><td>80 TCP</td><td>HTTP</td><td>Şifrəsiz veb</td></tr>
<tr><td>88 TCP/UDP</td><td>Kerberos</td><td>AD autentifikasiya</td></tr>
<tr><td>110/143 TCP</td><td>POP3/IMAP</td><td>Email alma</td></tr>
<tr><td>123 UDP</td><td>NTP</td><td>Vaxt sinxronizasiyası (loglar üçün kritik!)</td></tr>
<tr><td>135 TCP</td><td>MSRPC</td><td>Windows RPC, lateral movement</td></tr>
<tr><td>137-139</td><td>NetBIOS</td><td>Köhnə Windows paylaşım</td></tr>
<tr><td>161/162 UDP</td><td>SNMP</td><td>Cihaz idarəetmə. Zəif community string</td></tr>
<tr><td>389 TCP/UDP</td><td>LDAP</td><td>Directory sorğuları</td></tr>
<tr><td>443 TCP</td><td>HTTPS</td><td>Şifrəli veb (əksər C2 də burada gizlənir)</td></tr>
<tr><td>445 TCP</td><td>SMB</td><td>Fayl paylaşım. Ransomware, EternalBlue, lateral movement</td></tr>
<tr><td>514 UDP</td><td>Syslog</td><td>Log toplama</td></tr>
<tr><td>636 TCP</td><td>LDAPS</td><td>Şifrəli LDAP</td></tr>
<tr><td>1433 TCP</td><td>MSSQL</td><td>Verilənlər bazası</td></tr>
<tr><td>3306 TCP</td><td>MySQL</td><td>Verilənlər bazası</td></tr>
<tr><td>3389 TCP</td><td>RDP</td><td>Windows uzaq masaüstü. Brute force, ransomware giriş vektoru #1</td></tr>
<tr><td>5985/5986 TCP</td><td>WinRM</td><td>PowerShell Remoting, lateral movement</td></tr>
<tr><td>5900 TCP</td><td>VNC</td><td>Uzaq masaüstü</td></tr></table>
<p><b>Port diapazonları:</b> Well-known 0–1023, Registered 1024–49151, Dynamic/Ephemeral 49152–65535 (müştəri tərəfi müvəqqəti portları).</p>
<div class="tip">Yüksək, qeyri-standart portlarda (məs. 4444, 1337, 8080, 31337) dinləyən və ya bağlantı quran proseslər şübhəlidir. 4444 — Metasploit default; 1337/31337 — "leet", backdoor klişesi.</div>`},
{ title: "DNS — SOC-un ən çox istifadə etdiyi protokol", html: R`
<p>DNS domen adlarını IP ünvanlarına çevirir. Hər şəbəkə hadisəsinin təxminən həmişə DNS izi var — ona görə DNS logları threat hunting üçün qızıldır.</p>
<h3>Həlletmə prosesi</h3>
<ol><li>Browser → Recursive Resolver (məs. 8.8.8.8 və ya daxili DNS)</li><li>Resolver → Root → TLD (.com) → Authoritative server</li><li>Cavab keşlənir (TTL müddətində)</li></ol>
<h3>Qeyd (record) növləri</h3>
<table><tr><th>Növ</th><th>Məna</th></tr><tr><td>A</td><td>Domen → IPv4</td></tr><tr><td>AAAA</td><td>Domen → IPv6</td></tr>
<tr><td>CNAME</td><td>Alias (başqa domenə)</td></tr><tr><td>MX</td><td>Mail server</td></tr><tr><td>NS</td><td>Name server</td></tr>
<tr><td>TXT</td><td>İxtiyari mətn (SPF, DKIM, doğrulama — exfil üçün sui-istifadə olunur)</td></tr><tr><td>PTR</td><td>IP → domen (reverse)</td></tr></table>
<h3>Təhdid baxımından DNS</h3>
<ul><li><b>DNS Tunneling / Exfiltration (T1071.004, T1048):</b> məlumat sub-domen adlarında kodlaşdırılıb göndərilir. Əlamət: anormal uzun/təsadüfi subdomenlər (<code>a8f3b2c9d1.exfil.attacker.com</code>), bir domenə çox sayda unikal subdomen sorğusu, çoxlu TXT sorğuları.</li>
<li><b>DGA (Domain Generation Algorithm):</b> malware alqoritmik olaraq çoxlu təsadüfi domenlər yaradır (<code>kq3v9z7x.com</code>) C2 tapmaq üçün. Əlamət: çoxlu NXDOMAIN (mövcud olmayan domen) cavabları.</li>
<li><b>Fast Flux:</b> bir domen üçün IP-lərin tez-tez dəyişməsi (aşağı TTL).</li>
<li><b>Typosquatting:</b> <code>goggle.com</code>, <code>micros0ft.com</code> — phishing/malware.</li>
<li><b>DoH/DoT</b> (DNS over HTTPS/TLS) — DNS-i şifrələyir, monitorinqi çətinləşdirir.</li></ul>
<pre>nslookup example.com            # sadə sorğu
dig example.com A +short        # Linux, daha güclü
dig example.com MX
dig -x 8.8.8.8                  # reverse lookup</pre>`},
{ title: "HTTP, HTTPS, TLS", html: R`
<h3>HTTP metodları</h3>
<ul><li><b>GET</b> — məlumat al (parametrlər URL-də, loglarda görünür)</li><li><b>POST</b> — məlumat göndər (body-də)</li><li><b>PUT/DELETE</b>, <b>HEAD</b>, <b>OPTIONS</b></li></ul>
<h3>Status kodları (əzbər)</h3>
<table><tr><th>Kod</th><th>Məna</th><th>SOC qeydi</th></tr>
<tr><td>200</td><td>OK</td><td>Uğurlu — hücum da uğurlu ola bilər</td></tr>
<tr><td>301/302</td><td>Yönləndirmə</td><td>Phishing zəncirləri</td></tr>
<tr><td>401</td><td>Unauthorized</td><td>Autentifikasiya lazımdır</td></tr>
<tr><td>403</td><td>Forbidden</td><td>İcazə yoxdur / WAF blok</td></tr>
<tr><td>404</td><td>Not Found</td><td>Çoxlu 404 = skan/enumeration</td></tr>
<tr><td>500</td><td>Server Error</td><td>İnjection cəhdi serveri çökdürə bilər</td></tr>
</table>
<h3>Vacib HTTP başlıqları</h3>
<ul><li><b>User-Agent</b> — brauzer/alət. <code>sqlmap</code>, <code>nikto</code>, <code>python-requests</code>, <code>curl</code> User-Agent-ləri avtomatlaşdırılmış alət əlamətidir.</li>
<li><b>Host</b>, <b>Referer</b>, <b>Cookie</b> (sessiya), <b>Authorization</b>, <b>X-Forwarded-For</b> (real client IP, proxy arxasında)</li></ul>
<h3>HTTPS və TLS</h3>
<p>HTTPS = HTTP + TLS. TLS <b>məxfilik</b> (şifrələmə), <b>bütövlük</b> və <b>autentifikasiya</b> (server sertifikatı) təmin edir. TLS handshake zamanı simmetrik sessiya açarı asimmetrik kriptoqrafiya ilə mübadilə olunur (növbəti modul).</p>
<ul><li><b>Sertifikat</b> — CA (Certificate Authority) tərəfindən imzalanır. Self-signed və ya müddəti bitmiş sertifikatlar brauzerdə xəbərdarlıq verir.</li>
<li><b>SNI</b> (Server Name Indication) — TLS-də host adı hələ də açıq görünür (ESNI/ECH olmasa) — SOC monitorinqi üçün faydalıdır.</li>
<li><b>JA3/JA3S</b> — TLS handshake "barmaq izi". Şifrəli trafikdə belə malware/C2-ni tanımağa kömək edir, çünki məzmunu görmədən müştərinin TLS imzasını müqayisə edirik.</li></ul>
<div class="warn">Müasir malware trafikinin böyük hissəsi HTTPS (443) üzərindədir, çünki şifrəli və adidir. "Şifrəli = təhlükəsiz" düşüncəsi səhvdir. Metadata (hara, nə vaxt, nə qədər, JA3) analiz olunur.</div>`},
{ title: "Email protokolları və autentifikasiya", html: R`
<h3>Protokollar</h3>
<ul><li><b>SMTP (25, 587 submission, 465 SMTPS)</b> — göndərmə</li><li><b>POP3 (110/995)</b> — alıb silmə</li><li><b>IMAP (143/993)</b> — serverdə saxlama, sinxronizasiya</li></ul>
<h3>Email autentifikasiyası — phishing təhlilində kritik</h3>
<table><tr><th>Mexanizm</th><th>Nə edir</th></tr>
<tr><td><b>SPF</b></td><td>Hansı serverlərin bu domendən mail göndərə biləcəyini (IP) müəyyən edir. DNS TXT qeydi.</td></tr>
<tr><td><b>DKIM</b></td><td>Maili rəqəmsal imza ilə imzalayır — bütövlük və göndərən doğrulaması.</td></tr>
<tr><td><b>DMARC</b></td><td>SPF/DKIM uğursuz olanda nə edilməli (none/quarantine/reject) və hesabat. "From" domenini qoruyur.</td></tr></table>
<p>Phishing təhlilində email başlıqlarına (headers) baxırsan:</p>
<pre>Return-Path, Received (hansı serverlərdən keçib — aşağıdan yuxarı oxu),
Authentication-Results: spf=fail dkim=fail dmarc=fail  ← güclü spoofing əlaməti
From:  "IT Support" <support@micros0ft-help.com>        ← display name ≠ real domen
Reply-To: attacker@gmail.com                            ← fərqli reply ünvanı şübhəli</pre>
<h3>Phishing əlamətləri</h3>
<ul><li>Təcililik/qorxu ("hesabınız 24 saata bağlanacaq!")</li><li>Göndərən ünvanının saxtalaşdırılması / oxşar domen</li><li>Display name real, domen saxta</li><li>Şübhəli linklər (mətn ≠ real URL — üzərinə gətirib yoxla)</li><li>Gözlənilməz əlavələr (.html, .htm, .iso, .img, .zip, .lnk, parollu arxiv, makro sənədlər)</li><li>Qrammatik səhvlər, ümumi müraciət ("Hörmətli müştəri")</li><li>SPF/DKIM/DMARC uğursuzluğu</li></ul>
<p>Növbə: <b>URL-ləri təhlükəsiz aç</b> — urlscan.io, VirusTotal, sandbox. Real brauzerdə açma! Əlavələri yalnız izolyasiya olunmuş sandbox-da (any.run, Joe Sandbox) işlət.</p>`}
],
quiz: [
{ q: "TCP 3-way handshake-in düzgün ardıcıllığı hansıdır?", o: ["SYN → SYN/ACK → ACK", "ACK → SYN → FIN", "SYN → ACK → SYN", "FIN → ACK → RST"], a: 0, e: "Əsas əzbər." },
{ q: "Hansı protokol connectionless-dir?", o: ["UDP", "TCP", "SSH", "RDP"], a: 0, e: "UDP bağlantı qurmur." },
{ q: "RDP hansı portdadır?", o: ["3389", "3306", "443", "22"], a: 0, e: "Ransomware-in #1 giriş vektoru." },
{ q: "SMB hansı portdadır?", o: ["445", "139", "21", "25"], a: 0, e: "445 TCP. EternalBlue, lateral movement." },
{ q: "DNS hansı portdadır?", o: ["53", "80", "123", "161"], a: 0, e: "53 UDP (sorğu) / TCP (zone transfer, böyük cavab)." },
{ q: "SSH hansı portdadır?", o: ["22", "23", "21", "25"], a: 0, e: "22. Telnet 23 (açıq mətn)." },
{ q: "Bağlı porta SYN göndərəndə hansı cavab gəlir?", o: ["RST/ACK", "SYN/ACK", "Cavab yox", "FIN"], a: 0, e: "Açıq: SYN/ACK, bağlı: RST, filtrli: cavab yox." },
{ q: "Çoxlu təsadüfi uzun subdomen sorğuları (a8f3.exfil.evil.com) nəyə işarədir?", o: ["DNS tunneling/exfiltration", "Normal CDN", "DHCP", "NTP sinxronizasiya"], a: 0, e: "Məlumat subdomenlərdə kodlaşdırılır." },
{ q: "Çoxlu NXDOMAIN cavabları hansı malware davranışına işarə edə bilər?", o: ["DGA (Domain Generation Algorithm)", "Port skan", "ARP spoof", "SYN flood"], a: 0, e: "Malware işləyən C2 domenini tapana qədər çox domen sınayır." },
{ q: "Hansı DNS qeydi mail serverini göstərir?", o: ["MX", "A", "CNAME", "PTR"], a: 0, e: "Mail eXchange." },
{ q: "HTTP 404 kodunun çoxlu təkrarı nəyə işarə edir?", o: ["Skan/enumeration (dizin/fayl axtarışı)", "Uğurlu hücum", "Server söndürülüb", "Normal trafik"], a: 0, e: "Hücumçu mövcud yolları axtarır (gobuster, dirb)." },
{ q: "User-Agent 'sqlmap' nəyi göstərir?", o: ["Avtomatlaşdırılmış SQL injection aləti", "Normal brauzer", "Mobil cihaz", "Axtarış botu"], a: 0, e: "Avtomatik hücum aləti." },
{ q: "TLS hansı üç şeyi təmin edir?", o: ["Məxfilik, bütövlük, autentifikasiya", "Sürət, sıxışdırma, keş", "Routing, NAT, DHCP", "Backup, loglama, audit"], a: 0, e: "Confidentiality, integrity, authentication." },
{ q: "JA3 nədir?", o: ["TLS handshake barmaq izi", "DNS qeyd növü", "Firewall qaydası", "Email başlığı"], a: 0, e: "Şifrəli trafikdə belə client-i tanımağa kömək edir." },
{ q: "Phishing təhlilində 'Authentication-Results: spf=fail dkim=fail' nəyə işarədir?", o: ["Göndərən domen ehtimal ki saxtalaşdırılıb", "Mail təhlükəsizdir", "Server offline-dır", "Normal daxili mail"], a: 0, e: "Spoofing göstəricisi." },
{ q: "DMARC politikası 'reject' nə edir?", o: ["SPF/DKIM uğursuz mailləri rədd edir", "Bütün mailləri qəbul edir", "Mailləri şifrələyir", "Spam qovluğuna atır"], a: 0, e: "quarantine karantin, reject rədd." },
{ q: "Email başlıqlarında 'Received' sətirləri necə oxunur?", o: ["Aşağıdan yuxarı (ilk göndərən altda)", "Yuxarıdan aşağı", "Təsadüfi", "Əlifba sırası"], a: 0, e: "Ən alt Received orijinal göndərəndir." },
{ q: "Ephemeral (dynamic) port diapazonu hansıdır?", o: ["49152–65535", "0–1023", "1024–49151", "1–100"], a: 0, e: "Müştəri tərəfinin müvəqqəti portları." },
{ q: "Port 4444-də dinləyən proses niyə şübhəlidir?", o: ["Metasploit default portudur", "Standart HTTPS portudur", "DNS portudur", "Email portudur"], a: 0, e: "Reverse shell/C2 klişesi." },
{ q: "NTP (port 123) SOC üçün niyə vacibdir?", o: ["Vaxt sinxronizasiyası — logların korrelyasiyası üçün", "Faylları şifrələmək üçün", "Email göndərmək üçün", "IP paylamaq üçün"], a: 0, e: "Saatlar fərqli olsa, hadisələri sıralamaq mümkün olmaz." },
{ q: "FTP-nin təhlükəsizlik problemi nədir?", o: ["Credentials və məlumat açıq mətnlə ötürülür", "Çox yavaşdır", "Yalnız Linux-da işləyir", "Port yoxdur"], a: 0, e: "SFTP/FTPS istifadə olunmalıdır." }
],
tasks: [
{ t: "Port skanını tanı", d: R`<p>Firewall logu (bir mənbə IP-dən 2 saniyə ərzində):</p><pre>10.0.0.99:44321 -> 10.0.0.5:21   SYN
10.0.0.99:44322 -> 10.0.0.5:22   SYN
10.0.0.99:44323 -> 10.0.0.5:23   SYN
10.0.0.99:44324 -> 10.0.0.5:25   SYN
10.0.0.99:44325 -> 10.0.0.5:80   SYN
10.0.0.99:44326 -> 10.0.0.5:443  SYN
10.0.0.99:44327 -> 10.0.0.5:445  SYN
10.0.0.99:44328 -> 10.0.0.5:3389 SYN
... (1000 fərqli port) ...</pre>`, q: "Bu fəaliyyət nədir? (iki söz)", ans: ["port scan", "port skan", "port scanning", "port skanı"], hint: "Bir mənbə, çox port, qısa müddət, yalnız SYN.", sol: "Port scan (ehtimal Nmap SYN scan — handshake tamamlanmır). 10.0.0.99 daxili hostdur → ya icazəli pentest, ya da kompromis olunmuş host lateral kəşfiyyat aparır. Addım: 10.0.0.99 sahibini tap, icazəli skan olub-olmadığını yoxla, deyilsə eskalasiya et." },
{ t: "Phishing başlığı təhlili", d: R`<pre>From: "PayPal Security" <service@paypa1-secure.com>
Reply-To: getmoney2026@gmail.com
Return-Path: <bounce@mailgun-relay.xyz>
Authentication-Results: mx.corp.com;
   spf=fail (sender IP 185.100.87.202 not permitted)
   dkim=none
   dmarc=fail
Subject: Urgent: Your account will be suspended in 24 hours!
Link text: https://www.paypal.com/verify
Actual href: http://paypa1-secure.com/login/verify.php</pre>`, q: "Göndərən domenindəki hiylə nədir? (düzgün domen necə olmalı idi — bir söz)", ans: ["paypal", "paypal.com"], hint: "paypa'1'-secure — rəqəm '1' hərf 'l' əvəzinə.", sol: "Çoxlu qırmızı bayraq: (1) <code>paypa1-secure.com</code> typosquatting — 'l' yerinə '1'; (2) Reply-To Gmail; (3) spf=fail, dmarc=fail; (4) təcili/qorxu dili; (5) link mətni paypal.com, real href saxta domen və HTTP (şifrəsiz). Nəticə: TRUE POSITIVE phishing. Addım: maili karantinə al, göndərən/URL-i blok siyahısına əlavə et, eyni mövzunu alan digər istifadəçiləri tap, kliklənibsə IR başlat. URL-i yalnız urlscan.io/sandbox-da aç." },
{ t: "Status kodu təhlili", d: R`<p>Nginx access.log çıxarışı, IP 203.0.113.50:</p><pre>GET /admin        401
GET /login        200
GET /../../etc/passwd  403
GET /wp-admin     404
GET /phpmyadmin   404
GET /.env         200    <-- !!!
GET /backup.zip   200    <-- !!!
GET /api/users    200</pre>`, q: "Hansı iki uğurlu (200) sorğu ən təhlükəlidir? Birini yaz (fayl adı):", ans: [".env", "backup.zip", "/.env", "/backup.zip", "env"], hint: ".env sirləri, backup.zip ehtiyat nüsxəni sızdıra bilər.", sol: "<code>/.env</code> (200) — tətbiq sirləri (DB parolları, API açarları) ehtiva edə bilər; <code>/backup.zip</code> (200) — tam kod/verilənlər bazası ehtiyatı sızdıra bilər. 404-lər bloklanıb, amma bu ikisi mövcud və əlçatandır — ciddi data exposure. Hücumçu həm də path traversal (/etc/passwd) cəhd edib (403-lə bloklanıb). Addım: bu faylları dərhal qaldır/qoru, sirləri rotasiya et, 203.0.113.50 başqa nəyə girdiyini yoxla." },
{ t: "DNS və HTTP alətləri (lab)", d: R`<p>Öz kompüterində icra et (CyberChef və urlscan.io faydalıdır).</p>`, steps: ["dig example.com A +short və dig example.com MX icra et (Windows: nslookup)", "dig github.com — neçə A qeydi (IP) qaytarır?", "urlscan.io-da təhlükəsiz bir sayt axtar (məs. example.com) və nəticələrə bax", "Brauzerdə DevTools (F12) → Network tab aç, bir sayta gir, HTTP başlıqlarına (Request/Response Headers) bax", "Response-da Server və Content-Type başlıqlarını tap"], sol: "dig/nslookup, urlscan.io və brauzer DevTools — gündəlik SOC alətlərindir. urlscan.io şübhəli URL-i real sistemdə açmadan təhlükəsiz şəkildə təhlil etməyə imkan verir." }
]
},
// =====================================================================
{
id: "l1-threats", level: "L1", title: "Təhdidlər, zərərli proqramlar və hücum növləri",
intro: "Malware növləri, sosial mühəndislik, veb hücumlar, parol hücumları və DoS. Hücumçunun alət çantası.",
lessons: [
{ title: "Malware növləri", html: R`
<table><tr><th>Növ</th><th>Təsvir</th></tr>
<tr><td><b>Virus</b></td><td>Başqa fayllara yoluxur, istifadəçi fəaliyyəti ilə yayılır</td></tr>
<tr><td><b>Worm</b></td><td>Öz-özünə yayılır (şəbəkə üzərindən, istifadəçisiz). Məs: WannaCry (EternalBlue/SMB)</td></tr>
<tr><td><b>Trojan</b></td><td>Faydalı proqram kimi görünür, arxada zərərli iş görür</td></tr>
<tr><td><b>Ransomware</b></td><td>Faylları şifrələyir, fidyə tələb edir. Müasir: əvvəlcə oğurlayır (double extortion)</td></tr>
<tr><td><b>Spyware / Infostealer</b></td><td>Məlumat oğurlayır (parollar, cookie, kart). Məs: RedLine, Raccoon</td></tr>
<tr><td><b>Keylogger</b></td><td>Klaviatura girişlərini qeyd edir</td></tr>
<tr><td><b>Rootkit</b></td><td>Dərin gizlənir (kernel), özünü və digərlərini gizlədir</td></tr>
<tr><td><b>Bootkit</b></td><td>Boot prosesinə yoluxur</td></tr>
<tr><td><b>RAT</b></td><td>Remote Access Trojan — tam uzaq nəzarət</td></tr>
<tr><td><b>Botnet</b></td><td>Ələ keçirilmiş cihazlar şəbəkəsi (DDoS, spam)</td></tr>
<tr><td><b>Adware</b></td><td>Reklam göstərir, çox vaxt spyware ilə birlikdə</td></tr>
<tr><td><b>Fileless malware</b></td><td>Diskə yazılmır, yaddaşda/skriptlərdə yaşayır (LOLBins). Aşkarlanması çətin</td></tr>
<tr><td><b>Loader / Dropper</b></td><td>Əsas malware-i endirib işə salır (ilkin mərhələ)</td></tr>
<tr><td><b>Wiper</b></td><td>Məlumatı məhv edir (bərpa məqsədi yoxdur). Məs: NotPetya</td></tr>
<tr><td><b>Cryptominer</b></td><td>Resursları kripto çıxarmaq üçün oğurlayır (CPU 100%)</td></tr></table>
<h3>LOLBins (Living off the Land)</h3>
<p>Hücumçular şübhə doğurmamaq üçün sistemin öz legitim alətlərindən istifadə edir: <code>powershell.exe</code>, <code>certutil.exe</code> (fayl endirmə/decode), <code>bitsadmin.exe</code>, <code>mshta.exe</code>, <code>rundll32.exe</code>, <code>regsvr32.exe</code>, <code>wmic.exe</code>, <code>wscript/cscript</code>. Linux-da: <code>curl</code>, <code>wget</code>, <code>bash</code>, <code>python</code>, <code>nc</code>. Bu alətlərin qeyri-adi istifadəsi (məs. certutil-in internetdən fayl endirməsi) güclü detection fürsətidir. LOLBAS/GTFOBins layihələrinə bax.</p>`},
{ title: "Sosial mühəndislik və phishing növləri", html: R`
<p>İnsan ən zəif halqadır. Sosial mühəndislik texniki deyil, psixoloji manipulyasiyadır.</p>
<table><tr><th>Texnika</th><th>Təsvir</th></tr>
<tr><td><b>Phishing</b></td><td>Kütləvi aldadıcı email</td></tr>
<tr><td><b>Spear phishing</b></td><td>Konkret şəxsə yönəlmiş, fərdiləşdirilmiş</td></tr>
<tr><td><b>Whaling</b></td><td>Yüksək rəhbərliyə (CEO, CFO) yönəlmiş</td></tr>
<tr><td><b>BEC</b></td><td>Business Email Compromise — rəhbər adından saxta köçürmə tələbi</td></tr>
<tr><td><b>Vishing</b></td><td>Telefon zəngi ilə</td></tr>
<tr><td><b>Smishing</b></td><td>SMS ilə</td></tr>
<tr><td><b>Pretexting</b></td><td>Uydurma ssenari/rol (məs. "IT dəstəyiyəm")</td></tr>
<tr><td><b>Baiting</b></td><td>Yem (məs. "maaş" yazılı USB-ni atmaq)</td></tr>
<tr><td><b>Quid pro quo</b></td><td>Xidmət müqabilində məlumat</td></tr>
<tr><td><b>Tailgating</b></td><td>Fiziki: icazəli şəxsin arxasınca qapıdan keçmək</td></tr>
<tr><td><b>MFA fatigue / push bombing</b></td><td>Təkrar MFA bildirişləri göndərib istifadəçini "təsdiq et"məyə məcbur etmək</td></tr>
<tr><td><b>Watering hole</b></td><td>Hədəfin ziyarət etdiyi sayta malware yerləşdirmək</td></tr></table>
<p>Psixoloji qarmaqlar: <b>avtoritet</b> (rəis/polis), <b>təcililik</b>, <b>qorxu</b>, <b>maraq</b>, <b>nadir fürsət</b>, <b>etibar/tanışlıq</b>, <b>köməksevərlik</b>.</p>
<div class="note">SOC-da phishing ən çox gələn alert tiplərindən biridir. L1 analitik gündə onlarla phishing report-u təhlil edir.</div>`},
{ title: "Veb tətbiq hücumları (OWASP əsasları)", html: R`
<table><tr><th>Hücum</th><th>Təsvir və nümunə</th><th>Log əlaməti</th></tr>
<tr><td><b>SQL Injection</b></td><td>Sorğuya zərərli SQL. <code>' OR '1'='1</code>, <code>UNION SELECT</code>, <code>'; DROP TABLE</code></td><td>URL/body-də SQL açar sözləri, qəribə kavıçıqlar, 500 xətaları</td></tr>
<tr><td><b>XSS</b></td><td>Saxta skript injection. <code>&lt;script&gt;...&lt;/script&gt;</code>, <code>onerror=</code></td><td>Parametrlərdə <code>&lt;script&gt;</code>, <code>javascript:</code></td></tr>
<tr><td><b>Path/Directory Traversal</b></td><td><code>../../../etc/passwd</code>, <code>..\..\windows\win.ini</code></td><td><code>../</code>, <code>%2e%2e%2f</code> (URL encoded)</td></tr>
<tr><td><b>Command Injection</b></td><td><code>; whoami</code>, <code>| cat /etc/passwd</code>, <code>&& id</code></td><td>Shell metasimvolları parametrlərdə</td></tr>
<tr><td><b>LFI/RFI</b></td><td>Local/Remote File Inclusion</td><td><code>?page=http://evil.com/shell</code></td></tr>
<tr><td><b>CSRF</b></td><td>İstifadəçinin sessiyası ilə saxta sorğu</td><td>Qeyri-adi Referer/origin</td></tr>
<tr><td><b>SSRF</b></td><td>Serveri daxili resurslara sorğu göndərməyə məcbur etmək (<code>http://169.254.169.254</code> cloud metadata)</td><td>Serverdən daxili/metadata IP-lərə sorğu</td></tr>
<tr><td><b>File Upload</b></td><td>Webshell yükləmə (<code>shell.php</code>)</td><td>.php/.jsp/.aspx upload, sonra həmin fayla GET</td></tr>
<tr><td><b>Brute force / Credential stuffing</b></td><td>Login səhifəsinə çoxlu cəhd</td><td>Çoxlu 401/POST /login</td></tr></table>
<h3>Webshell</h3>
<p>Serverdə qalıcı uzaq icra imkanı verən zərərli skript. Əlamət: veb qovluqda yeni/dəyişmiş .php/.aspx/.jsp faylı, veb server prosesinin (w3wp.exe, php-fpm, apache) <code>cmd.exe</code>/<code>/bin/sh</code> başlatması.</p>
<h3>OWASP Top 10 (2021, yadda saxla)</h3>
<p>A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable Components, A07 Identification & Auth Failures, A08 Software & Data Integrity Failures, A09 Logging & Monitoring Failures, A10 SSRF.</p>
<div class="warn">Bu texnikaları yalnız öz lab mühitində (DVWA, OWASP Juice Shop, PortSwigger Academy) sına. İcazəsiz sistemdə icra cinayətdir.</div>`},
{ title: "Parol hücumları və DoS/DDoS", html: R`
<h3>Parol hücumları</h3>
<table><tr><th>Növ</th><th>Təsvir</th><th>Log əlaməti</th></tr>
<tr><td><b>Brute force</b></td><td>Bütün kombinasiyaları sınamaq</td><td>Bir hesaba çoxlu 4625/Failed password</td></tr>
<tr><td><b>Dictionary</b></td><td>Məşhur parol siyahısı (rockyou.txt)</td><td>Eyni</td></tr>
<tr><td><b>Password spraying</b></td><td>Bir-iki məşhur parolu ÇOX hesaba sınamaq (lockout-dan qaçmaq)</td><td>Çox fərqli hesaba az sayda 4625, eyni IP/vaxt</td></tr>
<tr><td><b>Credential stuffing</b></td><td>Sızmış user:parol cütlərini sınamaq</td><td>Çoxlu hesab, bəziləri uğurlu</td></tr>
<tr><td><b>Pass-the-Hash</b></td><td>Parol əvəzinə hash istifadəsi (L2)</td><td>NTLM, qeyri-adi logon</td></tr>
<tr><td><b>Rainbow table</b></td><td>Əvvəlcədən hesablanmış hash cədvəli (salt bunu zəiflədir)</td><td>Offline</td></tr></table>
<p><b>Password spraying vs brute force:</b> brute force = 1 hesab, çox parol; spraying = 1 parol, çox hesab. Spraying hesab bloklanmasından (lockout) yayınmaq üçün daha məxfidir.</p>
<p><b>Hash nədir:</b> parollar düz yox, hash kimi saxlanmalıdır. <b>Salt</b> — hər parola əlavə olunan təsadüfi dəyər (eyni parolların eyni hash almasının və rainbow table-ın qarşısını alır). Yavaş hash funksiyaları (bcrypt, scrypt, Argon2, PBKDF2) brute force-u çətinləşdirir.</p>
<h3>DoS və DDoS</h3>
<ul><li><b>DoS</b> — bir mənbədən xidməti əlçatmaz etmək. <b>DDoS</b> — çox mənbədən (botnet).</li>
<li><b>Volumetric</b> — zolaq eni doldurmaq (UDP flood, DNS/NTP amplification)</li>
<li><b>Protocol</b> — SYN flood (yarımaçıq bağlantılarla resursları tükətmək)</li>
<li><b>Application (L7)</b> — HTTP flood, Slowloris (bağlantıları açıq saxlamaq)</li>
<li><b>Amplification</b> — kiçik sorğu, böyük cavab (DNS, NTP, memcached) + spoofed mənbə IP</li></ul>
<p><b>Əlamətlər:</b> trafik həcminin kəskin artması, bir xidmətə çoxlu eyni tipli sorğu, serverin cavab verməməsi, çoxlu yarımaçıq bağlantı. <b>Qoruma:</b> rate limiting, DDoS mitigation xidmətləri (Cloudflare, upstream provider), anycast, SYN cookies.</p>`},
{ title: "Hücum zənciri: Cyber Kill Chain və MITRE ATT&CK", html: R`
<h3>Lockheed Martin Cyber Kill Chain</h3>
<ol><li><b>Reconnaissance</b> — hədəf haqqında məlumat toplama (OSINT, skan)</li>
<li><b>Weaponization</b> — zərərli yükün hazırlanması (makro sənəd, exploit)</li>
<li><b>Delivery</b> — çatdırılma (email, USB, veb)</li>
<li><b>Exploitation</b> — zəiflikdən istifadə</li>
<li><b>Installation</b> — malware quraşdırma, persistence</li>
<li><b>Command & Control (C2)</b> — hücumçu ilə əlaqə</li>
<li><b>Actions on Objectives</b> — məqsədə çatma (oğurluq, şifrələmə)</li></ol>
<p>İdeya: zənciri nə qədər erkən qırsan, zərər bir o qədər az olar.</p>
<h3>MITRE ATT&CK — sənin əsas çərçivən</h3>
<p>Real müşahidə olunmuş hücumçu <b>taktika</b> (nə üçün — məqsəd), <b>texnika</b> (necə) və <b>prosedurlarının</b> (TTP) kataloqu. Hər texnikanın ID-si var: məs. <code>T1059.001</code> (PowerShell).</p>
<h3>Enterprise taktikalar (14, sıra ilə təxmini)</h3>
<p>Reconnaissance, Resource Development, <b>Initial Access</b> (TA0001), <b>Execution</b>, <b>Persistence</b>, <b>Privilege Escalation</b>, <b>Defense Evasion</b>, <b>Credential Access</b>, <b>Discovery</b>, <b>Lateral Movement</b>, <b>Collection</b>, <b>Command and Control</b>, <b>Exfiltration</b>, <b>Impact</b>.</p>
<table><tr><th>Taktika</th><th>Tipik texnika nümunəsi</th></tr>
<tr><td>Initial Access</td><td>Phishing (T1566), Exploit Public-Facing App (T1190), Valid Accounts (T1078)</td></tr>
<tr><td>Execution</td><td>PowerShell (T1059.001), User Execution (T1204)</td></tr>
<tr><td>Persistence</td><td>Run keys (T1547.001), Scheduled Task (T1053), Create Account (T1136)</td></tr>
<tr><td>Privilege Escalation</td><td>Token manipulation, Exploitation (T1068)</td></tr>
<tr><td>Defense Evasion</td><td>Obfuscation (T1027), Masquerading (T1036), Clear Logs (T1070)</td></tr>
<tr><td>Credential Access</td><td>LSASS dump (T1003.001), Kerberoasting (T1558.003)</td></tr>
<tr><td>Discovery</td><td>whoami, net user, System Info (T1082, T1087)</td></tr>
<tr><td>Lateral Movement</td><td>RDP (T1021.001), SMB/PsExec (T1021.002), Pass-the-Hash</td></tr>
<tr><td>C2</td><td>Application Layer Protocol (T1071), DNS (T1071.004)</td></tr>
<tr><td>Exfiltration</td><td>Exfil over C2 (T1041), over web service</td></tr>
<tr><td>Impact</td><td>Ransomware/Data Encrypted (T1486), Wiper, Service Stop</td></tr></table>
<p>SOC-da hər alert və insident ATT&CK texnikaları ilə etiketlənir. attack.mitre.org-u tez-tez istifadə edəcəksən.</p>`}
],
quiz: [
{ q: "Öz-özünə, istifadəçi müdaxiləsi olmadan şəbəkə üzrə yayılan malware növü?", o: ["Worm", "Virus", "Trojan", "Adware"], a: 0, e: "Worm. WannaCry nümunədir." },
{ q: "Double extortion ransomware nə edir?", o: ["Faylları şifrələməzdən əvvəl oğurlayır", "İki dəfə şifrələyir", "İki kompüterə yayılır", "İki fidyə tələb edir"], a: 0, e: "Şifrələmə + sızdırma hədəsi." },
{ q: "certutil.exe-nin internetdən fayl endirməsi nəyə işarədir?", o: ["LOLBin sui-istifadəsi", "Normal sertifikat yeniləməsi", "Windows Update", "Antivirus skanı"], a: 0, e: "Legitim alət zərərli məqsədlə." },
{ q: "Fileless malware niyə aşkarlanması çətindir?", o: ["Diskə yazılmır, yaddaşda/skriptlərdə işləyir", "Çox böyükdür", "Şifrəlidir", "Yalnız gecə işləyir"], a: 0, e: "Fayl-əsaslı antivirus onu görmür." },
{ q: "CEO adından maliyyə şöbəsinə saxta köçürmə tələbi hansı hücumdur?", o: ["BEC (Business Email Compromise)", "DDoS", "SQL injection", "Port scan"], a: 0, e: "Whaling/BEC." },
{ q: "Təkrar MFA bildirişləri göndərib istifadəçini bezdirmək hansı texnikadır?", o: ["MFA fatigue / push bombing", "Password spraying", "Phishing", "Tailgating"], a: 0, e: "İstifadəçi bezib təsdiq edir." },
{ q: "<script>alert(1)</script> parametrdə görünür. Hansı hücum?", o: ["XSS", "SQL injection", "Path traversal", "SSRF"], a: 0, e: "Cross-Site Scripting." },
{ q: "' OR '1'='1 nümunəsi hansı hücumdur?", o: ["SQL Injection", "XSS", "CSRF", "Command injection"], a: 0, e: "Autentifikasiyanı keçmək üçün klassik SQLi." },
{ q: "../../../etc/passwd nə hücumudur?", o: ["Path/Directory Traversal", "SQLi", "XSS", "DDoS"], a: 0, e: "Fayl sistemində yuxarı qalxmaq." },
{ q: "http://169.254.169.254-ə serverdən sorğu hansı hücuma işarədir?", o: ["SSRF (cloud metadata)", "XSS", "Brute force", "ARP spoof"], a: 0, e: "Cloud metadata endpoint — credential oğurluğu." },
{ q: "Bir parolu çox sayda hesaba sınamaq hansı hücumdur?", o: ["Password spraying", "Brute force", "Rainbow table", "Pass-the-hash"], a: 0, e: "Lockout-dan yayınmaq üçün." },
{ q: "Salt nəyin qarşısını alır?", o: ["Rainbow table və eyni parolların eyni hash alması", "SQL injection", "DDoS", "Phishing"], a: 0, e: "Hər parola unikal təsadüfi dəyər." },
{ q: "SYN flood hansı DoS növüdür?", o: ["Protocol (yarımaçıq bağlantılar)", "Volumetric", "Application layer", "DNS amplification"], a: 0, e: "TCP resurslarını tükədir." },
{ q: "DNS amplification hücumunda hücumçu nə edir?", o: ["Kiçik spoofed sorğu ilə böyük cavabı qurbana yönəldir", "DNS serverini şifrələyir", "Domen oğurlayır", "DNS keşini təmizləyir"], a: 0, e: "Volumetric amplification." },
{ q: "Cyber Kill Chain-də C2 mərhələsi nədir?", o: ["Command & Control — hücumçu ilə əlaqə", "Credential Capture", "Clean-up", "Configuration"], a: 0, e: "Zərərli host hücumçudan əmr alır." },
{ q: "MITRE ATT&CK-də 'taktika' nəyi bildirir?", o: ["Hücumçunun məqsədi (niyə)", "Konkret alət", "CVE nömrəsi", "Firewall qaydası"], a: 0, e: "Texnika 'necə', taktika 'niyə'." },
{ q: "T1059.001 hansı texnikadır?", o: ["PowerShell", "Phishing", "RDP", "LSASS dump"], a: 0, e: "Command and Scripting Interpreter: PowerShell." },
{ q: "Veb qovluqda yeni shell.php faylı və sonra ona GET sorğusu nəyə işarədir?", o: ["Webshell quraşdırılması", "Normal yeniləmə", "Backup", "DNS sorğusu"], a: 0, e: "Uzaqdan icra backdoor-u." },
{ q: "LSASS prosesindən yaddaş dump etmək hansı ATT&CK taktikasıdır?", o: ["Credential Access", "Discovery", "Impact", "Delivery"], a: 0, e: "Credential-ları oğurlamaq (T1003.001)." },
{ q: "whoami, net user, systeminfo əmrləri hansı taktikadır?", o: ["Discovery", "Exfiltration", "Persistence", "Impact"], a: 0, e: "Mühiti kəşf etmək." },
{ q: "Ransomware-in faylları şifrələməsi hansı ATT&CK taktikasıdır?", o: ["Impact", "Collection", "Execution", "Reconnaissance"], a: 0, e: "T1486 Data Encrypted for Impact." },
{ q: "Spear phishing nədir?", o: ["Konkret şəxsə yönəlmiş fərdiləşdirilmiş phishing", "Telefon fırıldaqçılığı", "Kütləvi spam", "SMS fırıldaqçılığı"], a: 0, e: "Hədəflənmiş." }
],
tasks: [
{ t: "Spraying yoxsa brute force?", d: R`<pre>02:00:11  4625  user: aliyev    Src: 91.200.12.9
02:00:12  4625  user: mammadov  Src: 91.200.12.9
02:00:13  4625  user: hasanov   Src: 91.200.12.9
02:00:14  4625  user: quliyev   Src: 91.200.12.9
02:00:15  4625  user: aliyeva   Src: 91.200.12.9
... (eyni IP, 200 fərqli hesaba hərəsinə 1-2 cəhd) ...</pre>`, q: "Bu hücum növü nədir? (iki söz)", ans: ["password spraying", "parol spreyi", "password spray"], hint: "Çox hesab, hər birinə az cəhd.", sol: "Password spraying — eyni IP-dən çox sayda fərqli hesaba az cəhd (lockout-dan yayınmaq üçün). Brute force olsaydı, bir hesaba yüzlərlə cəhd görərdik. Addım: mənbə IP-ni blokla, uğurlu girişlərin (4624) olub-olmadığını yoxla, təsirlənən hesablar üçün MFA/parol sıfırlama, zəif parollu hesabları yoxla." },
{ t: "SQLi aşkarla", d: R`<p>access.log:</p><pre>GET /product?id=5 200
GET /product?id=5' 500
GET /product?id=5'+OR+'1'='1 200
GET /product?id=5+UNION+SELECT+username,password+FROM+users-- 200
GET /product?id=5;+DROP+TABLE+users-- 500</pre>`, q: "Hansı hücum növüdür? (iki söz)", ans: ["sql injection", "sqli", "sql injeksiya"], hint: "UNION SELECT, OR 1=1, DROP TABLE.", sol: "SQL Injection. İlk kavıçıq (') 500 xətası verib (sorğu pozulub) → inyeksiya mümkündür. Sonra UNION SELECT ilə users cədvəlindən username/password çıxarmağa çalışıb (200 = uğurlu!). Bu TRUE POSITIVE və uğurlu məlumat sızmasıdır. Addım: kritik eskalasiya, tətbiqi yoxla (parametrləşdirilmiş sorğular?), WAF, sızdırılmış credential-ları rotasiya et, həmin IP-nin bütün fəaliyyətini araşdır." },
{ t: "ATT&CK xəritələməsi", d: R`<p>Bir insidentin addımları:</p><ol><li>İşçi email əlavəsini (makro sənəd) açdı</li><li>Word → PowerShell başladı, kodlaşdırılmış əmr icra etdi</li><li>Malware Run registry açarına yazıldı</li><li>attacker-c2.com-a 443 üzərindən periodik bağlantı</li><li>Fayllar şifrələndi, fidyə notu qoyuldu</li></ol>`, q: "5-ci addım (fayl şifrələmə) hansı ATT&CK taktikasıdır? (bir söz, ingiliscə)", ans: ["impact"], hint: "Nəticə: xidmət/data dağılması.", sol: "Mərhələlər: (1) Initial Access — Phishing (T1566.001); (2) Execution — PowerShell (T1059.001) + User Execution (T1204); (3) Persistence — Run key (T1547.001); (4) Command & Control — HTTPS (T1071.001); (5) <b>Impact</b> — Data Encrypted for Impact (T1486). Bu, tipik ransomware kill chain-idir." },
{ t: "Təhlükəsiz lab qur (praktika)", d: R`<p>Veb hücumları etik şəkildə öyrənmək üçün.</p>`, steps: ["OWASP Juice Shop-u Docker ilə qaldır (docker run -d -p 3000:3000 bkimminich/juice-shop) VƏ YA PortSwigger Web Security Academy-də pulsuz hesab aç", "PortSwigger-də 'SQL injection' laboratoriyasının ilk tapşırığını həll et", "Hər hücumu edərkən brauzer DevTools → Network-də sorğunu müşahidə et", "Həmin sorğunun log-da necə görünəcəyini təsəvvür et və qeyd et", "QEYD: yalnız bu təlim platformalarında! Heç vaxt icazəsiz real sayta."], sol: "Hücumu müdafiəçi gözü ilə görmək (hücum → log izi) detection bacarığının təməlidir. PortSwigger Academy pulsuz və sahədə qızıl standartdır." }
]
},
// =====================================================================
{
id: "l1-crypto", level: "L1", title: "Kriptografiya əsasları",
intro: "Şifrələmə, hashing, rəqəmsal imza, PKI və sertifikatlar — autentifikasiya və məlumat qorumasının təməli.",
lessons: [
{ title: "Simmetrik və asimmetrik şifrələmə", html: R`
<h3>Simmetrik şifrələmə</h3>
<p>Eyni açar həm şifrələmə, həm deşifrələmə üçün. Sürətli, böyük məlumat üçün ideal. Problem: açarı təhlükəsiz paylaşmaq.</p>
<ul><li><b>AES</b> (128/192/256 bit) — müasir standart</li><li><b>ChaCha20</b> — mobil/müasir</li><li>Köhnə/zəif: DES, 3DES, RC4 (istifadə etmə)</li></ul>
<h3>Asimmetrik şifrələmə (public key)</h3>
<p>Cüt açar: <b>public key</b> (açıq) və <b>private key</b> (gizli). Biri ilə şifrələnən yalnız digəri ilə açılır.</p>
<ul><li><b>Məxfilik:</b> alıcının <i>public</i> açarı ilə şifrələ → yalnız alıcının <i>private</i> açarı açır.</li>
<li><b>İmza:</b> göndərənin <i>private</i> açarı ilə imzala → hər kəs <i>public</i> açarla yoxlayır.</li>
<li>Alqoritmlər: <b>RSA</b>, <b>ECC</b> (elliptik əyri — qısa açarla güclü), <b>Diffie-Hellman</b> (açar mübadiləsi)</li></ul>
<h3>Hibrid model (real dünya — TLS belə işləyir)</h3>
<p>Asimmetrik yavaşdır, simmetrik sürətli. Həll: asimmetrik ilə simmetrik sessiya açarını təhlükəsiz mübadilə et, sonra bütün məlumatı sürətli simmetrik açarla şifrələ.</p>
<div class="tip">Müsahibə sualı: "Email-i həm məxfi, həm imzalı göndərmək istəyirsən. Hansı açarları istifadə edirsən?" Cavab: məzmunu <b>alıcının public</b> açarı ilə şifrələ (məxfilik), özünün <b>private</b> açarınla imzala (autentifikasiya/bütövlük).</p></div>`},
{ title: "Hashing və rəqəmsal imza", html: R`
<h3>Hash funksiyaları</h3>
<p>İxtiyari girişi sabit uzunluqlu "barmaq izi"nə çevirir. <b>Birtərəflidir</b> (geri çevrilmir), kiçik dəyişiklik tamam fərqli hash verir (avalanche), eyni giriş həmişə eyni hash.</p>
<table><tr><th>Alqoritm</th><th>Uzunluq</th><th>Status</th></tr>
<tr><td>MD5</td><td>128 bit</td><td>Sınıq (kolliziya) — yalnız IOC müqayisəsi üçün</td></tr>
<tr><td>SHA-1</td><td>160 bit</td><td>Sınıq</td></tr>
<tr><td>SHA-256</td><td>256 bit</td><td>Standart, təhlükəsiz</td></tr>
<tr><td>SHA-512</td><td>512 bit</td><td>Təhlükəsiz</td></tr></table>
<p><b>İstifadə:</b> parol saxlama (salt + yavaş hash), fayl bütövlüyü, IOC (malware hash), rəqəmsal imza.</p>
<p><b>Encoding ≠ Hashing ≠ Encryption:</b> Encoding (Base64) geri çevrilir, açarsız. Hashing geri çevrilmir. Encryption açarla geri çevrilir.</p>
<h3>HMAC</h3>
<p>Hash + gizli açar = mesajın həm bütövlüyünü, həm də autentikliyini təsdiqləyir (API imzalarında geniş istifadə olunur).</p>
<h3>Rəqəmsal imza (addım-addım)</h3>
<ol><li>Göndərən mesajın <b>hash</b>-ini hesablayır</li><li>Hash-i öz <b>private</b> açarı ilə şifrələyir = imza</li><li>Alıcı imzanı göndərənin <b>public</b> açarı ilə açır → orijinal hash-i alır</li><li>Alıcı mesajın hash-ini özü hesablayır və müqayisə edir</li><li>Uyğun gəlirsə: mesaj dəyişməyib (bütövlük) + həqiqətən bu göndərəndir (autentifikasiya + non-repudiation)</li></ol>`},
{ title: "PKI, sertifikatlar və praktiki tətbiqlər", html: R`
<h3>PKI (Public Key Infrastructure)</h3>
<p>Rəqəmsal sertifikatların yaradılması, idarəsi və etibarını təmin edən sistem.</p>
<ul><li><b>CA (Certificate Authority)</b> — sertifikatları imzalayan etibarlı tərəf (DigiCert, Let's Encrypt). Daxili korporativ CA da ola bilər (AD CS).</li>
<li><b>Root CA → Intermediate CA → Server sertifikatı</b> — etibar zənciri (chain of trust)</li>
<li><b>CSR</b> — Certificate Signing Request</li><li><b>CRL / OCSP</b> — ləğv edilmiş sertifikatların yoxlanması</li></ul>
<h3>X.509 sertifikatı nəyi ehtiva edir</h3>
<p>Subject (kimə verilib), Issuer (kim verib), public key, etibar müddəti (valid from/to), seriya nömrəsi, SAN (Subject Alternative Names), imza.</p>
<h3>SOC baxımından sertifikatlar</h3>
<ul><li><b>Self-signed</b> sertifikat daxili test üçün normaldır, amma publik xidmətdə/C2-də şübhəlidir.</li>
<li>Yeni yaradılmış, qısa ömürlü sertifikatlar (məs. Let's Encrypt) phishing/C2-də çox görünür.</li>
<li><b>Certificate Transparency (crt.sh)</b> loglarını izləyərək öz brendinin typosquat domenlərini erkən aşkar etmək olar.</li>
<li>JA3/JA3S ilə yanaşı sertifikat barmaq izləri (JARM) C2 serverlərini tanımağa kömək edir.</li></ul>
<h3>Praktiki şifrələmə tətbiqləri</h3>
<table><tr><th>Texnologiya</th><th>Nəyi qoruyur</th></tr>
<tr><td>TLS/HTTPS</td><td>Hərəkətdə olan məlumat (in transit)</td></tr>
<tr><td>BitLocker / LUKS / FileVault</td><td>Diskdəki məlumat (at rest)</td></tr>
<tr><td>VPN (IPsec, WireGuard, OpenVPN)</td><td>Şəbəkə tuneli</td></tr>
<tr><td>PGP/GPG, S/MIME</td><td>Email</td></tr>
<tr><td>SSH</td><td>Uzaq giriş</td></tr>
<tr><td>Signal protocol</td><td>Messaging (E2EE)</td></tr></table>
<div class="note"><b>Ransomware və kriptografiya:</b> ransomware adətən hər fayl üçün simmetrik (AES) açar yaradır, sonra bu açarları hücumçunun public RSA açarı ilə şifrələyir. Ona görə private açar olmadan (yəni fidyə ödəmədən/açar tapmadan) deşifrə demək olar ki mümkün olmur — buna görə backup həyati əhəmiyyətlidir.</div>`}
],
quiz: [
{ q: "Simmetrik şifrələmənin əsas problemi nədir?", o: ["Açarın təhlükəsiz paylaşılması", "Çox yavaş olması", "Zəif olması", "Yalnız mətn şifrələməsi"], a: 0, e: "Eyni açar hər iki tərəfdə olmalıdır." },
{ q: "AES hansı növ şifrələmədir?", o: ["Simmetrik", "Asimmetrik", "Hash", "Encoding"], a: 0, e: "Simmetrik blok şifrəsi." },
{ q: "RSA hansı növ şifrələmədir?", o: ["Asimmetrik", "Simmetrik", "Hash", "Kodlaşdırma"], a: 0, e: "Public/private açar cütü." },
{ q: "Alıcıya yalnız onun oxuya biləcəyi şifrəli mesaj göndərmək üçün hansı açarı istifadə edirsən?", o: ["Alıcının public açarı", "Alıcının private açarı", "Öz private açarın", "Simmetrik açar paylaşmadan"], a: 0, e: "Yalnız alıcının private açarı aça bilər." },
{ q: "Rəqəmsal imza yaradanda hansı açarla imzalayırsan?", o: ["Öz private açarın", "Öz public açarın", "Alıcının public açarı", "CA-nın açarı"], a: 0, e: "Hər kəs sənin public açarınla yoxlayır." },
{ q: "TLS niyə hibrid (həm simmetrik, həm asimmetrik) model istifadə edir?", o: ["Asimmetrik açar mübadiləsi + sürətli simmetrik şifrələmə", "Daha çox açar lazımdır", "Qanun tələb edir", "Təsadüfən"], a: 0, e: "Hər ikisinin üstünlüyünü birləşdirir." },
{ q: "Hash funksiyasının əsas xüsusiyyəti nədir?", o: ["Birtərəfli (geri çevrilməz)", "Açarla açılır", "Base64-ə bənzəyir", "Sürəti artırır"], a: 0, e: "One-way function." },
{ q: "Hansı hash alqoritmi sınıqdır (köhnəlib)?", o: ["MD5", "SHA-256", "SHA-512", "SHA-3"], a: 0, e: "MD5 və SHA-1 kolliziyalara görə." },
{ q: "Salt nədir?", o: ["Hash-dən əvvəl parola əlavə olunan təsadüfi dəyər", "Şifrələmə açarı", "Firewall qaydası", "Sertifikat növü"], a: 0, e: "Rainbow table və eyni hash problemini həll edir." },
{ q: "HMAC nəyi təmin edir?", o: ["Mesajın bütövlüyü və autentikliyi (gizli açarla)", "Yalnız sürət", "Yalnız şifrələmə", "DNS həlli"], a: 0, e: "Hash + secret key." },
{ q: "Rəqəmsal imzanı kim yoxlaya bilər?", o: ["Göndərənin public açarına sahib hər kəs", "Yalnız göndərən", "Yalnız CA", "Heç kim"], a: 0, e: "Public açar açıqdır." },
{ q: "CA (Certificate Authority) nə edir?", o: ["Rəqəmsal sertifikatları imzalayıb etibar yaradır", "Firewall idarə edir", "Parol saxlayır", "DNS həll edir"], a: 0, e: "Etibar zəncirinin təməli." },
{ q: "'In transit' (hərəkətdə) məlumatı hansı texnologiya qoruyur?", o: ["TLS/HTTPS", "BitLocker", "Faylın silinməsi", "ZIP"], a: 0, e: "At rest üçün disk şifrələmə." },
{ q: "BitLocker nəyi şifrələyir?", o: ["Diskdəki məlumatı (at rest)", "Şəbəkə trafikini", "Email-i", "DNS sorğularını"], a: 0, e: "Full Disk Encryption." },
{ q: "Encoding (Base64) ilə encryption arasındakı əsas fərq nədir?", o: ["Encoding açar tələb etmir, hər kəs geri çevirə bilər", "Encoding daha güvənlidir", "Fərq yoxdur", "Encoding geri çevrilməz"], a: 0, e: "Base64 təhlükəsizlik vermir." },
{ q: "Ransomware deşifrə niyə çətindir?", o: ["Simmetrik açarlar hücumçunun public açarı ilə şifrələnir", "Fayllar silinir", "Disk fiziki zədələnir", "Antivirus bloklayır"], a: 0, e: "Private açar yalnız hücumçudadır." },
{ q: "crt.sh / Certificate Transparency nəyə kömək edir?", o: ["Typosquat/phishing domenlərini erkən aşkar etməyə", "Parol qırmağa", "DNS tunneling-ə", "DDoS-a"], a: 0, e: "Yeni verilən sertifikatları izləyir." },
{ q: "Hansı disk şifrələmə Linux üçündür?", o: ["LUKS", "BitLocker", "FileVault", "EFS"], a: 0, e: "BitLocker=Windows, FileVault=macOS." }
],
tasks: [
{ t: "Açar seçimi", d: R`<p>Ayxan Bəyimə həm <b>məxfi</b>, həm də onun həqiqətən səndən olduğuna <b>əmin ola biləcəyi</b> sənəd göndərmək istəyirsən.</p>`, q: "Məxfilik üçün hansı açarla şifrələyirsən? (kimin hansı açarı)", ans: ["bəyimin public", "bəyimin public açarı", "alıcının public", "recipient public", "bəyimin açıq açarı", "public açarı bəyimin"], hint: "Yalnız alıcı aça bilməlidir.", sol: "Məxfilik: sənədi <b>Bəyimin public açarı</b> ilə şifrələ (yalnız onun private açarı açar). Autentifikasiya: sənədi öz <b>private açarınla</b> imzala (Bəyim sənin public açarınla yoxlayar). Bu, 'sign-then-encrypt' prinsipidir — real dünyada GPG/S-MIME belə işləyir." },
{ t: "Hash praktikası (lab)", d: R`<p>Hash-in necə işlədiyini öz gözünlə gör.</p>`, steps: ["CyberChef-də 'MD5', 'SHA1', 'SHA256' reseptlərini sına: 'password' sözünü hash et", "'password' və 'Password' (böyük P) hash-lərini müqayisə et — tamam fərqli olmalıdır", "Eyni sözü iki dəfə hash et — eyni nəticə alırsan (deterministik)", "crackstation.net-də 'password' sözünün MD5 hash-ini axtar — tapılır (çünki zəif/salt yoxdur)", "Təsadüfi uzun parol hash-ini axtar — tapılmır"], sol: "Zəif/geniş yayılmış parolların hash-ləri onlayn 'reverse' bazalarında var — ona görə uzun, unikal parol + salt vacibdir. Bu, parol siyasətinin niyə lazım olduğunu izah edir." },
{ t: "Sertifikat yoxla (lab)", d: R`<p>Real sertifikata bax.</p>`, steps: ["Brauzerdə istənilən HTTPS sayta gir, ünvan çubuğundakı kilid işarəsinə kliklə → sertifikata bax", "Issuer (CA), Subject, Valid from/to, SAN sahələrini tap", "crt.sh saytında bir domen (məs. github.com) axtar — neçə sertifikat verilib?", "Qeyd: self-signed vs CA-signed fərqini anla"], sol: "Sertifikat təhlili həm phishing (saxta/yeni sertifikat), həm C2 aşkarlanmasında istifadə olunur. crt.sh brend monitorinqi üçün pulsuz vasitədir." }
]
}
);
})();
