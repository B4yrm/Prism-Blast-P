/* gen.js — prosedur sual generatoru.
   Hər çağırışda təsadüfi parametrlərlə YENİ, düzgün suallar yaradır.
   Nəticə: hər bölmədə effektiv 200+ sual, testlər demək olar təkrarlanmır.
   app.js-dən ƏVVƏL, data fayllarından SONRA yüklənir. */
window.SOC = window.SOC || { modules: [] };
(function () {
"use strict";

// ---- köməkçilər ----
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sample(pool, k, exclude) {
  const seen = new Set(), out = [];
  const ex = Array.isArray(exclude) ? exclude.map(String) : [String(exclude)];
  const sh = shuffle(pool);
  for (const v of sh) { const s = String(v); if (ex.indexOf(s) >= 0 || seen.has(s)) continue; seen.add(s); out.push(v); if (out.length >= k) break; }
  return out;
}
// correct + 3 distinct distractor → {q,o,a,e}; 3 distinct tapılmasa null (atılır)
function Q(q, correct, distractors, e) {
  const cc = String(correct), seen = new Set([cc]), d = [];
  (distractors || []).forEach(x => { const s = String(x); if (!seen.has(s)) { seen.add(s); d.push(s); } });
  if (d.length < 3) return null;
  return { q: q, o: [cc].concat(d.slice(0, 3)), a: 0, e: e || "" };
}

// ====================== MƏLUMAT CƏDVƏLLƏRİ ======================
const PORTS = [
  ["FTP", 21], ["SSH", 22], ["Telnet", 23], ["SMTP", 25], ["DNS", 53], ["DHCP", 67],
  ["HTTP", 80], ["Kerberos", 88], ["POP3", 110], ["NTP", 123], ["MSRPC", 135],
  ["NetBIOS", 139], ["IMAP", 143], ["SNMP", 161], ["LDAP", 389], ["HTTPS", 443],
  ["SMB", 445], ["Syslog", 514], ["LDAPS", 636], ["MSSQL", 1433], ["MySQL", 3306],
  ["RDP", 3389], ["VNC", 5900], ["WinRM", 5985]
];
const TCP_SVC = ["SSH", "HTTP", "HTTPS", "RDP", "SMB", "FTP", "Telnet", "SMTP", "LDAP", "MSSQL", "WinRM"];
const UDP_SVC = ["DHCP", "SNMP", "NTP", "TFTP", "Syslog"];

const EVENTS = [
  [4624, "Uğurlu logon"], [4625, "Uğursuz logon"], [4634, "Logoff"],
  [4648, "Explicit credentials ilə logon"], [4672, "Xüsusi imtiyazlar təyin edildi"],
  [4688, "Yeni proses yaradıldı"], [4697, "Servis quraşdırıldı"],
  [4698, "Scheduled task yaradıldı"], [4720, "İstifadəçi hesabı yaradıldı"],
  [4724, "Parol sıfırlama cəhdi"], [4728, "İstifadəçi qlobal qrupa əlavə edildi"],
  [4732, "İstifadəçi lokal qrupa əlavə edildi"], [4740, "Hesab bloklandı (lockout)"],
  [4768, "Kerberos TGT istəndi"], [4769, "Kerberos service ticket istəndi"],
  [4771, "Kerberos pre-auth uğursuz"], [4776, "NTLM credential yoxlanışı"],
  [4662, "Directory obyektə giriş (DCSync əlaməti)"], [1102, "Security audit logu silindi"],
  [7045, "Yeni servis quraşdırıldı (System log)"]
];
const LOGON = [
  [2, "Interactive (lokal klaviatura)"], [3, "Network (SMB/şəbəkə resursu)"],
  [4, "Batch (scheduled task)"], [5, "Service"], [7, "Unlock (ekran kilidi açılması)"],
  [8, "NetworkCleartext (parol açıq mətnlə)"], [9, "NewCredentials (runas /netonly)"],
  [10, "RemoteInteractive (RDP)"], [11, "CachedInteractive (keşlənmiş credentials)"]
];
const SYSMON = [
  [1, "Process Creation"], [3, "Network Connection"], [7, "Image/DLL Loaded"],
  [8, "CreateRemoteThread (injection)"], [10, "ProcessAccess (LSASS girişi)"],
  [11, "FileCreate"], [13, "Registry dəyəri təyini"], [15, "FileCreateStreamHash (ADS)"],
  [22, "DNS Query"]
];
const TACTICS = ["Initial Access", "Execution", "Persistence", "Privilege Escalation",
  "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
  "Collection", "Command and Control", "Exfiltration", "Impact"];
const TECH = [
  ["Phishing", "T1566", "Initial Access"], ["Exploit Public-Facing Application", "T1190", "Initial Access"],
  ["Command and Scripting Interpreter", "T1059", "Execution"], ["User Execution", "T1204", "Execution"],
  ["Boot or Logon Autostart (Run key)", "T1547", "Persistence"], ["Create Account", "T1136", "Persistence"],
  ["Exploitation for Privilege Escalation", "T1068", "Privilege Escalation"],
  ["Obfuscated Files or Information", "T1027", "Defense Evasion"], ["Masquerading", "T1036", "Defense Evasion"],
  ["Indicator Removal (log silmə)", "T1070", "Defense Evasion"],
  ["OS Credential Dumping (LSASS)", "T1003", "Credential Access"],
  ["Steal or Forge Kerberos Tickets", "T1558", "Credential Access"], ["Brute Force", "T1110", "Credential Access"],
  ["Account Discovery", "T1087", "Discovery"], ["System Information Discovery", "T1082", "Discovery"],
  ["Remote System Discovery", "T1018", "Discovery"], ["Remote Services (RDP/SMB)", "T1021", "Lateral Movement"],
  ["Data from Local System", "T1005", "Collection"], ["Application Layer Protocol (C2)", "T1071", "Command and Control"],
  ["Ingress Tool Transfer", "T1105", "Command and Control"], ["Exfiltration Over C2 Channel", "T1041", "Exfiltration"],
  ["Data Encrypted for Impact (ransomware)", "T1486", "Impact"], ["Inhibit System Recovery", "T1490", "Impact"],
  ["Service Stop", "T1489", "Impact"]
];
const MALWARE = [
  ["Faylları şifrələyib fidyə tələb edir", "Ransomware"], ["Öz-özünə şəbəkə üzrə yayılır", "Worm"],
  ["Faydalı proqram kimi görünür, arxada zərərli iş görür", "Trojan"],
  ["Klaviatura girişlərini qeyd edir", "Keylogger"], ["Kernel səviyyəsində gizlənir", "Rootkit"],
  ["Parol, cookie, kart məlumatı oğurlayır", "Infostealer (Spyware)"],
  ["Hücumçuya tam uzaq nəzarət verir", "RAT"], ["Məlumatı bərpasız məhv edir", "Wiper"],
  ["Resursları kripto çıxarmaq üçün oğurlayır", "Cryptominer"],
  ["Ələ keçirilmiş cihazlar şəbəkəsidir", "Botnet"], ["Diskə yazılmır, yaddaşda işləyir", "Fileless malware"],
  ["Əsas malware-i endirib işə salır", "Loader/Dropper"]
];
const MALTYPES = MALWARE.map(x => x[1]);
const CRYPTO = [
  ["AES", "Simmetrik"], ["ChaCha20", "Simmetrik"], ["DES", "Simmetrik"], ["3DES", "Simmetrik"],
  ["RC4", "Simmetrik"], ["Blowfish", "Simmetrik"], ["RSA", "Asimmetrik"], ["ECC", "Asimmetrik"],
  ["Diffie-Hellman", "Asimmetrik"], ["ElGamal", "Asimmetrik"], ["SHA-256", "Hash funksiyası"],
  ["MD5", "Hash funksiyası"], ["SHA-1", "Hash funksiyası"], ["bcrypt", "Hash funksiyası"]
];
const CRYPTO_CLASSES = ["Simmetrik", "Asimmetrik", "Hash funksiyası", "Encoding"];
const HTTP = [
  [200, "OK (uğurlu)"], [301, "Daimi yönləndirmə"], [302, "Müvəqqəti yönləndirmə"],
  [304, "Not Modified"], [400, "Bad Request"], [401, "Unauthorized (autentifikasiya lazım)"],
  [403, "Forbidden (icazə yoxdur)"], [404, "Not Found"], [429, "Too Many Requests"],
  [500, "Internal Server Error"], [502, "Bad Gateway"], [503, "Service Unavailable"]
];

// ====================== GENERATORLAR ======================
// --- subnetting (prefix 25-30, yalnız son oktet dəyişir) ---
function subBase() {
  const prefixes = [25, 26, 27, 28, 29, 30];
  const p = pick(prefixes), block = Math.pow(2, 32 - p);
  const o1 = pick([10, 172, 192]);
  const o2 = o1 === 192 ? 168 : (o1 === 172 ? rnd(16, 31) : rnd(0, 255));
  const o3 = rnd(0, 255), host = rnd(1, 254);
  const net = host - (host % block), bcast = net + block - 1, hosts = block - 2;
  const base = o1 + "." + o2 + "." + o3 + ".";
  return { p, block, base, host, net, bcast, hosts };
}
function genSubnetNetwork() {
  const s = subBase();
  const dist = [s.base + s.bcast, s.base + s.host, s.base + Math.min(255, s.net + s.block)];
  return Q(s.base + s.host + "/" + s.p + " hostunun şəbəkə (network) ünvanı nədir?", s.base + s.net, dist,
    "/" + s.p + " blok ölçüsü " + s.block + ": network = ən yaxın aşağı sərhəd (" + s.base + s.net + ").");
}
function genSubnetBroadcast() {
  const s = subBase();
  const dist = [s.base + s.net, s.base + s.host, s.base + Math.max(0, s.bcast - 1)];
  return Q(s.base + s.host + "/" + s.p + " hostunun broadcast ünvanı nədir?", s.base + s.bcast, dist,
    "Broadcast = network + blok − 1 = " + s.base + s.bcast + ".");
}
function genSubnetHosts() {
  const s = subBase();
  const dist = [s.block, s.block - 1, Math.max(1, s.hosts - 2)];
  return Q("/" + s.p + " şəbəkədə neçə istifadə edilə bilən host var?", s.hosts, dist,
    "2^(32−" + s.p + ") − 2 = " + s.hosts + " (network və broadcast çıxılır).");
}
function genCidrMask() {
  const map = { 24: "255.255.255.0", 25: "255.255.255.128", 26: "255.255.255.192", 27: "255.255.255.224", 28: "255.255.255.240", 29: "255.255.255.248", 30: "255.255.255.252", 16: "255.255.0.0", 8: "255.0.0.0" };
  const keys = Object.keys(map), p = pick(keys);
  const dist = sample(Object.values(map), 3, map[p]);
  return Q("/" + p + " prefiksinin subnet maskı hansıdır?", map[p], dist, "/" + p + " = " + map[p] + ".");
}
function genPrivatePublic() {
  let ip, priv;
  if (Math.random() < 0.5) {
    priv = true;
    const t = rnd(0, 2);
    ip = t === 0 ? "10." + rnd(0, 255) + "." + rnd(0, 255) + "." + rnd(1, 254)
      : t === 1 ? "172." + rnd(16, 31) + "." + rnd(0, 255) + "." + rnd(1, 254)
        : "192.168." + rnd(0, 255) + "." + rnd(1, 254);
  } else {
    priv = false;
    ip = pick([rnd(1, 9), rnd(173, 199), 8, 1, rnd(200, 223)]) + "." + rnd(0, 255) + "." + rnd(0, 255) + "." + rnd(1, 254);
    if (ip.indexOf("192.168") === 0 || ip.indexOf("10.") === 0) ip = "8.8." + rnd(0, 255) + "." + rnd(1, 254);
  }
  return Q(ip + " ünvanı hansı kateqoriyadır?", priv ? "Private (RFC 1918)" : "Public",
    priv ? ["Public", "Loopback", "Multicast"] : ["Private (RFC 1918)", "APIPA (link-local)", "Loopback"],
    priv ? "RFC 1918 private diapazonları: 10/8, 172.16/12, 192.168/16." : "RFC 1918-dən kənar = public.");
}
function genTtlOs() {
  const t = pick([[64, "Linux / macOS"], [128, "Windows"], [255, "Şəbəkə cihazı (router/switch)"]]);
  return Q("Paketdə default TTL=" + t[0] + " görürsən. Göndərən ehtimal ki hansıdır?", t[1],
    sample(["Linux / macOS", "Windows", "Şəbəkə cihazı (router/switch)", "iOS cihazı"], 3, t[1]),
    "Default TTL: Linux/macOS 64, Windows 128, şəbəkə cihazları çox vaxt 255.");
}

// --- rəqəm sistemləri ---
const H = x => "0x" + (((x % 256) + 256) % 256).toString(16).toUpperCase().padStart(2, "0");
const B = x => (((x % 256) + 256) % 256).toString(2).padStart(8, "0");
function genHex2Dec() { const n = rnd(0, 255); return Q("Hex " + H(n) + " decimal-da neçədir?", n, sample([n + 1, n - 1, (n + 16) % 256, (n + 2) % 256, Math.abs(n - 16), (n + 32) % 256, Math.abs(n - 2)], 3, n), H(n) + " = " + n + " (10-luq)."); }
function genDec2Hex() { const n = rnd(0, 255), h = H(n); return Q("Decimal " + n + " hex-də necədir?", h, sample([n + 1, n - 1, n + 2, n - 2, n + 16, n - 16, n + 32].map(H), 3, h), n + " = " + h + "."); }
function genBin2Dec() { const n = rnd(0, 255); return Q("İkilik (binary) " + B(n) + " decimal-da neçədir?", n, sample([n + 1, n - 1, n + 2, n - 2, n + 4, n - 4, n + 8], 3, n), B(n) + " = " + n + "."); }
function genDec2Bin() { const n = rnd(0, 255), b = B(n); return Q("Decimal " + n + " 8-bitlik binary-də necədir?", b, sample([n + 1, n - 1, n + 2, n - 2, n + 4, n - 4, n + 8].map(B), 3, b), n + " = " + b + "."); }
function genByteBit() { const n = rnd(1, 8); return Q(n + " byte neçə bitdir?", n * 8, sample([n * 4, n * 2, n * 16, n * 8 + 8], 3, n * 8), "1 byte = 8 bit, ona görə " + n + "×8 = " + n * 8 + "."); }

// --- portlar ---
function genPortToService() { const p = pick(PORTS); return Q("Port " + p[1] + " hansı xidmətə aiddir?", p[0], sample(PORTS.map(x => x[0]), 3, p[0]), p[0] + " = port " + p[1] + "."); }
function genServiceToPort() { const p = pick(PORTS); return Q(p[0] + " hansı portdan istifadə edir?", p[1], sample(PORTS.map(x => x[1]), 3, p[1]), p[0] + " = port " + p[1] + "."); }
function genTcpUdp() {
  const useTcp = Math.random() < 0.5, svc = useTcp ? pick(TCP_SVC) : pick(UDP_SVC);
  return Q(svc + " əsasən hansı transport protokolundan istifadə edir?", useTcp ? "TCP" : "UDP", useTcp ? ["UDP", "ICMP", "ARP"] : ["TCP", "ICMP", "ARP"], svc + " = " + (useTcp ? "TCP (etibarlı, bağlantı-yönümlü)" : "UDP (sürətli, bağlantısız)") + ".");
}
function genHttpStatus() {
  const h = pick(HTTP);
  if (Math.random() < 0.5) return Q("HTTP status kodu " + h[0] + " nə deməkdir?", h[1], sample(HTTP.map(x => x[1]), 3, h[1]), h[0] + " = " + h[1] + ".");
  return Q("'" + h[1] + "' hansı HTTP status kodudur?", h[0], sample(HTTP.map(x => x[0]), 3, h[0]), h[1] + " = " + h[0] + ".");
}

// --- Windows Event ID / Logon / Sysmon ---
function genEventMeaning() { const e = pick(EVENTS); return Q("Windows Event ID " + e[0] + " nəyi bildirir?", e[1], sample(EVENTS.map(x => x[1]), 3, e[1]), "Event " + e[0] + " = " + e[1] + "."); }
function genMeaningEvent() { const e = pick(EVENTS); return Q("'" + e[1] + "' hansı Windows Event ID-dir?", e[0], sample(EVENTS.map(x => x[0]), 3, e[0]), e[1] + " = Event " + e[0] + "."); }
function genLogon() {
  const l = pick(LOGON);
  if (Math.random() < 0.5) return Q("4624/4625-də Logon Type " + l[0] + " nə deməkdir?", l[1], sample(LOGON.map(x => x[1]), 3, l[1]), "Type " + l[0] + " = " + l[1] + ".");
  return Q("'" + l[1] + "' hansı Logon Type-dır?", l[0], sample(LOGON.map(x => x[0]), 3, l[0]), l[1] + " = Type " + l[0] + ".");
}
function genSysmon() { const s = pick(SYSMON); return Q("Sysmon Event ID " + s[0] + " nəyi qeyd edir?", s[1], sample(SYSMON.map(x => x[1]), 3, s[1]), "Sysmon " + s[0] + " = " + s[1] + "."); }

// --- Linux chmod ---
const PERM = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
function genChmod() {
  const a = rnd(0, 7), b = rnd(0, 7), c = rnd(0, 7), rwx = PERM[a] + PERM[b] + PERM[c];
  const dist = sample([0, 1, 2, 3, 4, 5, 6, 7].flatMap(() => [PERM[rnd(0, 7)] + PERM[rnd(0, 7)] + PERM[rnd(0, 7)]]), 3, rwx);
  return Q("chmod " + a + "" + b + "" + c + " hansı icazələri verir (owner/group/other)?", rwx, dist, a + "=" + PERM[a] + ", " + b + "=" + PERM[b] + ", " + c + "=" + PERM[c] + " (r=4, w=2, x=1).");
}
function genChmodReverse() {
  const a = rnd(0, 7), b = rnd(0, 7), c = rnd(0, 7), rwx = PERM[a] + PERM[b] + PERM[c], oct = "" + a + b + c;
  const dist = sample([0, 1, 2, 3, 4, 5, 6, 7].map(() => "" + rnd(0, 7) + rnd(0, 7) + rnd(0, 7)), 3, oct);
  return Q("'" + rwx + "' icazələri hansı oktal chmod dəyəridir?", oct, dist, rwx + " = " + oct + " (r=4, w=2, x=1).");
}

// --- ATT&CK / malware / crypto ---
function genAttackTactic() { const t = pick(TECH); return Q(t[0] + " (" + t[1] + ") hansı ATT&CK taktikasıdır?", t[2], sample(TACTICS, 3, t[2]), t[1] + " = " + t[2] + "."); }
function genMalwareType() { const m = pick(MALWARE); return Q("Bu təsvir hansı malware növüdür? \"" + m[0] + "\"", m[1], sample(MALTYPES, 3, m[1]), m[0] + " → " + m[1] + "."); }
function genSymAsym() { const c = pick(CRYPTO); return Q(c[0] + " hansı kateqoriyaya aiddir?", c[1], sample(CRYPTO_CLASSES, 3, c[1]), c[0] + " = " + c[1] + "."); }
function genHashLen() { const h = pick([["SHA-256", 256], ["SHA-1", 160], ["MD5", 128], ["SHA-512", 512]]); return Q(h[0] + " neçə bitlik hash verir?", h[1], sample([128, 160, 256, 512], 3, h[1]), h[0] + " = " + h[1] + " bit."); }

// --- risk / CVSS ---
function genCvss() {
  const score = (rnd(1, 100) / 10).toFixed(1);
  const s = parseFloat(score);
  const band = s >= 9 ? "Critical" : s >= 7 ? "High" : s >= 4 ? "Medium" : "Low";
  return Q("CVSS v3 balı " + score + " hansı ciddilik kateqoriyasıdır?", band, sample(["Low", "Medium", "High", "Critical"], 3, band), "0.1–3.9 Low, 4.0–6.9 Medium, 7.0–8.9 High, 9.0–10.0 Critical.");
}
function genRiskMatrix() { const p = rnd(1, 5), i = rnd(1, 5), r = p * i; return Q("Ehtimal=" + p + ", Təsir=" + i + " olarsa, risk balı (Ehtimal × Təsir) neçədir?", r, sample([r + 1, r - 1, r + 2, r - 2, r + 3, r + 5, p + i], 3, r), "Risk = Ehtimal × Təsir = " + p + "×" + i + " = " + r + "."); }
function genRiskALE() { const sle = rnd(1, 50) * 1000, aro = rnd(1, 10), ale = sle * aro; return Q("SLE=" + sle + " AZN, ARO=" + aro + " olarsa, ALE (illik gözlənilən itki) neçədir?", ale + " AZN", sample([ale + sle, ale + 1000, Math.max(1000, ale - sle), ale * 2, ale + 2000, sle + aro].map(x => x + " AZN"), 3, ale + " AZN"), "ALE = SLE × ARO = " + sle + " × " + aro + " = " + ale + " AZN."); }

// --- lüğət (universal doldurucu) ---
function genGlossaryTD() {
  const g = window.SOC.glossary; if (!g || !g.length) return null;
  const it = pick(g);
  return Q("\"" + it[0] + "\" nə deməkdir?", it[1], sample(g.map(x => x[1]), 3, it[1]), it[0] + ".");
}
function genGlossaryDT() {
  const g = window.SOC.glossary; if (!g || !g.length) return null;
  const it = pick(g);
  return Q("Bu tərif hansı termini təsvir edir? \"" + it[1] + "\"", it[0], sample(g.map(x => x[0]), 3, it[0]), it[0] + " — " + it[1]);
}

// ====================== MODUL → GENERATOR XƏRİTƏSİ ======================
const REG = {
  "l1-intro": [genCvss, genRiskMatrix, genRiskALE, genAttackTactic],
  "l1-os": [genHex2Dec, genDec2Hex, genBin2Dec, genDec2Bin, genByteBit],
  "l1-windows": [genEventMeaning, genMeaningEvent, genLogon, genSysmon],
  "l1-linux": [genChmod, genChmodReverse, genAttackTactic],
  "l1-net1": [genSubnetNetwork, genSubnetBroadcast, genSubnetHosts, genCidrMask, genPrivatePublic, genTtlOs, genHex2Dec],
  "l1-net2": [genPortToService, genServiceToPort, genTcpUdp, genHttpStatus],
  "l1-threats": [genAttackTactic, genMalwareType],
  "l1-crypto": [genSymAsym, genHashLen],
  "l1-logging": [genEventMeaning, genSysmon, genMeaningEvent],
  "l1-triage": [genAttackTactic, genPortToService, genMalwareType],
  "l1-ir-endpoint": [genAttackTactic, genEventMeaning],
  "l2-pcap": [genPortToService, genTcpUdp, genAttackTactic, genHttpStatus],
  "l2-ad": [genEventMeaning, genMeaningEvent, genLogon, genAttackTactic],
  "l2-linuxweb": [genHttpStatus, genChmod, genAttackTactic],
  "l2-malware": [genAttackTactic, genSymAsym, genMalwareType],
  "l2-ti": [genAttackTactic, genMalwareType],
  "l2-detection": [genAttackTactic, genEventMeaning, genSysmon],
  "l2-ir-phishing": [genAttackTactic, genHttpStatus],
  "l3-hunting": [genAttackTactic, genEventMeaning, genSysmon],
  "l3-dfir": [genAttackTactic, genSysmon, genEventMeaning],
  "l3-re": [genAttackTactic, genHex2Dec, genHashLen],
  "l3-leadership": [genAttackTactic, genMalwareType]
};

function generate(moduleId, n) {
  let gens = (REG[moduleId] || []).slice();
  gens = gens.concat([genGlossaryTD, genGlossaryDT]); // hər modula lüğət doldurucusu
  const out = [], seen = new Set();
  let guard = 0, i = 0;
  while (out.length < n && guard < n * 12) {
    guard++;
    const g = gens[i % gens.length]; i++;
    let q; try { q = g(); } catch (e) { continue; }
    if (!q || !q.q || !q.o || q.o.length < 2) continue;
    if (seen.has(q.q)) continue;
    // variant təkrarı olmasın
    if (new Set(q.o.map(String)).size < q.o.length) continue;
    seen.add(q.q); out.push(q);
  }
  return out;
}

window.SOC.gens = { generate: generate, has: function (id) { return true; } };
})();
