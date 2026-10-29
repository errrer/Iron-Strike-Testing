// COD-style Gunsmith: a full-screen overlay with the gun in the middle, one box per attachment slot around it, a pick list with the
// trade-offs of every option, and the weapon stats (with numbers) updating live as you swap parts.
import { WEAPONS, SLOTS, ATT, CAMOS, camoReqText, withAtt, weaponStats, cleanMask, getSlot, setSlot, setCamo, camoOf, attList } from './weapons.js?v=0.18.0';
import { WeaponPreview } from './wpreview.js?v=0.18.0';
import { camoSwatch, decal } from './gunmodels.js?v=0.18.0';

const $ = (id) => document.getElementById(id);
const mk = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
const ORDER = ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'mag', 'ammo', 'camo'];
const SLOT_NAME = Object.fromEntries(SLOTS.map((s) => [s.id, s.name])); SLOT_NAME.camo = 'Camo';

// "+4 Range" style chips for the change between two weapon stat sets
export function statDeltas(a, b) {
  const out = [];
  a.forEach((r, i) => { const d = Math.round((b[i].v - r.v) * 100) / 100; if (!d) return; out.push({ k: r.k, d, good: d * r.good > 0, unit: r.k === 'Range' ? ' m' : r.k === 'Reload' ? ' s' : r.k === 'Mobility' ? '%' : '' }); });
  return out;
}
export const deltaText = (x) => `${x.d > 0 ? '+' : ''}${x.d}${x.unit} ${x.k}`;

export class Gunsmith {
  // opts: { prog, getMask(id), setMask(id, mask), onClose() }
  constructor(opts) {
    this.o = opts; this.id = null; this.sel = 'muzzle'; this.open = false; this.prev = null;
    this.root = $('gs'); if (!this.root) return;
    try { this.prev = new WeaponPreview($('gsCanvas')); } catch (e) { this.prev = null; }
    $('gsClose').addEventListener('click', () => this.close());
    this.root.addEventListener('keydown', (e) => { if (e.code === 'Escape') { e.stopPropagation(); this.close(); } });
  }
  show(id) {
    if (!this.root) return; this.id = id; this.open = true; this.root.classList.remove('hidden');
    const w = WEAPONS[id]; const first = ORDER.find((s) => s === 'camo' || (w.opts && w.opts[s])); this.sel = (this.sel !== 'camo' && w.opts && w.opts[this.sel]) ? this.sel : (first || 'camo');
    this.render(); setTimeout(() => $('gsClose').focus(), 0);
  }
  close() { if (!this.open) return; this.open = false; this.root.classList.add('hidden'); if (this.o.onClose) this.o.onClose(this.id); }
  tick(dt) { if (this.open && this.prev && this.prev.ok) { try { this.prev.tick(dt); } catch (e) { this.prev.ok = false; } } }
  mask() { return cleanMask(WEAPONS[this.id], this.o.getMask(this.id)); }
  apply(m) { this.o.setMask(this.id, cleanMask(WEAPONS[this.id], m)); this.render(true); }

  render(keepPreview) {
    const w = WEAPONS[this.id], mask = this.mask(), cur = withAtt(w, mask);
    $('gsTitle').textContent = `${w.name} GUNSMITH`;
    const n = attList(mask).length, total = Object.keys(w.opts || {}).length;
    $('gsEquipped').textContent = `Equipped ${n}/${total}`; $('gsDots').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    // slot boxes
    const grid = $('gsSlots'); grid.textContent = '';
    for (const s of ORDER) {
      const avail = s === 'camo' || (w.opts && w.opts[s]), b = mk('button', 'gs-slot' + (this.sel === s ? ' sel' : '') + (avail ? '' : ' na')); b.type = 'button'; b.dataset.slot = s;
      b.appendChild(mk('b', null, SLOT_NAME[s]));
      let line = 'Not available';
      if (s === 'camo') line = CAMOS[camoOf(mask)].name;
      else if (avail) { const a = attList(mask).find((x) => x.slot === s); line = a ? a.name : 'None'; if (a) b.classList.add('has'); }
      b.appendChild(mk('span', null, line));
      if (avail) b.addEventListener('click', () => { this.sel = s; this.render(true); }); else b.disabled = true;
      grid.appendChild(b);
    }
    // pick list for the selected slot
    const pick = $('gsPick'); pick.textContent = ''; pick.appendChild(mk('h3', null, SLOT_NAME[this.sel]));
    if (this.sel === 'camo') this.renderCamos(pick, mask);
    else {
      const opts = (w.opts && w.opts[this.sel]) || [], base = weaponStats(cur);
      const mkRow = (name, desc, on, deltas, fn) => {
        const r = mk('button', 'gs-opt' + (on ? ' sel' : '')); r.type = 'button'; r.appendChild(mk('b', null, name)); if (desc) r.appendChild(mk('p', null, desc));
        const dl = mk('div', 'gs-d'); for (const x of deltas) dl.appendChild(mk('em', x.good ? 'up' : 'down', deltaText(x))); if (deltas.length) r.appendChild(dl);
        r.addEventListener('click', fn); pick.appendChild(r);
      };
      const without = withAtt(w, setSlot(mask, this.sel, 0)), wsStats = weaponStats(without);
      mkRow('None', 'Stock part.', getSlot(mask, this.sel) === 0, statDeltas(base, wsStats).length && getSlot(mask, this.sel) ? statDeltas(base, wsStats) : [], () => this.apply(setSlot(mask, this.sel, 0)));
      for (const key of opts) { const a = ATT[key]; mkRow(a.name, a.desc, getSlot(mask, this.sel) === a.v, statDeltas(wsStats, weaponStats(withAtt(w, setSlot(mask, this.sel, a.v)))), () => this.apply(setSlot(mask, this.sel, a.v))); }
    }
    if (this.sel === 'optic' && getSlot(mask, 'optic') === ATT.decal.v) this.renderDecal(pick);
    // stats panel (numbers + bars + change vs. stock gun)
    const stock = weaponStats(w), now = weaponStats(cur), box = $('gsStats'); box.textContent = '';
    now.forEach((r, i) => {
      const row = mk('div', 'gs-stat'), d = Math.round((r.v - stock[i].v) * 100) / 100;
      row.appendChild(mk('span', null, r.k));
      const bar = mk('i'), fill = mk('b'); fill.style.width = Math.round(r.bar * 100) + '%'; bar.appendChild(fill);
      if (d) { const ghost = mk('u'); ghost.style.width = Math.round(stock[i].bar * 100) + '%'; ghost.className = (d * r.good > 0) ? 'g' : 'r'; bar.appendChild(ghost); fill.classList.add(d * r.good > 0 ? 'up' : 'down'); }
      row.appendChild(bar); row.appendChild(mk('strong', d ? (d * r.good > 0 ? 'up' : 'down') : '', r.text));
      box.appendChild(row);
    });
    if (this.prev && this.prev.ok) { try { this.prev.show({ ...w, attMask: mask }); } catch (e) { this.prev.ok = false; } }
  }

  // Custom Decal Sight: choose / clear your own reticle image (saved on this device)
  renderDecal(pick) {
    const box = mk('div', 'gs-decal'); box.appendChild(mk('b', null, 'Your reticle image'));
    box.appendChild(mk('p', null, decal.hasImage ? 'Custom image loaded. Pick another to replace it.' : 'Using the default ring reticle. Pick any picture (PNG with a transparent background works best).'));
    const file = mk('input'); file.type = 'file'; file.accept = 'image/*'; file.style.display = 'none';
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = async () => { await decal.load(rd.result, true); this.render(true); }; rd.readAsDataURL(f);
    });
    const pickBtn = mk('button', 'btn', 'Choose image...'); pickBtn.type = 'button'; pickBtn.addEventListener('click', () => file.click());
    const clr = mk('button', 'btn', 'Reset'); clr.type = 'button'; clr.addEventListener('click', () => { decal.clear(); this.render(true); });
    const row = mk('div', 'gs-decal-row'); row.appendChild(pickBtn); row.appendChild(clr); row.appendChild(file); box.appendChild(row);
    const lab = mk('label', 'chk'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = decal.keyDark; cb.addEventListener('change', () => decal.setKeyDark(cb.checked));
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' Hide dark background')); box.appendChild(lab);
    pick.appendChild(box);
  }

  renderCamos(pick, mask) {
    const id = this.id, prog = this.o.prog, grid = mk('div', 'gs-camos');
    for (const c of CAMOS) {
      const open = prog.camoUnlocked(id, c.id), b = mk('button', 'camo' + (camoOf(mask) === c.id ? ' sel' : '') + (open ? '' : ' locked')); b.type = 'button';
      const sw = mk('i', 'sw'); const url = c.id ? camoSwatch(c.id, 120, 64) : ''; if (url) sw.style.backgroundImage = `url(${url})`; else if (!c.id) sw.classList.add('factory'); if (!open) sw.appendChild(mk('s', null, '\u{1F512}'));
      b.appendChild(sw); b.appendChild(mk('b', null, c.name));
      const n = prog.camoProgress(id, c.id), need = c.req.n;
      b.appendChild(mk('span', null, open ? (c.id ? 'Unlocked' : 'Default') : `${camoReqText(c)}${c.req.t === 'level' ? '' : ` (${Math.min(n, need)}/${need})`}`));
      if (!open && c.req.t !== 'level') { const p = mk('div', 'prog'), f = mk('b'); f.style.width = Math.min(100, Math.round(100 * n / need)) + '%'; p.appendChild(f); b.appendChild(p); }
      if (open) b.addEventListener('click', () => this.apply(setCamo(mask, c.id))); else b.title = camoReqText(c);
      grid.appendChild(b);
    }
    pick.appendChild(grid);
  }
}
