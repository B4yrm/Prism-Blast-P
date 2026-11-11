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
  net: `<path ${S} d="M3 6c4 2 14 2 18 0M3 6l3 14M21 6l-3 14M6 20c4-1.5 8-1.5 12 0M8 6.8l2 13M16 6.8l-2 13M4.2 11c5 1.5 10.6 1.5 15.6 0M5.3 15.5c4.5 1.3 8.9 1.3 13.4 0"/>`,
  box: `<path d="M3 8l9-4 9 4v10l-9 4-9-4z" fill="#d39b57"/><path d="M3 8l9 4 9-4M12 12v10" stroke="#8a5a2b" stroke-width="1.4" fill="none"/><path d="M7.5 6l9 4" stroke="#f1d39f" stroke-width="2"/>`,
  snow: `<path ${S} d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/>`,
  star: `<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" fill="#ffd23f" stroke="#e09a00" stroke-width="1.2" stroke-linejoin="round"/>`,
  tag: `<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z" fill="#ffd23f"/><circle cx="7.5" cy="7.5" r="1.8" fill="#8a5a2b"/>`,
  mega: `<path ${W} d="M3 10v4h3l9 5V5L6 10z"/><path d="M18 9c1.5 1.5 1.5 4.5 0 6M20 7c2.7 2.8 2.7 7.2 0 10" stroke="#ffd23f" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  bolt: `<path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#ffd23f" stroke="#e09a00" stroke-width="1.2" stroke-linejoin="round"/>`,
  compass: `<circle cx="12" cy="12" r="9.5" fill="#fff"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#1f6fe0" stroke-width="1.4"/><path d="M12 5l2.5 7h-5z" fill="#e2473b"/><path d="M12 19l-2.5-7h5z" fill="#1f6fe0"/>`,
  moon: `<path d="M20 15A8.5 8.5 0 019 4a8.5 8.5 0 1011 11z" fill="#ffd23f"/><circle cx="17" cy="5" r="1" fill="#fff"/><circle cx="20" cy="9" r=".8" fill="#fff"/>`,
  ff: `<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z" fill="#fff"/>`,
  check: `<circle cx="12" cy="12" r="10" fill="#34c24a"/><path d="M7 12.5l3.3 3.3L17.5 8.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  warn: `<path d="M12 3l10 18H2z" fill="#ffd23f" stroke="#e09a00" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 9v5" stroke="#4a2a00" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.4" fill="#4a2a00"/>`,
  sound: `<path ${W} d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  vibe: `<rect ${W} x="7" y="3" width="10" height="18" rx="2"/><path d="M4 8v8M20 8v8M2 10v4M22 10v4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
  palette: `<path d="M12 3a9 9 0 100 18c1.5 0 1.8-1.2 1.2-2.2-.7-1.2 0-2.4 1.4-2.4H17a4 4 0 004-4c0-5-4-9.4-9-9.4z" fill="#fff"/><circle cx="7.5" cy="11" r="1.6" fill="#e2473b"/><circle cx="10" cy="7" r="1.6" fill="#ffd23f"/><circle cx="14.5" cy="7" r="1.6" fill="#34c24a"/><circle cx="17" cy="11" r="1.6" fill="#1f6fe0"/>`,
  hourglass: `<path ${S} d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>`,
  center: `<circle cx="12" cy="12" r="7" ${S}/><circle cx="12" cy="12" r="2.2" fill="#fff"/><path ${S} d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>`,
  arrowUp: `<path d="M12 4l7 8h-4v8H9v-8H5z" fill="#fff"/>`,
  lock: `<rect ${W} x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3" stroke="#fff" stroke-width="2.2" fill="none"/>`,
};

// Icons are shown as <img> (data-URI SVG) rather than inline SVG: an image is
// rasterised once and stays stable, while inline SVG inside composited layers
// was seen drawing stroke paths as solid blocks in an Android WebView.
const urlCache = {};
export const iconUrl = name => urlCache[name] || (urlCache[name] =
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`));
export const icon = (name, cls = '') => `<img class="ic ${cls}" src="${iconUrl(name)}" alt="" draggable="false">`;

// Fill every [data-ic] element with its icon.
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach(el => { if (!el.firstChild) el.innerHTML = icon(el.dataset.ic); });
}
