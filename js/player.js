import * as THREE from '../vendor/three.module.js';

const R = 0.3;      // 몸 반지름
const H = 1.72;     // 키
const EYE = 1.6;
const G = -24;      // 중력

export class Player {
  constructor(world, camera) {
    this.w = world;
    this.cam = camera;
    this.pos = new THREE.Vector3(4.5, 1, 24.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0;      // +X 를 바라봄
    this.pitch = 0;
    this.fly = false;
    this.sprint = false;   // W 두 번 = 달리기 (앞으로 가는 동안만 유지)
    this.onGround = false;
    this.keys = Object.create(null);
  }

  spawnAt(x, y, z, yaw = 0, pitch = -0.35) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = pitch;
    this.syncCamera();
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  forwardVec(out) {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }
  rightVec(out) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  solidAt(x, y, z) {
    if (y < 0) return true;
    if (!this.w.inb(Math.floor(x), Math.floor(y), Math.floor(z))) return false;
    return this.w.isSolidAt(this.w.idx(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  resolve(axis, d) {
    if (d === 0) return;
    const p = this.pos;
    const x0 = Math.floor(p.x - R), x1 = Math.floor(p.x + R);
    const y0 = Math.floor(p.y + 0.001), y1 = Math.floor(p.y + H - 0.001);
    const z0 = Math.floor(p.z - R), z1 = Math.floor(p.z + R);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          if (!this.w.inb(x, y, z)) continue;
          if (!this.w.isSolidAt(this.w.idx(x, y, z))) continue;
          if (axis === 0) { p.x = d > 0 ? x - R - 1e-4 : x + 1 + R + 1e-4; this.vel.x = 0; }
          else if (axis === 1) {
            if (d > 0) { p.y = y - H - 1e-4; } else { p.y = y + 1 + 1e-4; this.onGround = true; }
            this.vel.y = 0;
          } else { p.z = d > 0 ? z - R - 1e-4 : z + 1 + R + 1e-4; this.vel.z = 0; }
          return;
        }
  }

  update(dt) {
    const k = this.keys;
    const f = new THREE.Vector3(), r = new THREE.Vector3();
    this.forwardVec(f); this.rightVec(r);
    let mx = 0, mz = 0;
    if (k['KeyW']) mz += 1;
    if (k['KeyS']) mz -= 1;
    if (k['KeyD']) mx += 1;
    if (k['KeyA']) mx -= 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    if (!k['KeyW']) this.sprint = false;          // 앞으로 가기를 놓으면 달리기가 풀린다
    const fast = this.sprint || k['ControlLeft'] || k['ControlRight'];
    const speed = (this.fly ? 9 : 4.8) * (fast ? 1.9 : 1);
    const wish = new THREE.Vector3(
      f.x * mz + r.x * mx, 0, f.z * mz + r.z * mx
    ).multiplyScalar(speed);

    if (this.fly) {
      this.vel.x = wish.x; this.vel.z = wish.z;
      let vy = 0;
      if (k['Space']) vy += 1;
      if (k['ShiftLeft'] || k['ShiftRight']) vy -= 1;
      this.vel.y = vy * speed * 0.8;
    } else {
      const a = this.onGround ? 30 : 8;
      this.vel.x += (wish.x - this.vel.x) * Math.min(1, a * dt);
      this.vel.z += (wish.z - this.vel.z) * Math.min(1, a * dt);
      this.vel.y += G * dt;
      if (k['Space'] && this.onGround) { this.vel.y = 8.2; this.onGround = false; }
    }

    this.onGround = false;
    const p = this.pos;
    const dx = this.vel.x * dt, dy = this.vel.y * dt, dz = this.vel.z * dt;
    p.x += dx; this.resolve(0, dx);
    p.z += dz; this.resolve(2, dz);
    p.y += dy; this.resolve(1, dy);

    // 월드 밖으로 나가지 않게
    p.x = Math.max(0.4, Math.min(this.w.SX - 0.4, p.x));
    p.z = Math.max(0.4, Math.min(this.w.SZ - 0.4, p.z));
    if (p.y < 1) { p.y = 1; this.vel.y = 0; this.onGround = true; }
    if (p.y > this.w.SY + 6) { p.y = this.w.SY + 6; this.vel.y = 0; }

    this.syncCamera();
  }

  syncCamera() {
    this.cam.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.cam.rotation.set(0, 0, 0);
    this.cam.rotateY(this.yaw - Math.PI / 2);
    this.cam.rotateX(this.pitch);
  }
}
