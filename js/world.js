import { B, DX, DY, DZ, OPP, DOWN, isSolid, needsSupport, floorOnly } from './blocks.js';

const SETKEY = {
  [B.WIRE]: 'wire', [B.TORCH]: 'torch', [B.LEVER]: 'lever',
  [B.REPEATER]: 'repeater', [B.RSBLOCK]: 'rsblock', [B.LAMP]: 'lamp',
};

export class World {
  constructor(sx = 48, sy = 20, sz = 48) {
    this.SX = sx; this.SY = sy; this.SZ = sz;
    this.n = sx * sy * sz;
    this.id = new Uint8Array(this.n);
    this.dir = new Uint8Array(this.n);
    this.dly = new Uint8Array(this.n);   // 리피터 지연 0..3 (=1..4틱)
    this.st = new Uint8Array(this.n);    // bit0: on/off
    this.sets = {
      wire: new Set(), torch: new Set(), lever: new Set(),
      repeater: new Set(), rsblock: new Set(), lamp: new Set(),
    };
    this.version = 0;
    this.reset();
  }

  idx(x, y, z) { return (y * this.SZ + z) * this.SX + x; }
  inb(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.SX && y < this.SY && z < this.SZ; }
  xyz(i) {
    const x = i % this.SX; const t = (i - x) / this.SX;
    const z = t % this.SZ; const y = (t - z) / this.SZ;
    return [x, y, z];
  }
  nbr(i, d) {
    const x = i % this.SX; const t = (i - x) / this.SX;
    const z = t % this.SZ; const y = (t - z) / this.SZ;
    const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
    if (!this.inb(nx, ny, nz)) return -1;
    return this.idx(nx, ny, nz);
  }
  above(i) { return this.nbr(i, 4); }
  below(i) { return this.nbr(i, 5); }
  idAt(i) { return i < 0 ? B.AIR : this.id[i]; }
  on(i) { return i >= 0 && (this.st[i] & 1) === 1; }
  setOn(i, v) { if (v) this.st[i] |= 1; else this.st[i] &= ~1; }

  reset() {
    this.id.fill(0); this.dir.fill(0); this.dly.fill(0); this.st.fill(0);
    for (const k in this.sets) this.sets[k].clear();
    for (let z = 0; z < this.SZ; z++)
      for (let x = 0; x < this.SX; x++)
        this.id[this.idx(x, 0, z)] = B.FLOOR;
    this.version++;
  }

  setIdx(i, id, dir = 0, dly = 0, on = 0) {
    const old = this.id[i];
    const ok = SETKEY[old]; if (ok) this.sets[ok].delete(i);
    this.id[i] = id; this.dir[i] = dir; this.dly[i] = dly;
    this.st[i] = on ? 1 : 0;
    const nk = SETKEY[id]; if (nk) this.sets[nk].add(i);
    this.version++;
  }
  set(x, y, z, id, dir = 0, dly = 0, on = 0) {
    if (!this.inb(x, y, z)) return -1;
    const i = this.idx(x, y, z);
    this.setIdx(i, id, dir, dly, on);
    return i;
  }

  isSolidAt(i) { return i >= 0 && isSolid(this.id[i]); }

  // 부품을 놓을 수 있는지 확인 (지지 블럭 존재 여부)
  canPlace(i, id, dir) {
    if (i < 0) return false;
    if (this.id[i] !== B.AIR) return false;
    if (!needsSupport(id)) return true;
    const sd = floorOnly(id) ? DOWN : dir;
    const s = this.nbr(i, sd);
    return this.isSolidAt(s);
  }

  /* 지지 블럭이 사라진 부품을 연쇄적으로 제거.  [[인덱스, 원래 id], ...] 를 돌려준다 */
  dropUnsupported(seed) {
    const stack = Array.isArray(seed) ? seed.slice() : [seed];
    const removed = [];
    while (stack.length) {
      const i = stack.pop();
      if (i < 0) continue;
      for (let d = 0; d < 6; d++) {
        const n = this.nbr(i, d);
        if (n < 0) continue;
        const nid = this.id[n];
        if (!needsSupport(nid)) continue;
        const sd = floorOnly(nid) ? DOWN : this.dir[n];
        if (this.nbr(n, sd) !== i) continue;
        if (this.isSolidAt(i)) continue;
        this.setIdx(n, B.AIR);
        removed.push([n, nid]); stack.push(n);
      }
    }
    return removed;
  }

  serialize() {
    const out = [];
    for (let i = 0; i < this.n; i++) {
      const id = this.id[i];
      if (id === B.AIR || id === B.FLOOR) continue;
      out.push([i, id, this.dir[i], this.dly[i], this.st[i] & 1]);
    }
    return { v: 1, size: [this.SX, this.SY, this.SZ], blocks: out };
  }

  deserialize(data) {
    if (!data || !Array.isArray(data.blocks)) return false;
    this.reset();
    for (const [i, id, dir, dly, on] of data.blocks) {
      if (i >= 0 && i < this.n) this.setIdx(i, id, dir | 0, dly | 0, on | 0);
    }
    return true;
  }
}
