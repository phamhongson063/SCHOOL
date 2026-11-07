import * as THREE from 'three';
import { createWalker } from './characters.js';
import { createBubble } from './bubble.js';
import { Gait } from './gait.js';
import { createBlobShadow } from './groundfx.js';

const SPACING = 0.6;
const LOOKAHEAD = 0.85;
const CLASSROOM = { x: 0.5, z: -2 };

const HANGOUTS = [
  { x: -3, z: 14 },
  { x: 6, z: 18 },
  { x: 17, z: 13 },
  { x: -15, z: 11 },
  { x: 0.5, z: 5.2 },
  { x: -7, z: 22 },
];

const REGIONS = [
  [-12, 9.5, 13, 24],
  [-11, -8, 12, 5],
  [-25, -16, 25, 28],
];

const CHAT = [
  'Chào cậu!',
  'Hôm nay học gì thế?',
  'Ha ha!',
  'Chơi ô ăn quan không?',
  'Thầy nghiêm quá!',
  'Tớ thuộc bài rồi!',
  'Đói bụng quá...',
  'Đi bắt dế không?',
  'Hì hì',
  'Ừ!',
  'Thật á?',
  'Chiều đi thả diều nhé!',
];
const PLAY = ['Đuổi bắt nè!', 'Bắt được rồi!', 'Hí hí!', 'Chạy mau!', 'Không bắt được đâu!'];
const BACK = ['Vào học rồi!', 'Về chỗ thôi!', 'Trống rồi kìa!', 'Chờ tớ với!'];
const TAKEN = ['Ơ, có người ngồi rồi!', 'Tớ ngồi chỗ khác vậy.', 'Chỗ tớ bị chiếm mất rồi!'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const MAX_STEP = 0.55;

function canMove(nav, y, toX, toZ) {
  const to = nav.heightAt(toX, toZ);
  return to !== null && Math.abs(to - y) <= MAX_STEP;
}

class Classmate {
  constructor(student, crew, root) {
    this.student = student;
    this.crew = crew;
    this.nav = crew.nav;
    this.walker = createWalker(student.options);
    this.walker.group.visible = false;
    this.walker.group.rotation.order = 'YXZ';
    this.bubble = createBubble();
    this.bubble.sprite.position.set(0, 1.82, 0);
    this.walker.group.add(this.bubble.sprite);
    root.add(this.walker.group);
    this.shadow = createBlobShadow(root);
    this.shadow.setVisible(false);

    this.walkSpeed = 1.6 * between(0.78, 1.25);
    this.runSpeed = 3.3 * between(0.85, 1.15);
    this.accel = between(2.2, 4);
    this.decel = between(2.5, 4.5);
    this.turnRate = between(3, 4.5);
    this.wobbleF = between(0.35, 0.9);
    this.wobbleP = Math.random() * Math.PI * 2;
    this.stepTime = between(0.35, 0.6);
    this.chatty = between(0.6, 1.4);
    this.gait = new Gait({ stride: between(0.6, 0.85), armSwing: between(0.55, 1.0), bounce: between(0.7, 1.4) });

    this.seatRef = student.seat;
    this.targetSeat = null;
    this.position = this.seatRef.sit.clone();
    this.from = this.seatRef.sit.clone();
    this.state = 'seated';
    this.activity = null;
    this.timer = 0;
    this.velocity = 0;
    this.facing = Math.PI;
    this.route = null;
    this.seg = 0;
    this.cruise = this.walkSpeed;
    this.routeTime = 0;
    this.routeBudget = 0;
    this.pauseTimer = 0;
    this.pop = 0;
    this.slot = null;
    this.lookAt = null;
    this.nextLine = 0;
    this.playLegs = 0;
    this.now = 0;
  }

  get roaming() {
    return this.state === 'walking' || this.state === 'idle' || this.state === 'returning' || this.state === 'heeding';
  }

  startBreak() {
    if (this.state === 'seated') {
      this.state = 'rising';
      this.timer = between(0.2, 3);
      return;
    }
    if (this.state === 'returning' || this.state === 'sitting' || this.state === 'heeding') {
      this.crew.seats.unreserve(this.targetSeat, this);
      this.targetSeat = null;
      if (this.state === 'sitting') this.crew.seats.vacate(this.seatRef, this);
      this.chooseActivity();
    }
  }

  endBreak() {
    if (this.state === 'rising') {
      this.state = 'seated';
      return;
    }
    if (this.state === 'seated' || this.state === 'sitting' || this.state === 'returning' || this.state === 'heeding') return;
    this.crew.releaseSlot(this);
    this.lookAt = null;
    this.activity = 'return';
    this.pauseTimer = 0;
    this.state = 'heeding';
    this.timer = between(0, 1.6);
  }

  headBack() {
    const seats = this.crew.seats;
    const target = seats.isFreeFor(this.seatRef, this) ? this.seatRef : seats.nearestFree(this.position, this);
    if (!target) {
      this.idle(2);
      return;
    }
    seats.reserve(target, this);
    this.targetSeat = target;
    if (Math.random() < 0.6) this.bubble.show(pick(BACK), 1.6, this.now);
    this.routeTo(target.spot, this.walkSpeed * between(1.1, 1.5));
    if (this.remainingDistance() > 10 && Math.random() < 0.5) this.cruise = this.runSpeed;
  }

  routeTo(point, cruise) {
    const path = this.nav.findPath(this.position, point);
    const route = path && path.length ? path : [{ x: point.x, z: point.z }];
    this.startRoute(route, cruise, 'returning');
  }

  retarget() {
    const seats = this.crew.seats;
    seats.unreserve(this.targetSeat, this);
    const next = seats.nearestFree(this.position, this);
    this.targetSeat = next;
    if (!next) {
      this.idle(2);
      return;
    }
    seats.reserve(next, this);
    this.bubble.show(pick(TAKEN), 1.8, this.now);
    this.routeTo(next.spot, Math.max(this.cruise, this.walkSpeed));
  }

  standUp() {
    this.crew.seats.vacate(this.seatRef, this);
    this.student.group.visible = false;
    this.walker.group.visible = true;
    this.shadow.setVisible(true);
    this.position.copy(this.seatRef.sit);
    this.from.copy(this.seatRef.sit);
    this.facing = Math.PI;
    this.pop = 0.25;
    this.timer = 0;
    this.state = 'leaving';
  }

  sitDown() {
    this.walker.group.visible = false;
    this.shadow.setVisible(false);
    this.student.group.visible = true;
    this.bubble.hide();
    this.position.copy(this.seatRef.sit);
    this.facing = Math.PI;
    this.velocity = 0;
    this.state = 'seated';
  }

  chooseActivity() {
    this.lookAt = null;
    const r = Math.random();
    if (r < 0.45) {
      const slot = this.crew.reserveSlot(this);
      if (slot) {
        this.activity = 'chat';
        this.lookAt = slot.center;
        this.walkTo(slot.position, this.walkSpeed);
        return;
      }
    }
    if (r < 0.75) {
      this.activity = 'wander';
      this.walkTo(this.crew.randomPoint(), this.walkSpeed * between(0.85, 1.1));
      return;
    }
    this.activity = 'play';
    this.playLegs = 3 + Math.floor(Math.random() * 3);
    this.bubble.show(pick(PLAY), 1.4, this.now);
    this.walkTo(this.nearby(4), this.runSpeed * between(0.85, 1.05));
  }

  walkTo(target, cruise) {
    const path = this.nav.findPath(this.position, target);
    if (!path || !path.length) {
      this.idle(1);
      return;
    }
    this.startRoute(path, cruise, 'walking');
  }

  startRoute(path, cruise, state) {
    this.route = [{ x: this.position.x, z: this.position.z }, ...path.map((p) => ({ x: p.x, z: p.z }))];
    this.seg = 0;
    this.cruise = cruise;
    this.state = state;
    this.pauseTimer = 0;
    this.routeTime = 0;
    this.routeBudget = (this.remainingDistance() / Math.max(0.6, cruise)) * 2.5 + 3;
  }

  idle(seconds) {
    this.state = 'idle';
    this.timer = seconds;
    this.route = null;
  }

  nearby(radius) {
    const a = Math.random() * Math.PI * 2;
    const r = between(1.5, radius);
    return new THREE.Vector3(this.position.x + Math.cos(a) * r, 0, this.position.z + Math.sin(a) * r);
  }

  remainingDistance() {
    let d = 0;
    let x = this.position.x;
    let z = this.position.z;
    for (let i = this.seg + 1; i < this.route.length; i++) {
      d += Math.hypot(this.route[i].x - x, this.route[i].z - z);
      x = this.route[i].x;
      z = this.route[i].z;
    }
    return d;
  }

  lookAhead(distance) {
    let left = distance;
    let x = this.position.x;
    let z = this.position.z;
    for (let i = this.seg + 1; i < this.route.length; i++) {
      const dx = this.route[i].x - x;
      const dz = this.route[i].z - z;
      const len = Math.hypot(dx, dz);
      if (len >= left) return { x: x + (dx / len) * left, z: z + (dz / len) * left };
      left -= len;
      x = this.route[i].x;
      z = this.route[i].z;
    }
    return this.route[this.route.length - 1];
  }

  arrive() {
    this.route = null;
    this.velocity = 0;
    if (this.state === 'returning') {
      const seats = this.crew.seats;
      if (!this.targetSeat || !seats.canTake(this.targetSeat, this)) {
        this.retarget();
        return;
      }
      seats.occupy(this.targetSeat, this);
      this.seatRef = this.targetSeat;
      this.targetSeat = null;
      this.seatRef.place(this.student.group);
      this.from.copy(this.position);
      this.timer = 0;
      this.state = 'sitting';
      return;
    }
    if (this.activity === 'chat') {
      this.idle(between(6, 11));
      this.nextLine = between(0.5, 2.5) / this.chatty;
      return;
    }
    if (this.activity === 'play' && --this.playLegs > 0) {
      if (Math.random() < 0.3) this.bubble.show(pick(PLAY), 1.2, this.now);
      this.walkTo(this.nearby(4), this.runSpeed * between(0.8, 1.05));
      return;
    }
    this.idle(between(1.5, 4.5));
  }

  turnTo(angle, rate, dt) {
    const diff = wrap(angle - this.facing);
    const max = rate * dt;
    this.facing += clamp(diff, -max, max);
    return diff;
  }

  steer(t, dt) {
    const pos = this.position;
    const route = this.route;
    while (this.seg < route.length - 1) {
      const a = route[this.seg];
      const b = route[this.seg + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      const proj = len2 > 1e-6 ? ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / len2 : 1;
      if (proj >= 1 || Math.hypot(b.x - pos.x, b.z - pos.z) < 0.3) this.seg++;
      else break;
    }

    const remaining = this.remainingDistance();
    this.routeTime += dt;
    if (remaining < 0.1 || (remaining < 0.35 && this.velocity < 0.2) || this.routeTime > this.routeBudget) {
      this.arrive();
      return;
    }

    const target = this.lookAhead(LOOKAHEAD);
    const running = this.cruise > this.walkSpeed * 1.6;
    const rate = this.turnRate * (running ? 1.3 : 1) * (remaining < 0.8 ? 3 : 1);
    const err = this.turnTo(Math.atan2(target.x - pos.x, target.z - pos.z), rate, dt);

    if (this.state === 'walking' && this.activity === 'wander' && this.pauseTimer <= 0 && Math.random() < dt * 0.12) {
      this.pauseTimer = between(0.6, 1.8);
    }
    let wanted = this.cruise * (1 + 0.12 * Math.sin(t * this.wobbleF + this.wobbleP));
    wanted *= Math.max(0.3, Math.cos(err));
    wanted = Math.min(wanted, Math.sqrt(2 * this.decel * Math.max(0, remaining - 0.05)) + 0.15);
    if (this.pauseTimer > 0) {
      wanted = 0;
      if (this.velocity < 0.05) this.pauseTimer -= dt;
    }
    const accel = wanted > this.velocity ? this.accel : this.decel;
    this.velocity += clamp(wanted - this.velocity, -accel * dt, accel * dt);

    const travel = this.velocity * dt;
    const nx = pos.x + Math.sin(this.facing) * travel;
    const nz = pos.z + Math.cos(this.facing) * travel;
    if (canMove(this.nav, pos.y, nx, nz)) {
      pos.x = nx;
      pos.z = nz;
      return;
    }
    const next = route[Math.min(this.seg + 1, route.length - 1)];
    const dx = next.x - pos.x;
    const dz = next.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return;
    const move = Math.min(travel, d);
    const mx = (dx / d) * move;
    const mz = (dz / d) * move;
    this.turnTo(Math.atan2(dx, dz), rate * 2, dt);
    for (const [ox, oz] of [[mx, mz], [mx, 0], [0, mz]]) {
      if ((ox || oz) && canMove(this.nav, pos.y, pos.x + ox, pos.z + oz)) {
        pos.x += ox;
        pos.z += oz;
        return;
      }
    }
    this.velocity *= 0.5;
  }

  step(dt, to, done) {
    const before = this.position.clone();
    this.timer += dt;
    const k = Math.min(1, this.timer / this.stepTime);
    this.position.lerpVectors(this.from, to, k * k * (3 - 2 * k));
    this.velocity = before.distanceTo(this.position) / Math.max(dt, 1e-4);
    this.turnTo(Math.PI, 8, dt);
    if (k >= 1) {
      this.velocity = 0;
      done();
    }
  }

  slowDown(dt) {
    this.velocity = Math.max(0, this.velocity - this.decel * dt);
    if (this.velocity <= 0) return;
    const nx = this.position.x + Math.sin(this.facing) * this.velocity * dt;
    const nz = this.position.z + Math.cos(this.facing) * this.velocity * dt;
    if (!canMove(this.nav, this.position.y, nx, nz)) {
      this.velocity = 0;
      return;
    }
    this.position.x = nx;
    this.position.z = nz;
  }

  idleUpdate(dt) {
    this.slowDown(dt);
    this.timer -= dt;
    const focus = this.lookAt ?? this.crew.nearestRoaming(this, 2.2)?.position;
    if (focus) this.turnTo(Math.atan2(focus.x - this.position.x, focus.z - this.position.z), 4, dt);
    if (this.activity === 'chat') {
      this.nextLine -= dt;
      if (this.nextLine <= 0) {
        this.bubble.show(pick(CHAT), 2.2, this.now);
        this.nextLine = between(3.5, 7) / this.chatty;
      }
    }
    if (this.timer <= 0) {
      this.crew.releaseSlot(this);
      this.chooseActivity();
    }
  }

  heedUpdate(dt) {
    this.slowDown(dt);
    this.turnTo(Math.atan2(CLASSROOM.x - this.position.x, CLASSROOM.z - this.position.z), 3, dt);
    this.timer -= dt;
    if (this.timer <= 0) this.headBack();
  }

  update(t, dt) {
    this.now = t;
    this.bubble.update(t);
    switch (this.state) {
      case 'seated':
        return;
      case 'rising':
        this.timer -= dt;
        if (this.timer > 0) return;
        this.standUp();
        break;
      case 'leaving':
        this.step(dt, this.seatRef.spot, () => this.chooseActivity());
        break;
      case 'sitting':
        this.step(dt, this.seatRef.sit, () => this.sitDown());
        break;
      case 'walking':
      case 'returning':
        this.steer(t, dt);
        break;
      case 'idle':
        this.idleUpdate(dt);
        break;
      case 'heeding':
        this.heedUpdate(dt);
        break;
    }
    if (this.state !== 'seated') this.animate(t, dt);
  }

  animate(t, dt) {
    const w = this.walker;
    const pos = this.position;
    const g = this.gait.update(w, this.velocity, dt, true);
    if (this.bubble.visible && this.state === 'idle') w.rightArm.rotation.x = -0.6 - Math.sin(t * 6) * 0.25;

    const curious = (this.state === 'idle' && !this.lookAt) || this.pauseTimer > 0;
    const headTarget = curious ? Math.sin(t * 0.9 + this.wobbleP) * 0.55 : 0;
    w.head.rotation.y += (headTarget - w.head.rotation.y) * (1 - Math.exp(-4 * dt));

    const ground = this.nav.heightAt(pos.x, pos.z);
    if (ground !== null && this.roaming) pos.y += (ground - pos.y) * (1 - Math.exp(-14 * dt));
    const hop = this.velocity > 2.5 ? Math.abs(Math.sin(g.phase)) * 0.08 * Math.min(1, (this.velocity - 2.5) / 0.8) : 0;
    w.group.position.set(pos.x, pos.y + g.bob + hop, pos.z);
    w.group.rotation.set(g.lean, this.facing, 0);

    if (this.pop > 0) this.pop = Math.max(0, this.pop - dt);
    w.group.scale.setScalar(this.pop > 0 ? 1 + Math.sin((1 - this.pop / 0.25) * Math.PI) * 0.08 : 1);
    w.face.update(t, this.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');

    this.shadow.place(pos.x, pos.y, pos.z, hop);
    if (g.step && this.roaming) this.crew.footprints?.step(pos.x, pos.y, pos.z, this.facing, g.step.side);
  }
}

export class Classmates {
  constructor({ students, nav, root, seats, footprints = null }) {
    this.nav = nav;
    this.seats = seats;
    this.footprints = footprints;
    this.hangouts = HANGOUTS.map((spot) => ({ ...spot, slots: new Array(4).fill(null) }));
    this.members = students.map((student) => new Classmate(student, this, root));
    for (const member of this.members) member.seatRef.occupant = member;
  }

  displaced(member, seat) {
    if (member instanceof Classmate && member.targetSeat === seat && member.state === 'returning') member.retarget();
  }

  allSeated() {
    return this.members.every((member) => member.state === 'seated');
  }

  setPhase(phase) {
    for (const member of this.members) {
      if (phase === 'break') member.startBreak();
      else member.endBreak();
    }
  }

  update(t, dt) {
    for (const member of this.members) member.update(t, dt);
    this.separate();
  }

  separate() {
    const roaming = this.members.filter((m) => m.roaming);
    for (let i = 0; i < roaming.length; i++) {
      for (let j = i + 1; j < roaming.length; j++) {
        const a = roaming[i].position;
        const b = roaming[j].position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 1e-3 || d >= SPACING) continue;
        const push = (SPACING - d) / 2;
        this.nudge(roaming[i], (-dx / d) * push, (-dz / d) * push);
        this.nudge(roaming[j], (dx / d) * push, (dz / d) * push);
      }
    }
  }

  nudge(member, dx, dz) {
    const x = member.position.x + dx;
    const z = member.position.z + dz;
    if (!canMove(this.nav, member.position.y, x, z)) return;
    member.position.x = x;
    member.position.z = z;
  }

  reserveSlot(member) {
    const options = [];
    for (const spot of this.hangouts) {
      const free = spot.slots.indexOf(null);
      if (free < 0) continue;
      options.push({ spot, free, weight: 1 + spot.slots.filter(Boolean).length * 2 });
    }
    if (!options.length) return null;
    let r = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
    const choice = options.find((o) => (r -= o.weight) <= 0) ?? options[options.length - 1];
    choice.spot.slots[choice.free] = member;
    member.slot = { spot: choice.spot, index: choice.free };
    const a = (choice.free / 4) * Math.PI * 2 + 0.4;
    return {
      position: new THREE.Vector3(choice.spot.x + Math.cos(a) * 0.85, 0, choice.spot.z + Math.sin(a) * 0.85),
      center: new THREE.Vector3(choice.spot.x, 0, choice.spot.z),
    };
  }

  releaseSlot(member) {
    if (!member.slot) return;
    member.slot.spot.slots[member.slot.index] = null;
    member.slot = null;
  }

  randomPoint() {
    const [x0, z0, x1, z1] = pick(REGIONS);
    return new THREE.Vector3(between(x0, x1), 0, between(z0, z1));
  }

  nearestRoaming(member, radius) {
    let best = null;
    let bestD = radius;
    for (const other of this.members) {
      if (other === member || !other.roaming) continue;
      const d = other.position.distanceTo(member.position);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }
}
