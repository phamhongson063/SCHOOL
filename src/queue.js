export const QUEUE_STEP = 0.85;

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

  slot(index) {
    const point = this.along(index);
    return this.snap ? this.snap(point) : point;
  }

  along(index) {
    let left = Math.max(0, index) * this.step;
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
