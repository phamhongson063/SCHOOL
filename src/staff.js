import * as THREE from 'three';
import { between } from './random.js';
import { ROUTINE, VENDOR, GUARD, ENERGY, ECONOMY } from './config.js';
import { Batch, shapes } from './toon.js';
import { isOpenAt } from './clock.js';
import { TEACHER_STAND, FLOOR, PACE_SPOTS } from './school.js';
import { GUARD_DAY_CALLS, GUARD_NIGHT_CALLS, PACE, PEDDLER_CALLS, PEDDLER_DAY_CALLS, pick } from './villagerData.js';
import { PAGODA, SHELTERS } from './terrain.js';
import { Villager } from './villager.js';

export class Teacher extends Villager {
  onDuty(ctx) {
    return !ctx.night && ctx.minute >= ROUTINE.teacherArrive && ctx.minute < ROUTINE.teacherLeave;
  }

  think() {
    const ctx = this.town.context;
    this.task = null;
    this.lookAt = null;
    if (!this.onDuty(ctx)) return this.goHome();
    if (this.goMeal(ctx)) return;
    this.task = 'teach';
    this.travel(TEACHER_STAND, { then: () => this.beginTeaching(), fail: () => this.beginTeaching() });
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
    const ctx = this.town.context;
    if (ctx.phase.kind !== 'period' && this.canEat(ctx)) {
      this.leaveDesk();
      this.think();
      return;
    }
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
      speed: this.walkSpeed,
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

  leaveDesk() {
    this.town.school.setTeacherPresent(false);
    this.position.set(TEACHER_STAND.x, FLOOR, TEACHER_STAND.z);
    this.facing = 0;
    this.setVisible(true);
    this.pop = 0.25;
    this.state = 'idle';
  }

  stopTeaching() {
    this.leaveDesk();
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
    if (!this.walker.model) this.walker.group.add(carryingPole());
  }

  roamsAt(ctx) {
    return ctx.minute >= ROUTINE.wake && ctx.minute < VENDOR.open;
  }

  onDuty(ctx) {
    return isOpenAt(VENDOR, ctx.minutes) || this.roamsAt(ctx);
  }

  roamSpot() {
    const town = this.town;
    const choices = [
      () => pick(town.streetStops),
      () => town.fieldEdgePoint(),
      () => pick(town.river.spots).stand,
      () => pick(SHELTERS),
      () => PAGODA.stand,
    ];
    return town.walkable(pick(choices)());
  }

  roam() {
    this.task = 'roam';
    const spot = this.roamSpot();
    const rest = () => this.wait(between(...VENDOR.roamPause), () => this.think());
    this.travel(new THREE.Vector3(spot.x, 0, spot.z), {
      then: () => {
        if (Math.random() < 0.5) this.say(pick(PEDDLER_DAY_CALLS), 2.6);
        rest();
      },
      fail: rest,
    });
  }

  think() {
    const ctx = this.town.context;
    this.lookAt = null;
    if (!this.onDuty(ctx)) return this.goHome();
    if (this.goMeal(ctx) || this.eatOwn()) return;
    if (this.roamsAt(ctx)) return this.roam();
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

  eatOwn() {
    const purse = this.purse;
    if (purse.energy >= ENERGY.low) return false;
    const eaten = [];
    for (const food of Object.values(VENDOR.foods).sort((a, b) => b.energy - a.energy)) {
      const cost = Math.ceil(food.price * (1 - ECONOMY.keep.vendor));
      while (purse.energy < ENERGY.max * 0.8 && purse.energy + food.energy <= ENERGY.max + 5 && purse.spend(cost)) {
        purse.addEnergy(food.energy);
        eaten.push(food.icon);
      }
    }
    if (!eaten.length) return false;
    this.task = 'eat';
    this.say(`Ăn tạm ${eaten.join('')} cho đỡ đói`, 2.2);
    this.wait(between(2, 4), () => this.think());
    return true;
  }

  hold(seconds = VENDOR.hold, toward = this.town.player?.position ?? null) {
    if (this.state === 'away' || this.task === 'home') return;
    if (this.task === 'serve' && this.state === 'idle') {
      this.timer = Math.max(this.timer, seconds);
      return;
    }
    this.task = 'serve';
    this.lookAt = toward;
    this.wait(seconds, () => this.think());
  }

  greet() {
    this.hold();
    this.say('Ăn gì không em?', 2);
  }
}

export class Guard extends ShiftWorker {
  constructor(profile, town) {
    super(profile, town);
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
    if (this.goMeal(ctx)) return;
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
