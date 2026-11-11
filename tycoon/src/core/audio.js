// Tiny synthesized sound effects (no audio files needed).
import { G } from './economy.js';

let ac = null;
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
}

function tone(f, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (!ac || !G.S.settings.sound) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.07, 'triangle', 0.08),
  coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.16, 'square', 0.05, 0, 0.07); },
  buy: () => { tone(523, 0.08, 'triangle', 0.1); tone(784, 0.14, 'triangle', 0.1, 0, 0.07); },
  tier: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, 0, i * 0.09)),
  level: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.06, 0, i * 0.1)),
  horn: () => { tone(150, 0.6, 'sawtooth', 0.04, -20); tone(225, 0.6, 'sawtooth', 0.03, -30); },
  error: () => tone(200, 0.15, 'square', 0.05, -60),
};

export function buzz(ms = 15) {
  if (G.S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
