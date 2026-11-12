import * as THREE from 'three';
import { between } from './random.js';
import { CROPS } from './crops.js';
import { ITEMS, seedId, fishId } from './inventory.js';
import { FISHING, ENERGY, HUNTING, CERTIFY } from './config.js';
import { FIELD_TREES } from './farm.js';
import { iconTag } from './itemArt.js';
import { BAGGED, CAUGHT, ESCAPED, FIELD, GOSSIP, MISSED, REST, TEND, pick } from './villagerData.js';
import { badgeMaterial } from './studyIcon.js';

const SIGN_SECONDS = 2.4;
const PEN_LIFT = 1.9;
let penMaterial = null;

export class WorkBehavior {
  nearby(radius) {
    const a = Math.random() * Math.PI * 2;
    const r = between(1.5, radius);
    return new THREE.Vector3(this.position.x + Math.cos(a) * r, 0, this.position.z + Math.sin(a) * r);
  }

  seedChoice() {
    const purse = this.purse;
    let best = null;
    let most = 0;
    for (const id of Object.keys(CROPS)) {
      const count = purse.count(seedId(id));
      if (count > most) {
        most = count;
        best = id;
      }
    }
    return best;
  }

  goFarm(idle = () => this.leisure()) {
    const farm = this.town.farm;
    const job = farm.jobFor(this, this.seedChoice());
    if (!job) {
      idle();
      return;
    }
    const stand = job.stand ?? farm.standFor(job.index, this.position);
    farm.claim(job.index, this.id);
    this.job = job;
    this.task = 'farm';
    this.travel(stand, { then: () => this.work(), fail: () => {
      this.dropJob();
      this.wait(1.5);
    } });
  }

  canHunt() {
    const wildlife = this.town.wildlife;
    if (!wildlife) return false;
    return this.purse.energy >= HUNTING.energy + ENERGY.costs.clear && wildlife.hunters < HUNTING.villagerHunters && wildlife.hasPrey;
  }

  goHunt() {
    const wildlife = this.town.wildlife;
    const prey = wildlife.claim(this);
    if (!prey) return false;
    this.task = 'hunt';
    this.hunting = { prey };
    const stand = wildlife.standFor(prey, this.position);
    this.travel(new THREE.Vector3(stand.x, 0, stand.z), {
      then: () => this.pounce(),
      fail: () => this.endHunt(),
    });
    return true;
  }

  pounce() {
    const session = this.hunting;
    const ctx = this.town.context;
    const wildlife = this.town.wildlife;
    if (!session || this.needsSleep(ctx) || this.shouldAttend(ctx) || !wildlife.reachable(session.prey, this.position) || !this.purse.spendEnergy(HUNTING.energy)) {
      this.endHunt();
      return;
    }
    const prey = session.prey;
    this.facing = Math.atan2(prey.x - this.position.x, prey.z - this.position.z);
    const skill = HUNTING.villagerSkill[this.kind] ?? 0.5;
    if (Math.random() < skill) {
      const item = wildlife.capture(prey);
      this.purse.add(item, 1);
      this.luckyIntellect();
      if (Math.random() < 0.7) this.say(`${pick(BAGGED)} ${iconTag(ITEMS[item])}`, 1.8);
    } else {
      wildlife.scare(prey, this.position);
      if (Math.random() < 0.6) this.say(pick(MISSED), 1.6);
    }
    this.endHunt();
  }

  endHunt() {
    this.town.wildlife?.release(this);
    this.hunting = null;
    this.task = null;
    this.wait(between(1, 2));
  }

  canFish() {
    const purse = this.purse;
    const river = this.town.river;
    return purse.count('rod') > 0 && purse.count('bait') > 0 && purse.energy >= ENERGY.costs.fish && river.hasRoom && river.anglers < FISHING.villagerAnglers;
  }

  goFish() {
    const river = this.town.river;
    const berth = river.pick(this.position, this);
    if (!berth) return false;
    this.task = 'fish';
    const [lo, hi] = FISHING.villagerCasts;
    river.claim(this, berth);
    this.fishing = { spot: berth.spot, berth, casts: lo + Math.floor(Math.random() * (hi - lo + 1)), biteAt: 0, done: false };
    this.travel(new THREE.Vector3(berth.stand.x, 0, berth.stand.z), { then: () => this.castLine(), fail: () => this.endFishing() });
    return true;
  }

  nextTurn() {
    const session = this.fishing;
    session.nextCastAt = null;
    if (this.fx) this.fx.angler.stop();
    if (session.casts <= 0 || !this.town.river.hasFish(session.spot)) {
      this.endFishing();
      return;
    }
    this.castLine();
  }

  castLine() {
    const session = this.fishing;
    const ctx = this.town.context;
    if (!session || session.casts <= 0 || this.needsSleep(ctx) || this.shouldAttend(ctx) || !this.town.river.hasFish(session.spot) || !this.purse.spendEnergy(ENERGY.costs.fish) || !this.purse.take('bait', 1)) {
      this.endFishing();
      return;
    }
    session.casts -= 1;
    session.done = false;
    session.reelAt = null;
    session.nextCastAt = null;
    this.facing = session.berth.facing;
    this.effects.angler.cast(session.berth.float);
    session.biteAt = this.now + FISHING.biteSeconds;
    this.state = 'fishing';
  }

  fishBite() {
    const session = this.fishing;
    if (!this.town.river.hasFish(session.spot)) {
      this.endFishing();
      return;
    }
    session.done = true;
    const answer = between(...FISHING.villagerAnswer);
    session.reelAt = this.now + answer;
    this.effects.angler.bite();
    this.say('🤔', answer);
  }

  resolveBite() {
    const session = this.fishing;
    session.reelAt = null;
    const ctx = this.town.context;
    this.effects.angler.reel();
    const skill = FISHING.villagerSkill[this.kind] ?? 0.5;
    if (Math.random() < skill && this.town.river.take(session.spot)) {
      const fish = this.town.river.rollFish(ctx.minutes);
      this.purse.catchFish(fishId(fish), ctx.day);
      this.luckyIntellect();
      const float = session.berth.float;
      this.effects.harvest.start({ count: 1, at: { x: float.x, y: 0.05, z: float.z }, height: 0.1, item: fishId(fish) });
      if (Math.random() < 0.6) this.say(`${pick(CAUGHT)} ${iconTag(ITEMS[fishId(fish)])}`, 1.8);
    } else if (Math.random() < 0.5) {
      this.say(pick(ESCAPED), 1.8);
    }
    session.nextCastAt = this.now + FISHING.castPause;
  }

  endFishing() {
    this.leaveQueue();
    this.town.river.leave(this);
    if (this.fx) this.fx.angler.stop();
    this.fishing = null;
    this.task = null;
    this.wait(between(0.5, 1.5));
  }

  leisure() {
    this.task = 'leisure';
    this.lookAt = null;
    if (Math.random() < 0.2 && this.canHunt() && this.goHunt()) return;
    if (Math.random() < 0.35 && this.canFish() && this.goFish()) return;
    const farm = this.town.farm;
    const r = Math.random();
    const plot = farm.randomPlot(this.id);
    if (r < 0.3 && plot >= 0) {
      const spot = farm.spot(plot);
      this.travel(farm.standFor(plot, this.position), {
        then: () => {
          this.facing = Math.atan2(spot.x - this.position.x, spot.z - this.position.z);
          if (Math.random() < 0.5) this.say(pick(TEND), 2.2);
          this.wait(between(3, 6));
        },
      });
      return;
    }
    if (r < 0.5) {
      const friend = this.town.companion(this, 30);
      if (friend) {
        const a = Math.random() * Math.PI * 2;
        const meet = new THREE.Vector3(friend.position.x + Math.cos(a) * 1.1, 0, friend.position.z + Math.sin(a) * 1.1);
        this.travel(meet, {
          then: () => {
            this.lookAt = friend.position;
            this.say(pick(GOSSIP), 2.6);
            if (friend.state === 'idle' && friend.task === 'leisure' && Math.random() < 0.6) {
              friend.lookAt = this.position;
              friend.say(pick(GOSSIP), 2.4);
            }
            this.wait(between(5, 9));
          },
        });
        return;
      }
    }
    if (r < 0.75 || this.kind === 'student') {
      const point = this.kind === 'student' ? this.town.strollPoint() : this.town.fieldEdgePoint();
      this.travel(point, {
        speed: this.walkSpeed,
        then: () => {
          if (this.kind !== 'student' && Math.random() < 0.2) this.say(pick(FIELD), 2.2);
          this.wait(between(2, 5));
        },
      });
      return;
    }
    const [tx, tz] = pick(FIELD_TREES);
    this.travel(new THREE.Vector3(tx + 0.5 + between(-0.6, 0.6), 0, tz - 1.3), {
      then: () => {
        if (Math.random() < 0.5) this.say(pick(REST), 2);
        this.wait(between(6, 12));
      },
    });
  }

  showPen(on) {
    if (!this.pen) {
      if (!on) return;
      penMaterial ??= badgeMaterial('✍️');
      this.pen = new THREE.Sprite(penMaterial);
      this.pen.scale.setScalar(0.42);
      this.pen.renderOrder = 6;
      this.pen.position.set(0, PEN_LIFT, 0);
      this.walker.group.add(this.pen);
    }
    this.pen.visible = on;
  }

  signLease(job) {
    const farm = this.town.farm;
    const sign = farm.signOf(job.bed);
    this.facing = Math.atan2(sign.x - this.position.x, sign.z - this.position.z);
    this.showPen(true);
    this.wait(SIGN_SECONDS, () => {
      this.showPen(false);
      farm.signLease(job.bed, this.id, job.offer);
      farm.release(job.index, this.id);
      this.job = null;
      this.wait(between(0.6, 1.2));
    });
    this.lookAt = sign;
  }

  work() {
    const job = this.job;
    const farm = this.town.farm;
    if (!job) {
      this.wait(0.5);
      return;
    }
    if (job.action === 'lease') {
      this.signLease(job);
      return;
    }
    const cost = ENERGY.costs[job.action] ?? 0;
    if (!this.purse.spendEnergy(cost)) {
      farm.release(job.index, this.id);
      this.job = null;
      this.say('Mệt quá, nghỉ chút đã...', 1.8);
      this.wait(between(4, 8));
      return;
    }
    const spot = farm.spot(job.index);
    this.facing = Math.atan2(spot.x - this.position.x, spot.z - this.position.z);
    const effect = farm.effectFor(job.index, job.action, this.id);
    const finish = () => {
      const reply = farm.act(job.action, job.index, job.choice, this.id);
      farm.release(job.index, this.id);
      this.job = null;
      if (reply && (job.action === 'harvest' || Math.random() < 0.25)) this.say(reply);
      if (reply && job.action === 'harvest' && Math.random() < CERTIFY.harvestQuiz && Math.random() < (FISHING.villagerSkill[this.kind] ?? 0.5)) this.luckyIntellect();
      this.wait(0.8 + Math.random() * 1.6);
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
    farm.animate(job.index, effect.kind, effect.duration);
    runner.start(effect, () => {
      finish();
      if (effect.then) this.effects[effect.then.kind]?.start(effect.then);
    });
  }
}
