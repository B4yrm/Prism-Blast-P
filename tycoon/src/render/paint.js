// Canvas-2D iso painter used to generate all textures at boot.
// Grid units (tiles) in x/y, pixels (1×) in z. S = texture supersampling.

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, f, a = 1) {
  const [r, g, b] = rgb(hex);
  const c = v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return a < 1 ? `rgba(${c(r)},${c(g)},${c(b)},${a})` : `rgb(${c(r)},${c(g)},${c(b)})`;
}

export class Painter {
  constructor(ctx, ox, oy, S) { this.c = ctx; this.ox = ox; this.oy = oy; this.S = S; }

  p(x, y, z = 0) {
    return [this.ox + (x - y) * 32 * this.S, this.oy + ((x + y) * 16 - z) * this.S];
  }

  path(pts) {
    const c = this.c;
    c.beginPath();
    pts.forEach((q, i) => { const [a, b] = this.p(q[0], q[1], q[2] || 0); i ? c.lineTo(a, b) : c.moveTo(a, b); });
    c.closePath();
  }

  poly(pts, fill, stroke, lw = 1) {
    this.path(pts);
    if (fill) { this.c.fillStyle = fill; this.c.fill(); }
    if (stroke) { this.c.strokeStyle = stroke; this.c.lineWidth = lw * this.S; this.c.stroke(); }
  }

  // vertical gradient between two screen points
  vgrad(z0pt, z1pt, c0, c1) {
    const g = this.c.createLinearGradient(z0pt[0], z0pt[1], z1pt[0], z1pt[1]);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  }

  // Lit box: top, front-left (+y face), front-right (+x face).
  box(x, y, z, w, d, h, col, o = {}) {
    const top = o.top || col, L = o.left || col, R = o.right || col;
    const edge = o.edge !== false;
    if (h > 0) {
      // +y face
      this.poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]],
        this.vgrad(this.p(x, y + d, z + h), this.p(x, y + d, z), shade(L, o.lf || 0.93), shade(L, (o.lf || 0.93) * 0.86)));
      // +x face
      this.poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]],
        this.vgrad(this.p(x + w, y, z + h), this.p(x + w, y, z), shade(R, o.rf || 0.74), shade(R, (o.rf || 0.74) * 0.84)));
    }
    if (o.noTop) return;
    const tp = [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]];
    this.poly(tp, this.vgrad(this.p(x, y, z + h), this.p(x + w, y + d, z + h), shade(top, o.tf || 1.06), shade(top, (o.tf || 1.06) * 0.92)));
    if (edge) {
      // soft highlight on the near top edges
      const c = this.c;
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2 * this.S;
      c.beginPath();
      let a = this.p(x, y + d, z + h); c.moveTo(a[0], a[1]);
      a = this.p(x + w, y + d, z + h); c.lineTo(a[0], a[1]);
      a = this.p(x + w, y, z + h); c.lineTo(a[0], a[1]);
      c.stroke();
      if (h > 0) {
        c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1 * this.S;
        c.beginPath();
        a = this.p(x + w, y + d, z); c.moveTo(a[0], a[1]);
        a = this.p(x + w, y + d, z + h); c.lineTo(a[0], a[1]);
        c.stroke();
      }
    }
  }

  // Map (u,v) in [0,1]² on a face to grid coords.
  fL(x, y, z, w, d, h) { return (u, v) => [x + u * w, y + d, z + v * h]; }   // +y face, u along x
  fR(x, y, z, w, d, h) { return (u, v) => [x + w, y + u * d, z + v * h]; }   // +x face, u along y

  quad(f, u0, v0, u1, v1, fill, stroke) {
    this.poly([f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)], fill, stroke);
  }

  // Window grid on a face.
  windows(f, cols, rows, o = {}) {
    const mu = o.mu ?? 0.08, mv = o.mv ?? 0.18, gu = o.gu ?? 0.35, gv = o.gv ?? 0.4;
    const cw = (1 - 2 * mu) / cols, rh = (1 - 2 * mv) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const u0 = mu + i * cw + cw * gu / 2, u1 = mu + (i + 1) * cw - cw * gu / 2;
      const v0 = mv + j * rh + rh * gv / 2, v1 = mv + (j + 1) * rh - rh * gv / 2;
      const a = this.p(...f(u0, v1)), b = this.p(...f(u0, v0));
      this.quad(f, u0, v0, u1, v1, this.vgrad(a, b, o.c1 || '#bfe6ff', o.c2 || '#4f8fd0'), o.frame || 'rgba(255,255,255,0.7)');
      // glint
      this.poly([f(u0 + (u1 - u0) * 0.15, v1 - (v1 - v0) * 0.1), f(u0 + (u1 - u0) * 0.4, v1 - (v1 - v0) * 0.1), f(u0 + (u1 - u0) * 0.2, v0 + (v1 - v0) * 0.2)], 'rgba(255,255,255,0.35)');
    }
  }

  // Gable roof over [x..x+w]×[y..y+d] at height z, ridge along x (axis 'x') or y.
  gable(x, y, z, w, d, rh, col, axis = 'x', o = {}) {
    const ov = o.over ?? 0.15;
    x -= ov; y -= ov; w += 2 * ov; d += 2 * ov;
    if (axis === 'x') {
      const ym = y + d / 2;
      // back slope then front slope (+y side) and gable end at +x
      this.poly([[x, y, z], [x + w, y, z], [x + w, ym, z + rh], [x, ym, z + rh]], shade(col, 0.8));
      this.poly([[x, ym, z + rh], [x + w, ym, z + rh], [x + w, y + d, z], [x, y + d, z]],
        this.vgrad(this.p(x, ym, z + rh), this.p(x, y + d, z), shade(col, 1.12), shade(col, 0.92)));
      if (o.stripes) this.stripes([x, ym, z + rh], [x + w, ym, z + rh], [x + w, y + d, z], [x, y + d, z], o.stripes, shade(col, 0.8, 0.5));
      this.poly([[x + w, y + ov, z], [x + w, ym, z + rh], [x + w, y + d - ov, z]], shade(o.end || '#e9eef3', 0.78));
    } else {
      const xm = x + w / 2;
      this.poly([[x, y, z], [xm, y, z + rh], [xm, y + d, z + rh], [x, y + d, z]], shade(col, 0.95));
      this.poly([[xm, y, z + rh], [x + w, y, z], [x + w, y + d, z], [xm, y + d, z + rh]],
        this.vgrad(this.p(xm, y, z + rh), this.p(x + w, y, z), shade(col, 0.82), shade(col, 0.68)));
      if (o.stripes) this.stripes([xm, y, z + rh], [x + w, y, z], [x + w, y + d, z], [xm, y + d, z + rh], o.stripes, shade(col, 0.6, 0.45), true);
      if (o.stripes) this.stripes([x, y, z], [xm, y, z + rh], [xm, y + d, z + rh], [x, y + d, z], o.stripes, shade(col, 0.75, 0.45), true);
      this.poly([[x + ov, y + d, z], [xm, y + d, z + rh], [x + w - ov, y + d, z]], shade(o.end || '#e9eef3', 0.95));
    }
  }

  // Lines across a quad (a,b,c,d): from edge a-b toward d-c.
  stripes(a, b, c, d, n, col, along) {
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    const cx = this.c;
    cx.strokeStyle = col; cx.lineWidth = 1.2 * this.S;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p0 = along ? lerp(a, d, t) : lerp(a, b, t), p1 = along ? lerp(b, c, t) : lerp(d, c, t);
      const s0 = this.p(...p0), s1 = this.p(...p1);
      cx.beginPath(); cx.moveTo(s0[0], s0[1]); cx.lineTo(s1[0], s1[1]); cx.stroke();
    }
  }

  // Vertical cylinder centred at (cx,cy), radius r tiles.
  cyl(cx, cy, z, r, h, col, o = {}) {
    const c = this.c, S = this.S;
    const [sx, sy] = this.p(cx, cy, z);
    const rx = r * 45.25 * S, ry = r * 22.6 * S, hh = h * S;
    const g = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
    g.addColorStop(0, shade(col, 0.95)); g.addColorStop(0.35, shade(col, 1.15));
    g.addColorStop(0.75, shade(col, 0.8)); g.addColorStop(1, shade(col, 0.62));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    c.lineTo(sx - rx, sy - hh);
    c.ellipse(sx, sy - hh, rx, ry, 0, Math.PI, 0, true);
    c.closePath(); c.fill();
    if (o.bands) for (const [v0, v1, bc] of o.bands) {
      const gb = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
      gb.addColorStop(0, shade(bc, 0.95)); gb.addColorStop(0.35, shade(bc, 1.12));
      gb.addColorStop(0.75, shade(bc, 0.8)); gb.addColorStop(1, shade(bc, 0.62));
      c.fillStyle = gb;
      c.beginPath();
      c.ellipse(sx, sy - v0 * hh, rx, ry, 0, 0, Math.PI);
      c.lineTo(sx - rx, sy - v1 * hh);
      c.ellipse(sx, sy - v1 * hh, rx, ry, 0, Math.PI, 0, true);
      c.closePath(); c.fill();
    }
    if (o.noTop) return;
    c.fillStyle = o.top || shade(col, 1.05);
    c.beginPath(); c.ellipse(sx, sy - hh, rx, ry, 0, 0, Math.PI * 2); c.fill();
    if (o.rim) { c.strokeStyle = o.rim; c.lineWidth = 1.2 * S; c.stroke(); }
  }

  ellipse(cx, cy, z, r, fill, ryk = 1) {
    const [sx, sy] = this.p(cx, cy, z);
    this.c.fillStyle = fill;
    this.c.beginPath(); this.c.ellipse(sx, sy, r * 45.25 * this.S, r * 22.6 * this.S * ryk, 0, 0, Math.PI * 2); this.c.fill();
  }

  // Soft contact shadow under a footprint.
  shadow(x, y, w, d, a = 0.28) {
    const c = this.c;
    c.save();
    this.path([[x - 0.1, y - 0.1], [x + w + 0.6, y - 0.1], [x + w + 0.6, y + d + 0.4], [x - 0.1, y + d + 0.4]]);
    c.fillStyle = `rgba(20,40,30,${a})`;
    c.fill();
    c.restore();
  }

  text(str, x, y, z, size, col, o = {}) {
    const c = this.c, [sx, sy] = this.p(x, y, z);
    c.save();
    c.font = `${o.weight || 900} ${size * this.S}px "Lilita One", "Arial Black", system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineWidth = (o.sw || 3) * this.S; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(str, sx, sy); }
    c.fillStyle = col; c.fillText(str, sx, sy);
    c.restore();
  }
}

// Fish glyph in screen space (used on signs and in icons).
export function fishGlyph(c, x, y, s, col = '#3d8fe0', belly = '#cfe9ff') {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-2, -8, 8, -2); c.quadraticCurveTo(10, 0, 8, 2);
  c.quadraticCurveTo(-2, 8, -10, 0); c.fill();
  c.beginPath(); c.moveTo(-9, 0); c.lineTo(-15, -5); c.lineTo(-14, 0); c.lineTo(-15, 5); c.closePath(); c.fill();
  c.fillStyle = belly; c.beginPath(); c.moveTo(-6, 1); c.quadraticCurveTo(0, 5, 7, 1.5); c.quadraticCurveTo(0, 3, -6, 1); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(4.5, -1.2, 1.6, 0, 7); c.fill();
  c.fillStyle = '#123'; c.beginPath(); c.arc(4.9, -1.2, 0.8, 0, 7); c.fill();
  c.restore();
}
