// Minimal event bus between simulation, world rendering and DOM UI.
const L = {};
export const bus = {
  on(e, f) { (L[e] || (L[e] = [])).push(f); },
  emit(e, a) { const l = L[e]; if (l) for (const f of l) f(a); },
};
