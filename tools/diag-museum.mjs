// 박물관 회로 단계별 값 보기:  node tools/diag-museum.mjs [입력값]
import { World } from '../js/world.js';
import { Redstone } from '../js/redstone.js';
import { EXHIBITS, MUSEUM_ORIGIN } from '../js/museum.js';
import { B, NAME } from '../js/blocks.js';

const VAL = Number(process.argv[2] ?? 10);
const ex = EXHIBITS[0];
const w = new World(96, 20, 96);
const [bx, by, bz] = MUSEUM_ORIGIN;
for (const b of ex.blocks) {
  const on = b.length > 6 ? b[6] : (b[3] === B.TORCH ? 1 : 0);
  w.set(bx + b[0], by + b[1], bz + b[2], b[3], b[4] || 0, b[5] || 0, on);
}
const rs = new Redstone(w);
const lv = ex.inputs.map(([x, y, z]) => w.idx(bx + x, by + y, bz + z));
lv.forEach((i, k) => w.setOn(i, (VAL >> k) & 1));
rs.cnt.fill(0); rs.compute(); rs.settle(200);

const ZS = ex.inputs[0][2] + 14;                 // 정규화로 밀린 z
const I = (x, y, z) => w.idx(bx + x, by + y, bz + z + ZS);
const val = (x, y, z) => {
  const i = I(x, y, z), id = w.id[i];
  if (id === B.WIRE) return rs.power[i];
  if (id === B.TORCH || id === B.LEVER || id === B.REPEATER) return w.on(i) ? 15 : 0;
  if (id === B.LAMP) return rs.lampLit(i) ? 15 : 0;
  return `[${NAME[id]}]`;
};

const N = 4, USED = 10, P = 7;
const busX = (l) => 3 * l, colX = (k) => 27 + 3 * k;
const rowZ = (k) => 2 * k, outZ = (j) => 24 + 2 * j;
const turn = (j) => 58 + 2 * (P - 1 - j);

console.log(`입력 ${VAL} = ${VAL.toString(2).padStart(4, '0')}(2)  (레버 순서: A B C D, A 가 1의 자리)\n`);

console.log('문자 버스 (z=0 에서의 세기)');
for (let i = 0; i < N; i++) {
  console.log(`  ${'ABCD'[i]}=${(VAL >> i) & 1}  참(x=${busX(2 * i)}) ${val(busX(2 * i), 2, 0)}`
    + `   거짓(x=${busX(2 * i + 1)}) ${val(busX(2 * i + 1), 2, 0)}`);
}

console.log('\n1단 가로줄 ¬m_k  (입력과 같은 k 만 0 이어야 함)');
for (let k = 0; k < USED; k++) {
  const taps = [];
  for (let i = 0; i < N; i++) {
    const b = busX(2 * i + (((k >> i) & 1) ? 0 : 1));
    taps.push(`${'ABCD'[i]}${((k >> i) & 1) ? '' : '¬'}:${val(b + 1, 1, rowZ(k))}`);
  }
  console.log(`  m${k}(${k.toString(2).padStart(4, '0')}) 줄끝 ${String(val(25 + 3 * k, 0, rowZ(k))).padStart(2)}`
    + `  버스 ${String(val(colX(k), 2, outZ(0))).padStart(2)}   탭 ${taps.join(' ')}`);
}

console.log('\n2단 가로줄 (출력)');
['b', 'a', 'f', 'g', 'e', 'd', 'c'].forEach((s, j) => {
  console.log(`  ${s}  줄끝 ${String(val(turn(j), 0, outZ(j))).padStart(2)}`);
});
