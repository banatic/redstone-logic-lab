import { B } from './blocks.js';

/*
 미션 시스템
 ------------------------------------------------------------------
 진리표를 목표로 주고 자동 채점한다. 정답 회로는 이 파일에 두지 않는다
 (배포 파일에 실리면 학생이 소스에서 볼 수 있다). 정답은 tools/solutions.mjs 에만 있고
 검증 도구가 거기서 읽어 미션이 풀리는지 확인한다.
   node tools/test-missions.mjs
*/

// 방향: E=0(+X) W=1(-X) S=2(+Z) N=3(-Z) U=4 D=5
const E = 0, W = 1, S = 2, D = 5;

const T = {
  S: B.STONE, G: B.GLASS, w: B.WIRE, R: B.RSBLOCK,
  L: B.LAMP, P: B.REPEATER, V: B.LEVER, X: B.TORCH,
};

/* x0..x1 구간에 와이어 한 줄 */
function row(x0, x1, z, y = 0) {
  const a = []; const st = x0 <= x1 ? 1 : -1;
  for (let x = x0; x !== x1 + st; x += st) a.push([x, y, z, T.w]);
  return a;
}
/* z0..z1 구간에 와이어 한 줄 */
function col(z0, z1, x, y = 0) {
  const a = []; const st = z0 <= z1 ? 1 : -1;
  for (let z = z0; z !== z1 + st; z += st) a.push([x, y, z, T.w]);
  return a;
}
/* 일반 블럭 + 토치 = 인버터 한 덩이 */
function inv(x, z, y = 0) { return [[x, y, z, T.S], [x + 1, y, z, T.X, W]]; }

// ---------------------------------------------------------------- 핫바 구성
const WIRE_ONLY = [B.WIRE];
const WIRE_REP = [B.WIRE, B.REPEATER];
const GATE = [B.STONE, B.WIRE, B.TORCH];
const GATE_G = [B.STONE, B.GLASS, B.WIRE, B.TORCH];
const GATE_ALL = [B.STONE, B.GLASS, B.WIRE, B.REPEATER, B.TORCH];

// ---------------------------------------------------------------- 미션
export const MISSIONS = [
  {
    id: 'tut', day: 1, title: '레버와 램프 잇기',
    inputs: [[0, 0, 0]], outputs: [[5, 0, 0]],
    truth: [[0], [1]],
    allowed: WIRE_ONLY,
  },
  {
    id: 'decay', day: 1, title: '멀리 있는 램프 켜기',
    inputs: [[0, 0, 0]], outputs: [[20, 0, 0]],
    truth: [[0], [1]],
    allowed: WIRE_REP,
  },
  {
    id: 'not', day: 1, title: 'NOT 게이트',
    inputs: [[0, 0, 0]], outputs: [[7, 0, 0]],
    truth: [[1], [0]],
    allowed: GATE,
  },
  {
    id: 'or', day: 1, title: 'OR 게이트',
    inputs: [[0, 0, 0], [0, 0, 4]], outputs: [[6, 0, 2]],
    truth: [[0], [1], [1], [1]],
    allowed: WIRE_ONLY,
  },
  {
    id: 'nor', day: 1, title: 'NOR 게이트',
    inputs: [[0, 0, 0], [0, 0, 4]], outputs: [[8, 0, 2]],
    truth: [[1], [0], [0], [0]],
    allowed: GATE,
  },
  {
    id: 'fix', day: 1, title: '고장난 회로 고치기',
    inputs: [[0, 0, 0], [0, 0, 4]], outputs: [[8, 0, 2]],
    truth: [[1], [1], [1], [0]],
    allowed: GATE_G,
    // 위쪽 인버터의 일반 블럭이 유리로 바뀌어 있다 → 토치가 늘 켜진 채 고장
    start: [
      ...row(1, 2, 0), [3, 0, 0, T.G], [4, 0, 0, T.X, W],
      ...row(1, 2, 4), ...inv(3, 4),
      ...col(0, 4, 5), ...row(6, 7, 2),
    ],
  },
  {
    id: 'nand', day: 1, title: 'NAND 게이트',
    inputs: [[0, 0, 0], [0, 0, 4]], outputs: [[8, 0, 2]],
    truth: [[1], [1], [1], [0]],
    allowed: GATE,
  },
  {
    id: 'and', day: 1, title: 'AND 게이트',
    inputs: [[0, 0, 0], [0, 0, 4]], outputs: [[11, 0, 2]],
    truth: [[0], [0], [0], [1]],
    allowed: GATE,
  },
  {
    id: 'xor', day: 2, title: 'XOR 게이트',
    inputs: [[2, 0, 0], [2, 0, 12]], outputs: [[19, 0, 6]],
    truth: [[0], [1], [1], [0]],
    allowed: GATE_ALL,
  },
  {
    id: 'half', day: 2, title: '반가산기',
    inputs: [[2, 0, 0], [2, 0, 12]],
    outputs: [[19, 0, 6], [24, 0, 16]],
    outNames: ['합', '올림'],
    truth: [[0, 0], [1, 0], [1, 0], [0, 1]],
    allowed: GATE_ALL,
  },
  {
    id: 'full', day: 2, title: '전가산기 ★',
    inputs: [[0, 0, 0], [0, 0, 9], [0, 0, 18]],
    inNames: ['A', 'B', 'C'],
    outputs: [[30, 0, 4], [30, 0, 14]],
    outNames: ['합', '올림'],
    truth: Array.from({ length: 8 }, (_, m) => {
      const a = m & 1, b = (m >> 1) & 1, c = (m >> 2) & 1;
      return [a ^ b ^ c, (a + b + c) >= 2 ? 1 : 0];
    }),
    allowed: GATE_ALL,
  },
];

export const ORIGIN = [8, 1, 14];

// ---------------------------------------------------------------- 도우미
/* 표시용 행 번호 r (A 가 맨 앞자리) → 시뮬레이터용 레버 비트마스크 */
export function maskForRow(r, n) {
  let m = 0;
  for (let k = 0; k < n; k++) if ((r >> (n - 1 - k)) & 1) m |= 1 << k;
  return m;
}
/* 현재 레버 상태(마스크) → 표시용 행 번호 */
export function rowForMask(mask, n) {
  let r = 0;
  for (let k = 0; k < n; k++) if ((mask >> k) & 1) r |= 1 << (n - 1 - k);
  return r;
}

export function inputName(m, k) { return (m.inNames && m.inNames[k]) || 'ABC'[k] || ('입력' + (k + 1)); }
export function outputName(m, k) { return (m.outNames && m.outNames[k]) || '램프'; }

/* 레버·램프 등 학생이 부술 수 없는 고정 블럭 */
export function frameBlocks(m) {
  const a = [];
  for (const [x, y, z] of m.inputs) a.push([x, y, z, T.V, D]);
  for (const [x, y, z] of m.outputs) a.push([x, y, z, T.L]);
  return a;
}

function put(world, blocks, base) {
  for (const b of blocks) {
    const [x, y, z, id] = b;
    const dir = b[4] || 0, dly = b[5] || 0;
    const on = b.length > 6 ? b[6] : (id === B.TORCH ? 1 : 0);
    world.set(base[0] + x, base[1] + y, base[2] + z, id, dir, dly, on);
  }
}

/* 미션 맵을 세운다. extra 로 블럭을 더 얹을 수 있다 (검증 도구가 정답 회로를 넣을 때) */
export function loadMission(world, m, extra = null, base = ORIGIN) {
  world.reset();
  put(world, frameBlocks(m), base);
  put(world, m.start || [], base);
  if (extra) put(world, extra, base);
  return world;
}

/* 없어진 레버·램프만 제자리에 다시 세운다 (저장본을 불러온 뒤 안전장치) */
export function placeFrame(world, m, base = ORIGIN) {
  for (const b of frameBlocks(m)) {
    const i = world.idx(base[0] + b[0], base[1] + b[1], base[2] + b[2]);
    if (world.id[i] !== b[3]) world.setIdx(i, b[3], b[4] || 0, 0, 0);
  }
}

/* 미션의 고정 블럭 인덱스 집합 */
export function frameIndices(world, m, base = ORIGIN) {
  const s = new Set();
  for (const [x, y, z] of frameBlocks(m)) s.add(world.idx(base[0] + x, base[1] + y, base[2] + z));
  return s;
}

/* 학생이 놓은 블럭 수 (고정 블럭·바닥판 제외) */
export function countPlaced(world, m, base = ORIGIN) {
  const fixed = frameIndices(world, m, base);
  let n = 0;
  for (let i = 0; i < world.n; i++) {
    const id = world.id[i];
    if (id === B.AIR || id === B.FLOOR) continue;
    if (fixed.has(i)) continue;
    n++;
  }
  return n;
}

/* 지금 레버 상태를 시뮬레이터용 비트마스크로 */
export function currentMask(world, m, base = ORIGIN) {
  let mask = 0;
  m.inputs.forEach(([x, y, z], k) => {
    const i = world.idx(base[0] + x, base[1] + y, base[2] + z);
    if (world.id[i] === B.LEVER && world.on(i)) mask |= 1 << k;
  });
  return mask;
}

/* 지금 이 순간의 출력 램프 상태 */
export function currentOut(world, rs, m, base = ORIGIN) {
  return m.outputs.map(([x, y, z]) => {
    const i = world.idx(base[0] + x, base[1] + y, base[2] + z);
    return world.id[i] === B.LAMP && rs.lampLit(i) ? 1 : 0;
  });
}

/*
 모든 입력 조합을 돌려 채점한다.
 반환: { pass, rows: [{ mask, got, want, ok }] }
 채점이 끝나면 레버 상태를 원래대로 되돌린다.
*/
export function gradeMission(world, rs, m, base = ORIGIN, settleTicks = 90) {
  const li = m.inputs.map(([x, y, z]) => world.idx(base[0] + x, base[1] + y, base[2] + z));
  const lo = m.outputs.map(([x, y, z]) => world.idx(base[0] + x, base[1] + y, base[2] + z));
  const saved = li.map((i) => world.on(i));
  const rows = [];
  let pass = true;

  for (let mask = 0; mask < (1 << li.length); mask++) {
    li.forEach((i, k) => world.setOn(i, (mask >> k) & 1));
    rs.cnt.fill(0);
    rs.compute();
    rs.settle(settleTicks);
    const got = lo.map((i) => (world.id[i] === B.LAMP && rs.lampLit(i) ? 1 : 0));
    const want = m.truth[mask];
    const ok = got.every((v, k) => v === want[k]);
    if (!ok) pass = false;
    rows.push({ mask, got, want, ok });
  }

  li.forEach((i, k) => world.setOn(i, saved[k]));
  rs.cnt.fill(0);
  rs.compute();
  rs.settle(settleTicks);
  return { pass, rows };
}
