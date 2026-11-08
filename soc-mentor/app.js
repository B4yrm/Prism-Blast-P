/* SOC Mentor — əsas tətbiq məntiqi */
(function () {
  "use strict";
  const D = window.SOC;
  const LEVELS = [
    { id: "L1", name: "L1 — Junior SOC Analitik", desc: "Sıfırdan başlayırıq: kompüter, OS, şəbəkə, təhlükələr, loglar, SIEM, alert triage, phishing, insident cavab. Bu səviyyəni bitirəndə ilk SOC işinə müraciət edə bilərsən." },
    { id: "L2", name: "L2 — SOC Analitik II / Incident Responder", desc: "Dərin təhqiqat: paket analizi, Windows/Linux/AD hücumlarının aşkarlanması, malware analizi əsasları, Threat Intel, detection engineering, cloud, IR playbook-ları." },
    { id: "L3", name: "L3 — Senior / Threat Hunter / DFIR", desc: "Threat hunting, disk və yaddaş forensikası, reverse engineering əsasları, purple teaming, SOC idarəçiliyi və avtomatlaşdırma." }
  ];
  const PASS = 0.8;
  const KEY = "socmentor.v1";

  // ---------- state ----------
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
  S.lessons = S.lessons || {}; S.quiz = S.quiz || {}; S.tasks = S.tasks || {}; S.exams = S.exams || {}; S.labs = S.labs || {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  try { const t = localStorage.getItem(KEY + ".theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  const $ = (s, r = document) => r.querySelector(s);
  const main = $("#main"), side = $("#sidebar");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => String(s).toLowerCase().replace(/\s+/g, " ").replace(/[“”"']/g, "").trim();

  const mods = lvl => D.modules.filter(m => m.level === lvl);
  const modById = id => D.modules.find(m => m.id === id);

  function modProgress(m) {
    let total = m.lessons.length + m.tasks.length + 1, done = 0;
    m.lessons.forEach((_, i) => { if (S.lessons[m.id + ":" + i]) done++; });
    m.tasks.forEach((_, i) => { if (S.tasks[m.id + ":" + i]) done++; });
    if ((S.quiz[m.id] || 0) >= PASS) done++;
    return total ? done / total : 0;
  }
  function lvlProgress(l) { const ms = mods(l); return ms.length ? ms.reduce((a, m) => a + modProgress(m), 0) / ms.length : 0; }
  const pct = x => Math.round(x * 100) + "%";

  // ---------- sidebar ----------
  function renderSide(activeId) {
    let h = `<div class="item ${activeId === "home" ? "active" : ""}" data-nav="home">🏠 Ana səhifə / Yol xəritəsi</div>`;
    LEVELS.forEach(L => {
      h += `<div class="grp"><span class="badge b-${L.id}">${L.id}</span> ${esc(L.name.split("—")[1] || "")} · ${pct(lvlProgress(L.id))}</div>`;
      mods(L.id).forEach((m, i) => {
        h += `<div class="item ${activeId === m.id ? "active" : ""}" data-nav="mod:${m.id}">${i + 1}. ${esc(m.title)}<span class="pct">${pct(modProgress(m))}</span></div>`;
      });
      h += `<div class="item ${activeId === "exam:" + L.id ? "active" : ""}" data-nav="exam:${L.id}">🎓 ${L.id} Yekun İmtahanı ${S.exams[L.id] ? "(" + pct(S.exams[L.id]) + ")" : ""}</div>`;
    });
    h += `<div class="grp">Əlavələr</div>
      <div class="item ${activeId === "interview" ? "active" : ""}" data-nav="interview">💼 Müsahibə sualları</div>
      <div class="item ${activeId === "lab" ? "active" : ""}" data-nav="lab">🧪 Ev laboratoriyası (Homelab)</div>
      <div class="item ${activeId === "glossary" ? "active" : ""}" data-nav="glossary">📖 Lüğət (Glossary)</div>
      <div class="item ${activeId === "resources" ? "active" : ""}" data-nav="resources">📚 Resurslar və sertifikatlar</div>
      <div class="item ${activeId === "ports" ? "active" : ""}" data-nav="ports">🔌 Port & Event ID cədvəli</div>
      <div class="item" data-nav="reset">♻️ Proqresi sıfırla</div>`;
    side.innerHTML = h;
  }

  // ---------- router ----------
  function go(route) { location.hash = route; }
  function route() {
    const r = decodeURIComponent(location.hash.slice(1)) || "home";
    side.classList.remove("open");
    window.scrollTo(0, 0);
    const [kind, a, b, c] = r.split(":");
    if (kind === "home") return home();
    if (kind === "mod") return moduleView(a, b || "lessons", c);
    if (kind === "exam") return examView(a);
    if (kind === "interview") return interview();
    if (kind === "lab") return lab();
    if (kind === "glossary") return glossary();
    if (kind === "resources") return resources();
    if (kind === "ports") return ports();
    if (kind === "search") return searchView(r.slice(7));
    home();
  }

  // ---------- home ----------
  function home() {
    renderSide("home");
    const totalLessons = D.modules.reduce((a, m) => a + m.lessons.length, 0);
    const totalQ = D.modules.reduce((a, m) => a + m.quiz.length, 0);
    const totalT = D.modules.reduce((a, m) => a + m.tasks.length, 0);
    const doneL = Object.keys(S.lessons).length, doneT = Object.keys(S.tasks).length;
    let next = null;
    outer: for (const L of LEVELS) for (const m of mods(L.id)) {
      for (let i = 0; i < m.lessons.length; i++) if (!S.lessons[m.id + ":" + i]) { next = { m, i, t: "lessons" }; break outer; }
      if ((S.quiz[m.id] || 0) < PASS) { next = { m, t: "quiz" }; break outer; }
      for (let i = 0; i < m.tasks.length; i++) if (!S.tasks[m.id + ":" + i]) { next = { m, t: "tasks" }; break outer; }
    }
    let h = `<h1>Salam! Mən sənin SOC mentorunam 🛡️</h1>
    <p>Bu proqram səni <b>sıfırdan</b> SOC analitik səviyyəsinə aparmaq üçün qurulub. Hər modulda üç hissə var:
    <b>📘 Nəzəriyyə</b> (oxu), <b>❓ Suallar</b> (keçid balı 80%) və <b>🛠️ Praktika</b> (real log/ssenari üzərində tapşırıqlar).
    Hər səviyyənin sonunda <b>Yekun İmtahan</b> var.</p>
    <div class="kv">
      <div class="stat"><b>${D.modules.length}</b>modul</div>
      <div class="stat"><b>${doneL}/${totalLessons}</b>dərs oxunub</div>
      <div class="stat"><b>${totalQ}</b>sual</div>
      <div class="stat"><b>${doneT}/${totalT}</b>praktiki tapşırıq</div>
    </div>`;
    if (next) {
      const label = next.t === "lessons" ? `Dərs: ${esc(next.m.lessons[next.i].title)}` : next.t === "quiz" ? "Modul testi" : "Praktiki tapşırıqlar";
      const rt = next.t === "lessons" ? `mod:${next.m.id}:lessons:${next.i}` : `mod:${next.m.id}:${next.t}`;
      h += `<div class="card"><b>👉 Mentorun tövsiyəsi — növbəti addım:</b><br><span class="badge b-${next.m.level}">${next.m.level}</span> ${esc(next.m.title)} → ${label}<br><button class="btn" data-nav="${rt}">Davam et</button></div>`;
    }
    h += `<h2>Yol xəritəsi</h2><div class="grid">`;
    LEVELS.forEach(L => {
      const first = mods(L.id)[0];
      h += `<div class="card lvl-card" data-nav="mod:${first ? first.id : ""}"><span class="badge b-${L.id}">${L.id}</span>
      <h3 style="margin:8px 0 4px">${esc(L.name)}</h3><p class="muted" style="font-size:14px">${esc(L.desc)}</p>
      <div class="bar"><span style="width:${pct(lvlProgress(L.id))}"></span></div><small>${pct(lvlProgress(L.id))} · ${mods(L.id).length} modul · İmtahan: ${S.exams[L.id] ? pct(S.exams[L.id]) : "—"}</small></div>`;
    });
    h += `</div>
    <h2>Necə öyrənməli? (Mentor məsləhəti)</h2>
    <div class="card"><ol>
      <li><b>Ardıcıllığı qoru.</b> L1 modullarını sıra ilə keç — hər modul əvvəlkinin üzərində qurulub.</li>
      <li><b>Hər gün 2–3 saat.</b> Gündə 1 dərs + həmin dərsin praktikası. L1 təxminən 3–5 ay, L2 6–12 ay əlavə, L3 isə illərlə təcrübə tələb edir.</li>
      <li><b>Oxumaqla kifayətlənmə.</b> "🧪 Ev laboratoriyası" bölməsindəki mühiti qur və hər əmri öz kompüterində yoxla.</li>
      <li><b>Qeyd apar.</b> Öz "SOC notebook"-unu yarat (Obsidian/Notion). Müsahibədə izah edə bilmədiyin şeyi bilmirsən.</li>
      <li><b>Testdən 80% topla.</b> Toplamadınsa, dərsə qayıt — səhv cavabların izahını mütləq oxu.</li>
      <li><b>Etika.</b> Burada öyrəndiyin hər şeyi yalnız öz laboratoriyanda və icazəli mühitdə tətbiq et. İcazəsiz sistemə müdaxilə cinayətdir (Azərbaycan Cinayət Məcəlləsi, Maddə 271–273).</li>
    </ol></div>`;
    main.innerHTML = h;
  }

  // ---------- module ----------
  function moduleView(id, tab, sub) {
    const m = modById(id); if (!m) return home();
    renderSide(id);
    const qs = S.quiz[m.id];
    let h = `<span class="badge b-${m.level}">${m.level}</span> <span class="muted">Modul</span>
      <h1>${esc(m.title)}</h1><p class="muted">${esc(m.intro || "")}</p>
      <div class="bar"><span style="width:${pct(modProgress(m))}"></span></div>
      <div class="tabs">
        <button class="tab ${tab === "lessons" ? "active" : ""}" data-nav="mod:${id}:lessons">📘 Nəzəriyyə (${m.lessons.length})</button>
        <button class="tab ${tab === "quiz" ? "active" : ""}" data-nav="mod:${id}:quiz">❓ Suallar (${m.quiz.length})${qs != null ? " · " + pct(qs) : ""}</button>
        <button class="tab ${tab === "tasks" ? "active" : ""}" data-nav="mod:${id}:tasks">🛠️ Praktika (${m.tasks.length})</button>
      </div><div id="tabbody"></div>`;
    main.innerHTML = h;
    const body = $("#tabbody");
    if (tab === "lessons") lessonsTab(m, body, sub);
    else if (tab === "quiz") quizRun(body, m.quiz, r => { S.quiz[m.id] = Math.max(S.quiz[m.id] || 0, r); save(); renderSide(m.id); }, m);
    else tasksTab(m, body);
  }

  function lessonsTab(m, body, sub) {
    if (sub == null) {
      let h = `<ol class="lesson-list">`;
      m.lessons.forEach((l, i) => { h += `<li class="${S.lessons[m.id + ":" + i] ? "done" : ""}" data-nav="mod:${m.id}:lessons:${i}"><a>${esc(l.title)}</a></li>`; });
      h += `</ol><button class="btn" data-nav="mod:${m.id}:lessons:0">Birinci dərsdən başla</button>`;
      body.innerHTML = h; return;
    }
    const i = +sub, l = m.lessons[i]; if (!l) return;
    S.lessons[m.id + ":" + i] = true; save(); renderSide(m.id);
    const idx = D.modules.indexOf(m);
    const nextMod = D.modules[idx + 1];
    body.innerHTML = `<div class="card lesson"><div class="muted" style="font-size:13px">Dərs ${i + 1}/${m.lessons.length}</div><h2>${esc(l.title)}</h2>${l.html}</div>
      <div>${i > 0 ? `<button class="btn sec" data-nav="mod:${m.id}:lessons:${i - 1}">← Əvvəlki</button>` : ""}
      ${i < m.lessons.length - 1 ? `<button class="btn" data-nav="mod:${m.id}:lessons:${i + 1}">Növbəti dərs →</button>` : `<button class="btn" data-nav="mod:${m.id}:quiz">Teste keç →</button>`}
      ${i === m.lessons.length - 1 && nextMod ? `<button class="btn sec" data-nav="mod:${nextMod.id}">Növbəti modul: ${esc(nextMod.title)}</button>` : ""}</div>`;
  }

  // ---------- quiz engine ----------
  function quizRun(body, pool, onDone, m, opts = {}) {
    if (!pool.length) { body.innerHTML = "<p>Sual yoxdur.</p>"; return; }
    const qs = shuffle(pool).slice(0, opts.limit || pool.length).map(q => {
      const order = shuffle(q.o.map((_, k) => k));
      return { ...q, order };
    });
    let i = 0, score = 0, wrong = [];
    function show() {
      if (i >= qs.length) return finish();
      const q = qs[i];
      let h = `<div class="card"><div class="muted" style="font-size:13px">Sual ${i + 1}/${qs.length} · Düzgün: ${score}</div>
        <div class="bar"><span style="width:${(i / qs.length) * 100}%"></span></div>
        <h3>${q.q}</h3>`;
      q.order.forEach(k => { h += `<button class="opt" data-k="${k}">${esc(q.o[k])}</button>`; });
      h += `<div id="exp"></div></div>`;
      body.innerHTML = h;
      body.querySelectorAll(".opt").forEach(b => b.onclick = () => {
        const k = +b.dataset.k;
        body.querySelectorAll(".opt").forEach(x => { x.disabled = true; if (+x.dataset.k === q.a) x.classList.add("correct"); });
        if (k === q.a) score++; else { b.classList.add("wrong"); wrong.push(q); }
        $("#exp", body).innerHTML = `<div class="explain">${k === q.a ? "✅ Düzdür!" : "❌ Səhvdir."} ${q.e || ""}</div>
          <button class="btn" id="nx">${i + 1 < qs.length ? "Növbəti sual →" : "Nəticəni gör"}</button>`;
        $("#nx", body).onclick = () => { i++; show(); };
      });
    }
    function finish() {
      const r = score / qs.length;
      onDone && onDone(r);
      let h = `<div class="card"><h2>Nəticə: ${score}/${qs.length} (${pct(r)})</h2>
        <p class="${r >= PASS ? "result-ok" : "result-bad"}">${r >= PASS ? "🎉 Təbriklər, keçdin! Mentor razıdır." : "Keçid balı 80%-dir. Səhvlərin izahını oxu, dərsə qayıt və yenidən cəhd et."}</p>
        <button class="btn" id="again">Yenidən başla</button>
        ${m ? `<button class="btn sec" data-nav="mod:${m.id}:tasks">Praktikaya keç →</button>` : ""}</div>`;
      if (wrong.length) {
        h += `<h3>Səhv cavab verdiyin suallar</h3>`;
        wrong.forEach(q => { h += `<div class="card"><b>${q.q}</b><br>✔ Düzgün cavab: <b>${esc(q.o[q.a])}</b><div class="explain">${q.e || ""}</div></div>`; });
      }
      body.innerHTML = h;
      $("#again", body).onclick = () => quizRun(body, pool, onDone, m, opts);
    }
    show();
  }

  // ---------- tasks ----------
  function tasksTab(m, body) {
    let h = `<p class="muted">Hər tapşırığı əvvəlcə özün həll et. Cavabı yaz və "Yoxla" düyməsini bas. Lab tapşırıqlarını öz kompüterində/laboratoriyanda icra et və addımları işarələ.</p>`;
    m.tasks.forEach((t, i) => {
      const id = m.id + ":" + i, done = S.tasks[id];
      h += `<div class="card task" data-i="${i}"><h3 style="margin-top:0">${done ? "✅" : "🛠️"} Tapşırıq ${i + 1}: ${esc(t.t)}</h3>${t.d}`;
      if (t.steps) {
        h += `<div class="checklist">`;
        t.steps.forEach((s, j) => { const sid = id + ":" + j; h += `<label><input type="checkbox" data-step="${sid}" ${S.labs[sid] ? "checked" : ""}> ${s}</label>`; });
        h += `</div>`;
      }
      if (t.ans) {
        h += `<p><b>${t.q}</b></p><input type="text" placeholder="Cavabını yaz…"><br><button class="btn chk">Yoxla</button><span class="res"></span>`;
      } else {
        h += `<button class="btn markdone">${done ? "Tamamlandı ✓" : "Tamamladım"}</button>`;
      }
      if (t.hint) h += `<details><summary>💡 İpucu</summary><div class="explain">${t.hint}</div></details>`;
      if (t.sol) h += `<details><summary>🔑 Həll və izah</summary><div class="explain">${t.sol}</div></details>`;
      h += `</div>`;
    });
    body.innerHTML = h;
    body.querySelectorAll(".task").forEach(card => {
      const i = +card.dataset.i, t = m.tasks[i], id = m.id + ":" + i;
      const chk = $(".chk", card);
      if (chk) {
        const inp = $("input[type=text]", card), res = $(".res", card);
        const check = () => {
          const v = norm(inp.value);
          const ok = t.ans.some(a => norm(a) === v);
          res.innerHTML = ok ? ' <span class="result-ok">✅ Düzdür!</span>' : ' <span class="result-bad">❌ Yox, yenidən yoxla (ipucuna bax).</span>';
          if (ok) { S.tasks[id] = true; save(); renderSide(m.id); }
        };
        chk.onclick = check; inp.onkeydown = e => { if (e.key === "Enter") check(); };
      }
      const md = $(".markdone", card);
      if (md) md.onclick = () => { S.tasks[id] = true; save(); md.textContent = "Tamamlandı ✓"; renderSide(m.id); };
      card.querySelectorAll("[data-step]").forEach(cb => cb.onchange = () => { S.labs[cb.dataset.step] = cb.checked; save(); });
    });
  }

  // ---------- exam ----------
  function examView(lvl) {
    renderSide("exam:" + lvl);
    const pool = mods(lvl).flatMap(m => m.quiz);
    const n = Math.min(50, pool.length);
    main.innerHTML = `<span class="badge b-${lvl}">${lvl}</span><h1>${lvl} Yekun İmtahanı</h1>
      <p>Bütün ${lvl} modullarından təsadüfi seçilmiş <b>${n}</b> sual. Keçid balı <b>80%</b>. Ən yaxşı nəticən: <b>${S.exams[lvl] ? pct(S.exams[lvl]) : "—"}</b></p>
      <p class="muted">Real müsahibəyə hazırlıq kimi düşün: tələsmə, hər sualı diqqətlə oxu. Hər dəfə suallar fərqli olacaq.</p>
      <button class="btn" id="start">İmtahana başla</button><div id="exbody"></div>`;
    $("#start").onclick = () => { $("#start").remove(); quizRun($("#exbody"), pool, r => { S.exams[lvl] = Math.max(S.exams[lvl] || 0, r); save(); renderSide("exam:" + lvl); }, null, { limit: n }); };
  }

  // ---------- extras ----------
  function interview() {
    renderSide("interview");
    let h = `<h1>💼 SOC Müsahibə Sualları</h1><p>Real SOC müsahibələrində tez-tez soruşulan suallar. Əvvəlcə cavabı <b>səsli</b> özün de, sonra açıb müqayisə et.</p>`;
    D.interview.forEach(sec => {
      h += `<h2>${esc(sec.title)}</h2>`;
      sec.items.forEach(([q, a]) => { h += `<details class="card"><summary>${esc(q)}</summary><div class="explain">${a}</div></details>`; });
    });
    main.innerHTML = h;
  }
  function lab() { renderSide("lab"); main.innerHTML = `<h1>🧪 Ev laboratoriyası (Homelab)</h1>` + D.lab; }
  function resources() { renderSide("resources"); main.innerHTML = `<h1>📚 Resurslar və sertifikatlar</h1>` + D.resources; }
  function ports() { renderSide("ports"); main.innerHTML = `<h1>🔌 Port və Event ID cədvəli</h1>` + D.ports; }
  function glossary() {
    renderSide("glossary");
    const items = D.glossary.slice().sort((a, b) => a[0].localeCompare(b[0]));
    let h = `<h1>📖 Lüğət</h1><input id="gf" type="search" placeholder="Termini filtrlə…" style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);color:var(--text)"><div id="gl"></div>`;
    main.innerHTML = h;
    const draw = f => { $("#gl").innerHTML = items.filter(([t, d]) => !f || norm(t + " " + d).includes(norm(f))).map(([t, d]) => `<div class="card"><b>${esc(t)}</b> — ${esc(d)}</div>`).join(""); };
    draw(""); $("#gf").oninput = e => draw(e.target.value);
  }

  // ---------- search ----------
  function searchView(qr) {
    renderSide("");
    const q = norm(qr);
    let hits = [];
    if (q.length >= 2) D.modules.forEach(m => m.lessons.forEach((l, i) => {
      const txt = l.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const p = norm(txt).indexOf(q);
      if (p >= 0 || norm(l.title).includes(q)) {
        const start = Math.max(0, p - 80);
        const snip = p >= 0 ? esc(txt.substr(start, 220)).replace(new RegExp(qr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), x => `<mark>${x}</mark>`) : "";
        hits.push(`<div class="search-hit" data-nav="mod:${m.id}:lessons:${i}"><span class="badge b-${m.level}">${m.level}</span> <b>${esc(m.title)} → ${esc(l.title)}</b><br><small class="muted">…${snip}…</small></div>`);
      }
    }));
    main.innerHTML = `<h1>Axtarış: “${esc(qr)}”</h1><p class="muted">${hits.length} nəticə</p>${hits.join("")}`;
  }

  // ---------- events ----------
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-nav]"); if (!el) return;
    const r = el.dataset.nav;
    if (r === "reset") { if (confirm("Bütün proqres silinsin?")) { S = { lessons: {}, quiz: {}, tasks: {}, exams: {}, labs: {} }; save(); home(); } return; }
    go(r);
  });
  $("#menuBtn").onclick = () => side.classList.toggle("open");
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nt = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nt; try { localStorage.setItem(KEY + ".theme", nt); } catch (e) {}
  };
  let st; $("#search").oninput = e => { clearTimeout(st); const v = e.target.value; st = setTimeout(() => { if (v.trim().length >= 2) go("search:" + v.trim()); }, 350); };
  window.addEventListener("hashchange", route);
  route();
})();
