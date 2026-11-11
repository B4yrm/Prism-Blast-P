// Generates every texture procedurally, showing progress in the DOM loader.
import { makeFx } from '../render/sprites.js';
import { loadAtlases } from '../render/atlas.js';
import { G } from '../core/economy.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    const bar = document.getElementById('loadbar');
    const steps = [
      () => fontsReady(),
      () => makeFx(this),
      () => loadAtlases(this, G.S.settings.quality),
    ];
    let i = 0;
    const next = async () => {
      if (i < steps.length) {
        await steps[i++]();
        if (bar) bar.style.width = (i / (steps.length + 1) * 100) + '%';
        setTimeout(next, 16);
      } else {
        this.scene.start('world');
      }
    };
    next();
  }
}

function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const t = new Promise(r => setTimeout(r, 1500));
  return Promise.race([Promise.all([
    document.fonts.load('800 20px "Baloo 2"'), document.fonts.load('800 20px "Baloo 2"', 'əƏİığş'),
    document.fonts.load('800 14px "Nunito"'), document.fonts.load('900 14px "Nunito"', 'əƏİığş'),
  ]), t]).catch(() => {});
}
