import { B, DX, DZ } from './blocks.js';

/*
  블럭의 생김새를 "상자 목록"으로만 기술한다.
  three.js 에 의존하지 않으므로 월드 렌더러와 핫바 아이콘이 같은 코드를 쓴다.

  out(kind, px, py, pz, sx, sy, sz, color, rx, ry, rz)
    kind  : 'solid' | 'glass' | 'glow'
    px..  : 블럭 칸 안에서의 중심 좌표 (칸은 0~1 범위)
*/

export const C = {
  stone: 0x8e8e94,
  glass: 0xa8dcff,
  rsblock: 0xd0281c,
  lampOff: 0x6f5a38,
  lampOn: 0xffe58f,
  torchStick: 0x7d5a33,
  torchOn: 0xff4a24,
  torchOff: 0x5e1a12,
  repBase: 0xb9b5ad,
  repBar: 0xe6e2d8,
  leverBase: 0x9b968c,
  leverOnHandle: 0xff5a33,
  leverOffHandle: 0x6e6a62,
};

/* 신호 세기(0~15) → 와이어 색 */
export function wireColor(p) {
  const t = p / 15;
  const r = Math.round((0.24 + 0.76 * t) * 255);
  const g = Math.round((0.03 + 0.30 * t) * 255);
  const b = Math.round((0.02 + 0.12 * t) * 255);
  return (r << 16) | (g << 8) | b;
}

const TILT = 0.38;

function emitWire(s, out) {
  const col = wireColor(s.power || 0);
  const cy = 0.03, th = 0.05;
  const dirs = s.wireDirs || [];
  if (dirs.length === 0) { out('glow', 0.5, cy, 0.5, 0.52, th, 0.52, col); return; }
  out('glow', 0.5, cy, 0.5, 0.3, th, 0.3, col);
  for (const d of dirs) {
    out('glow', 0.5 + DX[d] * 0.325, cy, 0.5 + DZ[d] * 0.325,
      DX[d] ? 0.36 : 0.3, th, DZ[d] ? 0.36 : 0.3, col);
  }
}

function emitTorch(s, out) {
  const sd = s.dir;
  let px = 0.5, py = 0.29, pz = 0.5;
  let rx = 0, rz = 0, ux = 0, uz = 0;
  if (sd !== 5) {                       // 벽에 붙은 토치는 바깥쪽으로 기울인다
    rx = -TILT * DZ[sd]; rz = TILT * DX[sd];
    ux = -Math.sin(rz); uz = Math.sin(rx);
    px += DX[sd] * 0.34; pz += DZ[sd] * 0.34; py = 0.42;
  }
  out('solid', px, py, pz, 0.13, 0.56, 0.13, C.torchStick, rx, 0, rz);
  const uy = sd === 5 ? 1 : Math.cos(TILT);
  const hx = px + ux * 0.33, hy = py + uy * 0.33, hz = pz + uz * 0.33;
  if (s.on) out('glow', hx, hy, hz, 0.21, 0.21, 0.21, C.torchOn);
  else out('solid', hx, hy, hz, 0.19, 0.19, 0.19, C.torchOff);
}

function emitLever(s, out) {
  const sd = s.dir, on = s.on;
  const bx = 0.5 + DX[sd] * 0.4;
  const bz = 0.5 + DZ[sd] * 0.4;
  const by = sd === 5 ? 0.07 : 0.5;
  out('solid', bx, by, bz,
    DX[sd] ? 0.14 : 0.34, sd === 5 ? 0.14 : 0.34, DZ[sd] ? 0.14 : 0.34, C.leverBase);
  const tilt = on ? 0.55 : -0.55;
  const hc = on ? C.leverOnHandle : C.leverOffHandle;
  if (sd === 5) {
    out('solid', 0.5, 0.3, 0.5 + Math.sin(tilt) * 0.17, 0.11, 0.42, 0.11, hc, tilt, 0, 0);
  } else {
    const alongX = DX[sd] !== 0;
    out('solid', bx - DX[sd] * 0.153, by + 0.16, bz - DZ[sd] * 0.153, 0.11, 0.42, 0.11, hc,
      alongX ? 0 : tilt * DZ[sd], 0, alongX ? -tilt * DX[sd] : 0);
  }
}

function emitRepeater(s, out) {
  const f = s.dir;
  const alongX = DX[f] !== 0;
  out('solid', 0.5, 0.06, 0.5, 0.94, 0.12, 0.94, C.repBase);
  // 진행 방향 표시 (막대 + 화살촉)
  out('solid', 0.5 + DX[f] * 0.06, 0.14, 0.5 + DZ[f] * 0.06,
    alongX ? 0.6 : 0.1, 0.05, alongX ? 0.1 : 0.6, C.repBar);
  out('solid', 0.5 + DX[f] * 0.3, 0.14, 0.5 + DZ[f] * 0.3,
    alongX ? 0.16 : 0.34, 0.05, alongX ? 0.34 : 0.16, C.repBar);
  // 뒤쪽 토치(입력) / 앞쪽 토치(출력, 지연에 따라 위치 이동)
  const put = (off, lit) => {
    const px = 0.5 + DX[f] * off, pz = 0.5 + DZ[f] * off;
    out('solid', px, 0.2, pz, 0.09, 0.2, 0.09, C.torchStick);
    if (lit) out('glow', px, 0.34, pz, 0.15, 0.15, 0.15, C.torchOn);
    else out('solid', px, 0.34, pz, 0.14, 0.14, 0.14, C.torchOff);
  };
  put(-0.34, s.inOn);
  put(-0.08 + (s.dly || 0) * 0.12, s.on);
}

export function emitBlock(id, s, out) {
  switch (id) {
    case B.STONE: out('solid', 0.5, 0.5, 0.5, 0.98, 0.98, 0.98, C.stone); break;
    case B.GLASS: out('glass', 0.5, 0.5, 0.5, 0.99, 0.99, 0.99, C.glass); break;
    case B.RSBLOCK: out('solid', 0.5, 0.5, 0.5, 0.98, 0.98, 0.98, C.rsblock); break;
    case B.LAMP:
      if (s.lit) out('glow', 0.5, 0.5, 0.5, 0.99, 0.99, 0.99, C.lampOn);
      else out('solid', 0.5, 0.5, 0.5, 0.98, 0.98, 0.98, C.lampOff);
      break;
    case B.WIRE: emitWire(s, out); break;
    case B.TORCH: emitTorch(s, out); break;
    case B.LEVER: emitLever(s, out); break;
    case B.REPEATER: emitRepeater(s, out); break;
  }
}

/*
  조준(레이캐스트)용 실제 충돌 상자.  [minX, minY, minZ, maxX, maxY, maxZ] (칸 안 0~1)
  와이어·리피터처럼 납작한 부품을 정육면체로 판정하면
  "옆 바닥을 보고 있는데 와이어가 먼저 잡히는" 일이 생겨서 조작이 불편해진다.
  눈에 보이는 크기에 맞추되, 누르기 쉽도록 아주 조금 넉넉하게 잡는다.
*/
const FULLBOX = [0, 0, 0, 1, 1, 1];

/* 벽(옆면)에 붙는 부품의 상자.  dir = 붙어 있는 쪽 방향 */
function wallBox(dir, depth, halfW, y0, y1) {
  const b = [0, y0, 0, 1, y1, 1];
  if (DX[dir] !== 0) {
    if (DX[dir] < 0) { b[0] = 0; b[3] = depth; } else { b[0] = 1 - depth; b[3] = 1; }
    b[2] = 0.5 - halfW; b[5] = 0.5 + halfW;
  } else {
    if (DZ[dir] < 0) { b[2] = 0; b[5] = depth; } else { b[2] = 1 - depth; b[5] = 1; }
    b[0] = 0.5 - halfW; b[3] = 0.5 + halfW;
  }
  return b;
}

export function blockAABB(id, dir = 0) {
  switch (id) {
    case B.WIRE: return [0, 0, 0, 1, 0.10, 1];
    case B.REPEATER: return [0.03, 0, 0.03, 0.97, 0.42, 0.97];
    case B.TORCH:
      return dir === 5 ? [0.32, 0, 0.32, 0.68, 0.78, 0.68]
        : wallBox(dir, 0.44, 0.17, 0.08, 0.88);
    case B.LEVER:
      return dir === 5 ? [0.26, 0, 0.26, 0.74, 0.60, 0.74]
        : wallBox(dir, 0.40, 0.22, 0.22, 0.92);
    default: return FULLBOX;
  }
}

/* 핫바 아이콘용 대표 상태 */
export function iconState(id) {
  switch (id) {
    case B.WIRE: return { power: 13, wireDirs: [0, 1, 2, 3] };
    case B.TORCH: return { dir: 5, on: true };
    case B.LEVER: return { dir: 5, on: true };
    case B.REPEATER: return { dir: 0, dly: 1, on: true, inOn: true };
    case B.LAMP: return { lit: true };
    default: return {};
  }
}

/* 파괴 파티클 색 */
export function particleColors(id) {
  switch (id) {
    case B.STONE: return [C.stone, 0x76767e, 0xa6a6ac];
    case B.GLASS: return [0xdff2ff, C.glass, 0x8fc9ee];
    case B.RSBLOCK: return [C.rsblock, 0xff5a44, 0x8e1810];
    case B.LAMP: return [C.lampOn, C.lampOff, 0xc9a95e];
    case B.WIRE: return [0xff3b17, 0xc2200c, 0x7a1408];
    case B.TORCH: return [C.torchStick, C.torchOn, 0x9a7040];
    case B.LEVER: return [C.leverBase, C.leverOnHandle, 0x6e6a62];
    case B.REPEATER: return [C.repBase, C.repBar, 0x8d8a84];
    case B.FLOOR: return [0x78806b, 0x707863, 0x5d5347];
    default: return [0x9a9a9a];
  }
}
