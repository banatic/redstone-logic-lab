import { B } from './blocks.js';

/*
 박물관 — 큰 회로를 자동으로 만들어 세운다
 ------------------------------------------------------------------
 손으로 배선할 수 있는 크기가 아니므로, 실제 칩과 같은 격자 배치(PLA)를 코드로 찍어낸다.
 이 파일은 DOM·three.js 에 의존하지 않으므로 node 로 바로 검증할 수 있다.
   node tools/test-museum.mjs

 배선이 서로 교차해야 하므로 2층으로 나눈다.
   아래층 y=0 : 가로줄 (가로 = x 방향)
   위층  y=2 : 세로 버스 (세로 = z 방향, y=1 의 받침 블럭 위)
 가로줄은 버스 밑을 그냥 지나간다. 신호를 주고받지 않는다.

 버스에서 가로줄로 신호를 내리는 "탭" 은 받침 블럭에 붙인 토치다.
 버스가 켜지면 받침 블럭이 충전되어 토치가 꺼지므로, 탭은 반전된 신호를 내려보낸다.
   가로줄 = OR( 탭한 버스 신호들의 반전 )

 이 성질만으로 2단 PLA 가 만들어진다.
   1단 : 가로줄 k 가 최소항 m_k 를 이루는 문자들을 탭 → 가로줄 = ¬m_k
   2단 : 가로줄 j 가 ¬m_k 들을 탭      → 가로줄 = OR( m_k ) = 출력 j
*/

const E = 0, W = 1, S = 2, N = 3, D = 5;
const T = { S: B.STONE, G: B.GLASS, w: B.WIRE, L: B.LAMP, P: B.REPEATER, V: B.LEVER, X: B.TORCH };

const BUS_GAP = 3;      // 버스 사이 간격. +1 은 탭, +2 는 가로줄 리피터 자리
const HOP = 9;          // 신호가 약해지기 전에 리피터를 넣는 간격
const odd = (z) => (((z % 2) + 2) % 2) === 1;   // 음수 z 에서도 맞게

// ---------------------------------------------------------------- 부품
/* 세로 버스 한 줄 (받침 블럭 + 와이어), 중간중간 리피터로 신호를 되살린다 */
function busColumn(out, x, z0, z1) {
  let since = HOP;
  for (let z = z0; z <= z1; z++) {
    out.push([x, 1, z, T.S]);
    // 리피터는 홀수 z 에만. 짝수 z 는 가로줄이 지나가며 탭을 붙이는 자리다
    if (z > z0 && since >= HOP && odd(z)) { out.push([x, 2, z, T.P, S]); since = 0; }
    else { out.push([x, 2, z, T.w]); since++; }
  }
}

/* 가로줄 한 줄. free(x) 가 참인 자리에만 리피터를 놓는다 */
function rowLine(out, z, x0, x1, free) {
  let since = 0;
  for (let x = x0; x <= x1; x++) {
    if (since >= HOP && free(x) && x < x1) { out.push([x, 0, z, T.P, E]); since = 0; }
    else { out.push([x, 0, z, T.w]); since++; }
  }
  return since;
}

/* 꺾이는 배선 한 줄. 직선 구간에서만 리피터를 놓는다 (모서리에는 못 놓는다) */
function path(out, cells, since = 0, skip = 0) {
  for (let k = skip; k < cells.length; k++) {
    const [x, z] = cells[k];
    const p = cells[k - 1], n = cells[k + 1];
    const straight = p && n && ((p[0] === x && n[0] === x) || (p[1] === z && n[1] === z));
    if (since >= HOP && straight) {
      out.push([x, 0, z, T.P, n[0] > x ? E : n[0] < x ? W : n[1] > z ? S : N]);
      since = 0;
    } else { out.push([x, 0, z, T.w]); since++; }
  }
}

/* 버스(bx)에서 가로줄(z)로 신호를 내리는 탭. 반전된다 */
function tap(out, bx, z) { out.push([bx + 1, 1, z, T.X, W, 0, 1]); }

/* 가로줄 → 세로 버스 로 두 칸 올라가는 계단. 올라간 자리의 x 를 돌려준다 */
function riser(out, x, z) {
  out.push([x + 1, 0, z, T.S], [x + 1, 1, z, T.w]);
  out.push([x + 2, 1, z, T.S], [x + 2, 2, z, T.w]);
  return x + 2;
}

// ---------------------------------------------------------------- PLA
/*
 spec = { inputs: ['A','B',...], outputs: [{ name, on: [최소항 번호...] }] }
 최소항 번호는 입력을 2진수로 본 값 (bit 0 = inputs[0])
*/
function pla(spec) {
  const out = [];
  const N = spec.inputs.length;
  // 실제로 쓰이는 최소항만 만든다. 안 쓰는 것까지 만들면 회로가 쓸데없이 넓어진다
  const used = [...new Set(spec.outputs.flatMap((o) => o.on))].sort((a, b) => a - b);
  const col = new Map(used.map((m, k) => [m, k]));
  const M = used.length;
  const P = spec.outputs.length;
  const LIT = 2 * N;                      // 문자(참/거짓) 버스 줄 수
  const busX = (l) => BUS_GAP * l;        // 문자 l 의 버스 x
  const free = (x) => x % BUS_GAP === 2;  // 가로줄 리피터를 놓아도 되는 자리

  const rowZ = (k) => 2 * k;                       // 1단 가로줄
  const colX = (k) => BUS_GAP * LIT + 3 + 3 * k;   // 2단 버스
  const Z2 = 2 * M + 4;                            // 2단 가로줄 시작 z
  const outZ = (j) => Z2 + 2 * j;

  // ---- 입력: 레버 하나에서 참/거짓 두 줄을 만든다
  const levers = [];
  for (let i = 0; i < N; i++) {
    const xt = busX(2 * i), xf = busX(2 * i + 1);
    levers.push([xt, 0, -14]);
    out.push([xt, 0, -14, T.V, D]);
    // 참: 레버 → 남쪽으로 → 계단 두 칸 → 버스
    for (let z = -13; z <= -9; z++) out.push([xt, 0, z, T.w]);
    out.push([xt, 0, -8, T.S], [xt, 1, -8, T.w]);
    out.push([xt, 1, -7, T.S], [xt, 2, -7, T.w]);
    busColumn(out, xt, -7, outZ(P - 1) + 2);
    // 거짓: 레버 → 북쪽으로 → 블럭 위 토치(반전) → 계단 → 버스
    out.push([xt, 0, -15, T.w]);
    for (let x = xt + 1; x < xf; x++) out.push([x, 0, -15, T.w]);
    out.push([xf, 0, -15, T.S], [xf, 1, -15, T.X, D, 0, 1]);
    out.push([xf, 0, -14, T.S], [xf, 1, -14, T.w]);
    out.push([xf, 1, -13, T.S], [xf, 2, -13, T.w]);
    for (let z = -12; z <= -8; z++) out.push([xf, 1, z, T.S], [xf, 2, z, T.w]);
    busColumn(out, xf, -7, outZ(P - 1) + 2);
  }

  // ---- 1단: 최소항마다 가로줄 하나.  가로줄 = ¬m_k
  used.forEach((m, k) => {
    const z = rowZ(k);
    const rx = colX(k) - 2;               // 계단 시작
    rowLine(out, z, 0, rx, free);
    for (let i = 0; i < N; i++) tap(out, busX(2 * i + (((m >> i) & 1) ? 0 : 1)), z);
    riser(out, rx, z);
    // 2단 버스 (¬m_k). 올라오자마자 리피터로 세기를 되살린다
    out.push([colX(k), 1, z + 1, T.S], [colX(k), 2, z + 1, T.P, S]);
    busColumn(out, colX(k), z + 2, outZ(P - 1) + 2);
  });

  // ---- 2단: 출력마다 가로줄 하나.  가로줄 = OR( 탭한 ¬m_k 의 반전 ) = OR( m_k )
  const fanX = colX(M - 1) + 4;           // 부채꼴로 갈라지는 시작 x
  const exits = [];
  const probes = {};
  for (let j = 0; j < P; j++) {
    const z = outZ(j);
    // 세로로 내려가는 자리를 j 가 커질수록 서쪽으로 잡으면 서로 안 겹친다
    const turn = spec.lamps ? fanX : fanX + 2 * (P - 1 - j);
    const since = rowLine(out, z, colX(0), turn, free);
    for (const m of spec.outputs[j].on) tap(out, colX(col.get(m)), z);
    if (spec.lamps) {                     // 출력마다 램프 하나를 세로로 늘어놓는다
      out.push([turn + 1, 0, z, T.L]);
      probes[spec.outputs[j].name] = [turn + 1, 0, z];
    }
    exits.push({ name: spec.outputs[j].name, x: turn, z, since });
  }
  return { blocks: out, levers, exits, probes, free };
}

// ---------------------------------------------------------------- 7세그먼트
/* 자리 배치 (dx, dz). 가로 획은 x 방향, 세로 획은 z 방향 */
/* 가로 획은 좌우로 한 칸씩 띄운다. 안 그러면 b·c 로 들어가는 배선이 옆 획을 켜 버린다 */
const SEG_CELLS = {
  a: [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0]],
  f: [[0, 2], [0, 3], [0, 4], [0, 5]],
  b: [[8, 2], [8, 3], [8, 4], [8, 5]],
  g: [[2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  e: [[0, 9], [0, 10], [0, 11], [0, 12]],
  c: [[8, 9], [8, 10], [8, 11], [8, 12]],
  d: [[2, 14], [3, 14], [4, 14], [5, 14], [6, 14]],
};
/* 출력 순서는 신호가 들어오는 z 순서(북→남)와 같아야 배선이 겹치지 않는다 */
const SEG_ORDER = ['b', 'a', 'f', 'g', 'e', 'd', 'c'];
/* 획마다 신호가 들어오는 z (표시기 기준). SEG_ORDER 순서대로 커져야 한다 */
const SEG_FEED = { b: -2, a: 0, f: 2, g: 7, e: 10, d: 14, c: 16 };

function sevenSegment(out, dx, dz) {
  const probes = {};
  for (const [name, cells] of Object.entries(SEG_CELLS)) {
    for (const [cx, cz] of cells) {
      out.push([dx + cx, 0, dz + cz, T.L]);      // 램프
      out.push([dx + cx, 1, dz + cz, T.w]);      // 그 위의 와이어가 램프를 켠다
    }
    probes[name] = [dx + cells[0][0], 0, dz + cells[0][1]];
  }
  return probes;
}

/* 2단 가로줄 끝(exit)에서 표시기의 획까지 잇는다 */
function wireToDisplay(out, exit, seg, dx, dz) {
  const fz = dz + SEG_FEED[seg];
  const cells = [];
  for (let z = exit.z; z <= fz; z++) cells.push([exit.x, z]);          // 남쪽으로
  if (seg === 'b' || seg === 'c') {
    // 오른쪽 획은 표시기를 돌아서 들어간다
    for (let x = exit.x + 1; x <= dx + 8; x++) cells.push([x, fz]);
    const zEnd = seg === 'b' ? dz + 1 : dz + 13;
    const st = seg === 'b' ? 1 : -1;
    for (let z = fz + st; z !== zEnd + st; z += st) cells.push([dx + 8, z]);
  } else {
    const xEnd = (seg === 'a' || seg === 'g' || seg === 'd') ? dx + 1 : dx - 1;
    for (let x = exit.x + 1; x <= xEnd; x++) cells.push([x, fz]);
  }
  path(out, cells, exit.since, 1);
}

// ---------------------------------------------------------------- 전시물
/* 숫자 0~9 를 이루는 획 (10~15 는 정의하지 않아 꺼진 채로 둔다) */
const DIGIT_SEGS = [
  'abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg',
];
function segOn(seg) {
  const on = [];
  for (let d = 0; d < DIGIT_SEGS.length; d++) if (DIGIT_SEGS[d].includes(seg)) on.push(d);
  return on;
}

function buildSevenSeg() {
  const spec = {
    inputs: ['A', 'B', 'C', 'D'],
    outputs: SEG_ORDER.map((s) => ({ name: s, on: segOn(s) })),
  };
  const r = pla(spec);
  const out = r.blocks;
  const dx = r.exits[0].x + 6;
  const dz = r.exits[0].z + 2;   // 첫 출력(b)의 급전 z 가 dz-2 이므로 2 만큼 남쪽에 둔다
  const probes = sevenSegment(out, dx, dz);
  r.exits.forEach((e, j) => wireToDisplay(out, e, SEG_ORDER[j], dx, dz));
  const expect = (v) => (DIGIT_SEGS[v] || '').split('');
  // 레버에 자릿값을 이름으로 붙인다. 켠 레버의 합이 그대로 숫자가 된다
  return { blocks: out, levers: r.levers, probes, expect, inNames: ['1', '2', '4', '8'] };
}

/* 좌표를 0 이상으로 옮긴다 */
function normalize(blocks, extra) {
  let mx = Infinity, my = Infinity, mz = Infinity;
  for (const b of blocks) { mx = Math.min(mx, b[0]); my = Math.min(my, b[1]); mz = Math.min(mz, b[2]); }
  const shift = (p) => [p[0] - mx, p[1] - my, p[2] - mz];
  for (const b of blocks) { b[0] -= mx; b[1] -= my; b[2] -= mz; }
  return { levers: extra.levers.map(shift), probes: Object.fromEntries(
    Object.entries(extra.probes).map(([k, v]) => [k, shift(v)])) };
}

function makeExhibit(id, title, note, build) {
  const r = build();
  const n = normalize(r.blocks, r);
  return { id, title, note, blocks: r.blocks, inputs: n.levers, probes: n.probes,
    expect: r.expect, inNames: r.inNames };
}

/* 입력 16가지에 대해 f(값) 을 계산해, 비트마다 켜지는 최소항 목록을 만든다 */
function bits(f, names) {
  return names.map((name, b) => ({
    name, on: [...Array(16).keys()].filter((m) => (f(m) >> b) & 1),
  }));
}

function buildMultiplier() {
  // A = A0 + 2·A1,  B = B0 + 2·B1,  곱은 최대 9 이므로 4비트
  const prod = (m) => ((m & 1) + 2 * ((m >> 1) & 1)) * (((m >> 2) & 1) + 2 * ((m >> 3) & 1));
  const r = pla({
    inputs: ['A0', 'A1', 'B0', 'B1'],
    outputs: bits(prod, ['1', '2', '4', '8']).reverse(),   // 위에서부터 8 4 2 1
    lamps: true,
  });
  const expect = (v) => ['1', '2', '4', '8'].filter((n, b) => (prod(v) >> b) & 1);
  return { blocks: r.blocks, levers: r.levers, probes: r.probes, expect, inNames: ['A의 1', 'A의 2', 'B의 1', 'B의 2'] };
}

function buildCompare() {
  const A = (m) => (m & 1) + 2 * ((m >> 1) & 1);
  const Bv = (m) => ((m >> 2) & 1) + 2 * ((m >> 3) & 1);
  const r = pla({
    inputs: ['A0', 'A1', 'B0', 'B1'],
    outputs: [
      { name: 'A가 큼', on: [...Array(16).keys()].filter((m) => A(m) > Bv(m)) },
      { name: '같음', on: [...Array(16).keys()].filter((m) => A(m) === Bv(m)) },
      { name: 'B가 큼', on: [...Array(16).keys()].filter((m) => A(m) < Bv(m)) },
    ],
    lamps: true,
  });
  const expect = (v) => [A(v) > Bv(v) ? 'A가 큼' : A(v) === Bv(v) ? '같음' : 'B가 큼'];
  return { blocks: r.blocks, levers: r.levers, probes: r.probes, expect, inNames: ['A의 1', 'A의 2', 'B의 1', 'B의 2'] };
}

export const EXHIBITS = [
  makeExhibit('seg7', '7세그먼트 숫자 표시기',
    '레버 네 개로 만든 2진수 0~9 를 숫자 모양으로 켠다. 신호가 회로를 타고 번져 가는 것이 보인다.',
    buildSevenSeg),
  makeExhibit('mul2', '2비트 곱셈기',
    'A 와 B 를 각각 0~3 으로 놓으면 곱을 2진수로 켠다. 레버 A0 A1 이 A, B0 B1 이 B.',
    buildMultiplier),
  makeExhibit('cmp2', '2비트 비교기',
    'A 와 B 중 어느 쪽이 큰지 램프 하나로 답한다.',
    buildCompare),
];

export const MUSEUM_ORIGIN = [3, 1, 3];

/* 전시물을 월드에 세운다 */
export function loadExhibit(world, ex, base = MUSEUM_ORIGIN) {
  world.reset();
  for (const b of ex.blocks) {
    const on = b.length > 6 ? b[6] : (b[3] === B.TORCH ? 1 : 0);
    world.set(base[0] + b[0], base[1] + b[1], base[2] + b[2], b[3], b[4] || 0, b[5] || 0, on);
  }
  return world;
}
