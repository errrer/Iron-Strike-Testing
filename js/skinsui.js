// Skins & Cases panel: pick a model skin for a gun (camos still stack on top through the Gunsmith), buy cases and watch them open.
import { WEAPONS, SKINS, CASES, RARITY, cleanMask, skinOf, setSkin, withAtt } from './weapons.js?v=0.19.2';
import { WeaponPreview } from './wpreview.js?v=0.19.2';

const $ = (id) => document.getElementById(id);
const mk = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const grad = (s) => `linear-gradient(135deg, ${hex(s.body)} 0%, ${hex(s.accent)} 60%, ${hex(s.glow)} 100%)`;
const money = (c) => (c === Infinity ? '$∞' : '$' + c.toLocaleString('en-US'));

export class SkinsUI {
  // opts: { prog, getMask(id), setMask(id, mask), onClose() }
  constructor(opts) {
    this.o = opts; this.id = null; this.tab = 'mine'; this.open = false; this.root = $('sk'); if (!this.root) return;
    try { this.prev = new WeaponPreview($('skCanvas')); } catch (e) { this.prev = null; }
    $('skClose').addEventListener('click', () => this.close());
    this.root.addEventListener('keydown', (e) => { if (e.code === 'Escape') { e.stopPropagation(); this.close(); } });
    for (const b of this.root.querySelectorAll('.sk-tabs button')) b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); });
  }
  show(id, tab) { if (!this.root) return; this.id = id; if (tab) this.tab = tab; this.open = true; this.root.classList.remove('hidden'); this.render(); this.preview(); setTimeout(() => $('skClose').focus(), 0); }
  close() { if (!this.open) return; this.open = false; this.root.classList.add('hidden'); if (this.o.onClose) this.o.onClose(this.id); }
  tick(dt) { if (this.open && this.prev && this.prev.ok) { try { this.prev.tick(dt); } catch (e) { this.prev.ok = false; } } }
  mask() { return cleanMask(WEAPONS[this.id], this.o.getMask(this.id)); }
  preview() { if (this.prev && this.prev.ok) this.prev.show(withAtt(WEAPONS[this.id], this.mask())); }
  equip(skinId) { this.o.setMask(this.id, cleanMask(WEAPONS[this.id], setSkin(this.mask(), skinId))); this.render(); this.preview(); }

  render() {
    const w = WEAPONS[this.id], cur = skinOf(this.mask()), prog = this.o.prog;
    $('skTitle').textContent = `SKINS - ${w.name}`; $('skCash').textContent = `Balance ${money(prog.cash)}`;
    for (const b of this.root.querySelectorAll('.sk-tabs button')) b.classList.toggle('on', b.dataset.tab === this.tab);
    $('skName').textContent = cur ? `${SKINS[cur].name}  -  ${RARITY[SKINS[cur].rarity].name}` : 'Factory finish';
    $('skName').style.color = cur ? RARITY[SKINS[cur].rarity].color : '#cfd6dd';
    const list = $('skList'); list.textContent = '';
    if (this.tab === 'mine') {
      list.appendChild(mk('p', 'sk-hint', 'Skins reshape the gun. Open the Gunsmith afterwards to add a camo on top.'));
      const grid = mk('div', 'sk-grid');
      const none = mk('button', 'sk-card' + (!cur ? ' sel' : '')); none.type = 'button'; none.appendChild(mk('i', 'sk-sw none')); none.appendChild(mk('b', null, 'Factory')); none.appendChild(mk('span', null, 'Default model')); none.addEventListener('click', () => this.equip(0)); grid.appendChild(none);
      for (const s of SKINS) {
        if (!s) continue;
        const own = prog.ownsSkin(s.id), b = mk('button', 'sk-card r-' + s.rarity + (cur === s.id ? ' sel' : '') + (own ? '' : ' locked')); b.type = 'button';
        const sw = mk('i', 'sk-sw'); sw.style.background = grad(s); if (!own) sw.appendChild(mk('s', null, '?')); b.appendChild(sw);
        b.appendChild(mk('b', null, own ? s.name : '???')); b.appendChild(mk('span', null, own ? RARITY[s.rarity].name : `${RARITY[s.rarity].name} - find in cases`));
        if (own) b.addEventListener('click', () => this.equip(s.id)); else b.title = 'Win it from a case';
        grid.appendChild(b);
      }
      list.appendChild(grid);
    } else this.renderCases(list);
  }

  renderCases(list) {
    const prog = this.o.prog;
    list.appendChild(mk('p', 'sk-hint', `Open a case for a random skin that works on every gun. Duplicates pay a refund. Earn $100 for every win.`));
    for (const c of CASES) {
      const row = mk('div', 'sk-case'), art = mk('i', 'sk-box'); art.style.setProperty('--t', c.tint); row.appendChild(art);
      const info = mk('div', 'sk-ci'); info.appendChild(mk('b', null, c.name));
      info.appendChild(mk('span', null, Object.entries(c.odds).filter(([, p]) => p > 0).map(([k, p]) => `${RARITY[k].name} ${Math.round(p * 1000) / 10}%`).join('  -  ')));
      row.appendChild(info);
      const b = mk('button', 'btn primary sk-open', `OPEN  ${money(c.price)}`); b.type = 'button'; b.disabled = !prog.canOpen(c); b.addEventListener('click', () => this.openCase(c)); row.appendChild(b);
      list.appendChild(row);
    }
  }

  // CS-style reel: a strip of random skins slides and slows down onto the one you won
  openCase(c) {
    const prog = this.o.prog; if (this.busy || !prog.canOpen(c)) return;
    const res = prog.openCase(c); if (!res) return; this.busy = true; if (this.o.onBuy) this.o.onBuy();
    const ov = $('skReel'), strip = $('skStrip'); strip.textContent = ''; strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
    const N = 46, WIN = 38, pick = () => SKINS[1 + Math.floor(Math.random() * (SKINS.length - 1))];
    for (let i = 0; i < N; i++) { const s = i === WIN ? res.skin : pick(), t = mk('div', 'sk-tile r-' + s.rarity); const sw = mk('i'); sw.style.background = grad(s); t.appendChild(sw); t.appendChild(mk('b', null, s.name)); strip.appendChild(t); }
    $('skResult').classList.add('hidden'); ov.classList.remove('hidden');
    const tile = 150, vw = $('skWindow').clientWidth || 600, target = -(WIN * tile + tile / 2 - vw / 2 + (Math.random() - 0.5) * 80);
    requestAnimationFrame(() => requestAnimationFrame(() => { strip.style.transition = 'transform 5.2s cubic-bezier(0.08, 0.7, 0.12, 1)'; strip.style.transform = `translateX(${target}px)`; }));
    const done = () => {
      const r = $('skResult'); r.className = 'sk-result r-' + res.skin.rarity; r.textContent = '';
      const sw = mk('i', 'sk-sw big'); sw.style.background = grad(res.skin); r.appendChild(sw);
      r.appendChild(mk('h2', null, res.skin.name)); r.appendChild(mk('p', null, `${RARITY[res.skin.rarity].name} skin${res.dup ? `  -  DUPLICATE, refunded ${money(res.refund)}` : '  -  added to your collection'}`));
      const ok = mk('button', 'btn primary', res.dup ? 'OK' : 'EQUIP ON THIS GUN'); ok.type = 'button'; ok.addEventListener('click', () => { ov.classList.add('hidden'); this.busy = false; if (!res.dup) this.equip(res.skin.id); else this.render(); });
      const no = mk('button', 'btn', 'CLOSE'); no.type = 'button'; no.addEventListener('click', () => { ov.classList.add('hidden'); this.busy = false; this.render(); });
      const row = mk('div', 'sk-rbtn'); row.appendChild(ok); row.appendChild(no); r.appendChild(row); r.classList.remove('hidden');
    };
    this._t = setTimeout(done, 5400);
    if (this.o.fast) { clearTimeout(this._t); done(); }
  }
}
