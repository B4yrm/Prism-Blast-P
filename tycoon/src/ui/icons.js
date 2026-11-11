// One consistent icon set (inline SVG, 24×24) so the UI looks the same on every
// phone instead of depending on the system's emoji font.
const W = 'fill="#fff"', S = 'stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"';

export const ICONS = {
  // resources (coloured)
  coin: `<circle cx="12" cy="12" r="10" fill="#f5a400"/><circle cx="12" cy="11" r="8.6" fill="#ffd23f"/><path d="M12 6.5v9M14.6 8.3c-.6-.8-1.6-1.1-2.6-1.1-1.5 0-2.6.7-2.6 1.9 0 2.7 5.4 1.4 5.4 4.2 0 1.2-1.2 2-2.8 2-1.1 0-2.2-.4-2.8-1.2" stroke="#b86f00" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  gem: `<path d="M6 3h12l4 6-10 12L2 9z" fill="#28c8f0"/><path d="M2 9h20L12 21z" fill="#139bd0"/><path d="M6 3l3 6 3-6 3 6 3-6" fill="none" stroke="#bff3ff" stroke-width="1.2"/><path d="M9 9l3 12 3-12" fill="none" stroke="#7fe0fa" stroke-width="1"/>`,
  fish: `<path d="M3 12c3-5 9-6 14-3l4-3v12l-4-3c-5 3-11 2-14-3z" fill="#3fa3f0"/><path d="M5 13c3 2.5 7 2.8 11 1" stroke="#c8e9ff" stroke-width="1.4" fill="none"/><circle cx="7.5" cy="10.8" r="1.2" fill="#0b2b55"/>`,
  income: `<path d="M3 20h18" stroke="#9fe58f" stroke-width="2" stroke-linecap="round"/><path d="M4 16l5-5 4 3 7-8" stroke="#56d84a" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6h5v5" stroke="#56d84a" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  captain: `<circle cx="12" cy="13" r="6.5" fill="#f6cfa8"/><path d="M4.5 9.5c0-3.2 3.4-5.5 7.5-5.5s7.5 2.3 7.5 5.5z" fill="#1d3f7a"/><rect x="4" y="9" width="16" height="2.4" rx="1.2" fill="#0f2b57"/><circle cx="12" cy="6.6" r="1.4" fill="#ffd23f"/><circle cx="9.6" cy="13.2" r=".9" fill="#2a1c14"/><circle cx="14.4" cy="13.2" r=".9" fill="#2a1c14"/><path d="M10 16.2c1.2.9 2.8.9 4 0" stroke="#b5654a" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  // white glyphs for buttons
  gear: `<path ${W} d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8zM12 8.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z"/>`,
  menu: `<rect ${W} x="3" y="3" width="7.5" height="7.5" rx="2"/><rect ${W} x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect ${W} x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect ${W} x="13.5" y="13.5" width="7.5" height="7.5" rx="2" opacity=".55"/>`,
  close: `<path ${S} d="M6 6l12 12M18 6L6 18"/>`,
  back: `<path ${S} d="M15 5l-7 7 7 7"/>`,
  up: `<path ${S} d="M6 15l6-6 6 6"/>`,
  down: `<path ${S} d="M6 9l6 6 6-6"/>`,
  missions: `<rect ${W} x="5" y="4" width="14" height="18" rx="2.5"/><rect x="9" y="2" width="6" height="4" rx="1.4" fill="#ffd23f"/><path d="M8 13l2.6 2.6L16 10" stroke="#1f6fe0" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  daily: `<rect ${W} x="3" y="10" width="18" height="11" rx="2"/><rect x="2" y="7" width="20" height="4.5" rx="1.5" fill="#ffd23f"/><rect x="10.6" y="7" width="2.8" height="14" fill="#e2473b"/><path d="M12 7c-2-4-6-4-6-1.6S9.5 7 12 7zm0 0c2-4 6-4 6-1.6S14.5 7 12 7z" fill="#e2473b"/>`,
  trophy: `<path ${W} d="M7 3h10v5a5 5 0 01-10 0z"/><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3" stroke="#fff" stroke-width="1.8" fill="none"/><rect ${W} x="10.5" y="12" width="3" height="4"/><rect x="7" y="17" width="10" height="4" rx="1.2" fill="#ffd23f"/>`,
  bell: `<path ${W} d="M12 3a6 6 0 00-6 6v4l-2 3h16l-2-3V9a6 6 0 00-6-6z"/><circle cx="12" cy="19.5" r="2.2" fill="#ffd23f"/>`,
  map: `<path ${W} d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14" stroke="#1f6fe0" stroke-width="1.4"/><circle cx="17.5" cy="10" r="1.8" fill="#e2473b"/>`,
  upgrade: `<path ${W} d="M4 18.5L13.5 9l1.5 1.5L5.5 20z"/><path d="M12 6.5l3-3 5.5 5.5-3 3z" fill="#ffd23f"/><path d="M18 22v-6M15.5 18.5L18 16l2.5 2.5" stroke="#56d84a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  workers: `<path d="M5 13a7 7 0 0114 0z" fill="#ffd23f"/><rect x="3" y="12.4" width="18" height="2.4" rx="1.2" fill="#f5a400"/><rect x="11" y="6" width="2" height="5" rx="1" fill="#f5a400"/><path ${W} d="M7 15.5h10a5 5 0 01-10 0z"/>`,
  boats: `<path ${W} d="M3 15h18l-3 5H6z"/><rect ${W} x="7" y="9" width="8" height="5" rx="1"/><rect x="8.5" y="10.4" width="2" height="1.8" fill="#1f6fe0"/><rect x="11.6" y="10.4" width="2" height="1.8" fill="#1f6fe0"/><path d="M11 9V4M11 4l5 3" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M3 21c2 1 4 1 6 0s4-1 6 0 4 1 6 0" stroke="#7fd3f2" stroke-width="1.6" fill="none"/>`,
  research: `<path ${W} d="M9 3h6v2h-1v5l5.5 8.5A2 2 0 0117.8 21H6.2a2 2 0 01-1.7-2.5L10 10V5H9z"/><path d="M6.3 17.5L8.5 14h7l2.2 3.5z" fill="#56d84a"/><circle cx="11" cy="16.6" r="1" fill="#fff"/>`,
  shop: `<path ${W} d="M2 4h3l2.5 11h11L21 7H6.4"/><path d="M2 4h3l2.5 11h11L21 7H6.4" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="9" cy="19.5" r="1.8" fill="#ffd23f"/><circle cx="17" cy="19.5" r="1.8" fill="#ffd23f"/>`,
  basket: `<path d="M3 10h18l-2 10H5z" fill="#d39b57"/><path d="M5 13h14M6 16.5h12" stroke="#a8743f" stroke-width="1.4"/><path d="M7 10l3-6M17 10l-3-6" stroke="#8a5a2b" stroke-width="2" stroke-linecap="round"/><path d="M8 9.5c1.5-2 6.5-2 8 0" fill="#3fa3f0"/>`,
  target: `<circle cx="12" cy="12" r="9.5" fill="#e2473b"/><circle cx="12" cy="12" r="6.6" fill="#fff"/><circle cx="12" cy="12" r="3.8" fill="#e2473b"/><circle cx="12" cy="12" r="1.4" fill="#fff"/>`,
  // buildings (coloured, used on map badges and panel headers)
  b_harbor: `<circle cx="12" cy="5" r="2.2" fill="none" stroke="#1d4f9a" stroke-width="2"/><path d="M12 7v13M7 11h10M4.5 14a7.5 7.5 0 0015 0" stroke="#1d4f9a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  b_warehouse: `<path d="M2 10l10-6 10 6v11H2z" fill="#2e6fd8"/><rect x="5" y="12" width="14" height="9" fill="#e3e8ed"/><path d="M5 15h14M5 18h14" stroke="#9aa9b8" stroke-width="1.2"/><rect x="8" y="7.5" width="8" height="2.5" rx=".8" fill="#fff"/>`,
  b_factory: `<path d="M2 21V11l6 3v-3l6 3v-3l6 3v7z" fill="#2e6fd8"/><rect x="17" y="3" width="3" height="9" fill="#e2473b"/><rect x="17" y="6" width="3" height="1.6" fill="#fff"/><rect x="5" y="16" width="3" height="2.5" fill="#bfe6ff"/><rect x="11" y="16" width="3" height="2.5" fill="#bfe6ff"/>`,
  b_market: `<path d="M3 9h18v12H3z" fill="#fbefd6"/><path d="M2 9l2-5h16l2 5z" fill="#e2473b"/><path d="M6 4l-1 5M10 4v5M14 4v5M18 4l1 5" stroke="#fff" stroke-width="1.6"/><path d="M6 15c2-3 6-3 8-1l3-2v6l-3-2c-2 2-6 2-8-1z" fill="#3fa3f0"/>`,
  b_hq: `<rect x="4" y="5" width="11" height="16" fill="#3a86e0"/><rect x="15" y="10" width="6" height="11" fill="#e4e9ef"/><path d="M6 8h7M6 11h7M6 14h7M6 17h7" stroke="#bfe6ff" stroke-width="1.6"/><rect x="16.5" y="12" width="3" height="2" fill="#7fbdf0"/><rect x="16.5" y="16" width="3" height="2" fill="#7fbdf0"/>`,
  b_farm: `<ellipse cx="12" cy="15" rx="9.5" ry="5.5" fill="#2bb3d6"/><ellipse cx="12" cy="14.2" rx="7.5" ry="3.8" fill="#7fdcf2"/><path d="M8 14c2-2 4.5-2 6-.6l2-1.4v4l-2-1.4c-1.5 1.4-4 1.4-6-.6z" fill="#f28c28"/>`,
  arrowUp: `<path d="M12 4l7 8h-4v8H9v-8H5z" fill="#fff"/>`,
  lock: `<rect ${W} x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3" stroke="#fff" stroke-width="2.2" fill="none"/>`,
};

export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// Fill every [data-ic] element with its icon.
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach(el => { if (!el.firstChild) el.innerHTML = icon(el.dataset.ic); });
}
