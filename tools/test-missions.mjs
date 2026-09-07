// 미션 정답 회로 검증:  node tools/test-missions.mjs
import { World } from '../js/world.js';
import { Redstone } from '../js/redstone.js';
import { MISSIONS, loadMission, gradeMission, maskForRow } from '../js/missions.js';
import { SOLUTIONS } from './solutions.mjs';

let fail = 0;

for (const m of MISSIONS) {
  const n = m.inputs.length;

  // 1) 시작 상태(과제)는 아직 통과하면 안 된다
  const w0 = new World();
  loadMission(w0, m);
  const rs0 = new Redstone(w0);
  const g0 = gradeMission(w0, rs0, m);
  if (g0.pass) {
    console.log(`X ${m.id.padEnd(7)} : 시작 상태가 이미 진리표를 통과합니다 (과제가 성립 안 됨)`);
    fail++;
  }

  // 2) 정답 회로는 반드시 통과해야 한다
  const sol = SOLUTIONS[m.id];
  if (!sol) {
    console.log(`- ${m.id.padEnd(7)} : 정답 회로 없음 (심화 과제)`);
    continue;
  }
  const w = new World();
  loadMission(w, m, sol);
  const rs = new Redstone(w);
  const g = gradeMission(w, rs, m);

  const cells = [];
  for (let r = 0; r < (1 << n); r++) {
    const mask = maskForRow(r, n);
    const row = g.rows[mask];
    const inb = Array.from({ length: n }, (_, k) => (mask >> k) & 1).join('');
    cells.push(`${inb}=${row.got.join('')}${row.ok ? '' : '(기대 ' + row.want.join('') + ')'}`);
  }
  console.log(`${g.pass ? 'O' : 'X'} ${m.id.padEnd(7)} : ${cells.join('  ')}`);
  if (!g.pass) fail++;
}

console.log(fail ? `\n실패 ${fail}건` : '\n모든 미션 통과');
process.exit(fail ? 1 : 0);
