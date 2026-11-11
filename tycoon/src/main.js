// Entry: load the save, pick a quality profile, boot Phaser and the DOM UI.
import { G, steadyRate, stat, addXp } from './core/economy.js';
import { load } from './core/state.js';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { initUI, showModal } from './ui/ui.js';
import { bus } from './core/bus.js';

G.S = load();
const high = G.S.settings.quality === 'high';
const dpr = high ? Math.min(2, window.devicePixelRatio || 1) : 1;
G.quality = { dpr, tex: high ? 2 : 1.25, ppl: high ? 3 : 2, ground: high ? 1 : 0.7 };

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
  fps: { target: 60 },
  banner: false,
  scene: [BootScene, WorldScene],
});
window.__game = game;

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
