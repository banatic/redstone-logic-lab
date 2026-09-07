import * as THREE from '../vendor/three.module.js';
import { B } from './blocks.js';
import { emitBlock, iconState } from './shapes.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
// vertexColors + instanceColor 조합을 쓰려면 흰색 color 속성이 필요하다
BOX.setAttribute('color', new THREE.BufferAttribute(
  new Float32Array(BOX.attributes.position.count * 3).fill(1), 3));

/* 같은 재질의 박스를 인스턴싱으로 모아 그리는 배치 */
class Batch {
  constructor(scene, material) {
    this.scene = scene;
    this.material = material;
    this.mesh = null;
    this.cap = 0;
    this.items = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
    this._c = new THREE.Color();
  }
  begin() { this.items.length = 0; }
  add(px, py, pz, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
    this.items.push(px, py, pz, sx, sy, sz, color, rx, ry, rz);
  }
  end() {
    const n = this.items.length / 10;
    if (n > this.cap) {
      if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); }
      this.cap = Math.max(128, Math.ceil(n * 1.6));
      this.mesh = new THREE.InstancedMesh(BOX, this.material, this.cap);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
    }
    if (!this.mesh) return;
    if (n === 0) { this.mesh.count = 0; return; }
    const a = this.items;
    for (let k = 0; k < n; k++) {
      const o = k * 10;
      this._p.set(a[o], a[o + 1], a[o + 2]);
      this._s.set(a[o + 3], a[o + 4], a[o + 5]);
      this._e.set(a[o + 7], a[o + 8], a[o + 9]);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(k, this._m);
      this._c.setHex(a[o + 6]);
      this.mesh.setColorAt(k, this._c);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class VoxelRenderer {
  constructor(scene, world, rs) {
    this.scene = scene;
    this.w = world;
    this.rs = rs;
    this.solid = new Batch(scene, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.glow = new Batch(scene, new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.glass = new Batch(scene, new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false,
    }));
    this.dirty = true;
    this.buildGround();
  }

  buildGround() {
    const { SX, SZ } = this.w;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#78806b'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#707863'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.strokeStyle = 'rgba(40,46,36,0.55)'; g.lineWidth = 2;
    g.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(SX / 2, SZ / 2);
    tex.anisotropy = 4;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(SX, SZ),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(SX / 2, 1, SZ / 2);
    this.scene.add(plane);

    const major = new THREE.GridHelper(SX, SX / 8, 0x3b4433, 0x3b4433);
    major.position.set(SX / 2, 1.005, SZ / 2);
    major.material.opacity = 0.5; major.material.transparent = true;
    this.scene.add(major);

    // 바닥 옆면 (두께감)
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(SX, 1, SZ),
      new THREE.MeshLambertMaterial({ color: 0x5d5347 })
    );
    side.position.set(SX / 2, 0.498, SZ / 2);
    this.scene.add(side);
  }

  /* 블럭 i 의 현재 상태를 shapes.js 가 이해하는 형태로 */
  stateOf(i, id) {
    const w = this.w;
    switch (id) {
      case B.WIRE: return { power: this.rs.power[i], wireDirs: this.rs.wireShape(i).dirs };
      case B.LAMP: return { lit: this.rs.lampLit(i) };
      case B.TORCH: case B.LEVER: return { dir: w.dir[i], on: w.on(i) };
      case B.REPEATER:
        return { dir: w.dir[i], dly: w.dly[i], on: w.on(i), inOn: this.rs.repeaterInput(i) };
      default: return {};
    }
  }

  build() {
    const w = this.w;
    this.solid.begin(); this.glow.begin(); this.glass.begin();
    const buckets = { solid: this.solid, glow: this.glow, glass: this.glass };
    let ox = 0, oy = 0, oz = 0;
    const out = (kind, px, py, pz, sx, sy, sz, color, rx, ry, rz) =>
      buckets[kind].add(ox + px, oy + py, oz + pz, sx, sy, sz, color, rx, ry, rz);

    for (let i = 0; i < w.n; i++) {
      const id = w.id[i];
      if (id === B.AIR || id === B.FLOOR) continue;
      const [x, y, z] = w.xyz(i);
      ox = x; oy = y; oz = z;
      emitBlock(id, this.stateOf(i, id), out);
    }
    this.solid.end(); this.glow.end(); this.glass.end();
    this.dirty = false;
  }
}

/* ------------------------------------------------------------------
   핫바용 블럭 아이콘을 실제 3D 로 렌더링해서 data URL 로 돌려준다.
   실패하면 null 을 돌려주고 호출한 쪽이 색 사각형으로 대체한다.
------------------------------------------------------------------- */
export function makeBlockIcons(ids, size = 96) {
  let r;
  try {
    r = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (err) {
    return null;
  }
  try {
    r.setSize(size, size, false);
    r.setPixelRatio(2);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a5a, 1.25));
    const dl = new THREE.DirectionalLight(0xfff6e8, 0.95);
    dl.position.set(4, 7, 5);
    scene.add(dl);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
    cam.position.set(6.5, 5.2, 7.5);
    cam.lookAt(0, 0, 0);

    const box = new THREE.Box3();
    const sph = new THREE.Sphere();
    const ctr = new THREE.Vector3();
    const out = [];
    const icons = {};

    for (const id of ids) {
      out.length = 0;
      emitBlock(id, iconState(id), (...a) => out.push(a));
      const group = new THREE.Group();
      for (const [kind, px, py, pz, sx, sy, sz, color, rx = 0, ry = 0, rz = 0] of out) {
        let mat;
        if (kind === 'glow') {
          mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.75 });
        } else if (kind === 'glass') {
          mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55 });
        } else {
          mat = new THREE.MeshLambertMaterial({ color });
        }
        const m = new THREE.Mesh(BOX, mat);
        m.position.set(px, py, pz);
        m.scale.set(sx, sy, sz);
        m.rotation.set(rx, ry, rz);
        group.add(m);
      }
      scene.add(group);
      // 어떤 모양이든 아이콘 안에 꽉 차게 맞춘다
      box.setFromObject(group);
      box.getCenter(ctr);
      group.position.sub(ctr);
      box.setFromObject(group);
      box.getBoundingSphere(sph);
      const half = Math.max(0.2, sph.radius) * 1.04;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();

      r.render(scene, cam);
      icons[id] = r.domElement.toDataURL('image/png');

      scene.remove(group);
      group.traverse((o) => { if (o.material) o.material.dispose(); });
    }
    r.dispose();
    r.forceContextLoss?.();
    return icons;
  } catch (err) {
    try { r.dispose(); } catch (e) { /* 무시 */ }
    return null;
  }
}
