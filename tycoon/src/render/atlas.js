// Sprite-atlas registry. Atlases are TexturePacker "JSON hash" pages whose
// frames carry a pivot (the sprite's ground anchor). The build inlines every
// page from assets/atlas/ as window.__ATLAS; replacing those PNG/WebP + JSON
// files (same frame names) swaps the art without touching game code.
//
// Frame naming:  b/<building>/<tier>   boat/<class>/<dir>   p/<look>/<carry>/<dir>/<step>
//                prop/<name>   t/<tile>   k/<kenney-model>/<rotation>
// dir: 0 = +x, 1 = +y, 2 = −x, 3 = −y (grid directions)

export const A = {
  ready: false,
  frames: {},          // name → { key, img, x, y, w, h, px, py }
};

export function loadAtlases(scene, quality) {
  const pages = window.__ATLAS || [];
  const down = quality === 'low';
  return Promise.all(pages.map((pg, i) => new Promise(res => {
    const img = new Image();
    img.onload = () => {
      let src = img, json = pg.json, k = 1;
      if (down) {
        // halve the texture for weak phones; frame data is scaled to match
        k = 0.5;
        const c = document.createElement('canvas');
        c.width = Math.ceil(img.width * k); c.height = Math.ceil(img.height * k);
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
        src = c;
        json = { ...json, frames: {} };
        for (const [n, f] of Object.entries(pg.json.frames)) {
          const r = f.frame, x = Math.floor(r.x * k), y = Math.floor(r.y * k), w = Math.max(1, Math.ceil((r.x + r.w) * k) - x), h = Math.max(1, Math.ceil((r.y + r.h) * k) - y);
          json.frames[n] = { ...f, frame: { x, y, w, h }, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } };
        }
      }
      const key = 'atlas' + i;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addAtlasJSONHash(key, src, json);
      for (const [n, f] of Object.entries(json.frames)) {
        A.frames[n] = { key, img: src, x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, px: f.pivot.x * f.frame.w, py: f.pivot.y * f.frame.h, s: (1 / (pg.json.meta.scale || 2)) / k };
      }
      res();
    };
    img.onerror = () => res();
    img.src = pg.img;
  }))).then(() => { A.ready = Object.keys(A.frames).length > 0; window.__ATLAS = null; });
}

export const has = name => !!A.frames[name];

// Adds an image anchored by the frame pivot at world (x, y).
export function addSprite(scene, x, y, name, scale = 1) {
  const f = A.frames[name];
  const img = scene.add.image(x, y, f.key, name).setScale(f.s * scale);
  img.atlasScale = f.s * scale;
  return img;
}

// Draws a frame into a 2D canvas so that its pivot lands on (dx, dy); s = world→canvas scale.
export function drawFrame(ctx, name, dx, dy, s, scale = 1) {
  const f = A.frames[name];
  if (!f) return false;
  const k = f.s * s * scale;
  ctx.drawImage(f.img, f.x, f.y, f.w, f.h, dx - f.px * k, dy - f.py * k, f.w * k, f.h * k);
  return true;
}

// Switches a sprite to another atlas frame (possibly on another page).
export function setSprite(img, name, scale = 1) {
  const f = A.frames[name];
  if (!f) return img;
  if (img.texture.key !== f.key) img.setTexture(f.key, name); else img.setFrame(name);
  return img.setScale(f.s * scale);
}
