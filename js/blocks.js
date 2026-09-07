// 블록 정의 및 방향 상수
// 방향(dir) 규약: 0:+X(동) 1:-X(서) 2:+Z(남) 3:-Z(북) 4:+Y(위) 5:-Y(아래)

export const B = Object.freeze({
  AIR: 0,
  FLOOR: 1,      // 바닥판 (절연체, 파괴 불가)
  STONE: 2,      // 일반 블럭 (전도성)
  GLASS: 3,      // 비전도 블럭 (절연체)
  WIRE: 4,       // 레드스톤 와이어
  RSBLOCK: 5,    // 레드스톤 블럭 (상시 전원)
  LAMP: 6,       // 레드스톤 램프
  REPEATER: 7,   // 리피터
  LEVER: 8,      // 레버 (입력 스위치)
  TORCH: 9,      // 레드스톤 토치 (NOT 게이트)
});

export const NAME = {
  [B.AIR]: '공기',
  [B.FLOOR]: '바닥판',
  [B.STONE]: '일반 블럭',
  [B.GLASS]: '비전도 블럭',
  [B.WIRE]: '레드스톤 와이어',
  [B.RSBLOCK]: '레드스톤 블럭',
  [B.LAMP]: '레드스톤 램프',
  [B.REPEATER]: '리피터',
  [B.LEVER]: '레버',
  [B.TORCH]: '레드스톤 토치',
};

export const KEYNAME = {
  AIR: B.AIR, FLOOR: B.FLOOR, STONE: B.STONE, GLASS: B.GLASS, WIRE: B.WIRE,
  RSBLOCK: B.RSBLOCK, LAMP: B.LAMP, REPEATER: B.REPEATER, LEVER: B.LEVER, TORCH: B.TORCH,
};

export const DX = [1, -1, 0, 0, 0, 0];
export const DY = [0, 0, 0, 0, 1, -1];
export const DZ = [0, 0, 1, -1, 0, 0];
export const OPP = [1, 0, 3, 2, 5, 4];
export const EAST = 0, WEST = 1, SOUTH = 2, NORTH = 3, UP = 4, DOWN = 5;

// 꽉 찬 큐브(충돌·시야 차단)
export function isSolid(id) {
  return id === B.FLOOR || id === B.STONE || id === B.GLASS || id === B.RSBLOCK || id === B.LAMP;
}
// 강한 신호를 통과시키는 전도성 블럭
export function isConductive(id) { return id === B.STONE; }
// 신호를 받을 수 있는 블럭 (전도성 블럭 + 램프)
export function isReceiver(id) { return id === B.STONE || id === B.LAMP; }
// 와이어가 연결 모양을 만드는 부품
export function isComponent(id) {
  return id === B.LAMP || id === B.RSBLOCK || id === B.TORCH || id === B.LEVER || id === B.REPEATER;
}
// 지지 블럭이 필요한 부품
export function needsSupport(id) {
  return id === B.WIRE || id === B.REPEATER || id === B.TORCH || id === B.LEVER;
}
// 바닥(아래쪽)에만 놓을 수 있는 부품
export function floorOnly(id) { return id === B.WIRE || id === B.REPEATER; }
