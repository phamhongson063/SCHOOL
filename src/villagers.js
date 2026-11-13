import * as THREE from 'three';
import { between } from './random.js';
import { VILLAGER } from './config.js';
import { INN_STAND } from './inn.js';
import { ServiceQueue } from './queue.js';
import { createRestGlow } from './regen.js';
import { AVOID_PROBE, AVOID_RANGE, BED_GAP, BED_REACH, BED_SCATTER, BLOCKED, FAR_MAX_DT, FAR_STEP, FIELD_EDGES, GUARDS, HANGOUTS, NO_REST_RADIUS, PASS_SPACING, PATHS_PER_FRAME, PEDDLER, PLAYER_AVOID_RANGE, SPACING, STOP_SPACING, STREET, STREET_MID, TEACHER, VISIBLE_DISTANCE, YARD, canMove, clamp, pick, villagerProfiles } from './villagerData.js';
import { blinkStudyIcons } from './studyIcon.js';
import { Villager } from './villager.js';
import { Guard, Peddler, Teacher } from './staff.js';
import { SQUEEZE, squeezePast } from './squeeze.js';
import { PLAYER } from './inventory.js';

const MOVING_SPEED = 0.1;
const bodyBox = new THREE.Box3();

export class Town {
  constructor({ root, nav, seats, studySeats, internalSeats, seatWait = null, school, farm, ledger, market, estate, places, lodges = [], river, bank = null, bankDesk = null, atms = [], classrooms = [], dust = null, stepSound = null }) {
    this.root = root;
    this.nav = nav;
    this.seats = seats;
    this.studySeats = studySeats;
    this.internalSeats = internalSeats;
    this.seatWait = seatWait;
    this.school = school;
    this.farm = farm;
    this.ledger = ledger;
    this.market = market;
    this.estate = estate;
    this.places = places;
    this.lodgeSpots = [{ id: 'inn', stand: INN_STAND }, ...places.lodges, ...lodges];
    this.river = river;
    this.queues = {
      shop: new ServiceQueue(places.shop.line, places.shop.look),
      chief: new ServiceQueue(places.chief.line, places.chief.look),
      eatery: new ServiceQueue(places.eatery.line, places.eatery.look),
      fish: new ServiceQueue(places.fish.line, places.fish.look),
    };
    this.bank = bank;
    if (bank && bankDesk) this.queues.bank = new ServiceQueue(bankDesk.line, bankDesk.look);
    this.atms = bank ? atms : [];
    for (const atm of this.atms) this.queues[`atm:${atm.id}`] = new ServiceQueue(atm.line, atm.look);
    this.classTeachers = {};
    for (const { deck, teacher } of classrooms) {
      this.queues[`teacher:${deck}`] = new ServiceQueue(teacher.line, teacher.at);
      this.classTeachers[deck] = teacher;
    }
    for (const queue of Object.values(this.queues)) queue.snap = (point) => this.walkable(point);
    for (const spot of river.spots) {
      for (const berth of spot.berths) {
        berth.stand = this.walkable(berth.stand);
        berth.facing = Math.atan2(berth.float.x - berth.stand.x, berth.float.z - berth.stand.z);
      }
    }
    this.dust = dust;
    this.stepSound = stepSound;
    this.context = null;
    this.restGlow = createRestGlow();
    this.view = null;
    this.posing = true;
    this.members = villagerProfiles().map((profile) => new Villager(profile, this));
    this.teacher = new Teacher(TEACHER, this);
    this.streetStops = [
      ...places.doors.values(),
      ...[places.shop, places.chief, places.eatery].map((place) => place.line[place.line.length - 1]),
    ]
      .map((point) => point.x)
      .sort((a, b) => a - b)
      .filter((x, i, xs) => i === 0 || x - xs[i - 1] >= STOP_SPACING)
      .map((x) => this.walkable({ x, z: STREET_MID }));
    this.vendor = new Peddler(PEDDLER, this);
    this.guards = GUARDS.map((profile) => new Guard(profile, this));
    this.shiftWorkers = [this.vendor, ...this.guards];
    this.all = [...this.members, this.teacher, ...this.shiftWorkers];
    this.budget = PATHS_PER_FRAME;
    this.frustum = new THREE.Frustum();
    this.viewProjection = new THREE.Matrix4();
    this.probe = new THREE.Sphere(new THREE.Vector3(), 1.4);
    this.lastNight = null;
    this.reviewAt = 0;
    this.started = false;
  }

  playerBlocks(queue, spot) {
    const player = this.player;
    if (!player || player.posture !== 'free' || queue.members.includes(player)) return false;
    return Math.hypot(player.position.x - spot.x, player.position.z - spot.z) < BLOCKED.radius;
  }

  walkable(point) {
    if (this.nav.heightAt(point.x, point.z) !== null) return point;
    const cell = this.nav.nearest(point.x, point.z, 3);
    if (cell < 0) return point;
    const center = this.nav.center(cell);
    return { x: center.x, z: center.z };
  }

  nameOf(id) {
    return this.all.find((member) => member.id === id)?.name ?? 'người khác';
  }

  villagerAt(object) {
    return this.all.find((member) => member.owns(object)) ?? null;
  }

  get clickables() {
    const list = [];
    for (const member of this.all) {
      if (member.walker.group.visible) list.push(member.walker.group);
      if (member.seated?.group.visible) list.push(member.seated.group);
    }
    return list;
  }

  path(from, to) {
    if (this.budget <= 0) return undefined;
    this.budget -= 1;
    return this.nav.findPath(from, to);
  }

  homeOf(member) {
    const house = this.estate.houseOf(member.id);
    if (house) return this.places.homes.get(house.id);
    return this.places.exits[member.profile.exit ?? 0];
  }

  displaced(member, seat) {
    if (!(member instanceof Villager) || member.targetSeat !== seat || member.state !== 'walking') return;
    if (seat.study) member.goSelfStudy();
    else member.goExam();
  }

  strollPoint() {
    const [x0, z0, x1, z1] = pick(Math.random() < 0.5 ? YARD : STREET);
    return new THREE.Vector3(between(x0, x1), 0, between(z0, z1));
  }

  fieldEdgePoint() {
    const [x0, z0, x1, z1] = pick(FIELD_EDGES);
    return new THREE.Vector3(between(x0, x1), 0, between(z0, z1));
  }

  bedTaken(x, z, member) {
    for (const other of this.members) {
      if (other === member) continue;
      const spot = other.bed ?? (other.lyingDown ? other.position : null);
      if (spot && Math.hypot(spot.x - x, spot.z - z) < BED_GAP) return true;
    }
    return false;
  }

  bedPoint(near, member = null) {
    const options = [...HANGOUTS, ...FIELD_EDGES.map(([x0, z0, x1, z1]) => ({ x: between(x0, x1), z: between(z0, z1) }))];
    options.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z));
    const claim = (x, z) => {
      const point = new THREE.Vector3(x, 0, z);
      if (member) member.bed = point;
      return point;
    };
    for (const option of options) {
      for (let tries = 0; tries < 10; tries++) {
        const reach = BED_SCATTER + (BED_REACH - BED_SCATTER) * (tries / 9);
        const x = option.x + between(-reach, reach);
        const z = option.z + between(-reach, reach);
        if (this.nav.bodyClear(x, z) && !this.restBlocked({ x, z }) && !this.bedTaken(x, z, member)) return claim(x, z);
      }
    }
    return claim(options[0].x + between(-BED_SCATTER, BED_SCATTER), options[0].z + between(-BED_SCATTER, BED_SCATTER));
  }

  restBlocked(point) {
    return Object.values(this.queues).some((queue) => queue.distanceTo(point, queue.busyLength()) <= NO_REST_RADIUS);
  }

  companion(member, radius) {
    let best = null;
    let bestD = radius;
    for (const other of this.members) {
      if (other === member || !other.present || other.inSchool) continue;
      if (other.task !== 'leisure' && other.task !== 'farm') continue;
      const d = other.position.distanceTo(member.position);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  fieldPoint() {
    const index = Math.floor(Math.random() * 200);
    const spot = this.farm.spot(index);
    return spot ? this.farm.standFor(index, { x: spot.x - 2, z: spot.z }) : { x: 0.5, z: 40 };
  }

  nearestRoaming(member, radius) {
    let best = null;
    let bestD = radius;
    for (const other of this.members) {
      if (other === member || !other.visible) continue;
      const d = other.position.distanceTo(member.position);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  steerAround(position, facing, remaining, self, { range = AVOID_RANGE, gain = 0.9, includePlayer = true, blocked = null } = {}) {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    let turn = 0;
    const consider = (pos) => {
      const dx = pos.x - position.x;
      const dz = pos.z - position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-3 || d > range || d > remaining) return;
      const ahead = (dx * fx + dz * fz) / d;
      if (ahead < 0.35) return;
      const side = dx * fz - dz * fx;
      const strength = (1 - d / range) * ahead;
      turn += (side >= 0 ? -1 : 1) * strength * gain;
    };
    for (const other of this.all) {
      if (other !== self && other.visible) consider(other.position);
    }
    if (includePlayer && this.player && this.player.posture === 'free') consider(this.player.position);
    turn = clamp(turn, -1.1, 1.1);
    if (blocked && turn && blocked(facing + turn) && !blocked(facing - turn)) return -turn;
    return turn;
  }

  avoidance(member, remaining) {
    if (remaining < 0.6) return 0;
    return this.steerAround(member.position, member.facing, remaining, member);
  }

  playerAvoidance(position, dirX, dirZ, remaining) {
    if (remaining < 0.5) return 0;
    const blocked = (heading) => {
      const probe = { x: position.x + Math.sin(heading) * AVOID_PROBE, y: position.y, z: position.z + Math.cos(heading) * AVOID_PROBE };
      return this.player.collides(probe);
    };
    return this.steerAround(position, Math.atan2(dirX, dirZ), remaining, null, { range: PLAYER_AVOID_RANGE, gain: 1.2, includePlayer: false, blocked });
  }

  restingBlockers() {
    const boxes = [];
    for (const member of this.all) {
      if (!member.visible || !(member.restBlend > 0)) continue;
      const p = member.position;
      boxes.push({ minX: p.x - SPACING, minZ: p.z - SPACING, maxX: p.x + SPACING, maxZ: p.z + SPACING });
      if (!member.near) continue;
      bodyBox.setFromObject(member.walker.group);
      boxes.push({ minX: bodyBox.min.x, minZ: bodyBox.min.z, maxX: bodyBox.max.x, maxZ: bodyBox.max.z });
    }
    return boxes;
  }

  separate(player, dt) {
    const bodies = this.all.filter((member) => member.visible);
    const playerFree = player && player.posture === 'free';
    const count = bodies.length + (playerFree ? 1 : 0);
    const bodyOf = (i) => (i < bodies.length ? bodies[i] : player);
    const playerMoving = playerFree && (!!player.path || Math.hypot(player.velocity.x, player.velocity.z) > 0.25);
    const moving = (body) => (body === player ? playerMoving : body.state === 'walking');
    for (let i = 0; i < count; i++) {
      const body = bodyOf(i);
      if (body.squeezeLeft > 0) body.squeezeLeft = Math.max(0, body.squeezeLeft - dt);
    }
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = bodyOf(i).position;
        const b = bodyOf(j).position;
        if (Math.abs(a.y - b.y) > 1.2) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= PASS_SPACING) continue;
        const nx = d < 1e-3 ? 1 : dx / d;
        const nz = d < 1e-3 ? 0 : dz / d;
        if (this.squeezes(bodyOf(i), bodyOf(j), moving, nx, nz)) {
          const push = (SQUEEZE.spacing - d) / 2;
          if (push <= 0) continue;
          this.nudge(bodyOf(i), -nx * push, -nz * push);
          this.nudge(bodyOf(j), nx * push, nz * push);
          continue;
        }
        if (j >= bodies.length) {
          const villager = bodies[i];
          const villagerWalking = villager.state === 'walking';
          const full = (playerMoving && villagerWalking ? PASS_SPACING : SPACING) - d;
          if (full <= 0) continue;
          if (playerMoving || !villagerWalking) this.nudge(player, nx * full, nz * full);
          else this.nudge(villager, -nx * full, -nz * full);
          continue;
        }
        const first = bodies[i];
        const second = bodies[j];
        const firstStill = first.state !== 'walking';
        const secondStill = second.state !== 'walking';
        const full = (firstStill || secondStill ? SPACING : PASS_SPACING) - d;
        if (full <= 0) continue;
        if (firstStill && !secondStill) {
          this.nudge(second, nx * full, nz * full);
          continue;
        }
        if (secondStill && !firstStill) {
          this.nudge(first, -nx * full, -nz * full);
          continue;
        }
        const push = full / 2;
        this.nudge(first, -nx * push, -nz * push);
        this.nudge(second, nx * push, nz * push);
      }
    }
  }

  squeezes(first, second, moving, nx, nz) {
    if (first.roaming === false || second.roaming === false || (!moving(first) && !moving(second))) return false;
    const narrow = (first.squeezeLeft > 0 && second.squeezeLeft > 0) || this.narrow(first, nx, nz) || this.narrow(second, nx, nz);
    if (!narrow) return false;
    squeezePast(first, second.position);
    squeezePast(second, first.position);
    return true;
  }

  narrow(body, nx, nz) {
    const p = body.position;
    const free = this.freeFor(body);
    let room = 0;
    for (const side of [1, -1]) {
      let reach = 0;
      while (reach < SQUEEZE.probe) {
        const next = reach + SQUEEZE.step;
        if (!free(p.x - nz * side * next, p.z + nx * side * next)) break;
        reach = next;
      }
      room += reach;
    }
    return room < SQUEEZE.room;
  }

  freeFor(body) {
    const p = body.position;
    return body instanceof Villager ? (x, z) => canMove(this.nav, p.y, x, z) : (x, z) => !body.collides({ x, y: p.y, z });
  }

  nudge(body, dx, dz) {
    const p = body.position;
    const free = this.freeFor(body);
    for (const [mx, mz] of [
      [dx, dz],
      [dx, 0],
      [0, dz],
    ]) {
      if ((!mx && !mz) || !free(p.x + mx, p.z + mz)) continue;
      p.x += mx;
      p.z += mz;
      return;
    }
  }

  snapshot(t, minutes) {
    const seats = this.studySeats.list;
    const rests = [];
    seats.forEach((seat, index) => {
      for (const [who, until] of seat.rested ?? []) {
        const id = who === 'player' ? PLAYER : who?.id;
        if (id && until > t) rests.push([index, id, Math.round(until - t)]);
      }
    });
    const members = this.members.map((member) => {
      const entry = { id: member.id };
      if (member.studyRestAt > t) entry.studyRest = Math.round(member.studyRestAt - t);
      if (member.state === 'seated' && member.task === 'selfstudy' && member.seatRef?.study) {
        entry.study = { seat: seats.indexOf(member.seatRef), left: Math.round(member.studyUntil - t), words: member.sitWords ?? 0, mark: Math.round(t - member.studyMark) };
      } else if (member.present && member.roaming) {
        entry.at = [Math.round(member.position.x * 100) / 100, Math.round(member.position.z * 100) / 100, Math.round(member.facing * 100) / 100];
      }
      return entry;
    });
    return { minutes, members, rests };
  }

  resumable(ctx) {
    const saved = this.saved;
    this.saved = null;
    const gap = ctx.minutes - saved?.minutes;
    if (!(gap >= 0 && gap <= VILLAGER.resumeMinutes) || !Array.isArray(saved.members)) return { members: new Map(), rests: [] };
    const members = new Map(saved.members.filter((entry) => entry && typeof entry.id === 'string').map((entry) => [entry.id, entry]));
    return { members, rests: Array.isArray(saved.rests) ? saved.rests : [] };
  }

  restoreRests(rests, t) {
    for (const [index, id, left] of rests) {
      const seat = this.studySeats.list[index];
      const who = id === PLAYER ? 'player' : this.members.find((member) => member.id === id);
      if (seat && who && left > 0) this.studySeats.rest(seat, who, t + left);
    }
  }

  resumeMember(member, entry, ctx, t) {
    if (!entry) return false;
    if (entry.studyRest > 0) member.studyRestAt = t + entry.studyRest;
    const study = entry.study;
    if (study && study.left > 0 && !(ctx.night && member.needsSleep(ctx))) {
      const seat = this.studySeats.list[study.seat];
      if (seat && member.resumeStudy(seat, study, t)) return true;
    }
    const [x, z, facing] = Array.isArray(entry.at) ? entry.at : [];
    if (![x, z].every(Number.isFinite)) return false;
    if (ctx.night && member.wantsSleep(ctx)) return false;
    const height = this.nav.heightAt(x, z);
    if (height === null) return false;
    member.position.set(x, height, z);
    if (Number.isFinite(facing)) member.facing = facing;
    member.setVisible(true);
    member.wait(between(0.2, 1.5));
    return true;
  }

  restore(ctx, t = 0) {
    const saved = this.resumable(ctx);
    this.restoreRests(saved.rests, t);
    this.context = ctx;
    this.started = true;
    this.lastNight = ctx.night;
    if (this.teacher.onDuty(ctx)) this.teacher.beginTeaching();
    else if (ctx.night) this.teacher.settleNight();
    else this.teacher.vanish();
    for (const worker of this.shiftWorkers) worker.vanish();
    for (const member of this.members) {
      if (this.resumeMember(member, saved.members.get(member.id), ctx, t)) continue;
      if (member.wantsSleep(ctx)) {
        member.settleNight();
        continue;
      }
      const spot = this.fieldPoint();
      const height = this.nav.heightAt(spot.x, spot.z);
      if (height === null) {
        member.vanish();
        member.wakeAt = between(0.5, 6);
        continue;
      }
      member.position.set(spot.x, height, spot.z);
      member.setVisible(true);
      member.wait(between(0.2, 3));
    }
  }

  review(ctx) {
    const teacher = this.teacher;
    if (teacher.state === 'teaching' && !teacher.onDuty(ctx)) teacher.stopTeaching();
    else if (teacher.state === 'away' && teacher.onDuty(ctx) && teacher.wakeAt === null) teacher.wakeAt = teacher.now + between(0.5, 3);
    for (const worker of this.shiftWorkers) {
      if (worker.state === 'away' && worker.onDuty(ctx) && worker.wakeAt === null) worker.wakeAt = worker.now + 0.5 + (worker.lag ?? between(0, 2.5));
    }
  }

  anyMoving() {
    return this.all.some((member) => member.near && member.velocity > MOVING_SPEED);
  }

  updateLod(camera) {
    this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const member of this.all) {
      const d = camera.position.distanceTo(member.position);
      this.probe.center.set(member.position.x, member.position.y + 0.9, member.position.z);
      const near = d < VISIBLE_DISTANCE && (d <= 10 || this.frustum.intersectsSphere(this.probe)) && (!this.view || this.view.sees(member.position, this.probe));
      if (near === member.near) continue;
      member.near = near;
      member.applyLod();
    }
  }

  update(t, dt, ctx, player, camera, posing = true) {
    this.posing = posing;
    this.budget = PATHS_PER_FRAME;
    this.player = player;
    this.context = ctx;
    if (!this.started) this.restore(ctx, t);
    if (ctx.night !== this.lastNight) {
      this.lastNight = ctx.night;
      if (ctx.night) {
        for (const member of this.all) {
          if (member.state === 'inn') member.lodgeNight = true;
          if (member.state === 'away' || member.state === 'inn' || member.keepsNight) continue;
          if (member === this.teacher && (member.state === 'teaching' || member.onDuty(ctx))) {
            if (!member.onDuty(ctx)) member.stopTeaching();
            continue;
          }
          if (member !== this.teacher && !member.wantsSleep(ctx)) continue;
          if (member.state === 'seated') member.rise(() => member.goHome(), between(0.2, 2));
          else if (member.state !== 'rising' && member.state !== 'leaving' && member.state !== 'sitting' && member.state !== 'resting') member.goHome();
        }
      } else {
        for (const member of this.members) {
          if (member.state === 'away') member.wakeAt = t + between(0.5, 40);
        }
      }
    }
    if (t >= this.reviewAt) {
      this.reviewAt = t + 1;
      this.review(ctx);
    }
    for (const member of this.all) member.tickEnergy(ctx);
    this.updateLod(camera);
    for (const member of this.all) {
      if (!member.near) {
        member.skipDt += dt;
        if (member.skipDt < FAR_STEP) continue;
        member.update(t, Math.min(member.skipDt, FAR_MAX_DT));
        member.skipDt = 0;
        continue;
      }
      member.skipDt = 0;
      member.update(t, dt);
    }
    this.separate(player, dt);
    blinkStudyIcons(t);
    this.restGlow.update(t);
  }
}
