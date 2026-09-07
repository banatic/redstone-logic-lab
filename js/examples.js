import { B } from './blocks.js';

// 방향: E=0(+X) W=1(-X) S=2(+Z) N=3(-Z) U=4 D=5
const E = 0, W = 1, D = 5;

const T = {
  S: B.STONE, G: B.GLASS, w: B.WIRE, R: B.RSBLOCK,
  L: B.LAMP, P: B.REPEATER, V: B.LEVER, X: B.TORCH,
};

/* x0..x1 구간에 와이어 한 줄 */
function wireRow(x0, x1, z, y = 0) {
  const a = [];
  const st = x0 <= x1 ? 1 : -1;
  for (let x = x0; x !== x1 + st; x += st) a.push([x, y, z, T.w]);
  return a;
}
/* z0..z1 구간에 와이어 한 줄 */
function wireCol(z0, z1, x, y = 0) {
  const a = [];
  const st = z0 <= z1 ? 1 : -1;
  for (let z = z0; z !== z1 + st; z += st) a.push([x, y, z, T.w]);
  return a;
}

export const EXAMPLES = [
  {
    id: 'delay',
    name: '리피터 지연 비교',
    desc: '같은 신호를 지연 1·2·3·4틱 리피터에 각각 넣었습니다. 레버를 켜면 램프가 순서대로 켜집니다. 리피터를 우클릭하면 지연이 바뀝니다.',
    inputs: [[0, 0, 3]], output: null, truth: null,
    blocks: [
      [0, 0, 3, T.V, D],
      ...wireCol(0, 6, 1),
      [2, 0, 0, T.P, E, 0], [3, 0, 0, T.w], [4, 0, 0, T.L],
      [2, 0, 2, T.P, E, 1], [3, 0, 2, T.w], [4, 0, 2, T.L],
      [2, 0, 4, T.P, E, 2], [3, 0, 4, T.w], [4, 0, 4, T.L],
      [2, 0, 6, T.P, E, 3], [3, 0, 6, T.w], [4, 0, 6, T.L],
    ],
  },
  {
    id: 'clock',
    name: '클럭 (발진 회로)',
    desc: '토치의 출력이 리피터를 지나 다시 자기 자신을 끄도록 되돌아옵니다. 램프가 일정한 주기로 깜빡입니다. 리피터 지연을 바꾸면 주기가 달라집니다.',
    inputs: [], output: null, truth: null,
    blocks: [
      [2, 0, 0, T.S], [3, 0, 0, T.X, W], [4, 0, 0, T.w],
      [5, 0, 0, T.P, E, 3],
      [6, 0, 0, T.w], [7, 0, 0, T.L],
      [6, 0, 1, T.w], [6, 0, 2, T.w],
      ...wireRow(5, 0, 2),
      [0, 0, 1, T.w], [0, 0, 0, T.w], [1, 0, 0, T.w],
    ],
  },
  {
    id: 'insulator',
    name: '절연체 실험',
    desc: '왼쪽은 와이어가 일반 블럭을 충전해 토치를 끄지만, 오른쪽은 비전도 블럭(유리)이라 신호가 통하지 않아 토치가 계속 켜져 있습니다.',
    inputs: [[0, 0, 0], [0, 0, 5]], output: null, truth: null,
    blocks: [
      [0, 0, 0, T.V, D], ...wireRow(1, 2, 0), [3, 0, 0, T.S], [4, 0, 0, T.X, W],
      ...wireRow(5, 6, 0), [7, 0, 0, T.L],
      [0, 0, 5, T.V, D], ...wireRow(1, 2, 5), [3, 0, 5, T.G], [4, 0, 5, T.X, W],
      ...wireRow(5, 6, 5), [7, 0, 5, T.L],
    ],
  },
  {
    id: 'latch',
    name: 'RS 래치 (기억 회로)',
    desc: 'NOR 게이트 2개를 서로 엇갈려 연결하면 상태를 기억합니다. R 레버를 켰다 끄면 Q가 꺼진 채로, S 레버를 켰다 끄면 Q가 켜진 채로 유지됩니다.',
    inputs: [[0, 0, 0], [10, 0, 6]], output: null, truth: null,
    blocks: [
      // 위쪽 NOR: 입력 R + ¬Q 되먹임  ->  출력 Q
      [0, 0, 0, T.V, D],
      [1, 0, 0, T.w], [2, 0, 0, T.w],
      [3, 0, 0, T.S], [4, 0, 0, T.X, W, 0, 1],
      [5, 0, 0, T.w], [5, 0, 1, T.L],
      // 아래쪽 NOR: 입력 S + Q 되먹임  ->  출력 ¬Q
      [10, 0, 6, T.V, D],
      [9, 0, 6, T.w], [8, 0, 6, T.w],
      [7, 0, 6, T.S], [6, 0, 6, T.X, E, 0, 0],
      [5, 0, 6, T.w], [5, 0, 5, T.L],
      // Q -> 아래쪽 게이트 입력
      ...wireRow(6, 9, 0), ...wireCol(1, 5, 9),
      // ¬Q -> 위쪽 게이트 입력
      ...wireRow(4, 1, 6), ...wireCol(5, 1, 1),
    ],
  },
];

export const ORIGIN = [8, 1, 14];

/* 예제를 월드에 배치한다 */
export function loadExample(world, ex, base = ORIGIN) {
  world.reset();
  for (const b of ex.blocks) {
    const [x, y, z, id] = b;
    const dir = b[4] || 0, dly = b[5] || 0;
    const on = b.length > 6 ? b[6] : (id === B.TORCH ? 1 : 0);
    world.set(base[0] + x, base[1] + y, base[2] + z, id, dir, dly, on);
  }
  return world;
}
