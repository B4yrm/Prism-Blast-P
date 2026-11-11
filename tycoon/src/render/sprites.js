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
  // seamless water ripple tile: rows of soft crests in the iso direction
  canvasTex(scene, 'waves', 512, 256, c => {
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    c.lineCap = 'round';
    const crest = (x, y, L, a, w) => {
      for (const ox of [-512, 0, 512]) for (const oy of [-256, 0, 256]) {
        const X = x + ox, Y = y + oy;
        c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = w;
        c.beginPath(); c.moveTo(X - L, Y + L * 0.18); c.quadraticCurveTo(X, Y - L * 0.22, X + L, Y + L * 0.18); c.stroke();
        c.strokeStyle = `rgba(10,70,140,${a * 0.5})`; c.lineWidth = w * 0.8;
        c.beginPath(); c.moveTo(X - L * 0.9, Y + L * 0.3 + w); c.quadraticCurveTo(X, Y - L * 0.05 + w, X + L * 0.9, Y + L * 0.3 + w); c.stroke();
      }
    };
    for (let k = 0; k < 70; k++) crest(rnd() * 512, rnd() * 256, 10 + rnd() * 22, 0.18 + rnd() * 0.3, 1.6 + rnd() * 1.8);
    for (let k = 0; k < 90; k++) { c.fillStyle = `rgba(255,255,255,${0.1 + rnd() * 0.25})`; const x = rnd() * 512, y = rnd() * 256; c.beginPath(); c.ellipse(x, y, 2 + rnd() * 4, 1 + rnd() * 1.5, 0, 0, 7); c.fill(); }
  });
}
