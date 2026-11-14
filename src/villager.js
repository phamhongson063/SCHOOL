import * as THREE from 'three';
import { createWalker, createStudent } from './characters.js';
import { hasModel, createModel } from './characterModels.js';
import { createBubble } from './bubble.js';
import { Gait } from './gait.js';
import { createBlobShadow } from './groundfx.js';
import { createWatering } from './watering.js';
import { createHarvesting } from './harvesting.js';
import { createClearing } from './clearing.js';
import { createAngler } from './angler.js';
import { between } from './random.js';
import { VILLAGER, ENERGY, MOVE, CERTIFY } from './config.js';
import { certify } from './certify.js';
import { absorption } from './absorption.js';
import { leaveRoom } from './lodging.js';
import { layDown, restEase } from './walk.js';
import { FEELERS, LANE, LOOKAHEAD, QUEUE_DRIFT, STUCK_TIME, TURN_RATE, canMove, clamp, wrap } from './villagerData.js';
import { SQUEEZE, squeezeTurn } from './squeeze.js';
import { RestBehavior } from './villagerRest.js';
import { SchoolBehavior } from './villagerSchool.js';
import { WorkBehavior } from './villagerWork.js';
import { ErrandBehavior } from './villagerErrands.js';
import { MindBehavior } from './villagerMind.js';


export class Villager {
  constructor(profile, town) {
    this.profile = profile;
    this.id = profile.id;
    this.name = profile.name;
    this.kind = profile.kind;
    this.town = town;
    this.diligence = profile.diligence ?? 0;
    this.innGoer = Math.random() < 0.35;
    this.studyUntil = 0;
    this.studyRestAt = 0;
    this.comfort = Math.random();
    this.thrift = Math.random();
    this.lodge = null;
    this.lodgeNight = false;
    this.sleepingOut = false;
    this.bed = null;
    this.bankAt = null;
    this.bankRoll = Math.random();
    const model = profile.model && hasModel(profile.model) ? profile.model : null;
    this.walker = model ? createModel(model) : createWalker(profile.look);
    this.walker.group.rotation.order = 'YXZ';
    this.walker.group.visible = false;
    town.root.add(this.walker.group);
    this.present = false;
    this.seatedShown = false;
    this.near = true;
    this.skipDt = 0;
    this.bubble = createBubble();
    this.bubble.sprite.position.set(0, 2.05, 0);
    this.bubble.setName(this.name);
    this.walker.group.add(this.bubble.sprite);
    this.shadow = createBlobShadow(town.root);
    this.shadow.setVisible(false);
    this.glow = town.restGlow.spawn();
    town.root.add(this.glow);
    this.seated = null;
    if (this.kind === 'student' || this.kind === 'farmer') {
      this.seated = model ? createModel(model, { seated: true }) : createStudent(profile.look);
      this.seated.group.visible = false;
      town.root.add(this.seated.group);
      this.seatBubble = createBubble();
      this.seatBubble.sprite.position.set(0, model ? 1.85 : 1.55, 0);
      this.seatBubble.setName(this.name);
      this.seated.group.add(this.seatBubble.sprite);
    }
    this.fx = null;

    const adult = this.kind !== 'student';
    this.walkSpeed = MOVE.walk;
    this.runSpeed = MOVE.run;
    this.lane = between(-LANE, LANE);
    this.wobbleP = Math.random() * Math.PI * 2;
    this.stepTime = between(0.35, 0.6);
    this.gait = new Gait({ stride: between(0.6, 0.85), armSwing: between(0.55, 1.0), bounce: adult ? 0.8 : between(0.7, 1.4) });
    this.writing = Math.random() < 0.6;
    this.seatPhase = Math.random() * Math.PI * 2;

    this.position = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.facing = Math.random() * Math.PI * 2;
    this.velocity = 0;
    this.state = 'away';
    this.task = null;
    this.timer = 0;
    this.afterWait = null;
    this.onRouteEnd = null;
    this.route = null;
    this.seg = 0;
    this.cruise = this.walkSpeed;
    this.routeTime = 0;
    this.routeBudget = 0;
    this.pauseTimer = 0;
    this.pop = 0;
    this.seatRef = null;
    this.targetSeat = null;
    this.afterLeave = null;
    this.lookAt = null;
    this.job = null;
    this.studying = false;
    this.wakeAt = null;
    this.lyingDown = false;
    this.restBlend = 0;
    this.restClock = 0;
    this.queue = null;
    this.queueIndex = -1;
    this.serve = null;
    this.now = 0;
  }

  get purse() {
    return this.town.ledger.purse(this.id);
  }

  get effects() {
    this.fx ??= {
      water: createWatering(this.town.root, this.walker),
      harvest: createHarvesting(this.town.root, this.walker),
      clear: createClearing(this.town.root, this.walker),
      angler: createAngler(this.town.root, this.walker),
    };
    return this.fx;
  }

  get visible() {
    return this.present;
  }

  get roaming() {
    return this.state === 'walking' || this.state === 'idle' || this.state === 'working' || this.state === 'queued' || this.state === 'fishing';
  }

  get inSchool() {
    if (this.task === 'selfstudy') return false;
    return this.state === 'seated' || this.state === 'sitting' || this.state === 'rising' || this.state === 'leaving';
  }

  owns(object) {
    for (let node = object; node; node = node.parent) {
      if (node === this.walker.group || node === this.seated?.group) return true;
    }
    return false;
  }

  answerPool() {
    const keys = certify.pool(this.id);
    return keys.length > 0 && absorption.answer(this.id, keys[Math.floor(Math.random() * keys.length)]);
  }

  luckyIntellect() {
    if (Math.random() >= CERTIFY.dropChance || !certify.pool(this.id).length) return;
    this.purse.addIntellect(1);
    this.say('💡', 1.6);
  }

  say(text, seconds = 1.8) {
    if (this.state === 'seated') this.seatBubble?.show(text, seconds, this.now);
    else this.bubble.show(text, seconds, this.now);
  }

  setVisible(visible) {
    this.present = visible;
    if (!visible) this.bubble.hide();
    this.applyLod();
  }

  showSeated(shown) {
    this.seatedShown = shown;
    this.applyLod();
  }

  applyLod() {
    const near = this.present && this.near && !this.town.veiled?.has(this.id);
    this.walker.group.visible = near;
    this.shadow.setVisible(near);
    if (this.seated) this.seated.group.visible = this.seatedShown && this.near;
  }

  think() {
    const ctx = this.town.context;
    this.lookAt = null;
    this.task = null;
    const nightPlan = ctx.night ? this.plan(ctx) : null;
    if (ctx.night && (this.needsSleep(ctx) || !nightPlan)) return this.wantsVendor() ? this.goVendor() : this.goHome();
    if (this.wantsInn()) return this.goInn();
    if (this.wantsVendor()) return this.goVendor();
    if (this.wantsFood(ctx)) return this.goEat();
    if (ctx.martOpen && this.wantsMart()) return this.goMart();
    if (this.examDeckWanted(ctx)) return this.goExam();
    const money = this.moneyErrand(ctx);
    if (money) return this.goMoney(money);
    if (this.wantsArena()) return this.goArena();
    if (ctx.shopOpen && this.town.market.wantsTrade(this)) return this.goShop();
    if (ctx.fishOpen && this.town.market.wantsFish(this)) return this.goFishShop();
    if (ctx.chiefOpen && this.town.estate.affordableFor(this.id, this.purse.money - VILLAGER.houseReserve)) return this.goChief();
    if (this.purse.energy < ENERGY.workMin) return this.wait(between(2, 4), () => this.goFarm(() => this.goRest()));
    const choice = nightPlan ?? this.plan(ctx);
    if (choice) return this.follow(choice);
    return ctx.night ? this.goHome() : this.leisure();
  }

  wait(seconds, then = null) {
    this.state = 'idle';
    this.timer = seconds;
    this.route = null;
    this.afterWait = then;
  }

  travel(point, { speed = this.walkSpeed, then = null, fail = null, state = 'walking' } = {}) {
    if (this.tired) speed = Math.min(speed, this.walkSpeed * ENERGY.tiredSpeed);
    const path = this.town.path(this.position, point);
    if (path === undefined) {
      this.wait(0.05 + Math.random() * 0.15, () => this.travel(point, { speed, then, fail, state }));
      return;
    }
    if (!path || !path.length) {
      if (fail) fail();
      else this.wait(1.5);
      return;
    }
    this.route = this.inLane([{ x: this.position.x, z: this.position.z }, ...path.map((p) => ({ x: p.x, z: p.z }))]);
    this.seg = 0;
    this.cruise = speed;
    this.state = state;
    this.pauseTimer = 0;
    this.routeTime = 0;
    this.routeBudget = (this.remainingDistance() / Math.max(0.6, speed)) * 2.5 + 4;
    this.onRouteEnd = then;
    this.onRouteFail = fail;
    this.bestRemaining = Infinity;
    this.stuckTime = 0;
    this.repaths = 0;
  }

  inLane(route) {
    const nav = this.town.nav;
    for (let i = 1; i < route.length - 1; i++) {
      const prev = route[i - 1];
      const here = route[i];
      const next = route[i + 1];
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      dx /= len;
      dz /= len;
      const shifted = { x: here.x - dz * this.lane, z: here.z + dx * this.lane };
      if (nav.bodyClear(shifted.x, shifted.z) && nav.clear(prev, shifted) && nav.clear(shifted, next)) route[i] = shifted;
    }
    return route;
  }

  giveUp() {
    this.route = null;
    this.velocity = 0;
    const fail = this.onRouteFail;
    this.onRouteEnd = null;
    this.onRouteFail = null;
    this.state = 'idle';
    this.timer = 0;
    this.afterWait = null;
    if (fail) fail();
    else this.wait(between(0.8, 1.6));
  }

  unstick() {
    this.stuckTime = 0;
    this.repaths += 1;
    if (this.repaths > 2) {
      this.giveUp();
      return;
    }
    const goal = this.route[this.route.length - 1];
    const path = this.town.path(this.position, goal);
    if (path === undefined) {
      this.repaths -= 1;
      this.stuckTime = STUCK_TIME - 0.15;
      return;
    }
    if (!path || !path.length) {
      this.giveUp();
      return;
    }
    this.route = [{ x: this.position.x, z: this.position.z }, ...path.map((p) => ({ x: p.x, z: p.z }))];
    this.seg = 0;
    this.bestRemaining = Infinity;
    this.routeTime = 0;
    this.routeBudget = (this.remainingDistance() / Math.max(0.6, this.cruise)) * 2.5 + 4;
  }

  dropJob() {
    if (this.job) this.town.farm.release(this.job.index, this.id);
    this.job = null;
  }

  cancel() {
    this.dropJob();
    this.showPen(false);
    this.leaveQueue();
    this.town.river.leave(this);
    this.fishing = null;
    this.town.wildlife?.release(this);
    this.hunting = null;
    if (this.fx) for (const effect of Object.values(this.fx)) effect.busy && effect.cancel();
    this.town.seatWait?.leave(this);
    if (this.targetSeat) this.town.seats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.afterWait = null;
    this.onRouteEnd = null;
    this.sleepingOut = false;
    this.bed = null;
    if (this.state !== 'inn') leaveRoom(this);
  }

  homePoint() {
    return this.town.homeOf(this);
  }

  goHome() {
    this.cancel();
    this.task = 'home';
    if (!this.town.estate.houseOf(this.id)) {
      if (this.town.context.night) this.goNight();
      else this.wait(between(5, 10));
      return;
    }
    const home = this.homePoint();
    this.travel(home, { then: () => this.vanish(), fail: () => this.vanish() });
  }

  vanish() {
    this.cancel();
    this.task = null;
    this.route = null;
    this.velocity = 0;
    this.state = 'away';
    const home = this.homePoint();
    this.position.set(home.x, 0, home.z);
    this.setVisible(false);
  }

  enterArena(spot) {
    if (this.seatRef && (this.state === 'seated' || this.state === 'sitting' || this.state === 'rising' || this.state === 'leaving')) {
      this.town.seats.vacate(this.seatRef, this);
      this.showSeated(false);
    }
    if (this.state === 'inn') leaveRoom(this);
    this.cancel();
    this.seatRef = null;
    this.studying = false;
    this.examKeys = null;
    this.examDeck = null;
    this.internalKeys = null;
    this.internalDeck = null;
    this.lyingDown = false;
    this.restBlend = 0;
    this.route = null;
    this.wakeAt = null;
    this.task = 'arena';
    this.state = 'arena';
    this.placeArena(spot);
    this.setVisible(true);
  }

  placeArena(spot) {
    this.position.set(spot.x, spot.y, spot.z);
    this.facing = spot.facing;
    this.arenaFacing = spot.facing;
    this.arenaGoal = null;
    this.velocity = 0;
    this.pop = 0.25;
  }

  arenaStep(dt) {
    const goal = this.arenaGoal;
    if (goal) {
      const dx = goal.x - this.position.x;
      const dz = goal.z - this.position.z;
      const gap = Math.hypot(dx, dz);
      if (gap > 0.08) {
        const speed = this.walkSpeed * 0.55;
        const step = Math.min(gap, speed * dt);
        this.position.x += (dx / gap) * step;
        this.position.z += (dz / gap) * step;
        this.velocity = speed;
        this.turnTo(Math.atan2(dx, dz), 6, dt);
        return;
      }
      this.arenaGoal = null;
    }
    this.velocity = 0;
    if (Number.isFinite(this.arenaFacing)) this.turnTo(this.arenaFacing, 3, dt);
  }

  leaveArena(spot, linger = between(0.5, 1.5)) {
    this.arenaGoal = null;
    this.task = null;
    this.state = 'idle';
    this.position.set(spot.x, this.town.nav.heightAt(spot.x, spot.z) ?? 0, spot.z);
    if (Number.isFinite(spot.facing)) this.facing = spot.facing;
    this.velocity = 0;
    this.pop = 0.25;
    this.setVisible(true);
    this.wait(linger);
  }

  appear() {
    const home = this.homePoint();
    this.position.set(home.x, this.town.nav.heightAt(home.x, home.z) ?? 0, home.z);
    this.facing = Math.random() * Math.PI * 2;
    this.velocity = 0;
    this.pop = 0.25;
    this.setVisible(true);
    this.wait(between(0.3, 1.2));
  }

  turnTo(angle, rate, dt) {
    const diff = wrap(angle - this.facing);
    const max = rate * dt;
    this.facing += clamp(diff, -max, max);
    return diff;
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
    const then = this.onRouteEnd;
    this.onRouteEnd = null;
    this.onRouteFail = null;
    this.state = 'idle';
    this.timer = 0;
    this.afterWait = null;
    if (then) then();
    else this.wait(0.5);
  }

  steer(dt) {
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
    if (remaining < 0.1 || (remaining < 0.35 && this.velocity < 0.2)) {
      this.arrive();
      return;
    }
    if (this.routeTime > this.routeBudget) {
      this.giveUp();
      return;
    }
    if (this.pauseTimer <= 0) {
      if (remaining < this.bestRemaining - 0.04) {
        this.bestRemaining = remaining;
        this.stuckTime = 0;
      } else {
        this.stuckTime += dt;
      }
    }
    if (this.stuckTime > STUCK_TIME) {
      this.unstick();
      return;
    }

    const target = this.lookAhead(LOOKAHEAD);
    const running = this.cruise > (this.walkSpeed + this.runSpeed) / 2;
    const rate = TURN_RATE * (running ? 1.3 : 1) * (remaining < 0.8 ? 3 : 1);
    const heading = Math.atan2(target.x - pos.x, target.z - pos.z) + this.town.avoidance(this, remaining);
    this.turnTo(heading, rate, dt);

    let wanted = this.cruise * Math.min(1, remaining / 0.5 + 0.2);
    if (this.squeezeLeft > 0) wanted *= SQUEEZE.pace;
    if (this.pauseTimer > 0) {
      wanted = 0;
      this.pauseTimer -= dt;
    }
    this.velocity = wanted;

    const travel = this.velocity * dt;
    if (travel <= 1e-5) return;
    const next = route[Math.min(this.seg + 1, route.length - 1)];
    const side = wrap(Math.atan2(next.x - pos.x, next.z - pos.z) - this.facing) >= 0 ? 1 : -1;
    const probe = Math.min(Math.max(travel, 0.18), Math.max(travel, remaining));
    for (const spread of FEELERS) {
      for (const sign of spread ? [side, -side] : [1]) {
        const angle = this.facing + spread * sign;
        const sx = Math.sin(angle);
        const sz = Math.cos(angle);
        if (!canMove(this.town.nav, pos.y, pos.x + sx * probe, pos.z + sz * probe)) continue;
        const step = spread ? travel * Math.cos(spread) : travel;
        pos.x += sx * step;
        pos.z += sz * step;
        if (spread) this.turnTo(angle, rate, dt);
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

  slowDown() {
    this.velocity = 0;
  }

  idleUpdate(dt) {
    this.slowDown();
    this.timer -= dt;
    const focus = this.lookAt ?? this.town.nearestRoaming(this, 2.2)?.position;
    if (focus) this.turnTo(Math.atan2(focus.x - this.position.x, focus.z - this.position.z), 4, dt);
    if (this.timer > 0) return;
    const next = this.afterWait;
    this.afterWait = null;
    if (next) next();
    else this.think();
  }

  seatedUpdate(t) {
    const s = this.seated;
    if (this.task === 'selfstudy') this.selfStudyUpdate(t);
    if (this.task === 'exam') this.examUpdate(t);
    if (this.task === 'internal') this.internalUpdate(t);
    this.seatBubble.update(t);
    const learning = this.studying;
    this.seatBubble.setStudy(learning);
    if (!this.near) return;
    if (learning && this.writing) {
      s.head.rotation.x = 0.3 + Math.sin(t * 1.3 + this.seatPhase) * 0.04;
      s.rightArm.rotation.x = -(0.03 + (Math.sin(t * 6 + this.seatPhase) * 0.5 + 0.5) * 0.06);
      s.rightArm.rotation.y = Math.sin(t * 3 + this.seatPhase) * 0.06;
      s.face.update(t, 'open');
      if (this.town.posing) s.pose?.();
      return;
    }
    s.rightArm.rotation.x = 0;
    s.head.rotation.x = -0.05 + Math.sin(t * 2.4 + this.seatPhase) * 0.08;
    s.head.rotation.y = Math.sin(t * 0.5 + this.seatPhase) * (learning ? 0.12 : 0.4);
    s.face.update(t, !learning && Math.sin(t * 9 + this.seatPhase) > 0.1 ? 'talk' : 'open');
    if (this.town.posing) s.pose?.();
  }

  showTurn(turn) {
    this.bubble.setTurn(turn > 0 ? turn : null);
  }

  update(t, dt) {
    this.now = t;
    this.bubble.update(t);
    if (this.seatBubble && this.state !== 'seated') this.seatBubble.setStudy(false);
    this.showTurn(this.state === 'away' ? 0 : this.town.seatWait?.turnOf(this) ?? 0);
    switch (this.state) {
      case 'away':
        if (this.wakeAt !== null && t >= this.wakeAt) {
          this.wakeAt = null;
          this.appear();
        }
        return;
      case 'inn':
        if (!this.town.context.night && (this.lodgeNight || this.purse.full)) this.leaveInn();
        return;
      case 'teaching':
        this.teachingUpdate?.(t);
        return;
      case 'seated':
        this.seatedUpdate(t);
        return;
      case 'rising':
        this.timer -= dt;
        if (this.timer > 0) return;
        this.standUp(this.afterLeave);
        break;
      case 'leaving':
        this.step(dt, this.seatRef.spot, () => {
          const after = this.afterLeave;
          this.afterLeave = null;
          if (this.seatRef.study || this.seatRef.internal) this.seatRef = null;
          this.state = 'idle';
          this.timer = 0;
          if (after) after();
          else this.think();
        });
        break;
      case 'sitting':
        this.step(dt, this.seatRef.sit, () => this.sitDown());
        break;
      case 'walking':
        this.steer(dt);
        break;
      case 'idle':
        this.idleUpdate(dt);
        break;
      case 'resting':
        this.restUpdate(dt);
        break;
      case 'working':
        this.slowDown();
        break;
      case 'arena':
        this.arenaStep(dt);
        break;
      case 'fishing': {
        this.slowDown();
        const session = this.fishing;
        if (!session) {
          this.wait(0.5);
          break;
        }
        this.turnTo(session.berth.facing, 4, dt);
        if (!session.done && t >= session.biteAt) this.fishBite();
        else if (session.reelAt != null && t >= session.reelAt) this.resolveBite();
        else if (session.nextCastAt != null && t >= session.nextCastAt) this.nextTurn();
        break;
      }
      case 'queued':
        this.slowDown();
        if (this.fishing && !this.town.river.hasFish(this.fishing.spot)) {
          this.endFishing();
          break;
        }
        if (!this.queue || this.queue.indexOf(this) !== this.queueIndex) this.queued();
        else {
          const slot = this.queue.slot(this.queueIndex);
          if (this.blocked) {
            const p = this.town.player?.position;
            if (p) this.turnTo(Math.atan2(p.x - this.position.x, p.z - this.position.z), 4, dt);
            this.followQueue();
          } else if (Math.hypot(slot.x - this.position.x, slot.z - this.position.z) > QUEUE_DRIFT) this.followQueue();
          else this.turnTo(this.queue.facingAt(this.queueIndex), 4, dt);
        }
        break;
    }
    if (this.state !== 'seated' && this.state !== 'away') this.animate(t, dt);
    if (this.fx) for (const effect of Object.values(this.fx)) effect.update(dt, this.walker.group.visible);
    if (this.town.posing && this.near && this.state !== 'seated' && this.state !== 'away') this.walker.pose?.();
  }

  animate(t, dt) {
    const pos = this.position;
    const ground = this.town.nav.heightAt(pos.x, pos.z);
    if (ground !== null && this.roaming) pos.y += (ground - pos.y) * (1 - Math.exp(-14 * dt));
    if (this.state !== 'resting') this.restBlend = 0;
    this.glow.visible = this.near && this.present && this.restBlend > 0;
    if (this.glow.visible) {
      this.glow.position.set(pos.x, pos.y, pos.z);
      this.glow.scale.setScalar(restEase(this.restBlend));
    }
    if (!this.near) return;
    const w = this.walker;
    const g = this.gait.update(w, this.velocity, dt, true);
    if (this.restBlend > 0) {
      this.restClock += dt;
      layDown(w, pos, this.facing, restEase(this.restBlend), this.restClock);
      w.group.scale.setScalar(1);
      w.face.update(t, this.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
      this.shadow.place(pos.x, pos.y, pos.z, 0);
      return;
    }
    if (this.bubble.visible && this.state === 'idle') w.rightArm.rotation.x = -0.6 - Math.sin(t * 6) * 0.25;
    const curious = (this.state === 'idle' && !this.lookAt) || this.pauseTimer > 0;
    const headTarget = curious ? Math.sin(t * 0.9 + this.wobbleP) * 0.55 : 0;
    w.head.rotation.y += (headTarget - w.head.rotation.y) * (1 - Math.exp(-4 * dt));
    const hop = this.velocity > 2.5 ? Math.abs(Math.sin(g.phase)) * 0.08 * Math.min(1, (this.velocity - 2.5) / 0.8) : 0;
    w.group.position.set(pos.x, pos.y + g.bob + hop, pos.z);
    w.group.rotation.set(g.lean, this.facing + squeezeTurn(this, dt), 0);
    if (this.pop > 0) this.pop = Math.max(0, this.pop - dt);
    w.group.scale.setScalar(this.pop > 0 ? 1 + Math.sin((1 - this.pop / 0.25) * Math.PI) * 0.08 : 1);
    w.face.update(t, this.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
    this.shadow.place(pos.x, pos.y, pos.z, hop);
    if (g.step && this.roaming) this.town.dust?.step(pos.x, pos.y, pos.z, this.facing, this.velocity > (this.walkSpeed + this.runSpeed) / 2);
    if (g.step) this.town.stepSound?.play(this.velocity > (this.walkSpeed + this.runSpeed) / 2, pos.x, pos.y, pos.z, true);
  }
}

function mixin(target, ...sources) {
  for (const source of sources) {
    for (const name of Object.getOwnPropertyNames(source.prototype)) {
      if (name !== 'constructor') Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(source.prototype, name));
    }
  }
}

mixin(Villager, RestBehavior, SchoolBehavior, WorkBehavior, ErrandBehavior, MindBehavior);
