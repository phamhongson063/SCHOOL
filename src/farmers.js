import * as THREE from 'three';
import { createWalker } from './characters.js';
import { Gait } from './gait.js';
import { createBubble } from './bubble.js';
import { createBlobShadow } from './groundfx.js';
import { createWatering } from './watering.js';
import { createHarvesting } from './harvesting.js';
import { createClearing } from './clearing.js';

const WALK = 1.35;
const CHATTER = ['Nắng quá!', 'Mùa này được giá đó!', 'Ráng làm cho xong luống này.', 'Bắp năm nay tốt ghê!', 'Cà chua chín đỏ cả rồi!', 'Nghỉ tay chút đã.'];

export const FARMER_PROFILES = [
  { id: 'tu', name: 'Bác Tư', home: 9, look: { shirt: 0x7a5236, pants: 0x2f2a26, skin: 0xd9a479, style: 'toc', iris: 0x4a2a18, hat: 0xe8d9a8 } },
  { id: 'ba', name: 'Chú Ba', home: 6, look: { shirt: 0x34507a, pants: 0x3a3430, skin: 0xe0ad84, style: 'khan', khan: 0x8a3a2a, iris: 0x5a3220, hat: 0xe2d29c } },
  { id: 'hai', name: 'Cô Hai', home: 20, look: { shirt: 0x9a4a5a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bui', iris: 0x6a3a1e, hat: 0xeadcae } },
  { id: 'nam', name: 'Anh Năm', home: 17, look: { shirt: 0x5a7a4a, pants: 0x4a3a30, skin: 0xe6b08a, style: 'toc', iris: 0x4a2a18, hat: 0xe5d6a2 } },
  { id: 'sau', name: 'Ông Sáu', home: 23, look: { shirt: 0x6a5a48, pants: 0x2f2a26, skin: 0xcf9a70, style: 'khan', khan: 0x3a3430, iris: 0x3a2214, hat: 0xdccb94 } },
  { id: 'bay', name: 'Chị Bảy', home: 25, look: { shirt: 0xb07a3a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bui', iris: 0x6a3a1e, hat: 0xece0b4 } },
  { id: 'tam', name: 'Út Tám', home: 15, look: { shirt: 0x3a7a8a, pants: 0x4a3a30, skin: 0xf2c4a0, style: 'chom', iris: 0x7a4a24, hat: 0xe9dbab } },
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Farmer {
  constructor(profile, farm, parent, start) {
    this.id = profile.id;
    this.name = profile.name;
    this.farm = farm;
    this.walker = createWalker(profile.look);
    this.walker.group.rotation.order = 'YXZ';
    parent.add(this.walker.group);
    this.shadow = createBlobShadow(parent);
    this.bubble = createBubble();
    this.bubble.sprite.position.set(0, 2.05, 0);
    this.walker.group.add(this.bubble.sprite);
    this.gait = new Gait({ stride: 0.68, armSwing: 0.7, bounce: 0.8 });
    this.effects = {
      water: createWatering(parent, this.walker),
      harvest: createHarvesting(parent, this.walker),
      clear: createClearing(parent, this.walker),
    };
    this.position = new THREE.Vector3(start.x, 0, start.z);
    this.facing = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.path = null;
    this.waypoint = 0;
    this.walked = 0;
    this.budget = 0;
    this.state = 'idle';
    this.timer = 0.5 + Math.random() * 2.5;
    this.job = null;
    this.now = 0;
  }

  owns(object) {
    for (let node = object; node; node = node.parent) {
      if (node === this.walker.group) return true;
    }
    return false;
  }

  say(text, seconds = 1.8) {
    this.bubble.show(text, seconds, this.now);
  }

  greet(from) {
    if (this.state === 'idle') this.facing = Math.atan2(from.x - this.position.x, from.z - this.position.z);
    this.say(this.farm.bagText(this.id), 2.6);
  }

  idle(seconds) {
    this.state = 'idle';
    this.timer = seconds;
    this.path = null;
  }

  think() {
    const job = this.farm.jobFor(this);
    if (!job) {
      if (Math.random() < 0.3) this.say(pick(CHATTER), 2.2);
      this.idle(3 + Math.random() * 4);
      return;
    }
    const stand = this.farm.standFor(job.index, this.position);
    const path = this.farm.nav()?.findPath(this.position, stand);
    if (!path?.length) {
      this.idle(2);
      return;
    }
    this.farm.claim(job.index, this.id);
    this.job = job;
    this.path = path;
    this.waypoint = 0;
    this.walked = 0;
    this.budget = path.reduce((sum, p, i) => sum + (i ? Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z) : 0), 0) / WALK + 6;
    this.state = 'walking';
  }

  giveUp() {
    if (this.job) this.farm.release(this.job.index, this.id);
    this.job = null;
    this.idle(1.5);
  }

  walk(dt) {
    this.walked += dt;
    if (this.walked > this.budget) {
      this.giveUp();
      return;
    }
    const target = this.path[this.waypoint];
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const last = this.waypoint === this.path.length - 1;
    if (dist < (last ? 0.08 : 0.3)) {
      if (last) this.arrive();
      else this.waypoint += 1;
      return;
    }
    const want = WALK * (last ? Math.min(1, dist / 0.6 + 0.25) : 1);
    this.speed += Math.max(-4 * dt, Math.min(4 * dt, want - this.speed));
    const step = Math.min(dist, this.speed * dt);
    this.position.x += (dx / dist) * step;
    this.position.z += (dz / dist) * step;
    this.facing += wrap(Math.atan2(dx, dz) - this.facing) * (1 - Math.exp(-10 * dt));
  }

  arrive() {
    this.path = null;
    this.speed = 0;
    const job = this.job;
    const spot = this.farm.spot(job.index);
    this.facing = Math.atan2(spot.x - this.position.x, spot.z - this.position.z);
    const effect = this.farm.effectFor(job.index, job.action, this.id);
    const finish = () => {
      const reply = this.farm.act(job.action, job.index, job.choice, this.id);
      this.farm.release(job.index, this.id);
      this.job = null;
      if (reply && (job.action === 'harvest' || Math.random() < 0.25)) this.say(reply);
      this.idle(0.8 + Math.random() * 1.6);
    };
    if (!effect) {
      finish();
      return;
    }
    const runner = this.effects[effect.kind];
    if (effect.applyAt === 'start') {
      finish();
      runner.start(effect);
      return;
    }
    this.state = 'working';
    this.farm.animate(job.index, effect.kind, effect.duration);
    runner.start(effect, () => {
      finish();
      if (effect.then) this.effects[effect.then.kind]?.start(effect.then);
    });
  }

  update(t, dt) {
    this.now = t;
    this.bubble.update(t);
    if (this.state === 'idle') {
      this.speed = Math.max(0, this.speed - 4 * dt);
      this.timer -= dt;
      if (this.timer <= 0) this.think();
    } else if (this.state === 'walking') {
      this.walk(dt);
    }
    this.animate(dt);
    for (const effect of Object.values(this.effects)) effect.update(dt);
  }

  animate(dt) {
    const ground = this.farm.nav()?.heightAt(this.position.x, this.position.z) ?? 0;
    this.position.y += (ground - this.position.y) * (1 - Math.exp(-14 * dt));
    const g = this.gait.update(this.walker, this.speed, dt, true);
    this.walker.group.position.set(this.position.x, this.position.y + g.bob, this.position.z);
    this.walker.group.rotation.set(g.lean, this.facing, 0);
    this.walker.face.update(this.now, this.bubble.visible && Math.sin(this.now * 11) > 0 ? 'talk' : 'open');
    this.shadow.place(this.position.x, this.position.y, this.position.z, 0);
  }
}
