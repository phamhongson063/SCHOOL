import * as THREE from 'three';
import { between } from './random.js';
import { ROUTINE, VENDOR, GUARD } from './config.js';
import { Batch, shapes } from './toon.js';
import { isOpenAt } from './clock.js';
import { TEACHER_STAND, FLOOR, PACE_SPOTS } from './school.js';
import { GUARD_DAY_CALLS, GUARD_NIGHT_CALLS, PACE, PEDDLER_CALLS, pick } from './villagerData.js';
import { Villager } from './villager.js';

export class Teacher extends Villager {
  onDuty(ctx) {
    return !ctx.night && ctx.minute >= ROUTINE.teacherArrive && ctx.minute < ROUTINE.teacherLeave;
  }

  think() {
    const ctx = this.town.context;
    const pacing = this.task === 'pace';
    this.task = null;
    this.lookAt = null;
    if (!this.onDuty(ctx)) return this.goHome();
    this.task = 'teach';
    const speed = pacing ? this.walkSpeed * PACE.speed : this.walkSpeed;
    this.travel(TEACHER_STAND, { speed, then: () => this.beginTeaching(), fail: () => this.beginTeaching() });
  }

  watchedStudent() {
    let best = null;
    let bestD = PACE.watch;
    for (const seat of this.town.seats.list) {
      if (!seat.occupant) continue;
      const d = Math.hypot(seat.x - this.position.x, seat.z - this.position.z);
      if (d < bestD) {
        bestD = d;
        best = seat.sit;
      }
    }
    return best;
  }

  beginTeaching() {
    this.task = 'teach';
    this.route = null;
    this.velocity = 0;
    this.position.set(TEACHER_STAND.x, FLOOR, TEACHER_STAND.z);
    this.setVisible(false);
    this.state = 'teaching';
    this.paceAt = this.now + between(...PACE.every);
    this.town.school.setTeacherPresent(true);
  }

  teachingUpdate(t) {
    if (t < this.paceAt) return;
    this.paceAt = t + between(...PACE.every);
    if (this.town.context.phase.kind !== 'period' || Math.random() >= PACE.chance) return;
    this.town.school.setTeacherSeated(false);
    this.facing = 0;
    this.setVisible(true);
    this.pop = 0.25;
    this.state = 'idle';
    this.task = 'pace';
    const [lo, hi] = PACE.stops;
    this.paceStops = lo + Math.floor(Math.random() * (hi - lo + 1));
    this.paceNext();
  }

  paceNext() {
    const ctx = this.town.context;
    if (!this.onDuty(ctx) || ctx.phase.kind !== 'period' || this.paceStops <= 0) {
      this.think();
      return;
    }
    this.paceStops -= 1;
    const spot = pick(PACE_SPOTS);
    this.lookAt = null;
    this.travel(new THREE.Vector3(spot.x, FLOOR, spot.z), {
      speed: this.walkSpeed * PACE.speed,
      then: () => {
        this.lookAt = this.watchedStudent();
        this.wait(between(...PACE.pause), () => this.paceNext());
      },
      fail: () => this.think(),
    });
  }

  goHome() {
    this.town.school.setTeacherPresent(false);
    super.goHome();
  }

  stopTeaching() {
    this.town.school.setTeacherPresent(false);
    this.position.set(TEACHER_STAND.x, FLOOR, TEACHER_STAND.z);
    this.facing = 0;
    this.setVisible(true);
    this.pop = 0.25;
    this.state = 'idle';
    this.goHome();
  }

  greet() {
    this.say('Chào con! Lên bục gặp thầy để đóng trước tiền học nhé.', 3);
  }
}

function carryingPole() {
  const b = new Batch();
  b.add(shapes.box(0.045, 0.045, 1.9), 0x8a5a2b);
  for (const end of [-1, 1]) {
    const z = end * 0.82;
    for (const [dx, dz] of [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]]) {
      b.limb([0, 0, z], [dx, -0.52, z + dz], 0.007, 0x5a3a20, { capsule: false, seg: 4 });
    }
    b.add(shapes.cylinder(0.2, 0.15, 0.2, 12), 0xb8894a, { p: [0, -0.62, z] });
    b.add(shapes.torus(0.2, 0.018, 12), 0x8a6a3a, { p: [0, -0.52, z], r: [Math.PI / 2, 0, 0] });
  }
  b.add(shapes.cylinder(0.12, 0.13, 0.13, 10), 0x6a3a2a, { p: [0, -0.46, 0.82] });
  b.add(shapes.cylinder(0.125, 0.125, 0.02, 10), 0x4a2a1a, { p: [0, -0.39, 0.82] });
  b.add(shapes.cylinder(0.15, 0.15, 0.08, 10), 0xe8dcc0, { p: [0, -0.48, -0.82] });
  const group = new THREE.Group();
  group.add(b.mesh());
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb64a }));
  lamp.position.set(0, -0.14, 0.98);
  group.add(lamp);
  group.position.set(-0.17, 0.9, 0);
  return group;
}

class ShiftWorker extends Villager {
  constructor(profile, town) {
    super(profile, town);
    this.keepsNight = true;
    this.stop = 0;
    this.step = 1;
  }

  tickEnergy() {
    this.tired = false;
  }

  nextStop() {
    const stops = this.town.streetStops;
    if (this.stop + this.step < 0 || this.stop + this.step >= stops.length) this.step = -this.step;
    this.stop += this.step;
    return stops[this.stop];
  }

  goHome() {
    this.cancel();
    this.task = 'home';
    this.lookAt = null;
    const home = this.homePoint();
    this.travel(home, { then: () => this.vanish(), fail: () => this.vanish() });
  }

  appear() {
    super.appear();
    this.stop = this.homePoint().x < 0 ? -1 : this.town.streetStops.length;
    this.step = this.stop < 0 ? 1 : -1;
  }
}

export class Peddler extends ShiftWorker {
  constructor(profile, town) {
    super(profile, town);
    this.walker.group.add(carryingPole());
    this.walkSpeed *= VENDOR.pace;
  }

  onDuty(ctx) {
    return isOpenAt(VENDOR, ctx.minutes);
  }

  think() {
    const ctx = this.town.context;
    this.lookAt = null;
    if (!this.onDuty(ctx)) return this.goHome();
    this.task = 'peddle';
    const stop = this.nextStop();
    const rest = () => this.wait(between(...VENDOR.pause), () => this.think());
    this.travel(new THREE.Vector3(stop.x, 0, stop.z), {
      then: () => {
        this.say(pick(PEDDLER_CALLS), 2.6);
        rest();
      },
      fail: rest,
    });
  }

  hold(seconds = VENDOR.hold) {
    if (this.state === 'away' || this.task === 'home') return;
    if (this.task === 'serve' && this.state === 'idle') {
      this.timer = Math.max(this.timer, seconds);
      return;
    }
    this.task = 'serve';
    this.lookAt = this.town.player?.position ?? null;
    this.wait(seconds, () => this.think());
  }

  greet() {
    this.hold();
    this.say('Ăn gì con ơi?', 2);
  }
}

function patrolStaff(lantern) {
  const b = new Batch();
  b.add(shapes.cylinder(0.022, 0.026, 1.7, 6), 0xc8a85a);
  for (const y of [-0.55, 0, 0.55]) b.add(shapes.torus(0.026, 0.007, 6), 0x9a7a3a, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
  if (lantern) b.limb([0, 0.82, 0], [0, 0.82, 0.3], 0.01, 0x5a3a20, { capsule: false, seg: 4 });
  const group = new THREE.Group();
  group.add(b.mesh());
  if (lantern) {
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 10), new THREE.MeshBasicMaterial({ color: 0xff7a3a }));
    glow.position.set(0, 0.62, 0.3);
    group.add(glow);
  }
  group.position.set(-0.27, 0.78, 0.06);
  return group;
}

export class Guard extends ShiftWorker {
  constructor(profile, town) {
    super(profile, town);
    this.walker.group.add(patrolStaff(profile.shift === 'night'));
    this.walkSpeed = GUARD.speed;
    this.lag = profile.follower ? GUARD.lag : 0;
  }

  onDuty(ctx) {
    const day = ctx.minute >= GUARD.day[0] && ctx.minute < GUARD.day[1];
    return this.profile.shift === 'day' ? day : !day;
  }

  appear() {
    super.appear();
    this.wait(0.5);
  }

  think() {
    const ctx = this.town.context;
    this.lookAt = null;
    if (!this.onDuty(ctx)) return this.goHome();
    this.task = 'patrol';
    const from = this.town.streetStops[this.stop] ?? this.position;
    const stop = this.nextStop();
    const target = this.profile.follower ? this.behind(from, stop) : stop;
    const rest = () => this.wait(GUARD.pause, () => this.think());
    this.travel(new THREE.Vector3(target.x, 0, target.z), {
      then: () => {
        if (!this.profile.follower && Math.random() < GUARD.callChance) this.say(pick(ctx.night ? GUARD_NIGHT_CALLS : GUARD_DAY_CALLS), 2.4);
        rest();
      },
      fail: rest,
    });
  }

  behind(from, stop) {
    const dx = stop.x - from.x;
    const dz = stop.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) return stop;
    return this.town.walkable({ x: stop.x - (dx / length) * GUARD.gap, z: stop.z - (dz / length) * GUARD.gap });
  }

  greet(from) {
    if (this.state === 'idle') this.facing = Math.atan2(from.x - this.position.x, from.z - this.position.z);
    this.say(`${this.name}: Đang đi tuần, có gì cứ báo nhé!`, 2.6);
  }
}
