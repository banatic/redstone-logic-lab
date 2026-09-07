import { World } from '../js/world.js';
import { Redstone } from '../js/redstone.js';
import { EXAMPLES, loadExample, ORIGIN } from '../js/examples.js';
const O = ORIGIN;
const find = id => EXAMPLES.find(e => e.id === id);

// 클럭: 램프가 깜빡이는가
{
  const w = new World(); loadExample(w, find('clock'));
  const rs = new Redstone(w);
  const lamp = w.idx(O[0]+7, O[1]+0, O[2]+0);
  let s = '';
  for (let t = 0; t < 40; t++) { s += rs.lampLit(lamp) ? '#' : '.'; rs.tick(); }
  console.log('clock lamp:', s);
}
// 래치: R/S 조작 후 기억 유지되는가
{
  const w = new World(); loadExample(w, find('latch'));
  const rs = new Redstone(w);
  const R = w.idx(O[0]+0, O[1], O[2]+0), S = w.idx(O[0]+10, O[1], O[2]+6);
  const Q = w.idx(O[0]+5, O[1], O[2]+1), Qb = w.idx(O[0]+5, O[1], O[2]+5);
  const rd = () => `Q=${rs.lampLit(Q)?1:0} ~Q=${rs.lampLit(Qb)?1:0}`;
  const step = (r, s) => { w.setOn(R, r); w.setOn(S, s); rs.compute(); rs.settle(40); };
  step(0,0); console.log('초기      ', rd());
  step(1,0); console.log('R=1       ', rd());
  step(0,0); console.log('R=0 (유지)', rd());
  step(0,1); console.log('S=1       ', rd());
  step(0,0); console.log('S=0 (유지)', rd());
}
// 절연체 실험
{
  const w = new World(); loadExample(w, find('insulator'));
  const rs = new Redstone(w); rs.settle(40);
  const A = w.idx(O[0]+0,O[1],O[2]+0), Bv = w.idx(O[0]+0,O[1],O[2]+5);
  const L1 = w.idx(O[0]+7,O[1],O[2]+0), L2 = w.idx(O[0]+7,O[1],O[2]+5);
  for (const v of [0,1]) {
    w.setOn(A, v); w.setOn(Bv, v); rs.compute(); rs.settle(40);
    console.log(`레버=${v}  일반블럭쪽 램프=${rs.lampLit(L1)?1:0}  유리쪽 램프=${rs.lampLit(L2)?1:0}`);
  }
}
