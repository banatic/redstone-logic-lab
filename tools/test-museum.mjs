// 박물관 전시물 검증:  node tools/test-museum.mjs
import { World } from '../js/world.js';
import { Redstone } from '../js/redstone.js';
import { EXHIBITS, MUSEUM_ORIGIN } from '../js/museum.js';
import { B } from '../js/blocks.js';

/* 7세그먼트는 켜진 획을 눈으로 확인할 수 있게 그린다 */
function draw(on) {
  const h = (s) => (on.has(s) ? '━━━' : '   ');
  const v = (l, r) => (on.has(l) ? '┃' : ' ') + '   ' + (on.has(r) ? '┃' : ' ');
  return [' ' + h('a'), v('f', 'b'), ' ' + h('g'), v('e', 'c'), ' ' + h('d')].join('\n');
}

let fail = 0;
for (const ex of EXHIBITS) {
  const w = new World(96, 20, 96);
  const [bx, by, bz] = MUSEUM_ORIGIN;
  for (const b of ex.blocks) {
    const on = b.length > 6 ? b[6] : (b[3] === B.TORCH ? 1 : 0);
    w.set(bx + b[0], by + b[1], bz + b[2], b[3], b[4] || 0, b[5] || 0, on);
  }
  let mx = 0, mz = 0;
  for (const b of ex.blocks) { mx = Math.max(mx, b[0]); mz = Math.max(mz, b[2]); }
  if (bx + mx >= 96 || bz + mz >= 96) { console.log(`X ${ex.title}: 월드 밖으로 나감`); fail++; }

  const rs = new Redstone(w);
  const lv = ex.inputs.map(([x, y, z]) => w.idx(bx + x, by + y, bz + z));
  for (const i of lv) if (w.id[i] !== B.LEVER) { console.log(`X ${ex.title}: 레버 자리가 어긋남`); fail++; }
  const names = Object.keys(ex.probes);
  const probe = Object.fromEntries(names.map((k) => {
    const [x, y, z] = ex.probes[k];
    return [k, w.idx(bx + x, by + y, bz + z)];
  }));
  for (const [k, i] of Object.entries(probe)) {
    if (w.id[i] !== B.LAMP) { console.log(`X ${ex.title}: 출력 ${k} 자리에 램프가 없음`); fail++; }
  }

  let bad = 0, worst = 0;
  for (let v = 0; v < 16; v++) {
    lv.forEach((i, k) => w.setOn(i, (v >> k) & 1));
    rs.cnt.fill(0); rs.compute();
    worst = Math.max(worst, rs.settle(200));
    const on = new Set(names.filter((s) => rs.lampLit(probe[s])));
    const want = new Set(ex.expect(v));
    if (!names.every((s) => on.has(s) === want.has(s))) {
      bad++;
      console.log(`X ${ex.title} ${v}: 켜짐 [${[...on].join(' ')}] 기대 [${[...want].join(' ')}]`);
    } else if (ex.id === 'seg7' && v < 10) {
      console.log(draw(on));
    }
  }
  console.log(`${bad ? 'X' : 'O'} ${ex.title} — 블럭 ${ex.blocks.length}개, `
    + `${mx + 1} x ${mz + 1}, 안정까지 최대 ${worst}틱\n`);
  fail += bad;
}
console.log(fail ? `실패 ${fail}건` : '박물관 전시물 통과');
process.exit(fail ? 1 : 0);
