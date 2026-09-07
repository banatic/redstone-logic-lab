import { B, OPP, UP } from './blocks.js';

/*
 교육용으로 단순화한 레드스톤 규칙
 ------------------------------------------------------------------
 1) 신호 세기는 0~15. 와이어를 한 칸 지날 때마다 1씩 줄어든다.
 2) 전원(세기 15): 레드스톤 블럭 / 켜진 레버 / 켜진 토치 / 켜진 리피터 출력
 3) 강한 신호(強): 일반 블럭이 "강하게" 충전되면 그 블럭에 닿은 와이어를 15로 만든다.
    - 토치는 자기 "바로 위" 블럭을 강하게 충전한다.
    - 레버는 자기가 붙은 블럭을 강하게 충전한다.
    - 리피터는 자기가 바라보는 앞쪽 블럭을 강하게 충전한다.
 4) 약한 신호(弱): 와이어는 자기 아래 블럭과, 자기가 가리키는 방향의 블럭을
    약하게 충전한다. 약한 신호는 램프/리피터/토치를 작동시키지만
    다른 와이어로는 흘러나가지 않는다.
 5) 토치는 자기가 붙은 블럭이 충전되면 꺼진다  →  NOT 게이트
 6) 비전도 블럭(유리)과 바닥판은 절대 충전되지 않는다  →  절연체
*/

export class Redstone {
  constructor(world) {
    this.w = world;
    this.power = new Uint8Array(world.n);   // 와이어 신호 세기
    this.strong = new Uint8Array(world.n);  // 강한 충전
    this.weak = new Uint8Array(world.n);    // 약한 충전
    this.cnt = new Uint8Array(world.n);     // 지연 카운터
    this.buckets = Array.from({ length: 16 }, () => []);
    this.ticks = 0;
    this.compute();
  }

  // ---- 보조 ----------------------------------------------------
  isReceiverAt(i) { const id = this.w.idAt(i); return id === B.STONE || id === B.LAMP; }
  isChargedBlock(i) { return i >= 0 && (this.strong[i] > 0 || this.weak[i] > 0); }

  /* 와이어 i 가 수평 방향 d(0..3) 로 연결되는지.
     반환: 연결된 와이어 인덱스(없으면 -2), 미연결이면 -1 */
  wireLink(i, d) {
    const w = this.w;
    const n = w.nbr(i, d);
    if (n < 0) return -1;
    const nid = w.id[n];
    if (nid === B.WIRE) return n;
    // 한 칸 위 와이어로 타고 올라감 (내 머리 위가 막혀있지 않을 때)
    const up = w.above(n);
    if (up >= 0 && w.id[up] === B.WIRE && !w.isSolidAt(w.above(i))) return up;
    // 한 칸 아래 와이어로 타고 내려감 (옆 칸이 막혀있지 않을 때)
    const dn = w.below(n);
    if (dn >= 0 && w.id[dn] === B.WIRE && !w.isSolidAt(n)) return dn;
    // 부품과 맞닿으면 모양만 연결
    if (nid === B.LAMP || nid === B.RSBLOCK || nid === B.TORCH || nid === B.LEVER) return -2;
    if (nid === B.REPEATER && (w.dir[n] === d || w.dir[n] === OPP[d])) return -2;
    return -1;
  }

  /* 와이어 모양: 연결된 방향들과, 신호를 "가리키는" 방향들 */
  wireShape(i) {
    const links = [];
    const dirs = [];
    for (let d = 0; d < 4; d++) {
      const r = this.wireLink(i, d);
      if (r !== -1) { dirs.push(d); if (r >= 0) links.push(r); }
    }
    let points;
    if (dirs.length === 0) points = [];             // 점 모양: 옆으로 못 나감
    else if (dirs.length === 1) points = [dirs[0], OPP[dirs[0]]]; // 직선 모양
    else points = dirs;
    return { dirs, links, points };
  }

  /* 이웃 n 이 방향 d(와이어→n) 로 와이어에 주는 전원 세기 */
  emitToWire(n, d) {
    const w = this.w;
    switch (w.id[n]) {
      case B.RSBLOCK: return 15;
      case B.TORCH: return (w.on(n) && w.dir[n] !== OPP[d]) ? 15 : 0;
      case B.LEVER: return (w.on(n) && w.dir[n] !== OPP[d]) ? 15 : 0;
      case B.REPEATER: return (w.on(n) && w.dir[n] === OPP[d]) ? 15 : 0;
      case B.STONE: return this.strong[n] > 0 ? 15 : 0;
      default: return 0;
    }
  }

  // ---- 신호장 계산 ---------------------------------------------
  compute() {
    const w = this.w;
    this.power.fill(0); this.strong.fill(0); this.weak.fill(0);

    // 1) 부품 → 블럭 강한 충전
    for (const i of w.sets.torch) {
      if (!w.on(i)) continue;
      const a = w.above(i);
      if (this.isReceiverAt(a)) this.strong[a] = 15;
      for (let d = 0; d < 6; d++) {
        if (d === w.dir[i]) continue;
        const n = w.nbr(i, d);
        if (n >= 0 && w.id[n] === B.LAMP) this.strong[n] = 15;
      }
    }
    for (const i of w.sets.lever) {
      if (!w.on(i)) continue;
      const s = w.nbr(i, w.dir[i]);
      if (this.isReceiverAt(s)) this.strong[s] = 15;
      for (let d = 0; d < 6; d++) {
        if (d === w.dir[i]) continue;
        const n = w.nbr(i, d);
        if (n >= 0 && w.id[n] === B.LAMP) this.strong[n] = 15;
      }
    }
    for (const i of w.sets.repeater) {
      if (!w.on(i)) continue;
      const f = w.nbr(i, w.dir[i]);
      if (this.isReceiverAt(f)) this.strong[f] = 15;
    }
    for (const i of w.sets.rsblock) {
      for (let d = 0; d < 6; d++) {
        const n = w.nbr(i, d);
        if (n >= 0 && w.id[n] === B.LAMP) this.strong[n] = 15;
      }
    }

    // 2) 와이어 초기 세기
    const bk = this.buckets;
    for (let k = 0; k < 16; k++) bk[k].length = 0;
    for (const i of w.sets.wire) {
      let lvl = 0;
      for (let d = 0; d < 6; d++) {
        const n = w.nbr(i, d);
        if (n < 0) continue;
        const e = this.emitToWire(n, d);
        if (e > lvl) lvl = e;
      }
      if (lvl > 0) { this.power[i] = lvl; bk[lvl].push(i); }
    }

    // 3) 와이어 전파 (한 칸당 -1)
    for (let lvl = 15; lvl >= 2; lvl--) {
      const arr = bk[lvl];
      for (let k = 0; k < arr.length; k++) {
        const i = arr[k];
        if (this.power[i] !== lvl) continue;
        const { links } = this.wireShape(i);
        for (const j of links) {
          if (this.power[j] < lvl - 1) { this.power[j] = lvl - 1; bk[lvl - 1].push(j); }
        }
      }
    }

    // 4) 와이어 → 블럭 약한 충전
    for (const i of w.sets.wire) {
      const p = this.power[i];
      if (p === 0) continue;
      const b = w.below(i);
      if (this.isReceiverAt(b) && this.weak[b] < p) this.weak[b] = p;
      const { points } = this.wireShape(i);
      for (const d of points) {
        const n = w.nbr(i, d);
        if (n >= 0 && this.isReceiverAt(n) && this.weak[n] < p) this.weak[n] = p;
      }
    }
  }

  // ---- 부품 상태 ----------------------------------------------
  torchShouldBeOff(i) {
    const w = this.w;
    const s = w.nbr(i, w.dir[i]);
    if (s < 0) return false;
    const id = w.id[s];
    if (id === B.RSBLOCK) return true;
    if (id === B.STONE || id === B.LAMP) return this.isChargedBlock(s);
    return false;
  }

  repeaterInput(i) {
    const w = this.w;
    const back = w.nbr(i, OPP[w.dir[i]]);
    if (back < 0) return false;
    switch (w.id[back]) {
      case B.WIRE: return this.power[back] > 0;
      case B.RSBLOCK: return true;
      case B.TORCH: return w.on(back);
      case B.LEVER: return w.on(back);
      case B.REPEATER: return w.on(back) && w.dir[back] === w.dir[i];
      case B.STONE: case B.LAMP: return this.isChargedBlock(back);
      default: return false;
    }
  }

  lampLit(i) { return this.isChargedBlock(i); }

  /* 한 레드스톤 틱 진행. 상태가 바뀌면 true */
  tick() {
    const w = this.w;
    const changes = [];
    for (const i of w.sets.torch) {
      const want = !this.torchShouldBeOff(i);
      if (want !== w.on(i)) {
        if (++this.cnt[i] >= 1) { changes.push([i, want]); this.cnt[i] = 0; }
      } else this.cnt[i] = 0;
    }
    for (const i of w.sets.repeater) {
      const want = this.repeaterInput(i);
      if (want !== w.on(i)) {
        if (++this.cnt[i] >= w.dly[i] + 1) { changes.push([i, want]); this.cnt[i] = 0; }
      } else this.cnt[i] = 0;
    }
    this.ticks++;
    if (!changes.length) return false;
    for (const [i, v] of changes) w.setOn(i, v);
    this.compute();
    return true;
  }

  /* 회로가 안정될 때까지 진행 (최대 max틱). 발진 회로는 max에서 멈춤 */
  settle(max = 60) {
    for (let k = 0; k < max; k++) if (!this.tick()) return k;
    return max;
  }
}
