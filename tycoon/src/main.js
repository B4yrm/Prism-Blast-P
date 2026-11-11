// Entry: load the save, pick a quality profile, boot Phaser and the DOM UI.
import { G, steadyRate, stat, addXp } from './core/economy.js';
import { load } from './core/state.js';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { initUI, showModal } from './ui/ui.js';
import { bus } from './core/bus.js';

G.S = load();
// Graphics presets. 'auto' picks one from the device's memory / CPU cores.
export const PRESETS = {
  high:   { dprMax: 2,   ground: 1.25, atlasHalf: false, fps: 60, cars: 5, glints: 22, foam: 1, sway: true,  wake: 1 },
  medium: { dprMax: 1.5, ground: 1.0,  atlasHalf: false, fps: 60, cars: 3, glints: 10, foam: 2, sway: true,  wake: 0.6 },
  low:    { dprMax: 1,   ground: 0.75, atlasHalf: true,  fps: 30, cars: 2, glints: 0,  foam: 0, sway: false, wake: 0.35 },
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

const game = new Phaser.Game({
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

// Periodic performance line (visible in Android logcat via the WebView console bridge).
setInterval(() => {
  let px = 0;
  try { for (const k of game.textures.getTextureKeys()) { const src = game.textures.get(k).source[0]; if (src) px += src.width * src.height; } } catch (e) { /* ignore */ }
  const heap = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 'n/a';
  console.log(`PERF fps=${game.loop.actualFps.toFixed(1)} textureMB=${(px * 4 / 1048576).toFixed(1)} heapMB=${heap} preset=${G.quality.name} canvas=${game.canvas.width}x${game.canvas.height}`);
}, 10000);

window.addEventListener('resize', () => {
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
