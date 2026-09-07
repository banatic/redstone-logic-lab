// 예제 회로 진리표 검증:  node tools/test.mjs
import { World } from '../js/world.js';
import { Redstone } from '../js/redstone.js';
import { EXAMPLES, loadExample, ORIGIN } from '../js/examples.js';
import { B } from '../js/blocks.js';

let fail = 0;

for (const ex of EXAMPLES) {
  const w = new World();
  loadExample(w, ex);
  const rs = new Redstone(w);
  rs.settle(80);

  if (!ex.truth || !ex.output) {
    console.log(`  ${ex.id.padEnd(10)} : 블럭 ${ex.blocks.length}개 배치 (진리표 검증 없음)`);
    continue;
  }

  const li = w.idx(ORIGIN[0] + ex.output[0], ORIGIN[1] + ex.output[1], ORIGIN[2] + ex.output[2]);
  if (w.id[li] !== B.LAMP) {
    console.log(`X ${ex.id}: 출력 위치에 램프가 없음`);
    fail++;
    continue;
  }
  const levers = ex.inputs.map(([x, y, z]) => w.idx(ORIGIN[0] + x, ORIGIN[1] + y, ORIGIN[2] + z));
  for (const l of levers) {
    if (w.id[l] !== B.LEVER) { console.log(`X ${ex.id}: 입력 위치에 레버가 없음`); fail++; }
  }

  const rows = [];
  let ok = true;
  for (let m = 0; m < (1 << levers.length); m++) {
    levers.forEach((l, k) => w.setOn(l, (m >> k) & 1));
    rs.compute();
    rs.settle(80);
    const got = rs.lampLit(li) ? 1 : 0;
    const want = ex.truth[m];
    if (got !== want) ok = false;
    rows.push(`${m.toString(2).padStart(levers.length, '0')}=${got}${got === want ? '' : '(기대 ' + want + ')'}`);
  }
  console.log(`${ok ? 'O' : 'X'} ${ex.id.padEnd(10)} : ${rows.join('  ')}`);
  if (!ok) fail++;
}

console.log(fail ? `\n실패 ${fail}건` : '\n모든 진리표 통과');
process.exit(fail ? 1 : 0);
