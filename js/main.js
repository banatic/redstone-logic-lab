import * as THREE from '../vendor/three.module.js';
import { B, NAME, OPP, isSolid } from './blocks.js';
import { World } from './world.js';
import { Redstone } from './redstone.js';
import { VoxelRenderer, makeBlockIcons } from './render.js';
import { Particles } from './particles.js';
import { particleColors, blockAABB } from './shapes.js';
import { Player } from './player.js';
import { EXAMPLES, loadExample } from './examples.js';
import { EXHIBITS, MUSEUM_ORIGIN, loadExhibit } from './museum.js';
import {
  MISSIONS, ORIGIN, loadMission, gradeMission, frameIndices, countPlaced,
  currentMask, currentOut, maskForRow, inputName, outputName, frameBlocks, placeFrame,
} from './missions.js';

// ---------------------------------------------------------------- 기본 설정
const ALLBLOCKS = [B.STONE, B.GLASS, B.WIRE, B.RSBLOCK, B.LAMP, B.REPEATER, B.LEVER, B.TORCH];
const SAVE_KEY = 'redstone-lab-save-v1';    // 수동 저장 슬롯 (내 작업장)
const MAPS_KEY = 'redstone-lab-maps-v3';    // 모든 맵 자동 저장
const PROG_KEY = 'redstone-lab-prog-v2';    // 미션 진행 상황
const DIRNAME = ['동(+X)', '서(-X)', '남(+Z)', '북(-Z)'];

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93c6e8);
scene.fog = new THREE.Fog(0x93c6e8, 90, 260);

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 700);
scene.add(new THREE.HemisphereLight(0xffffff, 0x585848, 1.15));
const sun = new THREE.DirectionalLight(0xfff4e2, 0.75);
sun.position.set(30, 60, 18);
scene.add(sun);

const world = new World(96, 20, 96);
const rs = new Redstone(world);
const vr = new VoxelRenderer(scene, world, rs);
const player = new Player(world, camera);
const particles = new Particles(scene);

// 선택 강조 상자
const hi = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)),
  new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.7 })
);
hi.visible = false;
scene.add(hi);

// ---------------------------------------------------------------- 상태
let hot = ALLBLOCKS.slice();   // 지금 쓸 수 있는 블럭 (미션마다 제한될 수 있음)
let sel = 0;
let tickMs = 100;
let running = true;
let acc = 0;
let target = null;
let locks = new Set();         // 부술 수 없는 고정 블럭 (레버·램프)

// ---------------------------------------------------------------- 레이캐스트
/*
 광선 ↔ 상자 교차. 맞으면 { t, nx, ny, nz }(들어간 면의 바깥 방향), 아니면 null.
 b = [minX, minY, minZ, maxX, maxY, maxZ] (월드 좌표)
*/
const _O = [0, 0, 0], _D = [0, 0, 0], _N = [0, 0, 0];
function rayBox(o, d, b, maxD) {
  _O[0] = o.x; _O[1] = o.y; _O[2] = o.z;
  _D[0] = d.x; _D[1] = d.y; _D[2] = d.z;
  let tmin = 0, tmax = maxD, ax = -1, sgn = 0;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(_D[k]) < 1e-9) {
      if (_O[k] < b[k] || _O[k] > b[k + 3]) return null;
      continue;
    }
    const inv = 1 / _D[k];
    let t1 = (b[k] - _O[k]) * inv, t2 = (b[k + 3] - _O[k]) * inv;
    let s = -1;                       // 들어가는 면의 바깥 방향
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
    if (t1 > tmin) { tmin = t1; ax = k; sgn = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  _N[0] = _N[1] = _N[2] = 0;
  if (ax >= 0) _N[ax] = sgn;
  else {                              // 시작점이 상자 안 — 보는 방향의 반대 면
    let k = 0;
    if (Math.abs(_D[1]) > Math.abs(_D[k])) k = 1;
    if (Math.abs(_D[2]) > Math.abs(_D[k])) k = 2;
    _N[k] = _D[k] > 0 ? -1 : 1;
  }
  return { t: tmin, nx: _N[0], ny: _N[1], nz: _N[2] };
}

/*
 칸을 순서대로 훑되, 각 칸에서는 그 블럭의 "진짜" 상자와만 교차 판정한다.
 와이어처럼 납작한 부품이 옆 바닥을 가로채지 않게 하려는 것.
*/
const _bb = [0, 0, 0, 0, 0, 0];
function raycast(maxD = 7) {
  const o = camera.position;
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const inf = 1e30;
  const tdx = sx !== 0 ? Math.abs(1 / d.x) : inf;
  const tdy = sy !== 0 ? Math.abs(1 / d.y) : inf;
  const tdz = sz !== 0 ? Math.abs(1 / d.z) : inf;
  let tx = sx !== 0 ? ((sx > 0 ? x + 1 - o.x : o.x - x) / Math.abs(d.x)) : inf;
  let ty = sy !== 0 ? ((sy > 0 ? y + 1 - o.y : o.y - y) / Math.abs(d.y)) : inf;
  let tz = sz !== 0 ? ((sz > 0 ? z + 1 - o.z : o.z - z) / Math.abs(d.z)) : inf;

  for (let s = 0; s < 220; s++) {
    if (world.inb(x, y, z)) {
      const i = world.idx(x, y, z);
      const id = world.id[i];
      if (id !== B.AIR) {
        const a = blockAABB(id, world.dir[i]);
        _bb[0] = x + a[0]; _bb[1] = y + a[1]; _bb[2] = z + a[2];
        _bb[3] = x + a[3]; _bb[4] = y + a[4]; _bb[5] = z + a[5];
        const h = rayBox(o, d, _bb, maxD);
        // 상자를 빗맞으면 이 칸은 없는 셈 치고 계속 나아간다
        if (h) return { i, x, y, z, nx: h.nx, ny: h.ny, nz: h.nz, box: a };
      }
    }
    if (tx <= ty && tx <= tz) {
      if (tx > maxD) break;
      x += sx; tx += tdx;
    } else if (ty <= tz) {
      if (ty > maxD) break;
      y += sy; ty += tdy;
    } else {
      if (tz > maxD) break;
      z += sz; tz += tdz;
    }
  }
  return null;
}

function dirFromNormal(nx, ny, nz) {
  if (nx === 1) return 0; if (nx === -1) return 1;
  if (nz === 1) return 2; if (nz === -1) return 3;
  if (ny === 1) return 4; return 5;
}
function lookDir() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  return Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 0 : 1) : (d.z > 0 ? 2 : 3);
}

// ---------------------------------------------------------------- 조작
function breakBlock() {
  if (!target) return;
  const id = world.id[target.i];
  if (id === B.FLOOR) { toast('바닥판은 부술 수 없습니다'); return; }
  if (locks.has(target.i)) { toast('미션에서 주어진 부품입니다'); return; }
  particles.burst(target.x, target.y, target.z, particleColors(id), 18);
  world.setIdx(target.i, B.AIR);
  for (const [ri, rid] of world.dropUnsupported(target.i)) {
    const [rx, ry, rz] = world.xyz(ri);
    particles.burst(rx, ry, rz, particleColors(rid), 10);
  }
  refresh();
}

function useOrPlace() {
  if (!target) return;
  const id = world.id[target.i];
  if (id === B.LEVER) {
    world.setOn(target.i, !world.on(target.i));
    refresh(); return;
  }
  if (id === B.REPEATER) {                    // 방향 회전 (수업에서 중요한 쪽)
    world.dir[target.i] = (world.dir[target.i] + 1) % 4;
    world.version++;
    toast('리피터 방향: ' + DIRNAME[world.dir[target.i]]);
    refresh(); return;
  }
  const px = target.x + target.nx, py = target.y + target.ny, pz = target.z + target.nz;
  if (!world.inb(px, py, pz)) return;
  const ni = world.idx(px, py, pz);
  const put = hot[sel];
  if (put === undefined) return;
  let dir = 0, dly = 0, on = 0;
  if (put === B.TORCH || put === B.LEVER) {
    dir = OPP[dirFromNormal(target.nx, target.ny, target.nz)];
    if (dir === 4) { toast('천장에는 붙일 수 없습니다'); return; }
    if (put === B.TORCH) on = 1;
  } else if (put === B.REPEATER) {
    dir = lookDir();          // 바라보는 쪽으로. 뒤에 우클릭으로 돌릴 수 있다
  }
  if (!world.canPlace(ni, put, dir)) { toast('여기에는 놓을 수 없습니다'); return; }
  const p = player.pos;
  if (isSolid(put) && px === Math.floor(p.x) && pz === Math.floor(p.z)
      && (py === Math.floor(p.y) || py === Math.floor(p.y + 1.5))) {
    toast('내가 서 있는 자리입니다'); return;
  }
  world.setIdx(ni, put, dir, dly, on);
  refresh();
}

/* 리피터 지연 바꾸기. 미션에는 쓸 일이 없고 클럭·지연 예제에서만 쓴다 */
function cycleDelay() {
  if (!target || world.id[target.i] !== B.REPEATER) return;
  world.dly[target.i] = (world.dly[target.i] + 1) % 4;
  world.version++;
  refresh();
  toast('리피터 지연 ' + (world.dly[target.i] + 1) + '틱');
}

function pickTarget() {
  if (!target) return;
  const k = hot.indexOf(world.id[target.i]);
  if (k >= 0) { sel = k; updateHotbar(); }
}

function refresh() {
  rs.compute();
  vr.dirty = true;
}

// ---------------------------------------------------------------- UI 기본
const el = (id) => document.getElementById(id);
const hud = el('hud'), toastEl = el('toast'), hotbarEl = el('hotbar');
const menu = el('menu');
const mpanel = el('mpanel'), mtable = el('mtable');

let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.style.opacity = 1; toastT = 2.6; }

const ICONS = makeBlockIcons(ALLBLOCKS);

function updateHotbar() {
  [...hotbarEl.children].forEach((c, k) => c.classList.toggle('on', k === sel));
}

function buildHotbar() {
  hotbarEl.innerHTML = '';
  hot.forEach((id, k) => {
    const d = document.createElement('div');
    d.className = 'slot';
    const art = ICONS && ICONS[id]
      ? `<img class="sw" src="${ICONS[id]}" alt="">`
      : `<span class="sw s${id}"></span>`;
    d.innerHTML = `<span class="num">${k + 1}</span>${art}<span class="nm">${NAME[id]}</span>`;
    d.onclick = () => { sel = k; updateHotbar(); };
    hotbarEl.appendChild(d);
  });
  if (sel >= hot.length) sel = 0;
  updateHotbar();
}

/* 신호 세기 0~15 를 15칸 막대로 */
function bar(v) {
  let h = '<span class="bar">';
  for (let k = 1; k <= 15; k++) h += `<i${k <= v ? ' class="on"' : ''}></i>`;
  return h + `</span><span class="n${v ? '' : ' zero'}">${v}</span>`;
}
const onoff = (v) => `<span class="dot${v ? ' on' : ''}"></span>${v ? '켜짐' : '꺼짐'}`;

let hudHtml = '';
function updateHud() {
  const m = MAPS[curMap];
  const tags = [];
  if (!player.fly) tags.push('걷기');
  if (player.sprint) tags.push('달리기');
  if (!running) tags.push('일시정지');
  let t = `<span class="map">${m.name}</span>`;
  if (tags.length) t += `<span class="tags">${tags.map((x) => `<span>${x}</span>`).join('')}</span>`;
  if (target) {
    const id = world.id[target.i];
    t += `<div class="aim"><b>${labelFor(target.i, id)}</b>`;
    if (id === B.WIRE) t += bar(rs.power[target.i]);
    else if (id === B.STONE) {
      const v = rs.strong[target.i] > 0 ? 15 : rs.weak[target.i];
      t += bar(v);
      if (rs.strong[target.i] > 0) t += '<span class="st">강한 충전</span>';
    }
    else if (id === B.REPEATER) t += `<span class="st">${DIRNAME[world.dir[target.i]]}, 지연 ${world.dly[target.i] + 1}틱</span>`;
    else if (id === B.LEVER || id === B.TORCH) t += `<span class="st">${onoff(world.on(target.i))}</span>`;
    else if (id === B.LAMP) t += `<span class="st">${onoff(rs.lampLit(target.i))}</span>`;
    t += '</div>';
  }
  if (t !== hudHtml) { hudHtml = t; hud.innerHTML = t; }
}

/* 미션의 레버·램프에는 A / B / 합 같은 이름을 붙여 보여준다 */
let labels = new Map();
function labelFor(i, id) {
  return labels.get(i) || NAME[id];
}
function buildLabels(mis, map) {
  labels = new Map();
  const put = (base, [x, y, z], name) =>
    labels.set(world.idx(base[0] + x, base[1] + y, base[2] + z), name);
  if (mis) {
    mis.inputs.forEach((p, k) => put(ORIGIN, p, '레버 ' + inputName(mis, k)));
    mis.outputs.forEach((p, k) => put(ORIGIN, p,
      '램프 ' + (mis.outputs.length > 1 ? outputName(mis, k) : '')));
  } else if (map && map.exhibit) {
    const e = map.exhibit;
    e.inputs.forEach((p, k) => put(MUSEUM_ORIGIN, p, '레버 ' + (e.inNames ? e.inNames[k] : k + 1)));
    for (const [name, p] of Object.entries(e.probes)) put(MUSEUM_ORIGIN, p, '램프 ' + name);
  }
}

/* (tx,tz) 를 비스듬히 내려다보는 위치로 이동 */
function lookAt(tx, tz, dist) {
  const px = Math.max(1, tx - dist * 0.66);
  const pz = Math.min(world.SZ - 1, tz + dist * 0.66);
  const py = 2 + dist * 0.62;
  const hx = tx - px, hz = tz - pz;
  const hd = Math.hypot(hx, hz);
  player.fly = true;
  player.spawnAt(px, py, pz, Math.atan2(-hz, hx), -Math.atan2(py + 0.6 - 1.5, hd));
}

/* 블럭 묶음 전체가 화면에 들어오는 위치로 */
function viewBlocks(blocks, base = ORIGIN) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const b of blocks) {
    if (b[0] < minX) minX = b[0];
    if (b[0] > maxX) maxX = b[0];
    if (b[2] < minZ) minZ = b[2];
    if (b[2] > maxZ) maxZ = b[2];
  }
  if (minX > maxX) { lookAt(46.5, 46.5, 16); return; }
  const span = Math.max(maxX - minX, maxZ - minZ) + 5;
  lookAt(base[0] + (minX + maxX) / 2 + 0.5,
    base[2] + (minZ + maxZ) / 2 + 0.5,
    Math.max(10, span * 0.85));
}

/* ================================================================
   맵(층) 시스템
     0            내 작업장
     1..M         미션
     M+1..        예제 회로 (교사 시연용)
================================================================= */
const MAPS = [{ key: 'home', name: '내 작업장', kind: 'home', data: null, view: null }];
MISSIONS.forEach((m, k) => {
  MAPS.push({ key: 'm:' + m.id, name: `${k + 1}. ${m.title}`, kind: 'mission', mission: m, data: null, view: null });
});
// 박물관 : 자동 생성한 큰 회로 + 진리표로 채점할 수 없는 회로들
const MU0 = MAPS.length;
for (const e of EXHIBITS) {
  MAPS.push({ key: 'mu:' + e.id, name: e.title, kind: 'museum', exhibit: e, note: e.note, data: null, view: null });
}
for (const ex of EXAMPLES) {
  MAPS.push({ key: 'ex:' + ex.id, name: ex.name, kind: 'museum', ex, note: ex.desc, data: null, view: null });
}
const MUSEUM = MAPS.slice(MU0);

let curMap = 0;
const isHome = () => curMap === 0;
function curMission() {
  const m = MAPS[curMap];
  return m.kind === 'mission' ? m.mission : null;
}

function snapshotView() {
  return {
    x: player.pos.x, y: player.pos.y, z: player.pos.z,
    yaw: player.yaw, pitch: player.pitch, fly: player.fly,
  };
}
function stashCurrent() {
  const m = MAPS[curMap];
  m.data = world.serialize();
  m.view = snapshotView();
}

/* 내 작업장 첫 방문용 맛보기 회로 */
function buildStarter() {
  const x = 44, y = 1, z = 46;
  world.set(x, y, z, B.LEVER, 5);
  world.set(x + 1, y, z, B.WIRE);
  world.set(x + 2, y, z, B.WIRE);
  world.set(x + 3, y, z, B.WIRE);
  world.set(x + 4, y, z, B.LAMP);
}

/* 저장된 시점이 없을 때(예: 새로고침 뒤 처음 들어갈 때) 쓸 기본 시점 */
function defaultView(m) {
  if (m.kind === 'mission') viewBlocks([...frameBlocks(m.mission), ...(m.mission.start || [])]);
  else if (m.kind === 'museum') viewBlocks(m.exhibit ? m.exhibit.blocks : m.ex.blocks,
    m.exhibit ? MUSEUM_ORIGIN : ORIGIN);
  else lookAt(46.5, 46.5, 16);
}

function initMap(m) {
  if (m.kind === 'mission') {
    loadMission(world, m.mission);
  } else if (m.kind === 'museum') {
    if (m.exhibit) loadExhibit(world, m.exhibit); else loadExample(world, m.ex);
  } else {
    world.reset();
    buildStarter();
  }
  defaultView(m);
  rs.cnt.fill(0); rs.compute(); rs.settle(60);
  vr.dirty = true;
  m.view = snapshotView();
}

function afterMapChange() {
  const m = MAPS[curMap];
  const mis = curMission();
  particles.clear();

  // 미션마다 쓸 수 있는 블럭이 다르다
  hot = m.kind === 'museum' ? []
    : (m.kind === 'mission' && mis && mis.allowed) ? mis.allowed.slice() : ALLBLOCKS.slice();
  buildHotbar();

  // 고정 블럭 잠금. 박물관은 레버 말고 전부 잠근다
  if (m.kind === 'museum') {
    locks = new Set();
    for (let i = 0; i < world.n; i++) {
      const id = world.id[i];
      if (id !== B.AIR && id !== B.FLOOR && id !== B.LEVER) locks.add(i);
    }
  } else locks = (m.kind === 'mission' && mis) ? frameIndices(world, mis) : new Set();
  buildLabels(mis, m);

  lastGrade = null;
  wasPass = undefined;
  gradeWait = -1;
  buildMissionTable(curMission());
  panelSig = '';
  countDirty = true;

  const back = el('btnBack');
  if (!isHome()) { back.hidden = false; back.textContent = '내 작업장으로'; }
  else back.hidden = true;

  buildMissionList();
  buildMissionCard();
  el('btnGoHome').classList.toggle('on', isHome());
  buildMuseumList();
  runGrade();
  updateMissionPanel();
}

function gotoMap(k) {
  if (k === curMap) { toast('이미 ' + MAPS[k].name + ' 입니다'); return; }
  stashCurrent();
  saveMaps();
  curMap = k;
  const m = MAPS[k];
  if (!m.data) {
    initMap(m);
  } else {
    world.deserialize(m.data);
    // 저장본이 어떻든 미션의 레버·램프는 늘 제자리에 있어야 한다
    if (m.kind === 'mission') placeFrame(world, m.mission);
    rs.cnt.fill(0); rs.compute(); rs.settle(60);
    vr.dirty = true;
    const v = m.view;
    if (v) {
      player.spawnAt(v.x, v.y, v.z, v.yaw, v.pitch);
      player.fly = v.fly;
    } else defaultView(m);
  }
  afterMapChange();
  toast(m.name);
}

// ---------------------------------------------------------------- 저장
let savedVersion = -1;
function saveMaps() {
  try {
    const out = {};
    for (const m of MAPS) if (m.data) out[m.key] = m.data;
    localStorage.setItem(MAPS_KEY, JSON.stringify(out));
    savedVersion = world.version;
  } catch (err) { /* file:// 등에서 막히면 무시 */ }
}
function loadMaps() {
  try {
    const t = localStorage.getItem(MAPS_KEY);
    if (!t) return;
    const data = JSON.parse(t);
    for (const m of MAPS) if (data[m.key]) m.data = data[m.key];
  } catch (err) { /* 무시 */ }
}

let prog = { cleared: {}, unlockAll: false };
function saveProgress() {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(prog)); } catch (err) { /* 무시 */ }
}
function loadProgress() {
  try {
    const t = localStorage.getItem(PROG_KEY);
    if (t) prog = Object.assign(prog, JSON.parse(t));
  } catch (err) { /* 무시 */ }
}
const isCleared = (m) => prog.cleared[m.id] !== undefined;
function isUnlocked(k) {
  return prog.unlockAll || k === 0 || isCleared(MISSIONS[k - 1]);
}

// ---------------------------------------------------------------- 미션 패널
let lastGrade = null;
let gradeVersion = -1;
let panelSig = '';
let countDirty = true;
let placedCount = 0;
let wasPass;            // undefined = 맵에 막 들어옴 (첫 채점은 조용히)
let gradeWait = -1;     // 회로가 바뀐 뒤 자동 채점까지 남은 시간(초)

function buildMissionTable(m) {
  if (!m) { mtable.innerHTML = ''; return; }
  const n = m.inputs.length;
  let h = '<tr>';
  for (let k = 0; k < n; k++) h += `<th>${inputName(m, k)}</th>`;
  h += '<th class="sep"></th>';
  for (let k = 0; k < m.outputs.length; k++) h += `<th>${outputName(m, k)}</th>`;
  h += '<th class="mk"></th></tr>';
  for (let r = 0; r < (1 << n); r++) {
    const mask = maskForRow(r, n);
    h += `<tr data-mask="${mask}">`;
    for (let k = 0; k < n; k++) h += `<td class="in">${(mask >> k) & 1}</td>`;
    h += '<td class="sep"></td>';
    for (const v of m.truth[mask]) h += `<td class="out">${v}</td>`;
    h += '<td class="mk"></td></tr>';
  }
  mtable.innerHTML = h;
}

function updateMissionPanel() {
  const m = curMission();
  if (!m) { mpanel.hidden = true; return; }
  mpanel.hidden = false;

  if (countDirty) { placedCount = countPlaced(world, m); countDirty = false; }

  const mask = currentMask(world, m);
  const pass = !!(lastGrade && lastGrade.pass);
  const sig = `${mask}|${placedCount}|${lastGrade ? lastGrade.rows.map((r) => (r.ok ? 1 : 0)).join('') : '-'}`;
  if (sig === panelSig) return;
  panelSig = sig;

  el('mtitle').textContent = m.title;
  el('mblocks').innerHTML = (pass ? '<em>통과</em>' : '') + '블럭 ' + placedCount;
  mpanel.classList.toggle('pass', pass);

  for (const tr of [...mtable.rows].slice(1)) {
    const rm = +tr.dataset.mask;
    tr.classList.toggle('now', rm === mask);
    const mk = tr.querySelector('.mk');
    if (lastGrade) {
      const ok = lastGrade.rows[rm].ok;
      mk.textContent = ok ? '✓' : '✗';
      mk.className = 'mk ' + (ok ? 'ok' : 'no');
    } else {
      mk.textContent = '·';
      mk.className = 'mk';
    }
  }
}

/*
 회로가 바뀔 때마다 자동으로 모든 입력 조합을 돌려 채점한다.
 학생이 따로 무엇을 누를 필요가 없다.
*/
function runGrade() {
  const m = curMission();
  if (!m) { lastGrade = null; return; }
  const first = wasPass === undefined;
  const g = gradeMission(world, rs, m);
  lastGrade = g;
  gradeVersion = world.version;
  panelSig = '';
  vr.dirty = true;

  if (g.pass && !first) {
    const n = countPlaced(world, m);
    const prev = prog.cleared[m.id];
    if (prev === undefined) {
      prog.cleared[m.id] = n;
      saveProgress(); buildMissionList(); buildMissionCard();
      toast(`통과!  블럭 ${n}개`);
    } else if (n < prev) {
      prog.cleared[m.id] = n;
      saveProgress(); buildMissionList(); buildMissionCard();
      toast(`최소 기록 경신 — 블럭 ${n}개`);
    } else if (!wasPass) {
      toast(`통과!  블럭 ${n}개 (최소 ${prev})`);
    }
  } else if (g.pass && first && prog.cleared[m.id] === undefined) {
    // 맵에 들어오자마자 이미 통과 상태라면 조용히 기록만 남긴다
    prog.cleared[m.id] = countPlaced(world, m);
    saveProgress(); buildMissionList(); buildMissionCard();
  }
  wasPass = g.pass;
}

// ---------------------------------------------------------------- 메뉴
function buildMissionList() {
  const list = el('mlist');
  list.innerHTML = '';
  let day = 0;
  MISSIONS.forEach((m, k) => {
    if (m.day !== day) {
      day = m.day;
      const d = document.createElement('div');
      d.className = 'daysep';
      d.textContent = day + '일차';
      list.appendChild(d);
    }
    const b = document.createElement('button');
    const open = isUnlocked(k);
    b.className = 'misbtn' + (open ? '' : ' locked') + (isCleared(m) ? ' done' : '')
      + (curMap === k + 1 ? ' on' : '');
    const best = prog.cleared[m.id];
    b.innerHTML = `<span class="mn">${k + 1}</span><span class="mt">${m.title}</span>`
      + `<span class="ms">${isCleared(m) ? '블럭 ' + best : (open ? '' : '잠김')}</span>`;
    b.disabled = !open;
    b.onclick = () => gotoMap(k + 1);
    list.appendChild(b);
  });
}

function buildMissionCard() {
  const map = MAPS[curMap];
  const card = el('mcard');
  const named = curMission() || map.kind === 'museum';
  if (!named) { card.hidden = true; return; }
  card.hidden = false;
  el('mcardtitle').textContent = map.name;
  el('mcardnote').textContent = map.note || '';
  el('mcardnote').hidden = !map.note;
}

function buildMuseumList() {
  const list = el('mulist');
  list.innerHTML = '';
  MUSEUM.forEach((m, k) => {
    const b = document.createElement('button');
    b.className = 'misbtn' + (curMap === MU0 + k ? ' on' : '');
    b.innerHTML = `<span class="mt">${m.name}</span>`;
    b.onclick = () => gotoMap(MU0 + k);
    list.appendChild(b);
  });
}

const toggleHelp = () => el('help').classList.toggle('hidden');
el('btnHelp').onclick = toggleHelp;
el('btnHelpMenu').onclick = toggleHelp;
el('btnHelpClose').onclick = () => el('help').classList.add('hidden');

el('btnGoHome').onclick = () => gotoMap(0);
el('btnBack').onclick = () => gotoMap(0);

el('btnResetMap').onclick = () => {
  const m = MAPS[curMap];
  if (m.kind === 'home') { toast('내 작업장은 여기서 되돌리지 않습니다'); return; }
  if (!confirm(m.name + ' 을(를) 처음 상태로 되돌릴까요?')) return;
  initMap(m);
  lastGrade = null; panelSig = ''; countDirty = true;
  locks = curMission() ? frameIndices(world, curMission()) : new Set();
  toast('처음 상태로 되돌렸습니다');
};

el('btnUnlockAll').onclick = () => {
  prog.unlockAll = !prog.unlockAll;
  saveProgress();
  buildMissionList();
  toast(prog.unlockAll ? '모든 미션을 열었습니다' : '미션 잠금을 다시 켰습니다');
};
el('btnResetProg').onclick = () => {
  if (!confirm('미션 진행 상황(통과 기록·힌트)을 모두 지울까요?')) return;
  prog = { cleared: {}, unlockAll: false };
  saveProgress();
  buildMissionList(); buildMissionCard();
  toast('진행 상황을 지웠습니다');
};

el('btnClear').onclick = () => {
  if (curMap !== 0) gotoMap(0);
  if (!confirm('내 작업장의 블럭을 모두 지울까요?')) return;
  world.reset(); rs.cnt.fill(0); refresh();
  toast('내 작업장을 비웠습니다');
};
el('btnSave').onclick = () => {
  if (curMap !== 0) gotoMap(0);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.serialize()));
    toast('내 작업장을 저장 슬롯에 담았습니다');
  } catch (err) {
    toast('이 환경에서는 저장이 막혀 있습니다. 파일로 내보내기를 쓰세요');
  }
};
el('btnLoad').onclick = () => {
  if (curMap !== 0) gotoMap(0);
  let t = null;
  try { t = localStorage.getItem(SAVE_KEY); } catch (err) { t = null; }
  if (!t) { toast('저장 슬롯이 비어 있습니다'); return; }
  world.deserialize(JSON.parse(t));
  rs.cnt.fill(0); rs.compute(); rs.settle(60); vr.dirty = true;
  toast('저장 슬롯에서 불러왔습니다');
};
el('btnExport').onclick = () => {
  const name = (el('who').value || '').trim();
  const payload = {
    who: name,
    map: MAPS[curMap].key,
    cleared: prog.cleared,
    circuit: world.serialize(),
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (name ? name + '_' : '') + 'circuit.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
el('fileImport').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (curMap !== 0) gotoMap(0);
  f.text().then((t) => {
    try {
      const d = JSON.parse(t);
      world.deserialize(d.circuit || d);
      rs.cnt.fill(0); rs.compute(); rs.settle(60); vr.dirty = true;
      toast('파일을 내 작업장으로 불러왔습니다' + (d.who ? ' — ' + d.who : ''));
    } catch (err) { toast('파일을 읽을 수 없습니다'); }
  });
  e.target.value = '';
};
el('speed').oninput = (e) => {
  tickMs = +e.target.value;
  el('speedv').textContent = tickMs + 'ms';
};
el('btnPause').onclick = () => {
  running = !running;
  el('btnPause').textContent = running ? '일시정지' : '재개';
};
el('btnStep').onclick = () => { if (rs.tick()) vr.dirty = true; };

// ---------------------------------------------------------------- 입력
const locked = () => document.pointerLockElement === canvas;
const playing = () => menu.classList.contains('hidden');

function setPlaying(on) {
  menu.classList.toggle('hidden', on);
  document.body.classList.toggle('playing', on);
  if (!on) {
    player.keys = Object.create(null);
    lastJump = lastFwd = 0;
    player.sprint = false;
    if (locked()) document.exitPointerLock();
    buildMissionList(); buildMissionCard();
  }
}
function startPlay() {
  if (playing()) return;
  setPlaying(true);
  const req = canvas.requestPointerLock();
  if (req && req.catch) req.catch(() => {});
}
canvas.addEventListener('click', startPlay);
el('btnPlay').onclick = startPlay;
el('btnMenu').onclick = () => setPlaying(!playing());

document.addEventListener('pointerlockchange', () => {
  if (!locked() && playing()) setPlaying(false);
});

/* 짧은 간격으로 두 번 누르는 조작 (마인크래프트와 같다) */
const TAP = 320;
let lastJump = 0, lastFwd = 0;

/* 점프 두 번 = 비행 ↔ 걷기 */
function doubleJump() {
  const now = performance.now();
  if (now - lastJump < TAP) {
    lastJump = 0;
    player.fly = !player.fly;
    if (player.fly) player.vel.y = 0;
    toast(player.fly ? '비행 모드' : '걷기 모드');
  } else lastJump = now;
}

/* 앞으로 가기 두 번 = 달리기. W 를 놓으면 저절로 풀린다 */
function doubleForward() {
  const now = performance.now();
  if (now - lastFwd < TAP) { lastFwd = 0; player.sprint = true; }
  else lastFwd = now;
}

let dragging = false, dragDist = 0, dragBtn = -1;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (locked() || !playing()) return;
  e.preventDefault();
  dragging = true; dragDist = 0; dragBtn = e.button;
});
addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  if (dragDist < 7) {
    if (dragBtn === 0) breakBlock();
    else if (dragBtn === 2) useOrPlace();
    else if (dragBtn === 1) pickTarget();
  }
});
document.addEventListener('mousemove', (e) => {
  if (locked()) player.look(e.movementX, e.movementY);
  else if (dragging) {
    dragDist += Math.abs(e.movementX) + Math.abs(e.movementY);
    player.look(e.movementX, e.movementY);
  }
});
document.addEventListener('mousedown', (e) => {
  if (!locked()) return;
  if (e.button === 0) breakBlock();
  else if (e.button === 2) useOrPlace();
  else if (e.button === 1) { e.preventDefault(); pickTarget(); }
});
canvas.addEventListener('wheel', (e) => {
  if (!playing()) return;
  sel = (sel + (e.deltaY > 0 ? 1 : hot.length - 1)) % hot.length;
  updateHotbar();
}, { passive: true });

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape') { if (!locked()) setPlaying(false); return; }
  player.keys[e.code] = true;
  if (e.code >= 'Digit1' && e.code <= 'Digit8') {
    const k = +e.code.slice(5) - 1;
    if (k < hot.length) { sel = k; updateHotbar(); }
  }
  if (e.code === 'KeyR') cycleDelay();
  if (e.code === 'KeyP') el('btnPause').click();
  if (e.code === 'KeyT') el('btnStep').click();
  if (e.code === 'KeyH') el('help').classList.toggle('hidden');
  if (e.code === 'KeyB') gotoMap(0);
  if (e.code === 'Space' && playing()) {
    e.preventDefault();
    if (!e.repeat) doubleJump();          // 점프 두 번 = 비행 ↔ 걷기
  }
  if (e.code === 'KeyW' && playing() && !e.repeat) doubleForward();
});
addEventListener('keyup', (e) => { player.keys[e.code] = false; });

// ---------------------------------------------------------------- 루프
let cw = 0, ch = 0;
function resize() {
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  if (w === cw && h === ch) return;
  cw = w; ch = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let autoT = 0;
let lastVersion = -1;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  resize();

  if (playing()) player.update(dt);
  else player.syncCamera();

  if (running) {
    acc += dt * 1000;
    let guard = 0;
    while (acc >= tickMs && guard++ < 8) {
      acc -= tickMs;
      if (rs.tick()) vr.dirty = true;
    }
  } else acc = 0;

  particles.update(dt);

  target = raycast();
  if (target) {
    // 강조 상자를 그 블럭의 진짜 크기에 맞춘다 (와이어는 납작하게)
    const a = target.box;
    hi.visible = true;
    hi.scale.set(a[3] - a[0], Math.max(0.04, a[4] - a[1]), a[5] - a[2]);
    hi.position.set(target.x + (a[0] + a[3]) / 2,
      target.y + (a[1] + a[4]) / 2,
      target.z + (a[2] + a[5]) / 2);
  } else hi.visible = false;

  if (vr.dirty) vr.build();

  if (world.version !== lastVersion) {
    lastVersion = world.version;
    countDirty = true;
    if (world.version !== gradeVersion) gradeWait = 0.18;   // 연속 편집은 한 번만
  }
  if (gradeWait >= 0) {
    gradeWait -= dt;
    if (gradeWait < 0) runGrade();
  }

  // 만든 것은 맵마다 조금씩 자동 저장
  if (world.version !== savedVersion) {
    autoT += dt;
    if (autoT > 4) { autoT = 0; stashCurrent(); saveMaps(); }
  } else autoT = 0;

  if (toastT > 0) {
    toastT -= dt;
    if (toastT <= 0) toastEl.style.opacity = 0;
  }
  updateHud();
  updateMissionPanel();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 시작
loadProgress();
loadMaps();
buildHotbar();
if (MAPS[0].data) {
  world.deserialize(MAPS[0].data);
  rs.compute(); rs.settle(60);
  vr.dirty = true;
  lookAt(46.5, 46.5, 16);
} else {
  initMap(MAPS[0]);
}
savedVersion = world.version;
afterMapChange();
addEventListener('beforeunload', () => { stashCurrent(); saveMaps(); saveProgress(); });
requestAnimationFrame(frame);

// 디버그/수업용 콘솔 핸들
window.lab = {
  world, rs, vr, player, camera, renderer, scene, particles,
  MAPS, gotoMap, getMap: () => curMap, MISSIONS, EXAMPLES, B, raycast, blockAABB,
  runGrade, prog,
};
