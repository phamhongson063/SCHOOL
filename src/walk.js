import * as THREE from 'three';
import { Gait } from './gait.js';
import { ENERGY } from './config.js';

const RADIUS = 0.3;
const MAX_STEP = 0.55;
const SNAP_DOWN = 0.45;
const HEIGHT = 1.7;
const EYE = 1.55;
const PIVOT = 1.5;
const LOOK_ABOVE = 0.55;
const LOW_PITCH = -0.12;
const PITCH_STEP = 0.12;
const ROOMY = 0.85;
const GRAVITY = 30;
const JUMP_SPEED = 9;
export const WALK_SPEED = 2.4;
export const RUN_SPEED = 4.9;
const WORK_SIDE = 1.75;
const WORK_PITCH = 0.28;
const WORK_DROP = 0.5;
const WORK_DISTANCE = 6.6;
const DOUBLE_CLICK_MS = 320;
const DOUBLE_CLICK_PX = 24;
const SENSITIVITY = 0.005;
const DRAG_THRESHOLD = 6;
const EPS = 1e-4;
const REST_TILT = Math.PI / 2 - 0.33;
const REST_TIME = 0.6;
const REST_SHIFT = 0.6;
const REST_LIFT = 0.04;
const REST_PIVOT = 0.55;
const REST_EYE = 0.45;
const REST_ARM_UP = Math.PI - 0.5;
const REST_ARM_OUT = 0.55;
const REST_HEAD = 0.3;
const REST_BREATH = 0.035;

export class PlayerController {
  constructor({ camera, domElement, world, obstacles, avatar, footprints = null, shadow = null }) {
    this.camera = camera;
    this.dom = domElement;
    this.world = world;
    this.obstacles = obstacles;
    this.footprints = footprints;
    this.shadow = shadow;
    this.surfaceAt = null;
    this.posture = 'free';
    this.seat = null;
    this.seating = null;
    this.pendingSeat = null;
    this.pendingAction = null;
    this.cameraGoal = null;
    this.lookTarget = null;
    this.onFacingTeacher = null;
    this.onStand = null;
    this.postureTimer = 0;
    this.postureFrom = new THREE.Vector3();
    this.pivotHeight = PIVOT;
    this.eyeHeight = EYE;
    this.gait = new Gait({ stride: 0.72, armSwing: 0.85, bounce: 1 });
    avatar.group.rotation.order = 'YXZ';
    this.avatar = avatar;
    this.nav = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.spawn = new THREE.Vector3();
    this.keys = new Set();
    this.hiddenLayers = new Set();
    this.onGround = false;
    this.enabled = false;
    this.firstPerson = false;
    this.yaw = 0;
    this.pitch = 0.3;
    this.viewPitch = 0.3;
    this.workSpot = new THREE.Vector2();
    this.working = false;
    this.workBlend = 0;
    this.distance = 5;
    this.distanceScale = 1;
    this.running = false;
    this.tired = false;
    this.lastClick = null;
    this.cameraDistance = 5;
    this.facing = Math.PI;
    this.stepOffset = 0;
    this.path = null;
    this.pathIndex = 0;
    this.bestDistance = Infinity;
    this.stuckTime = 0;
    this.drag = null;
    this.onClick = null;
    this.onTarget = null;
    this.avoid = null;
    this.resting = false;
    this.rest = 0;
    this.restTime = 0;
    this.afterRest = null;

    this.dom.addEventListener('pointerdown', (e) => this.pointerDown(e));
    this.dom.addEventListener('pointermove', (e) => this.pointerMove(e));
    this.dom.addEventListener('pointerup', (e) => this.pointerUp(e));
    this.dom.addEventListener('pointercancel', (e) => this.endDrag(e));
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    this.dom.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled || this.firstPerson) return;
        this.distance = THREE.MathUtils.clamp(this.distance + Math.sign(e.deltaY) * 0.5, 2, 9);
      },
      { passive: true },
    );
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target?.closest?.('input, textarea, dialog')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  pointerDown(e) {
    if (!this.enabled || (e.button !== 0 && e.button !== 2)) return;
    this.drag = { id: e.pointerId, button: e.button, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, moved: false };
    this.dom.setPointerCapture(e.pointerId);
  }

  pointerMove(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) {
      d.moved = true;
      this.dom.style.cursor = 'grabbing';
    }
    if (d.moved) {
      if (this.cameraGoal) this.completeFacing();
      this.yaw -= (e.clientX - d.x) * SENSITIVITY;
      this.pitch += (e.clientY - d.y) * SENSITIVITY;
      this.clampPitch();
    }
    d.x = e.clientX;
    d.y = e.clientY;
  }

  pointerUp(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.endDrag(e);
    if (d.moved || d.button !== 0) return;
    const now = performance.now();
    const last = this.lastClick;
    const double = last && now - last.time < DOUBLE_CLICK_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_CLICK_PX;
    this.lastClick = double ? null : { time: now, x: e.clientX, y: e.clientY };
    this.onClick?.(e.clientX, e.clientY, double);
  }

  endDrag(e) {
    if (this.dom.hasPointerCapture?.(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
    this.drag = null;
    this.dom.style.cursor = '';
  }

  clampPitch() {
    const [min, max] = this.firstPerson ? [-1.45, 1.45] : [-0.35, 1.25];
    this.pitch = THREE.MathUtils.clamp(this.pitch, min, max);
  }

  setFirstPerson(on) {
    this.firstPerson = on;
    this.cameraDistance = 0.5;
    this.clampPitch();
  }

  place(spawn, yaw) {
    this.spawn.copy(spawn);
    this.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.facing = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.drag = null;
      this.clearPath();
      const seated = this.posture === 'seated';
      this.avatar.group.visible = !seated;
      if (this.seating) this.seating.model.group.visible = seated;
    }
  }

  attachSeating({ seats, model, onDisplace }) {
    this.seating = { seats, model, onDisplace };
    model.group.visible = false;
  }

  get lying() {
    return this.resting || this.rest > 0;
  }

  get restAmount() {
    return this.rest * this.rest * (3 - 2 * this.rest);
  }

  lieDown() {
    if (this.posture !== 'free' || !this.onGround || this.resting) return false;
    this.clearPath();
    this.pendingSeat = null;
    this.afterRest = null;
    this.resting = true;
    this.velocity.set(0, 0, 0);
    return true;
  }

  getUp(then = null) {
    if (!this.lying) {
      then?.();
      return;
    }
    this.resting = false;
    this.afterRest = then;
  }

  updateRest(dt) {
    this.rest = this.resting ? Math.min(1, this.rest + dt / REST_TIME) : Math.max(0, this.rest - dt / REST_TIME);
    this.velocity.set(0, 0, 0);
    const k = this.restAmount;
    const p = this.position;
    const ahead = REST_SHIFT * k;
    this.gait.update(this.avatar, 0, dt, true);
    this.restPose(k, dt);
    this.avatar.group.position.set(p.x + Math.sin(this.facing) * ahead, p.y + REST_LIFT * k, p.z + Math.cos(this.facing) * ahead);
    this.avatar.group.rotation.set(-REST_TILT * k, this.facing, 0);
    this.shadow?.place(p.x, p.y, p.z, 0);
    if (!this.lying) {
      const then = this.afterRest;
      this.afterRest = null;
      then?.();
    }
    if (this.enabled) this.updateCamera(dt);
  }

  restPose(k, dt) {
    const a = this.avatar;
    this.restTime += dt;
    const t = this.restTime;
    const lerp = THREE.MathUtils.lerp;
    a.leftArm.rotation.set(lerp(a.leftArm.rotation.x, REST_ARM_UP, k), 0, REST_ARM_OUT * k);
    a.rightArm.rotation.set(lerp(a.rightArm.rotation.x, REST_ARM_UP, k), 0, -REST_ARM_OUT * k);
    a.leftLeg.rotation.set(lerp(a.leftLeg.rotation.x, -0.24, k), 0, (-0.2 + Math.sin(t * 1.7) * 0.08) * k);
    a.rightLeg.rotation.set(lerp(a.rightLeg.rotation.x, -0.04, k), 0, 0.05 * k);
    a.head.rotation.x = (REST_HEAD + Math.sin(t * 0.6) * 0.04) * k;
    if (a.body) a.body.scale.z = 1 + Math.sin(t * 1.9) * REST_BREATH * k;
  }

  requestMove(point, run = false) {
    if (this.lying) {
      this.getUp(() => this.requestMove(point, run));
      return;
    }
    this.running = run;
    this.pendingSeat = null;
    if (this.posture !== 'free') {
      this.pendingAction = () => this.goTo(point);
      this.beginStand();
      return;
    }
    this.goTo(point);
  }

  requestSeat(seat, run = false) {
    if (this.lying) {
      this.getUp(() => this.requestSeat(seat, run));
      return;
    }
    if (this.seat === seat && this.posture !== 'standing') return;
    this.running = run;
    const go = () => {
      this.pendingSeat = seat;
      if (!this.goTo(seat.spot)) this.pendingSeat = null;
    };
    if (this.posture !== 'free') {
      this.pendingAction = go;
      this.beginStand();
      return;
    }
    go();
  }

  arrived() {
    const seat = this.pendingSeat;
    this.pendingSeat = null;
    this.onArrive?.();
    if (!seat || !this.seating) return;
    if (Math.hypot(seat.spot.x - this.position.x, seat.spot.z - this.position.z) > 0.7) return;
    if (!this.seating.seats.canTake(seat, 'player')) return;
    this.beginSit(seat);
  }

  faceToward(x, z) {
    this.facing = Math.atan2(x - this.position.x, z - this.position.z);
  }

  beginSit(seat) {
    const displaced = this.seating.seats.occupy(seat, 'player');
    if (displaced) this.seating.onDisplace?.(displaced, seat);
    this.seat = seat;
    this.posture = 'sitting';
    this.postureTimer = 0;
    this.postureFrom.copy(this.position);
    this.velocity.set(0, 0, 0);
  }

  standUp() {
    this.pendingAction = null;
    this.beginStand();
  }

  beginStand() {
    if (this.posture === 'free' || this.posture === 'standing') return;
    this.cameraGoal = null;
    this.onStand?.();
    this.seating.model.group.visible = false;
    this.seating.seats.vacate(this.seat, 'player');
    this.posture = 'standing';
    this.postureTimer = 0;
    this.postureFrom.copy(this.position);
  }

  finishSit() {
    this.posture = 'seated';
    this.position.copy(this.seat.sit);
    this.facing = this.seat.facing ?? Math.PI;
    this.seat.place(this.seating.model.group);
    this.shadow?.setVisible(false);
    const look = this.seat.look ?? this.lookTarget;
    if (look) this.faceTarget(look);
    else this.completeFacing();
  }

  faceTarget(target, { work = false, then = null } = {}) {
    let yaw = Math.atan2(-(target.x - this.position.x), -(target.z - this.position.z));
    if (work && !this.firstPerson) {
      const left = Math.atan2(Math.sin(yaw + WORK_SIDE - this.yaw), Math.cos(yaw + WORK_SIDE - this.yaw));
      const right = Math.atan2(Math.sin(yaw - WORK_SIDE - this.yaw), Math.cos(yaw - WORK_SIDE - this.yaw));
      yaw += Math.abs(left) < Math.abs(right) ? WORK_SIDE : -WORK_SIDE;
    }
    if (work) {
      this.workSpot.set((target.x + this.position.x) / 2, (target.z + this.position.z) / 2);
      this.working = true;
    }
    const diff = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    const pitch = work ? (this.firstPerson ? 0.7 : WORK_PITCH) : this.firstPerson ? 0.08 : 0.22;
    this.cameraGoal = { yaw: this.yaw + diff, pitch, then };
  }

  completeFacing() {
    const goal = this.cameraGoal;
    this.cameraGoal = null;
    if (goal?.then) goal.then();
    else this.onFacingTeacher?.();
  }

  finishStand() {
    this.posture = 'free';
    this.position.copy(this.seat.spot);
    this.seat = null;
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.shadow?.setVisible(true);
    const action = this.pendingAction;
    this.pendingAction = null;
    action?.();
  }

  updatePosture(dt) {
    const p = this.position;
    const before = p.clone();
    if (this.posture === 'sitting' || this.posture === 'standing') {
      this.postureTimer += dt;
      const k = Math.min(1, this.postureTimer / 0.4);
      p.lerpVectors(this.postureFrom, this.posture === 'sitting' ? this.seat.sit : this.seat.spot, k * k * (3 - 2 * k));
      this.facing += Math.atan2(Math.sin(Math.PI - this.facing), Math.cos(Math.PI - this.facing)) * (1 - Math.exp(-12 * dt));
      if (k >= 1) {
        if (this.posture === 'sitting') this.finishSit();
        else this.finishStand();
      }
    }
    if (this.posture !== 'seated') {
      const speed = this.posture === 'free' ? 0 : before.distanceTo(p) / Math.max(dt, 1e-4);
      const g = this.gait.update(this.avatar, speed, dt, true);
      this.avatar.group.position.set(p.x, p.y + g.bob, p.z);
      this.avatar.group.rotation.set(g.lean, this.facing, 0);
      this.shadow?.place(p.x, p.y, p.z, 0);
    }
    if (this.enabled) this.updateCamera(dt);
  }

  goTo(point) {
    this.working = false;
    const path = this.nav?.findPath(this.position, point);
    if (!path || !path.length) return false;
    this.path = path;
    this.pathIndex = 0;
    this.bestDistance = Infinity;
    this.stuckTime = 0;
    this.onTarget?.(path[path.length - 1]);
    return true;
  }

  clearPath() {
    if (!this.path) return;
    this.path = null;
    this.running = false;
    this.onTarget?.(null);
  }

  advanceWaypoint() {
    if (this.pathIndex >= this.path.length - 1) {
      this.clearPath();
      this.arrived();
      return false;
    }
    this.pathIndex++;
    this.bestDistance = Infinity;
    this.stuckTime = 0;
    return true;
  }

  followPath(dt) {
    while (this.path) {
      const target = this.path[this.pathIndex];
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      const last = this.pathIndex === this.path.length - 1;

      if (dist < (last ? 0.12 : 0.3)) {
        if (!this.advanceWaypoint()) return null;
        continue;
      }
      const turn = this.avoid ? this.avoid(this.position, dx / dist, dz / dist, last ? dist : dist + 2) : 0;
      if (dist < this.bestDistance - 0.02) {
        this.bestDistance = dist;
        this.stuckTime = 0;
      } else if (Math.abs(turn) < 0.2) {
        this.stuckTime += dt;
        if (this.stuckTime > 0.7) {
          this.advanceWaypoint();
          return null;
        }
      }

      const running = !this.tired && (this.running || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
      const pace = running ? RUN_SPEED : this.tired ? WALK_SPEED * ENERGY.tiredSpeed : WALK_SPEED;
      const speed = pace * (last ? Math.min(1, dist / 0.5 + 0.2) : 1);
      const heading = Math.atan2(dx, dz) + turn;
      return new THREE.Vector3(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
    }
    return null;
  }

  update(dt) {
    if (this.posture !== 'free') {
      this.updatePosture(dt);
      return;
    }
    if (this.lying) {
      this.updateRest(dt);
      return;
    }
    const wish = (this.enabled && this.followPath(dt)) || new THREE.Vector3();

    const response = 1 - Math.exp(-(this.onGround ? 14 : 4) * dt);
    this.velocity.x += (wish.x - this.velocity.x) * response;
    this.velocity.z += (wish.z - this.velocity.z) * response;
    if (this.enabled && this.onGround && this.keys.has('Space')) this.velocity.y = JUMP_SPEED;
    this.velocity.y = Math.max(this.velocity.y - GRAVITY * dt, -40);

    const travel = Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y), Math.abs(this.velocity.z)) * dt;
    const steps = Math.max(1, Math.ceil(travel / 0.2));
    const h = dt / steps;
    let grounded = false;
    for (let i = 0; i < steps; i++) {
      this.moveHorizontal('x', this.velocity.x * h);
      this.moveHorizontal('z', this.velocity.z * h);
      if (this.moveVertical(this.velocity.y * h)) grounded = true;
    }
    if (!grounded && this.onGround && this.velocity.y <= 0) grounded = this.snapDown();
    this.onGround = grounded;

    if (this.position.y < -25) {
      this.position.copy(this.spawn);
      this.velocity.set(0, 0, 0);
      this.clearPath();
    }
    this.stepOffset *= Math.exp(-14 * dt);

    this.animate(dt, wish);
    if (this.enabled) this.updateCamera(dt);
  }

  animate(dt, wish) {
    const a = this.avatar;
    if (wish.lengthSq() > 0) {
      const target = Math.atan2(wish.x, wish.z);
      const diff = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += diff * (1 - Math.exp(-12 * dt));
    }

    const p = this.position;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const g = this.gait.update(a, speed, dt, this.onGround);
    a.group.position.set(p.x, p.y + this.stepOffset + g.bob, p.z);
    a.group.rotation.set(g.lean, this.facing, 0);

    const ground = this.onGround ? p.y : this.nav?.heightAt(p.x, p.z) ?? p.y;
    this.shadow?.place(p.x, ground, p.z, Math.max(0, p.y - ground));
    if (g.step && this.onGround) this.footprints?.step(p.x, p.y, p.z, this.facing, g.step.side);
  }

  updateCamera(dt) {
    const p = this.position;
    const seated = this.posture === 'seated';
    const ease = 1 - Math.exp(-6 * dt);
    if (this.cameraGoal) {
      const turn = 1 - Math.exp((this.cameraGoal.then ? -7 : -4) * dt);
      this.yaw += (this.cameraGoal.yaw - this.yaw) * turn;
      this.pitch += (this.cameraGoal.pitch - this.pitch) * turn;
      if (Math.abs(this.cameraGoal.yaw - this.yaw) < 0.02 && Math.abs(this.cameraGoal.pitch - this.pitch) < 0.02) this.completeFacing();
    }
    this.pivotHeight += ((seated ? 1.05 : this.resting ? REST_PIVOT : PIVOT) - this.pivotHeight) * ease;
    this.eyeHeight += ((seated ? 0.95 : this.resting ? REST_EYE : EYE) - this.eyeHeight) * ease;
    if (this.firstPerson) {
      this.camera.position.set(p.x, p.y + this.eyeHeight + this.stepOffset, p.z);
      this.camera.quaternion.setFromEuler(new THREE.Euler(-this.pitch, this.yaw, 0, 'YXZ'));
      this.avatar.group.visible = false;
      if (this.seating) this.seating.model.group.visible = false;
      return;
    }

    const pivot = new THREE.Vector3(p.x, p.y + this.pivotHeight + this.stepOffset, p.z);
    if (this.working && (this.posture !== 'free' || this.lying)) this.working = false;
    this.workBlend += ((this.working ? 1 : 0) - this.workBlend) * ease;
    if (this.workBlend > 0.001) {
      pivot.x += (this.workSpot.x - p.x) * this.workBlend;
      pivot.z += (this.workSpot.y - p.z) * this.workBlend;
      pivot.y -= WORK_DROP * this.workBlend;
    }
    const want = (this.distance + (WORK_DISTANCE - this.distance) * this.workBlend) * this.distanceScale;
    const target = this.roomyPitch(pivot, want);
    if (target === this.pitch && Math.abs(this.viewPitch - target) < 0.01) this.viewPitch = target;
    else this.viewPitch += (target - this.viewPitch) * (1 - Math.exp(-12 * dt));
    const dir = this.viewDirection(this.viewPitch);
    const free = this.castCamera(pivot, dir, want);
    if (free < this.cameraDistance) this.cameraDistance = free;
    else this.cameraDistance += (free - this.cameraDistance) * (1 - Math.exp(-5 * dt));

    this.camera.position.copy(pivot).addScaledVector(dir, this.cameraDistance);
    const lift = LOOK_ABOVE * Math.min(1, this.cameraDistance / 4);
    this.camera.lookAt(pivot.x, pivot.y + lift, pivot.z);
    const show = this.cameraDistance > 0.9;
    this.avatar.group.visible = show && !seated;
    if (this.seating) this.seating.model.group.visible = show && seated;
  }

  viewDirection(pitch) {
    return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
  }

  roomyPitch(pivot, want) {
    let best = this.pitch;
    let bestFree = this.castCamera(pivot, this.viewDirection(best), want);
    for (let pitch = this.pitch - PITCH_STEP; bestFree < want * ROOMY && pitch >= LOW_PITCH; pitch -= PITCH_STEP) {
      const free = this.castCamera(pivot, this.viewDirection(pitch), want);
      if (free > bestFree + 0.05) {
        best = pitch;
        bestFree = free;
      }
    }
    return best;
  }

  castCamera(origin, dir, maxDistance) {
    const step = 0.1;
    for (let d = step; d <= maxDistance; d += step) {
      const x = Math.floor(origin.x + dir.x * d);
      const y = Math.floor(origin.y + dir.y * d);
      const z = Math.floor(origin.z + dir.z * d);
      if (this.world.blocksView(x, y, z, this.hiddenLayers)) return Math.max(0.3, d - 0.35);
    }
    return maxDistance;
  }

  moveHorizontal(axis, amount) {
    if (!amount) return;
    const p = this.position;
    p[axis] += amount;
    if (!this.collides(p)) return;
    const lift = Math.floor(p.y + EPS) + 1 - p.y;
    if (this.onGround && lift <= MAX_STEP + EPS) {
      p.y += lift;
      if (!this.collides(p)) {
        this.stepOffset -= lift;
        return;
      }
      p.y -= lift;
    }
    p[axis] -= amount;
    this.velocity[axis] = 0;
  }

  moveVertical(amount) {
    const p = this.position;
    const before = p.y;
    p.y += amount;
    let landed = false;
    if (this.collides(p)) {
      this.velocity.y = 0;
      if (amount >= 0) {
        p.y = Math.floor(p.y + HEIGHT - EPS) - HEIGHT - EPS;
        return false;
      }
      p.y = Math.floor(p.y + EPS) + 1;
      landed = true;
    }
    const floor = this.surfaceAt?.(p.x, p.z);
    if (floor != null && amount <= 0 && p.y <= floor + EPS) {
      if (floor - before > 0.01) this.stepOffset -= floor - before;
      p.y = floor;
      this.velocity.y = 0;
      landed = true;
    }
    return landed;
  }

  snapDown() {
    const p = this.position;
    const stair = this.surfaceAt?.(p.x, p.z);
    let target = null;
    if (stair != null && stair < p.y) target = stair;
    else {
      const level = Math.floor(p.y - EPS);
      if (!this.collides({ x: p.x, y: level, z: p.z }) && this.collides({ x: p.x, y: level - 0.02, z: p.z })) target = level;
    }
    if (target === null || p.y - target > SNAP_DOWN) return false;
    this.stepOffset += p.y - target;
    p.y = target;
    this.velocity.y = 0;
    return true;
  }

  collides(p) {
    const x0 = Math.floor(p.x - RADIUS + EPS);
    const x1 = Math.floor(p.x + RADIUS - EPS);
    const y0 = Math.floor(p.y + EPS);
    const y1 = Math.floor(p.y + HEIGHT - EPS);
    const z0 = Math.floor(p.z - RADIUS + EPS);
    const z1 = Math.floor(p.z + RADIUS - EPS);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (this.world.isSolid(x, y, z)) return true;
        }
      }
    }
    for (const b of this.obstacles) {
      if (
        p.x + RADIUS > b.minX &&
        p.x - RADIUS < b.maxX &&
        p.z + RADIUS > b.minZ &&
        p.z - RADIUS < b.maxZ &&
        p.y + HEIGHT > b.minY &&
        p.y < b.maxY
      ) {
        return true;
      }
    }
    return false;
  }
}
