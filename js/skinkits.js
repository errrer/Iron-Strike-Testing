// Model skins: every skin has its OWN geometry kit (not a re-shuffle of shared parts), themed on what the skin is.
// `skinKit(THREE, sk, c)` returns true when it built the skin's kit. c = { add, g, L, H, cx, cz, hw, yb, yt, yl, zf, zr, glowM, accM, bodyM }
// (add(geo, mat, x, y, z, rx, ry, rz) -> mesh; z runs from the muzzle zf (negative) back to the butt zr; yb = barrel line, yt = top rail, yl = low).
export function skinKit(THREE, sk, c) {
  const { L, H, cx, cz, hw, yb, yt, yl, zf, zr, glowM, accM, bodyM } = c, T = THREE;
  const add = (geo, mat, x, y, z, rx, ry, rz) => { if (Math.abs(x - cx) < 0.016 && y > yt - 0.006 && y < yt + 0.09) x = cx + 0.026; return c.add(geo, mat, x, y, z, rx, ry, rz); };   // keep the line of sight over the top rail clear
  const now = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
  const Box = (w, h, d) => new T.BoxGeometry(w, h, d), Cone = (r, h, n = 6) => new T.ConeGeometry(r, h, n), Sph = (r) => new T.SphereGeometry(r, 10, 8), Tor = (r, t) => new T.TorusGeometry(r, t, 8, 22), Oct = (r) => new T.OctahedronGeometry(r), Cyl = (r, h, n = 10) => new T.CylinderGeometry(r, r, h, n);
  const side = hw + 0.004, sp = (i, n, a, b) => a + (b - a) * (n <= 1 ? 0.5 : i / (n - 1));
  const mk = (color, o = {}) => new T.MeshBasicMaterial({ color, transparent: o.op !== undefined, opacity: o.op === undefined ? 1 : o.op, blending: o.add ? T.AdditiveBlending : undefined, depthWrite: o.add ? false : undefined });
  const std = (color, m = 0.7, r = 0.3) => new T.MeshStandardMaterial({ color, metalness: m, roughness: r, envMapIntensity: 1.6 });
  const anim = (m, fn) => { m.onBeforeRender = () => fn(now()); return m; };
  const pulse = (m, base, amp, sp2 = 3, ph = 0) => anim(m, (t) => { m.scale.setScalar(base * (1 + amp * Math.sin(t * sp2 + ph))); });
  const chain = (n, f) => { for (let i = 0; i < n; i++) f(i, n); };
  const K = {};

  K[1] = () => {                                              // Ironwood: brass bands round the barrel + inlaid leaf diamonds
    for (const k of [0.1, 0.2, 0.3, 0.55]) add(Tor(0.0165, 0.0026), accM, cx, yb, zf + L * k, 0, 0, 0);
    chain(6, (i, n) => { for (const sd of [-1, 1]) { const o = add(Oct(0.007), accM, cx + sd * side, yb - H * 0.05, zf + L * sp(i, n, 0.14, 0.34)); o.scale.set(0.35, 1.4, 1); } });
    add(Box(0.016, 0.004, L * 0.1), accM, cx, yt + 0.006, cz + L * 0.1);
  };
  K[2] = () => {                                              // Glacier Edge: ice crystals along the top, icicles hanging under the forend
    chain(6, (i, n) => { const o = add(Oct(0.011), glowM, cx, yt + 0.012, zf + L * sp(i, n, 0.12, 0.62), 0.3 * ((i % 3) - 1), 0, 0.25 * ((i % 2) - 0.5)); o.scale.set(0.5, 1.7 - 0.1 * (i % 3), 0.7); });
    chain(8, (i, n) => add(Cone(0.005, 0.022 + 0.014 * ((i * 7) % 4) / 3, 4), glowM, cx + ((i % 2) - 0.5) * 0.012, yl - 0.004, zf + L * sp(i, n, 0.08, 0.4), Math.PI));
  };
  K[3] = () => {                                              // Spectre: a ghost shell round the muzzle, wisps trailing the butt, two glowing eyes
    const sh = add(Sph(0.03), mk(sk.glow, { op: 0.22 }), cx, yb, zf - 0.01); sh.scale.set(1, 1, 1.9);
    chain(7, (i) => { const w = add(Sph(0.016 - i * 0.0016), mk(sk.glow, { op: 0.6 - i * 0.07 }), cx, yb + 0.01, zr + 0.02 + i * 0.034); anim(w, (t) => { w.position.y = yb + 0.012 + Math.sin(t * 3 + i * 0.8) * 0.01; }); });
    for (const sd of [-1, 1]) add(Sph(0.0055), glowM, cx + sd * 0.012, yb + 0.002, zf + L * 0.04);
  };
  K[4] = () => {                                              // Ember Drake: dragon snout at the muzzle - jaw, horns, glowing eyes, breathing flames
    add(Box(0.04, 0.026, 0.07), accM, cx, yb + 0.002, zf - 0.03); add(Box(0.034, 0.012, 0.06), bodyM, cx, yb - 0.02, zf - 0.025, 0.12);
    chain(4, (i) => { for (const sd of [-1, 1]) add(Cone(0.0032, 0.011, 4), glowM, cx + sd * 0.014, yb - 0.012, zf - 0.052 + i * 0.015, Math.PI); });
    for (const sd of [-1, 1]) { add(Cone(0.007, 0.05, 4), accM, cx + sd * 0.018, yb + 0.03, zf + 0.0, -0.9, 0, sd * 0.35); add(Sph(0.0058), glowM, cx + sd * 0.02, yb + 0.012, zf - 0.015); }
    chain(3, (i) => { const f = add(Cone(0.011 - i * 0.002, 0.07, 6), mk(0xff7a1f, { op: 0.8, add: 1 }), cx, yb, zf - 0.1 - i * 0.02, -Math.PI / 2); anim(f, (t) => { const k = 0.8 + 0.4 * Math.sin(t * 22 + i * 2); f.scale.set(k, 1.1 + 0.4 * Math.sin(t * 17 + i), k); }); });
  };
  K[5] = () => {                                              // Void Bloom: a flower of petals on each receiver side, orb at its heart
    for (const sd of [-1, 1]) {
      chain(8, (i) => { const a = (i / 8) * Math.PI * 2; add(Cone(0.007, 0.034, 4), accM, cx + sd * (side + 0.004), yb + Math.cos(a) * 0.03, cz + Math.sin(a) * 0.03, a, 0, 0); });
      chain(5, (i) => { const a = (i / 5) * Math.PI * 2 + 0.3; add(Cone(0.0045, 0.02, 4), glowM, cx + sd * (side + 0.006), yb + Math.cos(a) * 0.013, cz + Math.sin(a) * 0.013, a, 0, 0); });
      add(Sph(0.007), glowM, cx + sd * (side + 0.008), yb, cz);
    }
    add(Tor(0.036, 0.002), glowM, cx, yb, cz + L * 0.04, 0, 0, 0);
  };
  K[6] = () => {                                              // Neon Syndicate: neon outline on the receiver + an equalizer of animated bars
    for (const sd of [-1, 1]) { add(Box(0.0025, 0.0025, L * 0.5), glowM, cx + sd * side, yb + H * 0.1, cz); add(Box(0.0025, 0.0025, L * 0.5), glowM, cx + sd * side, yb - H * 0.12, cz); add(Box(0.0025, H * 0.22, 0.0025), glowM, cx + sd * side, yb - H * 0.01, cz + L * 0.25); }
    chain(7, (i, n) => { const b = add(Box(0.004, 0.02, 0.005), glowM, cx + side + 0.002, yb - 0.01, zf + L * sp(i, n, 0.2, 0.5)); anim(b, (t) => { b.scale.y = 0.4 + 0.9 * Math.abs(Math.sin(t * 4 + i * 1.3)); }); });
    add(Box(0.02, 0.0025, L * 0.12), glowM, cx, yt + 0.012, zf + L * 0.42);
  };
  K[7] = () => {                                              // Crimson Saint: a floating halo, a cross on the side, a rosary swinging from the grip
    const h = add(Tor(0.04, 0.0035), glowM, cx, yt + 0.085, cz + L * 0.14, Math.PI / 2, 0, 0);
    for (const sd of [-1, 1]) { add(Box(0.003, 0.034, 0.006), glowM, cx + sd * side, yb + 0.004, cz); add(Box(0.003, 0.007, 0.024), glowM, cx + sd * side, yb + 0.01, cz); }
    chain(10, (i, n) => { const a = sp(i, n, -0.9, 0.9), b = add(Sph(0.0042), accM, cx - side + 0.002, yl + 0.02 - 0.03 * Math.cos(a) , cz + L * 0.1 + Math.sin(a) * 0.07); anim(b, (t) => { b.position.x = cx - side + Math.sin(t * 2 + i * 0.2) * 0.003; }); });
    add(Box(0.003, 0.022, 0.0045), accM, cx - side, yl - 0.02, cz + L * 0.1); add(Box(0.003, 0.0045, 0.015), accM, cx - side, yl - 0.014, cz + L * 0.1);
  };
  K[8] = () => {                                              // Aether Wing: layered feather wings sweeping back from the receiver
    for (const sd of [-1, 1]) chain(6, (i) => { const f = add(Box(0.003, 0.012, 0.06 + i * 0.022), i % 2 ? glowM : accM, cx + sd * (side + i * 0.012), yb + 0.008 + i * 0.016, cz + L * 0.12 + i * 0.016, 0, 0, sd * (0.2 + i * 0.12)); f.rotation.x = -0.2 - i * 0.06; });
    add(Sph(0.009), glowM, cx, yb + 0.03, cz + L * 0.04);
  };
  K[9] = () => {                                              // Abyss Leviathan: swaying tentacles under the gun, a slit-pupil eye at the muzzle, a dorsal fin
    for (const [k, x0] of [[0, -0.012], [1, 0], [2, 0.012]]) chain(9, (i) => { const s = add(Sph(0.016 - i * 0.0015), i % 3 ? bodyM : glowM, cx + x0 * 1.6, yl - 0.012 - i * 0.017, zf + L * (0.3 + k * 0.06) - i * 0.006); anim(s, (t) => { s.position.x = cx + x0 + Math.sin(t * 2.4 + i * 0.6 + k) * 0.004 * i; s.position.z = zf + L * (0.3 + k * 0.06) - i * 0.006 + Math.cos(t * 1.7 + i * 0.5) * 0.003 * i; }); });
    add(Sph(0.016), glowM, cx, yb + 0.004, zf - 0.012); add(Box(0.004, 0.022, 0.004), mk(0x000000), cx, yb + 0.004, zf - 0.028);
    chain(5, (i) => add(Cone(0.007, 0.03 - i * 0.003, 3), accM, cx, yt + 0.012, cz + L * 0.04 - i * 0.04, 0, 0, 0));
  };
  K[10] = () => {                                             // Solar Crown: a spinning sun disc with rays on each side + a golden crown on top
    for (const sd of [-1, 1]) {
      const disc = add(Cyl(0.02, 0.004, 14), accM, cx + sd * side, yb, cz, 0, 0, Math.PI / 2); add(Sph(0.011), glowM, cx + sd * (side + 0.003), yb, cz);
      const g2 = new T.Group(); g2.position.set(cx + sd * (side + 0.002), yb, cz);
      chain(12, (i) => { const a = (i / 12) * Math.PI * 2, r = new T.Mesh(Cone(0.005, 0.02, 4), glowM); r.position.set(0, Math.cos(a) * 0.032, Math.sin(a) * 0.032); r.rotation.x = a; g2.add(r); });
      c.g.add(g2); anim(disc, (t) => { g2.rotation.x = t * 0.8 * sd; });
    }
    chain(5, (i) => add(Cone(0.008, 0.04 - Math.abs(i - 2) * 0.008, 5), accM, cx, yt + 0.018, cz + L * 0.04 + (i - 2) * 0.022, 0, 0, (i - 2) * 0.1));
  };
  K[11] = () => {                                             // Marble Court: fluted stone columns carrying the muzzle, gold laurel leaves
    for (const y of [yb + 0.02, yb - 0.02]) { add(Cyl(0.007, 0.06, 8), bodyM, cx, y, zf + L * 0.12, Math.PI / 2); add(Box(0.022, 0.006, 0.012), accM, cx, y + 0.01, zf + L * 0.07); add(Box(0.022, 0.006, 0.012), accM, cx, y + 0.01, zf + L * 0.16); }
    for (const sd of [-1, 1]) chain(6, (i, n) => { const l = add(Sph(0.006), accM, cx + sd * side, yb + 0.006 + 0.006 * (i % 2), zf + L * sp(i, n, 0.34, 0.62)); l.scale.set(0.35, 1, 1.8); });
  };
  K[12] = () => {                                             // Cyber Pulse: spinning data rings round the barrel, circuit blocks on the sides
    chain(2, (i) => { const r = add(Tor(0.02 + i * 0.006, 0.002), glowM, cx, yb, zf + L * (0.14 + i * 0.1)); anim(r, (t) => { r.rotation.z = t * (2 + i); r.rotation.x = Math.sin(t * 1.3 + i) * 0.5; }); });
    chain(14, (i) => { for (const sd of [-1, 1]) if ((i * 5 + (sd > 0 ? 2 : 0)) % 3) add(Box(0.0025, 0.004 + 0.006 * ((i * 3) % 3) / 2, 0.008 + 0.005 * ((i * 7) % 3)), glowM, cx + sd * side, yb - 0.012 + ((i * 5) % 4) * 0.008, zf + L * (0.18 + i * 0.03)); });
    add(Tor(0.007, 0.0012), glowM, cx, yt + 0.02, cz + L * 0.08, Math.PI / 2, 0, 0);
  };
  K[13] = () => {                                             // Gilded Age: baroque scrolls, gold barrel bands and ruby studs
    for (const sd of [-1, 1]) chain(3, (i) => { const s = add(Tor(0.012 - i * 0.002, 0.0018), accM, cx + sd * side, yb, zf + L * (0.2 + i * 0.1)); s.rotation.y = Math.PI / 2; s.scale.set(1, 1, 1); });
    for (const k of [0.08, 0.5]) add(Tor(0.0165, 0.003), accM, cx, yb, zf + L * k);
    chain(4, (i) => add(Oct(0.005), mk(0xd02030), cx, yt + 0.008, zf + L * (0.16 + i * 0.12)));
  };
  K[14] = () => {                                             // Nebula: planets orbiting the receiver on a tilted ring
    const ring = add(Tor(0.05, 0.0025), glowM, cx, yb + 0.01, cz, Math.PI / 2 - 0.35, 0, 0);
    chain(3, (i) => { const pl = add(Sph(0.011 + i * 0.003), i % 2 ? glowM : bodyM, cx, yb, cz); anim(pl, (t) => { const a = t * (0.9 - i * 0.2) + i * 2.1; pl.position.set(cx + Math.sin(a) * 0.04 * 0.5, yb + 0.01 + Math.sin(a) * 0.02, cz + Math.cos(a) * 0.05); }); });
    chain(8, (i) => add(Oct(0.0025), glowM, cx + ((i * 37) % 11 - 5) * 0.004, yt + 0.02 + (i % 3) * 0.01, cz + ((i * 53) % 13 - 6) * 0.02));
  };
  K[15] = () => {                                             // Inferno: licking flames along the barrel and forend
    chain(9, (i, n) => { const f = add(Cone(0.01, 0.045, 5), mk(i % 2 ? 0xff9a2f : 0xff5a1a, { op: 0.85, add: 1 }), cx + (i % 2 ? 1 : -1) * 0.026, yb + 0.012, zf + L * sp(i, n, 0.06, 0.6)); anim(f, (t) => { f.scale.set(0.8 + 0.3 * Math.sin(t * 18 + i * 2), 0.9 + 0.5 * Math.abs(Math.sin(t * 13 + i * 1.7)), 0.8 + 0.3 * Math.cos(t * 15 + i)); }); });
    add(Box(0.004, 0.004, L * 0.5), glowM, cx + side, yb - H * 0.04, zf + L * 0.3); add(Box(0.004, 0.004, L * 0.5), glowM, cx - side, yb - H * 0.04, zf + L * 0.3);
  };
  K[16] = () => {                                             // Frostbite: snowflake plates and a fringe of icicles
    for (const sd of [-1, 1]) chain(2, (i) => { for (let a = 0; a < 3; a++) add(Box(0.0022, 0.034 - i * 0.01, 0.0036), i ? glowM : accM, cx + sd * side, yb, cz + L * (0.04 - i * 0.2), a * Math.PI / 3, 0, 0); });
    chain(10, (i, n) => add(Cone(0.0036, 0.02 + ((i * 5) % 3) * 0.01, 4), glowM, cx + ((i % 2) - 0.5) * 0.02, yl - 0.002, zf + L * sp(i, n, 0.05, 0.62), Math.PI));
    add(Oct(0.012), glowM, cx, yt + 0.014, cz + L * 0.1).scale.set(0.8, 1.6, 0.8);
  };
  K[17] = () => {                                             // Toxic Rain: hazard stripes, glowing vials and dripping slime
    chain(8, (i, n) => add(Box(0.034, 0.034, 0.012), i % 2 ? mk(0xe8c10a) : mk(0x15170f), cx, yb, zf + L * (0.04 + i * 0.012)));
    for (const sd of [-1, 1]) chain(3, (i) => { add(Cyl(0.0065, 0.04, 8), mk(sk.glow, { op: 0.8 }), cx + sd * side, yb - 0.004, zf + L * (0.22 + i * 0.1), Math.PI / 2); });
    chain(6, (i) => { const d = add(Sph(0.0055), glowM, cx + ((i % 3) - 1) * 0.012, yl - 0.004, zf + L * (0.2 + i * 0.06)); anim(d, (t) => { d.position.y = yl - 0.004 - ((t * 0.04 + i * 0.3) % 0.06); d.scale.y = 1.4; }); });
  };
  K[18] = () => {                                             // Gold Reaper: a curved scythe blade slung under the barrel, with a skull
    chain(8, (i) => { const a = i / 7; add(Box(0.006, 0.016 - a * 0.008, 0.034), bodyM, cx, yl - 0.012 - Math.sin(a * 2) * 0.03, zf + L * 0.05 + a * L * 0.28, -0.5 + a * 1.4); });
    add(Sph(0.014), bodyM, cx, yl + 0.004, zf + L * 0.42); for (const sd of [-1, 1]) add(Sph(0.0035), glowM, cx + sd * 0.006, yl + 0.008, zf + L * 0.42 - 0.011);
    add(Box(0.008, 0.01, 0.01), bodyM, cx, yl - 0.008, zf + L * 0.42 - 0.01);
  };
  K[19] = () => {                                             // Starforge: a constellation floating over the gun, joined by thin light lines
    const pts = [[-0.02, 0.04, 0.0], [0.01, 0.062, 0.1], [0.02, 0.045, 0.2], [-0.01, 0.07, 0.3], [0.0, 0.05, 0.4], [0.02, 0.07, 0.5]];
    pts.forEach((p, i) => { const s = add(Oct(0.007), glowM, cx + 0.03 + p[0] * 0.4, yt + p[1] - 0.02, zf + L * p[2] + 0.04); pulse(s, 1, 0.25, 3, i); if (i) { const q = pts[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], dz = (p[2] - q[2]) * L, len = Math.hypot(dx, dy, dz); const ln = add(Box(0.0016, 0.0016, len), mk(sk.glow, { op: 0.6 }), cx + 0.03 + (p[0] + q[0]) * 0.2, yt + (p[1] + q[1]) / 2 - 0.02, zf + L * (p[2] + q[2]) / 2 + 0.04); ln.rotation.y = Math.atan2(dx, dz) * 0; ln.rotation.x = -Math.atan2(dy, dz); } });
    add(Tor(0.03, 0.0016), glowM, cx, yb, zf + L * 0.04, 0, 0, 0);
  };
  K[20] = () => {                                             // Plasma Heart: a pulsing heart on each side wired to the barrel
    for (const sd of [-1, 1]) { const hg = new T.Group(); hg.position.set(cx + sd * (side + 0.004), yb, cz); chain(2, (i) => { const lobe = new T.Mesh(Sph(0.0085), glowM); lobe.position.set(0, 0.006, (i ? 1 : -1) * 0.007); hg.add(lobe); }); const tip = new T.Mesh(Cone(0.0155, 0.022, 5), glowM); tip.rotation.x = Math.PI; tip.position.set(0, -0.007, 0); hg.add(tip); c.g.add(hg); anim(tip, (t) => { hg.scale.setScalar(1 + 0.18 * Math.max(0, Math.sin(t * 5.5))); }); }
    chain(5, (i) => add(Box(0.0022, 0.0022, 0.03), glowM, cx, yb + 0.014, zf + L * (0.1 + i * 0.07)));
    chain(5, (i) => add(Cone(0.005, 0.026, 4), accM, cx, yt + 0.012, cz + L * 0.04 - i * 0.03));
  };
  K[21] = () => {                                             // Dragon Emperor: overlapping scales, long whiskers, a pearl and swept horns
    chain(14, (i, n) => { for (const sd of [-1, 1]) { const s = add(Sph(0.007), i % 2 ? accM : bodyM, cx + sd * (side - 0.001), yb + ((i % 2) ? 0.007 : -0.001), zf + L * sp(i, n, 0.1, 0.56)); s.scale.set(0.35, 0.8, 1.3); } });
    for (const sd of [-1, 1]) chain(8, (i) => { const b = add(Sph(0.0028), accM, cx + sd * (0.012 + i * 0.006), yb + 0.004 - i * 0.0015, zf - 0.01 - i * 0.012); anim(b, (t) => { b.position.y = yb + 0.004 - i * 0.0015 + Math.sin(t * 3 + i * 0.5) * 0.004; }); });
    add(Sph(0.011), mk(0xffffff, { op: 0.9 }), cx, yb, zf - 0.02); for (const sd of [-1, 1]) add(Cone(0.006, 0.05, 4), accM, cx + sd * 0.016, yb + 0.03, zf + L * 0.18, -1.0, 0, sd * 0.5);
  };
  K[22] = () => {                                             // Celestial: large white angel wings, a vertical halo and drifting sparkles
    for (const sd of [-1, 1]) chain(7, (i) => { const f = add(Box(0.002, 0.007, 0.04 + i * 0.012), bodyM, cx + sd * (side + i * 0.004), yb + 0.004 + i * 0.012, cz + L * 0.12 + i * 0.01, -0.2 - i * 0.03, 0, sd * (0.1 + i * 0.1)); });
    add(Tor(0.026, 0.0025), glowM, cx, yt + 0.036, cz + L * 0.2, 0, 0, 0);
    chain(6, (i) => { const s = add(Oct(0.0035), glowM, cx, yt + 0.03, cz); anim(s, (t) => { const a = t * 0.7 + i * 1.05; s.position.set(cx + Math.sin(a) * 0.04, yt + 0.03 + Math.sin(a * 1.7) * 0.015, cz + L * 0.1 + Math.cos(a) * 0.1); s.rotation.y = t * 2; }); });
  };

  const f = K[sk.id]; if (!f) return false; f(); return true;
}
