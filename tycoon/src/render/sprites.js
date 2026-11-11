// Small procedural effect textures (particles, coins, gulls, water ripples).
// Buildings, units and props come from the sprite atlas (see ASSETS.md).
import { fishGlyph } from './paint.js';

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  draw(t.getContext(), t);
  t.refresh();
  return t;
}

// ---- boats ---------------------------------------------------------------
// dir: 0:+x 1:+y 2:-x 3:-y (travel direction in grid space)
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// ---- effects -------------------------------------------------------------
export function makeFx(scene) {
  canvasTex(scene, 'puff', 64, 64, c => {
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(240,240,240,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, 'dot', 16, 16, c => { c.fillStyle = '#fff'; c.beginPath(); c.arc(8, 8, 6, 0, 7); c.fill(); });
  canvasTex(scene, 'drop', 12, 12, c => { c.fillStyle = '#bfefff'; c.beginPath(); c.arc(6, 6, 4, 0, 7); c.fill(); });
  canvasTex(scene, 'spark', 32, 32, c => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(16, 0); c.lineTo(19, 13); c.lineTo(32, 16); c.lineTo(19, 19); c.lineTo(16, 32); c.lineTo(13, 19); c.lineTo(0, 16); c.lineTo(13, 13); c.closePath(); c.fill();
  });
  canvasTex(scene, 'coin', 40, 40, c => {
    const g = c.createRadialGradient(15, 13, 2, 20, 20, 18);
    g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#ffcf2e'); g.addColorStop(1, '#d68a00');
    c.fillStyle = g; c.beginPath(); c.arc(20, 20, 17, 0, 7); c.fill();
    c.strokeStyle = '#b86f00'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#b86f00'; c.font = '900 20px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 20, 21);
  });
  canvasTex(scene, 'gull', 64, 20, c => {
    for (let f = 0; f < 2; f++) {
      c.save(); c.translate(f * 32, 0);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath();
      if (f === 0) { c.moveTo(3, 6); c.quadraticCurveTo(10, 2, 16, 10); c.quadraticCurveTo(22, 2, 29, 6); }
      else { c.moveTo(3, 13); c.quadraticCurveTo(10, 12, 16, 10); c.quadraticCurveTo(22, 12, 29, 13); }
      c.stroke();
      c.fillStyle = '#f2a33a'; c.fillRect(15, 10, 2, 2);
      c.restore();
    }
  });
  const t = scene.textures.get('gull'); t.add('g0', 0, 0, 0, 32, 20); t.add('g1', 0, 32, 0, 32, 20);
  canvasTex(scene, 'fishjump', 24, 14, c => fishGlyph(c, 13, 7, 0.65, '#cfe3f2', '#fff'));
  // seamless water ripple tile
  canvasTex(scene, 'waves', 256, 128, c => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    c.lineCap = 'round';
    for (let k = 0; k < 46; k++) {
      const x = rnd() * 256, y = rnd() * 128, L = 8 + rnd() * 18, a = 0.08 + rnd() * 0.16;
      c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1.2 + rnd() * 1.4;
      for (const ox of [-256, 0, 256]) for (const oy of [-128, 0, 128]) {
        c.beginPath(); c.moveTo(x + ox - L, y + oy); c.quadraticCurveTo(x + ox, y + oy - 3, x + ox + L, y + oy); c.stroke();
      }
    }
  });
}
