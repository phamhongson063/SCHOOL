import * as THREE from 'three';
import { between } from './random.js';
import { ROUTINE, VENDOR, GUARD, ENERGY, CERTIFY } from './config.js';
import { Batch, shapes } from './toon.js';
import { isOpenAt } from './clock.js';
import { TEACHER_STAND, FLOOR } from './school.js';
import { GUARD_DAY_CALLS, GUARD_NIGHT_CALLS, PEDDLER_CALLS, PEDDLER_DAY_CALLS, pick } from './villagerData.js';
import { PAGODA, SHELTERS } from './terrain.js';
import { BANK_POINTS } from './fishZones.js';
import { Villager } from './villager.js';
import { createBubble, nameColor } from './bubble.js';
import { homelandOf } from './profileRules.js';
import { trade } from './trade.js';
import { patrolNext } from './patrol.js';

export class Teacher extends Villager {
  constructor(profile, town) {
    super(profile, town);
    this.seatBubble = createBubble();
    this.seatBubble.sprite.position.set(0, 1.85, 0);
    this.seatBubble.setName(this.name, nameColor(this.id), homelandOf(this.id, this.name)?.flag);
    town.school.teacher.group.add(this.seatBubble.sprite);
  }

  onDuty(ctx) {
    return ctx.minute >= CERTIFY.open && ctx.minute < CERTIFY.close;
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

  beginTeaching() {
    this.task = 'teach';
    this.route = null;
    this.velocity = 0;
    this.position.set(TEACHER_STAND.x, FLOOR, TEACHER_STAND.z);
    this.setVisible(false);
    this.state = 'teaching';
    this.town.school.setTeacherPresent(true);
  }

  teachingUpdate() {
    if (!this.canEat(this.town.context)) return;
    this.leaveDesk();
    this.think();
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
    this.say('Muốn khảo thí thì tới gặp ta đăng ký nhé!', 3);
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

  get stops() {
    return this.town.streetStops;
  }

  nextStop() {
    ({ stop: this.stop, step: this.step } = patrolNext(this, this.stops.length));
    return this.stops[this.stop];
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
    this.stop = this.homePoint().x < 0 ? -1 : this.stops.length;
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
      () => pick(BANK_POINTS),
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
      while (purse.energy < ENERGY.max * 0.8 && purse.energy + food.energy <= ENERGY.max + 5 && trade.cookFor(this.id, food)) {
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

  get stops() {
    return this.town.patrolStops;
  }

  onDuty() {
    return true;
  }

  appear() {
    super.appear();
    this.wait(0.5);
  }

  patrolPlace() {
    const entry = { id: this.id, stop: this.stop, step: this.step };
    if (this.state !== 'away') entry.at = [this.position.x, this.position.z, this.facing].map((value) => Math.round(value * 100) / 100);
    return entry;
  }

  resumePatrol({ stop, step, at }) {
    const stops = this.stops;
    if (!Number.isInteger(stop) || stop < 0 || stop >= stops.length) return false;
    this.cancel();
    this.step = step === -1 ? -1 : 1;
    this.stop = stop;
    const [x, z, facing] = Array.isArray(at) ? at : [];
    const target = stops[stop];
    const spot = [x, z].every(Number.isFinite) ? { x, z } : this.profile.follower ? this.behind(stops[stop - this.step] ?? target, target) : target;
    const height = this.town.nav.heightAt(spot.x, spot.z);
    if (height === null) return false;
    this.task = 'patrol';
    this.position.set(spot.x, height, spot.z);
    this.facing = Number.isFinite(facing) ? facing : this.step > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.velocity = 0;
    this.wakeAt = null;
    this.setVisible(true);
    this.wait(0.3 + this.lag, () => this.think());
    return true;
  }

  think() {
    const ctx = this.town.context;
    this.lookAt = null;
    if (this.goMeal(ctx)) return;
    this.task = 'patrol';
    const from = this.stops[this.stop] ?? this.position;
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
