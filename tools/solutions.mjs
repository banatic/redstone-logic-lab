import { B } from '../js/blocks.js';

/*
 미션 정답 회로 — 검증 도구 전용. 배포 파일(index.html)에는 들어가지 않는다.
 좌표는 missions.js 의 미션과 같은 원점(ORIGIN) 기준.
*/
const E = 0, W = 1, S = 2;
const T = { S: B.STONE, G: B.GLASS, w: B.WIRE, L: B.LAMP, P: B.REPEATER, V: B.LEVER, X: B.TORCH };
function row(x0, x1, z, y = 0) {
  const a = []; const st = x0 <= x1 ? 1 : -1;
  for (let x = x0; x !== x1 + st; x += st) a.push([x, y, z, T.w]);
  return a;
}
function col(z0, z1, x, y = 0) {
  const a = []; const st = z0 <= z1 ? 1 : -1;
  for (let z = z0; z !== z1 + st; z += st) a.push([x, y, z, T.w]);
  return a;
}
function inv(x, z, y = 0) { return [[x, y, z, T.S], [x + 1, y, z, T.X, W]]; }

export const SOLUTIONS = {
  tut: [...row(1, 4, 0)
  ],
  decay: [...row(1, 7, 0), [8, 0, 0, T.P, E], ...row(9, 19, 0)
  ],
  not: [...row(1, 2, 0), ...inv(3, 0), ...row(5, 6, 0)
  ],
  or: [
      ...row(1, 3, 0), ...row(1, 3, 4), ...col(1, 3, 3), ...row(4, 5, 2),
  ],
  nor: [
      ...row(1, 2, 0), ...row(1, 2, 4), ...col(1, 3, 2), [3, 0, 2, T.w],
      ...inv(4, 2), ...row(6, 7, 2),
  ],
  fix: [
      ...row(1, 2, 0), ...inv(3, 0),
      ...row(1, 2, 4), ...inv(3, 4),
      ...col(0, 4, 5), ...row(6, 7, 2),
  ],
  nand: [
      ...row(1, 2, 0), ...inv(3, 0),
      ...row(1, 2, 4), ...inv(3, 4),
      ...col(0, 4, 5), ...row(6, 7, 2),
  ],
  and: [
      ...row(1, 2, 0), ...inv(3, 0),
      ...row(1, 2, 4), ...inv(3, 4),
      ...col(0, 4, 5), [6, 0, 2, T.w], ...inv(7, 2), ...row(9, 10, 2),
  ],
  xor: [
      ...col(1, 6, 2), ...col(11, 6, 2),
      [3, 0, 6, T.w], ...inv(4, 6),
      ...row(3, 6, 0), [6, 0, 1, T.w], [6, 0, 2, T.w], ...col(5, 2, 5),
      [7, 0, 2, T.w], ...inv(8, 2),
      ...row(3, 6, 12), [6, 0, 11, T.w], [6, 0, 10, T.w], ...col(7, 10, 5),
      [7, 0, 10, T.w], ...inv(8, 10),
      [10, 0, 2, T.w], ...col(3, 6, 10),
      [10, 0, 10, T.w], ...col(9, 7, 10),
      [11, 0, 6, T.w], ...inv(12, 6),
      [14, 0, 6, T.w], ...inv(15, 6),
      ...row(17, 18, 6),
  ],
  half: [
      // ---- 합 = XOR ----
      ...col(1, 6, 2), ...col(11, 6, 2),
      [3, 0, 6, T.w], ...inv(4, 6),                       // G1 = NOR(A,B)
      ...row(3, 6, 0), [6, 0, 1, T.w], [6, 0, 2, T.w], ...col(5, 2, 5),
      [7, 0, 2, T.w], ...inv(8, 2),                       // G2 = NOR(A,G1)
      ...row(3, 6, 12), [6, 0, 11, T.w], [6, 0, 10, T.w], ...col(7, 10, 5),
      [7, 0, 10, T.w], ...inv(8, 10),                     // G3 = NOR(B,G1)
      [10, 0, 2, T.w], ...col(3, 6, 10),
      [10, 0, 10, T.w], ...col(9, 7, 10),
      [11, 0, 6, T.w], ...inv(12, 6),                     // G4 = XNOR
      [14, 0, 6, T.w], ...inv(15, 6),                     // G5 = XOR = 합
      ...row(17, 18, 6),
      // ---- 올림 = NOR(합, NOR(A,B)) ----
      ...col(11, 13, 1), [1, 0, 14, T.P, S], ...col(15, 16, 1),
      ...row(2, 3, 16), ...inv(4, 16),                    // A OR B 를 다시 뒤집음
      ...col(7, 16, 18),                                  // 합 신호를 남쪽으로
      ...row(6, 19, 16),                                  // 두 신호를 합쳐 직선으로 진입
      ...inv(20, 16),                                     // 올림 = NOR(합, NOR(A,B))
      ...row(22, 23, 16),
  ],
};
