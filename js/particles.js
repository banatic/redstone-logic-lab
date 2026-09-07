import * as THREE from '../vendor/three.module.js';

const G = -21;          // 파티클 중력
const CAP = 900;        // 동시에 살아있을 수 있는 파티클 수
const FLASH = 0.24;     // 테두리 섬광 지속 시간(초)

function whiteBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.setAttribute('color', new THREE.BufferAttribute(
    new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

/* 블럭을 부술 때 튀는 조각과 섬광 */
export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.n = 0;
    const f = () => new Float32Array(CAP);
    this.px = f(); this.py = f(); this.pz = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.rx = f(); this.ry = f(); this.rz = f();
    this.dx = f(); this.dy = f(); this.dz = f();
    this.sz = f(); this.life = f(); this.max = f(); this.gy = f();
    this.col = new Uint32Array(CAP);

    const geo = whiteBox();
    this.mesh = new THREE.InstancedMesh(
      geo, new THREE.MeshLambertMaterial({ vertexColors: true }), CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);

    // 파괴 순간 퍼져나가는 테두리 (동시에 여러 개가 터질 수 있으므로 풀로)
    const edge = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.flashes = [];
    for (let k = 0; k < 6; k++) {
      const m = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.visible = false;
      scene.add(m);
      this.flashes.push({ mesh: m, t: 0 });
    }
    this.flashNext = 0;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  /* 맵을 옮길 때처럼 즉시 전부 지워야 할 때 */
  clear() {
    this.n = 0;
    this.mesh.count = 0;
    for (const fl of this.flashes) { fl.t = 0; fl.mesh.visible = false; }
  }

  /* 블럭 칸 (bx,by,bz) 에서 조각이 터져 나오게 한다 */
  burst(bx, by, bz, colors, count = 16) {
    const cx = bx + 0.5, cy = by + 0.45, cz = bz + 0.5;
    for (let k = 0; k < count && this.n < CAP; k++) {
      const i = this.n++;
      this.px[i] = cx + (Math.random() - 0.5) * 0.7;
      this.py[i] = cy + (Math.random() - 0.5) * 0.7;
      this.pz[i] = cz + (Math.random() - 0.5) * 0.7;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 2.6;
      this.vx[i] = Math.cos(a) * sp * 0.55;
      this.vz[i] = Math.sin(a) * sp * 0.55;
      this.vy[i] = 2.2 + Math.random() * 3.4;
      this.rx[i] = Math.random() * 6.28; this.ry[i] = Math.random() * 6.28; this.rz[i] = Math.random() * 6.28;
      this.dx[i] = (Math.random() - 0.5) * 12;
      this.dy[i] = (Math.random() - 0.5) * 12;
      this.dz[i] = (Math.random() - 0.5) * 12;
      this.sz[i] = 0.07 + Math.random() * 0.09;
      this.max[i] = this.life[i] = 0.55 + Math.random() * 0.5;
      this.gy[i] = by;
      this.col[i] = colors[(Math.random() * colors.length) | 0];
    }
    // 테두리 섬광
    const fl = this.flashes[this.flashNext];
    this.flashNext = (this.flashNext + 1) % this.flashes.length;
    fl.mesh.position.set(cx, by + 0.5, cz);
    fl.mesh.visible = true;
    fl.t = FLASH;
  }

  update(dt) {
    for (const fl of this.flashes) {
      if (fl.t <= 0) continue;
      fl.t -= dt;
      const t = Math.max(0, fl.t / FLASH);
      const s = 1.02 + (1 - t) * 0.8;
      fl.mesh.scale.set(s, s, s);
      fl.mesh.material.opacity = t * 0.9;
      if (fl.t <= 0) fl.mesh.visible = false;
    }
    if (this.n === 0) { this.mesh.count = 0; return; }

    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {                 // 죽은 건 마지막 것으로 덮어쓴다
        const j = --this.n;
        if (j !== i) {
          for (const a of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'rx', 'ry', 'rz',
            'dx', 'dy', 'dz', 'sz', 'life', 'max', 'gy']) this[a][i] = this[a][j];
          this.col[i] = this.col[j];
        }
        i--; continue;
      }
      this.vy[i] += G * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      const floor = this.gy[i] + this.sz[i] * 0.5;
      if (this.py[i] < floor) {                // 바닥에서 한 번 튕긴다
        this.py[i] = floor;
        this.vy[i] *= -0.34;
        this.vx[i] *= 0.7; this.vz[i] *= 0.7;
        this.dx[i] *= 0.5; this.dy[i] *= 0.5; this.dz[i] *= 0.5;
      }
      this.rx[i] += this.dx[i] * dt;
      this.ry[i] += this.dy[i] * dt;
      this.rz[i] += this.dz[i] * dt;
    }

    for (let i = 0; i < this.n; i++) {
      const fade = Math.min(1, this.life[i] / (this.max[i] * 0.35));
      const s = this.sz[i] * fade;
      this._p.set(this.px[i], this.py[i], this.pz[i]);
      this._s.set(s, s, s);
      this._e.set(this.rx[i], this.ry[i], this.rz[i]);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c.setHex(this.col[i]));
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
