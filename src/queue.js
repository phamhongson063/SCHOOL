export const QUEUE_STEP = 1.3;
export const QUEUE_GAP = 0.6;
export const JOIN_RADIUS = 2.5;

export class ServiceQueue {
  constructor(line, look, step = QUEUE_STEP) {
    this.line = line;
    this.look = look;
    this.step = step;
    this.members = [];
    this.snap = null;
  }

  join(member) {
    if (!this.members.includes(member)) this.members.push(member);
    return this.members.indexOf(member);
  }

  leave(member) {
    const index = this.members.indexOf(member);
    if (index >= 0) this.members.splice(index, 1);
  }

  indexOf(member) {
    return this.members.indexOf(member);
  }

  tail() {
    return this.slot(this.members.length);
  }

  reached(position) {
    const tail = this.tail();
    return Math.hypot(tail.x - position.x, tail.z - position.z) <= JOIN_RADIUS;
  }

  distanceTo(point) {
    let best = Infinity;
    for (let i = 0; i < this.line.length - 1; i++) {
      const a = this.line[i];
      const b = this.line[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length2 = dx * dx + dz * dz;
      const t = length2 > 1e-9 ? Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2)) : 0;
      best = Math.min(best, Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t)));
    }
    return best;
  }

  slot(index) {
    const point = this.along(index);
    return this.snap ? this.snap(point) : point;
  }

  along(index) {
    let left = QUEUE_GAP + Math.max(0, index) * this.step;
    const line = this.line;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (left <= length || i === line.length - 2) {
        const t = length > 1e-6 ? left / length : 0;
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      }
      left -= length;
    }
    return { x: line[0].x, z: line[0].z };
  }

  facingAt(index) {
    const from = this.slot(index);
    const to = index <= 0 ? this.look : this.slot(index - 1);
    return Math.atan2(to.x - from.x, to.z - from.z);
  }
}
