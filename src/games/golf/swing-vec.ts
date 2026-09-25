/** Small 3D vector. No three.js, so the swing maths can be checked on its own. */

export class Vec {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new Vec(this.x, this.y, this.z);
  }

  copy(v: Vec) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  fromArray(a: number[]) {
    this.x = a[0];
    this.y = a[1];
    this.z = a[2];
    return this;
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  add(v: Vec) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: Vec) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  addScaledVector(v: Vec, s: number) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalize() {
    const len = this.length() || 1;
    return this.multiplyScalar(1 / len);
  }

  dot(v: Vec) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  crossVectors(a: Vec, b: Vec) {
    const ax = a.x;
    const ay = a.y;
    const az = a.z;
    const bx = b.x;
    const by = b.y;
    const bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  lerp(v: Vec, t: number) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }

  applyAxisAngle(axis: Vec, angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const ax = axis.x;
    const ay = axis.y;
    const az = axis.z;
    this.x = (t * ax * ax + c) * x + (t * ax * ay - s * az) * y + (t * ax * az + s * ay) * z;
    this.y = (t * ax * ay + s * az) * x + (t * ay * ay + c) * y + (t * ay * az - s * ax) * z;
    this.z = (t * ax * az - s * ay) * x + (t * ay * az + s * ax) * y + (t * az * az + c) * z;
    return this;
  }
}
