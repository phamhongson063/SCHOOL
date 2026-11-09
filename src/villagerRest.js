import { between } from './random.js';
import { VILLAGER, ENERGY, EATERY, FOODS } from './config.js';
import { book, isFree, leaveRoom, roomTier } from './lodging.js';
import { activityOf } from './stamina.js';
import { REST_TIME } from './walk.js';

export class RestBehavior {
  goRest(tries = 0) {
    this.task = 'rest';
    this.lookAt = null;
    const settle = () => {
      if (!this.town.restBlocked(this.position)) this.lieDown();
      else if (tries < 3) this.goRest(tries + 1);
      else this.wait(between(2, 4), () => this.think());
    };
    this.travel(this.town.fieldEdgePoint(), {
      speed: this.walkSpeed * 0.8,
      then: settle,
      fail: settle,
    });
  }

  lieDown(out = false) {
    this.task = 'rest';
    this.route = null;
    this.velocity = 0;
    this.state = 'resting';
    this.lyingDown = true;
    this.sleepingOut = out;
    this.say(out ? 'Ngủ tạm ngoài này vậy...' : 'Mệt quá, nằm nghỉ chút...', 2);
  }

  restUpdate(dt) {
    this.velocity = 0;
    const ctx = this.town.context;
    if (this.lyingDown && (this.sleepingOut ? !ctx.night : ctx.night || this.purse.energy >= VILLAGER.restUntil)) {
      this.lyingDown = false;
      this.sleepingOut = false;
      this.bed = null;
    }
    this.restBlend = Math.min(1, Math.max(0, this.restBlend + (this.lyingDown ? dt : -dt) / REST_TIME));
    if (this.lyingDown || this.restBlend > 0) return;
    this.state = 'idle';
    this.timer = 0;
    this.afterWait = null;
    this.think();
  }

  activityNow(ctx) {
    if (this.state === 'away') return ctx.night ? 'sleep' : 'idle';
    if (this.state === 'inn') return this.lodge?.id ?? 'inn';
    if (this.state === 'resting') return this.lyingDown ? 'rest' : 'idle';
    if (this.state === 'seated' && this.studying && (this.town.context.phase.kind === 'period' || this.task === 'selfstudy')) return 'study';
    if (this.state === 'seated' || this.state === 'teaching') return 'seated';
    return activityOf(this.velocity, this.walkSpeed, this.runSpeed);
  }

  tickEnergy(ctx) {
    const activity = this.activityNow(ctx);
    const stay = this.state === 'inn' ? activity : null;
    this.purse.liveEnergy(ctx.minutes, activity, stay ?? 'sleep', stay ?? 'idle');
    this.tired = this.purse.energy <= 0;
  }

  wantsFood(ctx) {
    if (this.purse.energy >= ENERGY.low || ctx.minute < EATERY.open || ctx.minute >= EATERY.close) return false;
    return Object.values(FOODS).some((food) => food.price <= this.purse.money);
  }

  wantsInn() {
    return this.innGoer && this.purse.energy < ENERGY.low && !!this.pickLodge(false);
  }

  pickLodge(allowGround = true) {
    const money = this.purse.money;
    const options = [];
    for (const spot of this.town.lodgeSpots) {
      const lodge = roomTier(spot.id);
      if (lodge.price > money || !isFree(spot.id, this)) continue;
      const taste = 1 - Math.abs(this.comfort - lodge.comfort);
      const budget = Math.min(3, money / lodge.price);
      const near = 1 / (1 + Math.hypot(spot.stand.x - this.position.x, spot.stand.z - this.position.z) / 40);
      options.push({ spot, weight: taste * taste * budget * near });
    }
    if (allowGround) options.push({ spot: null, weight: options.length ? this.thrift * 0.5 : 1 });
    const total = options.reduce((sum, option) => sum + option.weight, 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const option of options) {
      roll -= option.weight;
      if (roll <= 0) return option.spot;
    }
    return options[options.length - 1].spot;
  }

  goInn() {
    const spot = this.pickLodge(false);
    if (!spot) return this.wait(between(1, 2));
    this.goLodge(spot);
  }

  goLodge(spot) {
    this.cancel();
    if (!book(spot.id, this)) {
      if (this.town.context.night) this.sleepOut();
      else this.wait(between(1, 2));
      return;
    }
    this.task = 'inn';
    this.travel(spot.stand, {
      then: () => this.checkIn(spot),
      fail: () => (this.town.context.night ? this.sleepOut() : this.wait(between(2, 4))),
    });
  }

  checkIn(spot) {
    if (!isFree(spot.id, this)) {
      this.say('Phòng có người rồi...', 1.8);
      if (this.town.context.night) this.goNight();
      else this.wait(between(1.5, 3));
      return;
    }
    if (!this.purse.spend(roomTier(spot.id).price)) {
      leaveRoom(this);
      this.say('Hết tiền thuê phòng rồi...', 2);
      if (this.town.context.night) this.sleepOut();
      else this.wait(between(1.5, 3));
      return;
    }
    this.cancel();
    book(spot.id, this);
    this.task = 'inn';
    this.lodge = spot;
    this.lodgeNight = this.town.context.night;
    this.route = null;
    this.velocity = 0;
    this.state = 'inn';
    this.setVisible(false);
  }

  leaveInn() {
    leaveRoom(this);
    const stand = (this.lodge ?? this.town.lodgeSpots[0]).stand;
    this.lodge = null;
    this.lodgeNight = false;
    this.task = null;
    this.position.set(stand.x, this.town.nav.heightAt(stand.x, stand.z) ?? 0, stand.z);
    this.facing = 0;
    this.velocity = 0;
    this.pop = 0.25;
    this.setVisible(true);
    this.wait(between(0.6, 1.5));
    this.say('Khoẻ re rồi!', 1.8);
  }

  goNight() {
    const spot = this.pickLodge(true);
    if (spot) this.goLodge(spot);
    else this.sleepOut();
  }

  sleepOut() {
    this.cancel();
    this.task = 'home';
    const lie = () => this.lieDown(true);
    this.travel(this.town.bedPoint(this.position, this), { then: lie, fail: lie });
  }

  settleNight() {
    if (this.town.estate.houseOf(this.id)) {
      this.vanish();
      return;
    }
    const spot = this.pickLodge(true);
    const at = spot ? spot.stand : this.town.bedPoint(this.homePoint(), this);
    this.position.set(at.x, this.town.nav.heightAt(at.x, at.z) ?? 0, at.z);
    if (spot) {
      this.checkIn(spot);
      return;
    }
    this.setVisible(true);
    this.lieDown(true);
  }

  goEat() {
    this.cancel();
    this.task = 'eat';
    this.lineUp(this.town.queues.eatery, () => this.eat());
  }

  eat() {
    const ctx = this.town.context;
    const purse = this.purse;
    if (ctx.minute < EATERY.open || ctx.minute >= EATERY.close) {
      this.say('Quán đóng cửa mất rồi!');
      this.wait(1.5, () => this.finishService());
      return;
    }
    const menu = Object.values(FOODS).sort((a, b) => b.energy - a.energy);
    const eaten = [];
    for (const food of menu) {
      while (purse.energy < ENERGY.max * 0.8 && purse.energy + food.energy <= ENERGY.max + 5 && purse.spend(food.price)) {
        purse.addEnergy(food.energy);
        eaten.push(food.icon);
      }
    }
    this.say(eaten.length ? `Ăn ${eaten.join('')} no bụng rồi!` : 'Hết tiền ăn rồi...', 2.2);
    this.wait(between(2, 4), () => this.finishService());
  }
}
