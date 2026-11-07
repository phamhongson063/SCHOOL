const LEG = 0.4;

export class Gait {
  constructor({ stride = 0.72, armSwing = 0.85, bounce = 1 } = {}) {
    this.stride = stride;
    this.armSwing = armSwing;
    this.bounce = bounce;
    this.phase = 0;
    this.beat = 0;
  }

  update(walker, speed, dt, grounded = true) {
    const moving = Math.min(1, speed / 0.35);
    const amp = this.stride * (0.4 + 0.6 * Math.min(1, speed / 1.4));
    const stepLength = 2 * LEG * Math.sin(amp) * (1 + Math.max(0, speed - 2) * 0.35);
    if (speed > 0.02) this.phase += ((Math.PI * speed) / stepLength) * dt;

    const s = Math.sin(this.phase);
    const swing = s * amp * moving;
    walker.leftLeg.rotation.x = grounded ? swing : 0.35;
    walker.rightLeg.rotation.x = grounded ? -swing : -0.35;
    walker.leftArm.rotation.x = -swing * this.armSwing;
    walker.rightArm.rotation.x = swing * this.armSwing;

    const bob = grounded ? -Math.abs(s) * 0.035 * this.bounce * moving : 0;
    const lean = moving * (0.04 + Math.min(1, speed / 3.5) * 0.08);

    let step = null;
    const beat = Math.floor((this.phase - Math.PI / 2) / Math.PI);
    if (beat !== this.beat) {
      this.beat = beat;
      if (grounded && speed > 0.3) step = { side: s > 0 ? -1 : 1 };
    }
    return { bob, lean, step, phase: this.phase };
  }
}
