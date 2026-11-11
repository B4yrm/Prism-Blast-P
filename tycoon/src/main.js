// Entry: load the save, pick a quality profile, boot Phaser and the DOM UI.
import { G, steadyRate, stat, addXp } from './core/economy.js';
import { load, snapshot } from './core/state.js';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { initUI, showModal } from './ui/ui.js';
import { bus } from './core/bus.js';

G.S = load();
console.log('LOADED ' + JSON.stringify(snapshot(G.S)));
// Graphics presets. 'auto' picks one from the device's memory / CPU cores.
export const PRESETS = {
  high:   { water: 'shader', dprMax: 2,   ground: 1.25, atlasHalf: false, fps: 60, cars: 5, glints: 22, foam: 1, sway: true,  wake: 1 },
  medium: { water: 'layers', dprMax: 1.5, ground: 1.0,  atlasHalf: false, fps: 60, cars: 3, glints: 10, foam: 2, sway: true,  wake: 0.6 },
  low:    { water: 'basic',  dprMax: 1,   ground: 0.75, atlasHalf: true,  fps: 30, cars: 2, glints: 0,  foam: 0, sway: false, wake: 0.35 },
};
function autoPreset() {
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (mem <= 2 || cores <= 2) return 'low';
  if (mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}
const chosen = G.S.settings.quality || 'auto';
const presetName = PRESETS[chosen] ? chosen : autoPreset();
const P = PRESETS[presetName];
G.quality = { ...P, name: presetName, chosen, dpr: Math.min(P.dprMax, window.devicePixelRatio || 1) };
const dpr = G.quality.dpr;

// Offline earnings: half the steady-state rate, capped.
const away = (Date.now() - (G.S.lastSeen || Date.now())) / 1000;
const isNew = G.S.stats.caught === 0 && G.S.stats.sold === 0;
let offline = null;
if (!isNew && away > 60) {
  const secs = Math.min(away, stat.offlineCapH() * 3600);
  const amt = Math.floor(steadyRate() * secs * 0.5);
  if (amt > 0) offline = { secs, amt };
}

window.addEventListener('error', e => console.log('ERR ' + e.message + ' @' + (e.filename || '').slice(-20) + ':' + e.lineno));
window.addEventListener('unhandledrejection', e => console.log('ERR promise ' + (e.reason && e.reason.message)));

// Start only once the page has a real size (a WebView can report 0×0 at first).
function whenSized(cb) {
  if (innerWidth > 0 && innerHeight > 0) return cb();
  const t = setInterval(() => { if (innerWidth > 0 && innerHeight > 0) { clearInterval(t); cb(); } }, 50);
}
let game;
whenSized(() => {
game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b8bd0',
  width: Math.round(innerWidth * dpr),
  height: Math.round(innerHeight * dpr),
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
  render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
  fps: { target: G.quality.fps, limit: G.quality.fps < 60 ? G.quality.fps : 0 },
  banner: false,
  scene: [BootScene, WorldScene],
});
window.__game = game;
window.__quality = G.quality;
});

// Periodic performance line (visible in Android logcat via the WebView console bridge).
setInterval(() => {
  if (!game) return;
  let px = 0;
  try { for (const k of game.textures.getTextureKeys()) { const src = game.textures.get(k).source[0]; if (src) px += src.width * src.height; } } catch (e) { /* ignore */ }
  const heap = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 'n/a';
  const r = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)]; };
  console.log('UIPOS ' + JSON.stringify({ w: innerWidth, h: innerHeight, sideTog: r('#sideTog'), recenter: r('#recenter'), boats: r('#dock [data-open=boats]'), pclose: r('#pclose'), mission: r('#mission'), gear: r('#hud .gear'), collect: r('#collect'), rail0: r('#side .items button'), missionX: r('#mission .mx'), start: r('#mcard [data-m]'), upg: r('#pbody [data-act=track]:not([disabled])') }));
  console.log(`PERF renderer=${game.renderer ? (game.renderer.type === 2 ? 'webgl' : 'canvas') : 'none'} world=${!!G.world} size=${innerWidth}x${innerHeight} zoom=${G.world ? G.world.cameras.main.zoom.toFixed(3) : 0} money=${Math.floor(G.S.money)} level=${G.S.level} caught=${G.S.stats.caught} fps=${game.loop.actualFps.toFixed(1)} textureMB=${(px * 4 / 1048576).toFixed(1)} heapMB=${heap} preset=${G.quality.name} canvas=${game.canvas.width}x${game.canvas.height}`);
}, 5000);

window.addEventListener('resize', () => {
  if (!game || !innerWidth || !innerHeight) return;
  game.scale.resize(Math.round(innerWidth * dpr), Math.round(innerHeight * dpr));
  game.scale.setZoom(1 / dpr);
});

bus.on('worldReady', () => {
  initUI();
  const ld = document.getElementById('loader');
  ld.classList.add('done');
  setTimeout(() => ld.remove(), 600);
  if (offline) showModal('offline', offline);
  else if (isNew) showModal('welcome');
});
