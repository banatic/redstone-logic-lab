// 2층 배선 실험:  node tools/probe-tap.mjs
//
// 큰 회로를 만들려면 배선이 서로 교차해야 한다. 한 층에서는 불가능하므로
//   아래층(y=1) = 가로줄,  위층(y=3, 블럭 위) = 세로 버스
// 로 나누고, 버스에서 가로줄로 신호를 내리는 "탭"이 필요하다.
//
// 여기서 두 가지를 확인한다.
//   1) 가로줄이 버스 밑을 지나갈 때 신호를 주워 먹지 않는가 (교차)
//   2) 버스 받침 블럭에 붙인 토치가 버스 신호의 반대로 켜지는가 (탭, 반전됨)

import { World } from '../js/world.js';
import { Redstone } from '../js/redstone.js';
import { B } from '../js/blocks.js';

const E = 0, W = 1, D = 5;
const w = new World();
const set = (x, y, z, id, dir = 0, dly = 0, on = 0) => w.set(x, y, z, id, dir, dly, on);

// ---- 버스 두 줄 : x=4, x=8 에 세로(z)로. 받침 블럭 y=2, 와이어 y=3
for (const bx of [4, 8]) {
  for (let z = 0; z <= 6; z++) {
    set(bx, 2, z, B.STONE);
    set(bx, 3, z, B.WIRE);
  }
}
// 버스를 켜는 레버 (버스 북쪽 끝 받침 블럭 위에 얹어 세기 15 공급)
set(4, 3, 7, B.LEVER, D);   // ← 받침이 없으니 따로 블럭을 둔다
set(4, 2, 7, B.STONE);
set(8, 2, 7, B.STONE);
set(8, 3, 7, B.LEVER, D);

// ---- 가로줄 : z=3 에 x=0..14 로. 버스 밑(x=4, 8)을 지나간다
for (let x = 0; x <= 14; x++) set(x, 1, 3, B.WIRE);
set(15, 1, 3, B.LAMP);

// ---- 탭 : x=4 버스의 받침 블럭에 동쪽으로 토치를 붙인다 → 아래 가로줄을 구동
set(5, 2, 3, B.TORCH, W, 0, 1);

const rs = new Redstone(w);
const lever4 = w.idx(4, 3, 7), lever8 = w.idx(8, 3, 7);
const lamp = w.idx(15, 1, 3);
const torch = w.idx(5, 2, 3);
const rowAt = (x) => rs.power[w.idx(x, 1, 3)];

function run(a, b) {
  w.setOn(lever4, a); w.setOn(lever8, b);
  rs.cnt.fill(0); rs.compute(); rs.settle(60);
  return {
    '버스4': a, '버스8': b,
    '탭토치': rs.w.on(torch) ? '켜짐' : '꺼짐',
    '가로줄 x=6': rowAt(6), '가로줄 x=9': rowAt(9), '가로줄 x=14': rowAt(14),
    '램프': rs.lampLit(lamp) ? '켜짐' : '꺼짐',
  };
}

console.log('탭은 반전이므로 버스4 가 꺼졌을 때 가로줄이 켜져야 한다.');
console.table([run(0, 0), run(1, 0), run(0, 1), run(1, 1)]);

// 판정
const off = run(0, 0), on = run(1, 0), other = run(0, 1);
let fail = 0;
if (off['램프'] !== '켜짐') { console.log('X 탭이 신호를 못 내림'); fail++; }
if (on['램프'] !== '꺼짐') { console.log('X 버스가 켜졌는데 탭이 안 꺼짐'); fail++; }
if (other['가로줄 x=9'] === 0 && other['램프'] !== '켜짐') { console.log('X 교차 지점에서 신호가 끊김'); fail++; }
// x=8 버스만 켠 상태에서도 가로줄은 x=4 탭(꺼진 버스 → 토치 켜짐)으로 살아 있어야 하고,
// x=8 버스가 가로줄에 신호를 새로 흘려 넣으면 안 된다 → 세기가 탭에서 온 값 그대로여야 함
if (other['가로줄 x=9'] !== off['가로줄 x=9']) { console.log('X 교차 지점에서 신호가 새어 들어옴'); fail++; }

console.log(fail ? `\n실패 ${fail}건` : '\n2층 배선 가능: 교차 안전, 탭 동작 (반전)');
process.exit(fail ? 1 : 0);
