// DOM interface: HUD, side rail, dock, building labels, sheets and modals.
import { BINFO, TRACKS, TIER, RESEARCH, SHOP, MISSIONS, ACHIEVEMENTS, DAILY, STAGES, BOAT_COST, FREE_CHEST_EVERY, fmt } from '../data/defs.js';
import { BUILDINGS } from '../config.js';
import {
  G, stat, trackCost, trackMax, buyTrack, tierInfo, buyTier, hire, hireCost, buyBoat, boatCost, xpNeed, addMoney, addGems, spend,
  currentMission, claimMission, achState, claimAch, anyAchReady, startResearch, finishResearchIfDone, rushCost, steadyRate, stage, reward,
} from '../core/economy.js';
import { bus } from '../core/bus.js';
import { sfx, buzz, unlockAudio } from '../core/audio.js';
import { save, wipe, snapshot } from '../core/state.js';
import { icon, hydrateIcons } from './icons.js';

const $ = id => document.getElementById(id);
const money = n => '$' + fmt(n);
const S = () => G.S;
const ORDER = ['harbor', 'warehouse', 'factory', 'market', 'hq', 'farm'];

let openName = null, holdRender = false, lastSig = '';

export function initUI() {
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  // global open buttons
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { sfx.click(); open(b.dataset.open); }));
  $('pclose').addEventListener('click', close);
  // ignore a scrim tap right after opening (the second half of a quick double tap)
  $('scrim').addEventListener('click', () => { if (performance.now() - openedAt > 400) close(); });
  $('collect').addEventListener('click', collect);
  const pb = $('pbody');
  pb.addEventListener('pointerdown', () => { holdRender = true; });
  window.addEventListener('pointerup', () => setTimeout(() => { holdRender = false; }, 80));
  pb.addEventListener('click', onPanelClick);
  hydrateIcons();
  // mission: a small chip by default; tap to expand, × to collapse
  $('mission').addEventListener('click', e => {
    const s = S();
    if (e.target.closest('[data-act="claimMission"]')) { if (claimMission()) { sfx.coin(); buzz(); toast('Missiya tamamlandı!', 'good'); } return; }
    if (e.target.closest('[data-act="missionClose"]')) { s.settings.missionOpen = false; }
    else if (e.target.closest('[data-act="missionAll"]')) { open('missions'); return; }
    else if (!s.settings.missionOpen) { s.settings.missionOpen = true; }
    else return;
    console.log('UI mission ' + (s.settings.missionOpen ? 'open' : 'mini'));
    sfx.click(); $('mission').dataset.sig = ''; tick();
  });
  // collapsible left rail (closes again after picking an item)
  const side = $('side'), tog = $('sideTog');
  const setSide = o => { console.log('UI rail ' + (o ? 'open' : 'closed')); side.classList.toggle('closed', !o); tog.setAttribute('aria-expanded', o); tog.innerHTML = icon(o ? 'close' : 'menu'); tog.appendChild(dotSide); dotSide.style.visibility = o ? 'hidden' : ''; };
  const dotSide = $('dotSide');
  tog.addEventListener('click', () => { sfx.click(); setSide(side.classList.contains('closed')); });
  side.querySelectorAll('.items button').forEach(b => b.addEventListener('click', () => setSide(false)));
  $('recenter').addEventListener('click', () => { console.log('UI recenter'); sfx.click(); G.world && G.world.recenter(); });
  $('mcard').addEventListener('click', onModalClick);

  makeLabels();
  // labels let drags through to the map; a tap on a label opens its building
  G.labelAt = (x, y) => {
    for (const id of ORDER) {
      const r = labels[id].getBoundingClientRect();
      if (labels[id].style.visibility !== 'hidden' && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  };
  bus.on('frame', placeLabels);
  bus.on('tapBuilding', id => { sfx.click(); open('b:' + id); G.world.focus(id); });
  bus.on('toast', e => toast(e.t, e.warn ? 'warn' : ''));
  bus.on('levelup', l => { sfx.level(); buzz(40); log(`Səviyyə ${l}! +${3 + l} almaz`, 'star'); showModal('level', l); });
  bus.on('tier', ({ b, tier }) => { sfx.tier(); log(`${BINFO[b].name} → Lv. ${tier}`, 'b_' + b); });
  bus.on('research', e => { if (e && e.done) { const r = RESEARCH.find(x => x.id === e.done); toast(`Tədqiqat bitdi: ${r.name}`, 'good'); log(`${r.name} hazırdır`, 'research'); sfx.tier(); } });
  bus.on('horn', () => { if (Math.random() < 0.3) sfx.horn(); });
  bus.on('collect', e => { if (!e.auto) { sfx.coin(); flyCoins(); } });
  bus.on('mission', () => log('Missiya tamamlandı', 'missions'));

  setInterval(tick, 250);
  setInterval(() => save(S()), 5000);
  const persist = () => { save(S()); console.log('SAVED ' + JSON.stringify(snapshot(S()))); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);
  tick();
}

// ---------------------------------------------------------------- HUD tick
function tick() {
  const s = S();
  finishResearchIfDone();
  $('money').textContent = money(s.money);
  $('gems').textContent = fmt(s.gems);
  $('fishn').textContent = fmt(s.stock.wh + s.stock.quay);
  $('lvl').textContent = s.level;
  const need = xpNeed(s.level);
  $('xpfill').style.width = Math.min(100, s.xp / need * 100) + '%';
  const ipm = G.sim ? G.sim.incomePerMin() : 0;
  $('ipm').textContent = '+' + money(ipm);
  const m = currentMission();
  // collect button
  const reg = Math.floor(s.register), cap = stat.tillCap();
  $('regamt').textContent = `${money(reg)} / ${money(cap)}`;
  $('dotSide').classList.toggle('on', (m && m.done) || dailyReady() || anyAchReady() || s.logUnread > 0);
  $('collect').classList.toggle('ready', reg >= Math.max(20, cap * 0.25));
  $('collect').classList.toggle('full', reg >= cap);
  // badges
  setDot('dotMis', m && m.done);
  setDot('dotDaily', dailyReady());
  setDot('dotAch', anyAchReady());
  setDot('dotRes', !s.research.active && RESEARCH.some(r => (s.research.lv[r.id] || 0) < r.cost.length && s.money >= r.cost[s.research.lv[r.id] || 0]));
  setDot('dotShop', Date.now() >= s.freeChestAt);
  setDot('dotUp', ORDER.some(b => affordable(b)));
  setDot('dotLog', s.logUnread > 0, s.logUnread);
  renderMission(m);
  updateLabels();
  if (openName && !holdRender) renderPanel();
}
function setDot(id, on, n) { const d = $(id); d.classList.toggle('on', !!on); d.textContent = n ? Math.min(9, n) : ''; }

function affordable(b) {
  const s = S();
  if (!s.tier[b]) { const ti = tierInfo(b); return ti && s.level >= ti.lvl && s.money >= ti.cost; }
  if (TRACKS[b].some(tr => s.up[b][tr.id] < trackMax(b) && s.money >= trackCost(b, tr))) return true;
  const ti = tierInfo(b);
  return !!(ti && s.level >= ti.lvl && s.money >= ti.cost);
}

function renderMission(m) {
  const el = $('mission'), openCard = !!S().settings.missionOpen;
  const sig = (m ? `${S().mission}|${m.v}|${m.done}` : 'none') + '|' + openCard;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  el.className = openCard ? 'open' : 'mini' + (m && m.done ? ' ready' : '');
  if (!m) { el.innerHTML = openCard ? `<div class="mh"><span class="mi">${icon('target')}</span><h3>Bütün missiyalar bitdi</h3><button class="mx" data-act="missionClose" aria-label="Kiçilt">${icon('up')}</button></div><span class="rw">Yeniləri növbəti yeniləmədə</span>` : `<span class="mi">${icon('target')}</span><span class="mt">Missiyalar bitdi</span>`; return; }
  const rw = [m.r.c ? money(m.r.c) : '', m.r.g ? m.r.g + ' almaz' : ''].filter(Boolean).join(' + ');
  if (!openCard) {
    el.innerHTML = `<span class="mi">${icon('target')}</span><span class="mt">${m.t}</span>
      <span class="mbar"><i style="width:${m.v / m.n * 100}%"></i></span><span class="mn">${m.done ? 'Al!' : `${fmt(m.v)}/${fmt(m.n)}`}</span>`;
    el.setAttribute('aria-label', 'Missiya: ' + m.t);
    return;
  }
  el.innerHTML = `<div class="mh"><span class="mi">${icon('target')}</span><h3>${m.t}</h3><button class="mx" data-act="missionClose" aria-label="Kiçilt">${icon('up')}</button></div>
    <div class="bar"><i style="width:${m.v / m.n * 100}%"></i><em>${fmt(m.v)} / ${fmt(m.n)}</em></div>
    <span class="rw">Mükafat: ${rw}</span>
    ${m.done ? '<button class="btn gold" data-act="claimMission">Mükafatı al</button>' : '<button class="btn blue" data-act="missionAll">Bütün missiyalar</button>'}`;
}

// --------------------------------------------------------- building labels
const labels = {};
const LABEL_Z = { hq: 70, factory: 70, farm: 30, market: 52, warehouse: 50, harbor: 40 };
function makeLabels() {
  const root = $('labels');
  for (const id of ORDER) {
    const el = document.createElement('div');
    el.className = 'blabel';
    el.innerHTML = `<span class="bi">${icon('b_' + id)}</span><span class="tx"><b>${BINFO[id].name}</b><small></small></span><span class="up">${icon('arrowUp')}</span>`;
    root.appendChild(el);
    labels[id] = el;
  }
}
function updateLabels() {
  const s = S();
  for (const id of ORDER) {
    const el = labels[id], t = s.tier[id];
    el.querySelector('small').textContent = t ? `Lv. ${t}` : (id === 'farm' ? 'Mərhələ 3' : 'Tikilməyib');
    el.classList.toggle('locked', !t);
    el.classList.toggle('can', affordable(id));
  }
}
// Labels: full name plates when zoomed in, small icon badges when zoomed out,
// and never stacked on top of each other or under the HUD / dock.
let labelsFar = true, uiRects = null, uiRectsT = 0;
const LABEL_PRIO = ['market', 'warehouse', 'harbor', 'factory', 'hq', 'farm'];
function placeLabels() {
  const w = G.world; if (!w) return;
  const cam = w.cameras.main, z = cam.zoom / G.quality.dpr;
  labelsFar = labelsFar ? z < 0.54 : z < 0.46;          // hysteresis: no flicker at the threshold
  const far = labelsFar;
  const sc = far ? Math.max(0.85, Math.min(1, z * 2)) : Math.max(0.8, Math.min(1.05, z * 1.1));
  const W = innerWidth, H = innerHeight, taken = [];
  if (!uiRects || uiRectsT++ % 15 === 0) uiRects = [$('hud'), $('dock'), $('collect'), $('mission'), $('side')].map(e => e.getBoundingClientRect());
  const blocked = uiRects;
  for (const id of LABEL_PRIO) {
    const d = BUILDINGS[id], el = labels[id];
    const p = w.worldToScreen(d.x + d.w / 2, d.y + d.d / 2, LABEL_Z[id] + 40);
    el.classList.toggle('far', far);
    const lw = (far ? 30 : 150) * sc, lh = (far ? 30 : 32) * sc;
    const r = { left: p.x - lw / 2, right: p.x + lw / 2, top: p.y - lh, bottom: p.y };
    const hit = q => !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom);
    const vis = p.x > -60 && p.x < W + 60 && p.y > 0 && p.y < H + 30 && !taken.some(hit) && !blocked.some(hit);
    el.style.visibility = vis ? 'visible' : 'hidden';
    if (vis) { taken.push(r); el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%) scale(${sc.toFixed(3)})`; }
  }
}

// ------------------------------------------------------------------- panel
let openedAt = 0;
function open(name) {
  openName = name; lastSig = ''; openedAt = performance.now();
  console.log('UI open ' + name);
  $('panel').hidden = false; $('scrim').hidden = false;
  if (name === 'log') { S().logUnread = 0; }
  renderPanel(true);
  $('pbody').scrollTop = 0;
}
function close() {
  console.log('UI close ' + openName);
  openName = null;
  $('panel').hidden = true; $('scrim').hidden = true;
}

function renderPanel(force) {
  const r = VIEWS[openName.startsWith('b:') ? 'building' : openName]?.(openName.slice(2));
  if (!r) return;
  const html = r.body;
  if (!force && html === lastSig) return;
  lastSig = html;
  $('pico').innerHTML = icon(r.ic || PANEL_IC[openName] || 'menu'); $('ptitle').textContent = r.title; $('psub').textContent = r.sub || '';
  $('pbody').innerHTML = html;
}

const ri = name => `<span class="ri">${icon(name)}</span>`;
const PANEL_IC = { upgrades: 'upgrade', workers: 'workers', boats: 'boats', research: 'research', shop: 'shop', missions: 'missions', daily: 'daily', ach: 'trophy', log: 'bell', map: 'map', settings: 'gear' };
const bar = (v, max, cls = '', label) => `<div class="bar"><i class="${cls}" style="width:${Math.min(100, max ? v / max * 100 : 0)}%"></i><em>${label ?? `${fmt(v)} / ${fmt(max)}`}</em></div>`;
const statBox = (label, val, extra = '') => `<div class="stat"><small>${label}</small><b>${val}</b>${extra}</div>`;
const pips = (n, max) => `<span class="pips">${Array.from({ length: Math.min(max, 10) }, (_, i) => `<i class="${i < Math.round(n / max * Math.min(max, 10)) ? 'on' : ''}"></i>`).join('')}</span>`;

function trackRows(b) {
  const s = S(), max = trackMax(b);
  return TRACKS[b].map(tr => {
    const l = s.up[b][tr.id], c = trackCost(b, tr), done = l >= max;
    return `<div class="row">${ri(tr.icon)}
      <span class="rt"><b>${tr.name} <span class="lv">Lv ${l}/${max}</span></b>
      <small>${tr.fx(l)}${done ? '' : ` → <span class="fx">${tr.fx(l + 1)}</span>`}</small></span>
      <button class="btn" data-act="track" data-b="${b}" data-t="${tr.id}" ${done || s.money < c ? 'disabled' : ''}>${done ? 'MAKS' : money(c)}</button></div>`;
  }).join('');
}
function tierCard(b) {
  const s = S(), ti = tierInfo(b);
  if (!ti) return `<div class="tier"><span><b>Maksimum səviyyə</b><small>${BINFO[b].name} tam genişlənib</small></span><span class="tic">${icon('trophy')}</span></div>`;
  const lock = s.level < ti.lvl;
  const what = s.tier[b] ? `Genişləndir → Lv. ${ti.next}` : 'Tik';
  const gain = s.tier[b] ? `Bütün təkmilləşdirmə limitləri ${10 * ti.next}-ə qalxır, bina böyüyür` : BINFO[b].desc;
  return `<div class="tier"><span><b>${what}</b><small>${lock ? `${icon('lock', 'ii')} Oyunçu Lv ${ti.lvl} lazımdır` : gain}</small></span>
    <button class="btn gold" data-act="tier" data-b="${b}" ${lock || s.money < ti.cost ? 'disabled' : ''}>${money(ti.cost)}</button></div>`;
}

const BOAT_STATE = { dock: 'Limanda', out: 'Dənizə gedir', fish: 'Balıq tutur', back: 'Qayıdır' };
const WORK_STATE = { idle: 'Gözləyir', toRest: 'Ofisə qayıdır', toSrc: 'Yük götürməyə gedir', pick: 'Yükləyir', toDst: 'Daşıyır', drop: 'Boşaldır' };
const PLACE = { quay: 'iskələ', wh: 'anbar', facOut: 'zavod', mRaw: 'bazar', mProd: 'bazar' };

function boatRows() {
  const sim = G.sim;
  return sim.boats.map((b, i) => {
    let p = b.state === 'fish' ? 1 - Math.max(0, b.t) / stat.fishTime() : b.state === 'dock' ? (b.load ? 1 - b.load / stat.boatCap() : 1) : b.m.path ? b.m.idx / b.m.path.length : 0;
    // The label says what the boat on screen is doing (it can be a second ahead of or behind the simulation's
    // clock); load and catch are the simulation's own numbers.
    const seen = G.world && G.world.fleet && G.world.fleet.shownState ? G.world.fleet.shownState(b) : b.state;
    if (seen !== b.state) p = seen === 'back' ? 0.97 : seen === 'out' ? 0.03 : p;
    // a boat still coming in (the simulation already unloads it): the panel shows the full hold it is bringing
    const shownLoad = seen === 'back' && b.state === 'dock' ? (b.cap || stat.boatCap()) : b.load;
    return `<div class="row">${ri('boats')}<span class="rt"><b>Qayıq #${i + 1} · ${BOAT_STATE[seen]}${b.blocked ? ' · iskələ dolub!' : ''}</b>
      <small>Yük: ${fmt(shownLoad)} / ${stat.boatCap()} balıq</small>${bar(p * 100, 100, 'blue', b.state === 'fish' && seen === 'fish' ? Math.ceil(Math.max(0, b.t)) + ' s' : '')}</span><span></span></div>`;
  }).join('');
}

const VIEWS = {
  building(id) {
    const s = S(), info = BINFO[id], t = s.tier[id], st = s.stock;
    let body = `<p class="desc">${info.desc}</p>`;
    if (id === 'farm') {
      body += `<div class="tier"><span><b>${icon('lock', 'ii')} Mərhələ 3</b><small>Balıq fermaları növbəti yeniləmədə açılacaq.</small></span><span class="tic">${icon('b_farm')}</span></div>`;
      return { ic: 'b_' + id, title: info.name, sub: 'Bağlıdır', body };
    }
    if (!t) {
      body += tierCard(id);
      if (id === 'factory') body += `<p class="note">Zavod anbardakı balığı konveyerlə götürür və 3 dəfə baha satılan qablaşdırılmış məhsul çıxarır.</p>`;
      return { ic: 'b_' + id, title: info.name, sub: 'Tikilməyib', body };
    }
    if (id === 'harbor') {
      body += `<div class="stats">${statBox('Qayıqlar', `${s.boats} / ${stat.maxBoats()}`)}${statBox('Tutum', stat.boatCap() + ' balıq')}${statBox('Sürət', stat.boatSpeed().toFixed(1) + ' kv/s')}${statBox('Tutma vaxtı', stat.fishTime().toFixed(1) + ' s')}</div>`;
      body += `<div class="card"><b>İskələdəki balıq</b>${bar(st.quay, stat.quayCap(), 'blue')}</div>`;
      body += boatRows();
    } else if (id === 'warehouse') {
      body += `<div class="card"><b>Anbar doluluğu</b>${bar(st.wh, stat.whCap(), st.wh >= stat.whCap() ? 'red' : 'blue')}</div>`;
      body += `<div class="stats">${statBox('Yükləmə', stat.loadTime().toFixed(2) + ' s')}${statBox('Təzə balıq qiyməti', money(stat.rawPrice()))}</div>`;
    } else if (id === 'factory') {
      body += `<div class="stats">${statBox('Emal sürəti', stat.facRate().toFixed(2) + ' /s')}${statBox('Məhsul qiyməti', money(stat.prodPrice()))}${statBox('Konveyerdə', G.sim.convey.length)}${statBox('Hazır məhsul', fmt(st.facOut))}</div>`;
      body += `<div class="card"><b>Çıxış anbarı</b>${bar(st.facOut, stat.facOutCap(), 'gold')}</div>`;
    } else if (id === 'market') {
      body += `<div class="card"><b>Kassa</b>${bar(s.register, stat.tillCap(), 'gold', `${money(s.register)} / ${money(stat.tillCap())}`)}
        <button class="btn wide" data-act="collect" ${s.register < 1 ? 'disabled' : ''}>Topla ${money(s.register)}</button></div>`;
      body += `<div class="stats">${statBox('Təzə balıq', `${fmt(st.mRaw)} · ${money(stat.rawPrice())}`)}${statBox('Məhsul', `${fmt(st.mProd)} · ${money(stat.prodPrice())}`)}${statBox('Müştəri', 'hər ' + stat.custEvery().toFixed(1) + ' s')}${statBox('Növbədə', G.sim.queue.length)}</div>`;
      if (stat.autoCollect()) body += `<p class="note">Kassir kassanı özü toplayır.</p>`;
    } else if (id === 'hq') {
      body += `<div class="stats">${statBox('İşçilər', `${s.workers} / ${stat.maxWorkers()}`)}${statBox('Sürət', stat.workerSpeed().toFixed(1) + ' kv/s')}${statBox('Daşıma', stat.carry() + ' qutu')}${statBox('Tədqiqat', s.research.active ? 'Gedir' : 'Boş')}</div>`;
      body += `<button class="btn blue wide" data-act="open" data-v="workers">${icon('workers', 'ii')} İşçiləri idarə et</button><button class="btn blue wide" data-act="open" data-v="research">${icon('research', 'ii')} Tədqiqat mərkəzi</button>`;
    }
    body += `<div class="sec">Təkmilləşdirmələr</div>` + trackRows(id) + `<div class="sec">Bina</div>` + tierCard(id);
    return { ic: 'b_' + id, title: info.name, sub: `Lv. ${t}`, body };
  },

  upgrades() {
    const s = S();
    let body = '';
    for (const b of ORDER) {
      if (b === 'farm') continue;
      body += `<div class="sec">${icon(BINFO[b].icon, 'ii')} ${BINFO[b].name} ${s.tier[b] ? '· Lv. ' + s.tier[b] : ''}</div>`;
      body += s.tier[b] ? trackRows(b) : tierCard(b);
    }
    return { title: 'Təkmilləşdirmələr', sub: 'Bütün binalar', body };
  },

  workers() {
    const s = S(), max = stat.maxWorkers(), c = hireCost();
    let body = `<div class="stats">${statBox('İşçilər', `${s.workers} / ${max}`)}${statBox('Sürət', stat.workerSpeed().toFixed(1) + ' kv/s')}${statBox('Daşıma', stat.carry() + ' qutu')}${statBox('Yükləmə', stat.loadTime().toFixed(2) + ' s')}</div>`;
    body += `<div class="tier"><span><b>Yeni daşıyıcı işə götür</b><small>${s.workers >= max ? `Limit doludur — Baş Ofisi genişləndir` : 'İskələ → anbar → bazar arasında yük daşıyır'}</small></span>
      <button class="btn gold" data-act="hire" ${s.workers >= max || s.money < c ? 'disabled' : ''}>${s.workers >= max ? 'Limit' : money(c)}</button></div>`;
    body += `<div class="sec">Komanda</div>`;
    body += G.sim.workers.map((w, i) => {
      const j = w.job;
      const what = j ? `${WORK_STATE[w.state]}: ${PLACE[j.src]} → ${PLACE[j.dst]}` : WORK_STATE[w.state];
      return `<div class="row">${ri('workers')}<span class="rt"><b>Daşıyıcı #${i + 1}</b><small>${what}${w.carry ? ` · ${w.carry} qutu` : ''}</small></span><span></span></div>`;
    }).join('');
    body += `<div class="sec">Baş Ofis təkmilləşdirmələri</div>` + trackRows('hq');
    return { title: 'İşçilər', sub: 'Daşıyıcılar və təlim', body };
  },

  boats() {
    const s = S(), max = stat.maxBoats(), c = boatCost();
    let body = boatRows();
    const canBuy = s.boats < max;
    body += `<div class="tier"><span><b>Yeni qayıq al</b><small>${canBuy ? 'Daha çox balıq, daha çox gəlir' : s.boats >= 4 ? 'Donanma tamdır' : `Limanı Lv ${s.tier.harbor + 1}-ə genişləndir`}</small></span>
      <button class="btn gold" data-act="boat" ${!canBuy || s.money < c ? 'disabled' : ''}>${canBuy ? money(c) : 'Limit'}</button></div>`;
    body += `<div class="sec">Liman təkmilləşdirmələri</div>` + trackRows('harbor') + `<div class="sec">Liman</div>` + tierCard('harbor');
    return { title: 'Gəmilər', sub: `${s.boats} qayıq`, body };
  },

  research() {
    const s = S(), a = s.research.active;
    let body = '';
    if (a) {
      const r = RESEARCH.find(x => x.id === a.id), left = Math.max(0, a.ends - Date.now()) / 1000;
      body += `<div class="card"><b>${icon(r.icon, 'ii')} ${r.name} araşdırılır</b>${bar(a.total - left, a.total, 'blue', `${Math.ceil(left)} s qalıb`)}
        <button class="btn blue wide" data-act="rush" ${s.gems < rushCost() ? 'disabled' : ''}>Dərhal bitir · ${rushCost()} ${icon('gem','ii')}</button></div>`;
    } else body += `<p class="desc">Baş Ofisdə bir anda bir tədqiqat aparılır. Nəticələr bütün şirkətə daimi bonus verir.</p>`;
    for (const r of RESEARCH) {
      const l = s.research.lv[r.id] || 0, max = r.cost.length, done = l >= max;
      body += `<div class="row">${ri(r.icon)}<span class="rt"><b>${r.name} <span class="lv">${l}/${max}</span></b><small>${r.desc}${done ? '' : ` · ${r.time[l]} s`}</small>${pips(l, max)}</span>
        <button class="btn" data-act="research" data-id="${r.id}" ${done || a || s.money < r.cost[l] ? 'disabled' : ''}>${done ? 'Hazır' : money(r.cost[l])}</button></div>`;
    }
    return { title: 'Tədqiqat', sub: a ? 'Gedir…' : 'Boşdur', body };
  },

  shop() {
    const s = S(), rate = steadyRate(), now = Date.now();
    const free = now >= s.freeChestAt;
    let body = `<div class="tier"><span><b>${icon('daily', 'ii')} Pulsuz sandıq</b><small>${free ? '5 dəqiqəlik gəlir, hər 4 saatdan bir' : 'Növbəti: ' + clock(s.freeChestAt - now)}</small></span>
      <button class="btn gold" data-act="chest" ${free ? '' : 'disabled'}>${free ? 'Aç' : icon('hourglass', 'ii')}</button></div>`;
    for (const it of SHOP) {
      const val = it.id === 'warp' ? rate * 3600 : it.id === 'purse' ? rate * 1200 : 0;
      const active = it.id === 'boost' && now < s.boostUntil;
      body += `<div class="row">${ri(it.icon)}<span class="rt"><b>${it.name}</b><small>${it.desc}${val ? ` (≈ ${money(val)})` : ''}${active ? ` · aktiv ${clock(s.boostUntil - now)}` : ''}</small></span>
        <button class="btn blue" data-act="shop" data-id="${it.id}" ${s.gems < it.gems ? 'disabled' : ''}>${it.gems} ${icon('gem','ii')}</button></div>`;
    }
    body += `<p class="note">Bütün alışlar oyun daxili almazlarla edilir. Almaz missiyalardan, nailiyyətlərdən, gündəlik mükafatdan və səviyyə artımından gəlir. Real pul alışı yoxdur.</p>`;
    return { title: 'Mağaza', sub: `${fmt(s.gems)} almaz`, body };
  },

  missions() {
    const s = S(), m = currentMission();
    let body = '';
    MISSIONS.forEach((mm, i) => {
      if (i < s.mission - 2 || i > s.mission + 3) return;
      const st = i < s.mission ? 'done' : i === s.mission ? 'cur' : 'lock';
      const rw = [mm.r.c ? money(mm.r.c) : '', mm.r.g ? mm.r.g + ' almaz' : ''].filter(Boolean).join(' + ');
      body += `<div class="row">${ri(st === 'done' ? 'check' : st === 'cur' ? 'target' : 'lock')}<span class="rt"><b>${mm.t}</b><small>Mükafat: ${rw}</small>
        ${st === 'cur' ? bar(m.v, m.n) : ''}</span>
        ${st === 'cur' && m.done ? '<button class="btn gold" data-act="claimMission">Al</button>' : '<span></span>'}</div>`;
    });
    if (!m) body += `<p class="desc">Bütün missiyaları bitirdin. Yeni missiyalar növbəti yeniləmədə gələcək.</p>`;
    return { title: 'Missiyalar', sub: `${Math.min(s.mission, MISSIONS.length)} / ${MISSIONS.length}`, body };
  },

  daily() {
    const s = S(), ready = dailyReady(), day = s.daily.day % 7;
    let body = `<p class="desc">Hər gün gir və mükafat al. 7-ci gün böyük sandıqdır.</p><div class="grid7">`;
    DAILY.forEach((r, i) => {
      const cls = i < day ? 'got' : i === day && ready ? 'now' : '';
      body += `<div class="day ${cls}"><small>Gün ${i + 1}</small><span class="dic">${icon(r.g && r.c ? 'daily' : r.g ? 'gem' : 'coin')}</span>${[r.c ? money(r.c * dailyMul()) : '', r.g ? r.g + ' almaz' : ''].filter(Boolean).join(' + ')}</div>`;
    });
    body += `</div><button class="btn gold wide" data-act="daily" ${ready ? '' : 'disabled'}>${ready ? 'Mükafatı al' : 'Sabah yenə gəl'}</button>`;
    return { title: 'Gündəlik mükafat', sub: `Gün ${day + 1}`, body };
  },

  ach() {
    let body = '';
    for (const a of ACHIEVEMENTS) {
      const st = achState(a), done = st.step === undefined;
      body += `<div class="row">${ri(a.icon)}<span class="rt"><b>${a.name} <span class="stars">${icon('star','ii').repeat(st.claimed)}</span></b>
        <small>${done ? 'Hamısı tamamlandı' : `Hədəf: ${fmt(st.step)}`}</small>${done ? '' : bar(Math.min(st.v, st.step), st.step, 'gold')}</span>
        <button class="btn gold" data-act="ach" data-id="${a.id}" ${st.ready ? '' : 'disabled'}>${done ? icon('check','ii') : st.gems + ' ' + icon('gem','ii')}</button></div>`;
    }
    return { title: 'Nailiyyətlər', sub: '', body };
  },

  log() {
    const s = S();
    const body = s.log.length ? `<div class="loglist">${s.log.map(e => `<div>${icon(e.ic || 'bell', 'li')}<span>${e.t.replace(/^[^\p{L}\p{N}]+/u, '')}</span><time>${new Date(e.at).toLocaleTimeString('az', { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('')}</div>`
      : `<p class="desc">Hələ bildiriş yoxdur. Səviyyə artımı, tikinti və tədqiqat xəbərləri burada görünəcək.</p>`;
    return { title: 'Bildirişlər', sub: '', body };
  },

  map() {
    const s = S(), st = stage();
    let body = `<p class="desc">Balıqçılıq şirkətin üç mərhələdən keçir. Hər mərhələ yeni bina və imkanlar açır.</p>`;
    STAGES.forEach(x => {
      body += `<div class="stagecard ${x.n < st ? 'done' : x.n === st ? 'cur' : ''}"><span class="n">${x.n < st ? icon('check') : x.n}</span><span><b>${x.name}</b><p class="desc">${x.desc}</p></span></div>`;
    });
    body += `<div class="stats">${statBox('Oyunçu səviyyəsi', s.level)}${statBox('Tutulan balıq', fmt(s.stats.caught))}${statBox('Satılan', fmt(s.stats.sold))}${statBox('Ümumi qazanc', money(s.stats.earned))}</div>`;
    return { title: 'Xəritə', sub: `Mərhələ ${st}`, body };
  },

  settings() {
    const s = S().settings;
    const tg = (k, label) => `<div class="toggle"><span>${label}</span><button class="sw ${s[k] ? 'on' : ''}" data-act="toggle" data-k="${k}" aria-pressed="${!!s[k]}" aria-label="${label}"></button></div>`;
    let body = tg('sound', icon('sound', 'ii dk') + ' Səs effektləri') + tg('vibrate', icon('vibe', 'ii dk') + ' Vibrasiya');
    const q = s.quality || 'auto', QN = { auto: 'Avto', low: 'Aşağı', medium: 'Orta', high: 'Yüksək' };
    body += `<div class="card"><b>${icon('palette', 'ii dk')} Qrafika keyfiyyəti</b><div class="seg">${Object.entries(QN).map(([k, n]) => `<button class="${q === k ? 'on' : ''}" data-act="quality" data-q="${k}">${n}</button>`).join('')}</div>
      <small class="note">İndi işləyən: ${QN[G.quality.name]}${q === 'auto' ? ' (cihaza görə seçilib)' : ''}. Aşağı rejim zəif telefonlar üçündür: 30 FPS, yarım ölçülü teksturlar, az effekt.</small></div>`;
    body += `<p class="note">Qrafika dəyişikliyi oyunu yenidən yükləyir, proqres saxlanılır.</p>`;
    body += `<div class="sec">Proqres</div><button class="btn red wide" data-act="reset">Proqresi sıfırla</button>`;
    body += `<p class="note">Fishing Tycoon · Mərhələ 1 prototipi · Qrafika kodla yaradılıb (müvəqqəti, son art deyil).</p>`;
    return { title: 'Ayarlar', sub: '', body };
  },
};

function onPanelClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const s = S(), d = b.dataset;
  let ok = true;
  switch (d.act) {
    case 'track': { const tr = TRACKS[d.b].find(x => x.id === d.t); ok = buyTrack(d.b, tr); if (ok) { sfx.buy(); buzz(); } break; }
    case 'tier': ok = buyTier(d.b); if (ok) { buzz(40); toast(`${BINFO[d.b].name} → Lv. ${s.tier[d.b]}`, 'good'); } break;
    case 'hire': ok = hire(); if (ok) { sfx.buy(); buzz(); log('Yeni işçi işə başladı', 'workers'); toast('Yeni işçi yoldadır!', 'good'); } break;
    case 'boat': ok = buyBoat(); if (ok) { sfx.horn(); buzz(40); log('Yeni qayıq alındı', 'boats'); toast('Yeni qayıq limanda!', 'good'); } break;
    case 'collect': collect(); break;
    case 'open': open(d.v); return;
    case 'research': ok = startResearch(d.id); if (ok) sfx.buy(); break;
    case 'rush': { const c = rushCost(); if (s.gems >= c) { s.gems -= c; finishResearchIfDone(true); } else ok = false; break; }
    case 'shop': ok = shopBuy(d.id); break;
    case 'chest': { const v = Math.max(100, steadyRate() * 300); addMoney(v); s.freeChestAt = Date.now() + FREE_CHEST_EVERY; sfx.coin(); flyCoins(); toast(`+${money(v)}`, 'good'); break; }
    case 'claimMission': ok = claimMission(); if (ok) { sfx.coin(); toast('Missiya tamamlandı!', 'good'); } break;
    case 'daily': claimDaily(); break;
    case 'ach': { const a = ACHIEVEMENTS.find(x => x.id === d.id); ok = claimAch(a); if (ok) { sfx.coin(); log(`${a.name} nailiyyəti`, 'trophy'); } break; }
    case 'toggle': s.settings[d.k] = !s.settings[d.k]; break;
    case 'quality': if (s.settings.quality === d.q) return; s.settings.quality = d.q; save(s); location.reload(); return;
    case 'reset': showModal('reset'); return;
  }
  if (!ok) sfx.error();
  renderPanel(true);
  tick();
}

function shopBuy(id) {
  const s = S(), it = SHOP.find(x => x.id === id);
  if (s.gems < it.gems) return false;
  s.gems -= it.gems;
  const rate = steadyRate();
  if (id === 'boost') { s.boostUntil = Math.max(Date.now(), s.boostUntil) + 600000; toast('Gəlir ×2 aktivdir!', 'good'); }
  if (id === 'warp') { const v = rate * 3600; addMoney(v); toast(`+${money(v)}`, 'good'); flyCoins(); }
  if (id === 'purse') { const v = rate * 1200; addMoney(v); toast(`+${money(v)}`, 'good'); flyCoins(); }
  sfx.coin(); bus.emit('money');
  return true;
}

// ------------------------------------------------------------ daily reward
const today = () => new Date().toISOString().slice(0, 10);
function dailyReady() { return S().daily.last !== today(); }
function dailyMul() { return Math.max(1, Math.floor(S().level / 2)); }
function claimDaily() {
  const s = S();
  if (!dailyReady()) return;
  const r = DAILY[s.daily.day % 7];
  reward({ c: (r.c || 0) * dailyMul(), g: r.g });
  s.daily.day++; s.daily.last = today();
  sfx.coin(); flyCoins(); log('Gündəlik mükafat alındı', 'daily');
}

// ------------------------------------------------------------------ collect
function collect() {
  const v = G.sim.collect(false);
  console.log('UI collect ' + v);
  if (!v) { sfx.error(); toast('Kassa boşdur — müştərilər alış-veriş edir'); }
}
function flyCoins() {
  const from = $('collect').getBoundingClientRect(), to = $('money').getBoundingClientRect();
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('span');
    c.className = 'fly'; c.innerHTML = icon('coin');
    c.style.transform = `translate(${from.left + from.width / 2 + (Math.random() - 0.5) * 60}px, ${from.top + (Math.random() - 0.5) * 30}px)`;
    $('flyer').appendChild(c);
    setTimeout(() => { c.style.transform = `translate(${to.left}px, ${to.top}px) scale(.6)`; c.style.opacity = '0.4'; }, 30 + i * 50);
    setTimeout(() => c.remove(), 900 + i * 50);
  }
}

// ---------------------------------------------------------- toasts & log
export function toast(t, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = t;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3100);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
function log(t, ic = 'bell') {
  const s = S();
  s.log.unshift({ t, ic, at: Date.now() });
  s.log.length = Math.min(s.log.length, 40);
  s.logUnread = (s.logUnread || 0) + 1;
}

// ------------------------------------------------------------------ modals
let modalData = null;
export function showModal(kind, data) {
  modalData = { kind, data };
  let h = '';
  if (kind === 'offline') {
    h = `<div class="big">${icon('moon')}</div><h2>Xoş gəldin!</h2><p class="desc">Sən yoxkən işçilər ${clock(data.secs * 1000)} işlədi.</p>
      <div class="amt">+${money(data.amt)}</div>
      <div class="btns"><button class="btn" data-m="take">Topla</button><button class="btn blue" data-m="take2" ${S().gems < 10 ? 'disabled' : ''}>×2 · 10 ${icon('gem','ii')}</button></div>`;
  } else if (kind === 'level') {
    h = `<div class="big">${icon('star')}</div><h2>Səviyyə ${data}!</h2><p class="desc">Mükafat: ${3 + data} ${icon('gem','ii')}. Yeni genişlənmələr açıla bilər.</p><div class="btns"><button class="btn gold" data-m="ok">Əla!</button></div>`;
  } else if (kind === 'reset') {
    h = `<div class="big">${icon('warn')}</div><h2>Proqres silinsin?</h2><p class="desc">Bütün pul, binalar və tədqiqatlar itəcək. Bunu geri qaytarmaq olmur.</p>
      <div class="btns"><button class="btn" data-m="ok">Ləğv et</button><button class="btn red" data-m="wipe">Sil</button></div>`;
  } else if (kind === 'welcome') {
    h = `<div class="big">${icon('b_harbor')}</div><h2>Fishing Tycoon</h2><p class="desc">Kiçik balıqçı kəndindən başla. Qayıq balıq tutur, işçi onu anbara və bazara daşıyır, müştərilər alır. Kassanı <b>Topla</b> və binalara toxunub təkmilləşdir.</p>
      <div class="btns"><button class="btn gold" data-m="ok">Başla</button></div>`;
  }
  $('mcard').innerHTML = h;
  $('modal').hidden = false;
}
function onModalClick(e) {
  const b = e.target.closest('[data-m]');
  if (!b || b.disabled) return;
  const m = b.dataset.m, s = S();
  if (m === 'take' || m === 'take2') {
    let v = modalData.data.amt;
    if (m === 'take2') { s.gems -= 10; v *= 2; }
    addMoney(v); sfx.coin(); flyCoins();
  }
  if (m === 'wipe') { wipe(); window.__noSave = true; location.reload(); return; }
  $('modal').hidden = true;
}

function clock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h} saat ${m} dəq` : m ? `${m} dəq ${s} s` : `${s} s`;
}
