import { between } from './random.js';
import { VILLAGER, ENERGY, EATERY, FOODS, ECONOMY, VENDOR, MART, SNACKS, BLESSING, FISHING, CERTIFY, MIND } from './config.js';
import { certify } from './certify.js';
import { ITEMS, snackId } from './inventory.js';
import { book, isFree, leaveRoom, roomTier } from './lodging.js';
import { activityOf, energyRate, homeActivity, moodOf, nextShift } from './stamina.js';
import { REST_TIME } from './walk.js';
import { inStudyRoom } from './rooms.js';
import { economy } from './economy.js';

const VENDOR_TRIES = 2;
const OFFICIAL_ATTEND = 3;

export class RestBehavior {
  wantsBlessing(ctx) {
    const blessing = this.town.blessing;
    if (!blessing?.active(ctx.minutes) || blessing.member(this.id, ctx.minutes)) return false;
    const session = blessing.session(ctx.minutes);
    if (this.blessingSession !== session) {
      this.blessingSession = session;
      this.blessingWish = Math.random() < BLESSING.villagerChance;
    }
    return this.blessingWish || this.purse.energy < ENERGY.workMin;
  }

  goBlessing() {
    const blessing = this.town.blessing;
    this.blessingWish = false;
    this.task = 'blessing';
    this.lookAt = null;
    this.travel(blessing.standFor(), {
      then: () => {
        if (!blessing.join(this.id, this.town.context.minutes)) return this.think();
        this.lookAt = blessing.official.at;
        blessing.official.attend(this, OFFICIAL_ATTEND);
        this.wait(between(1.5, 2.5), () => this.startBlessingTest());
      },
      fail: () => this.think(),
    });
  }

  startBlessingTest() {
    const blessing = this.town.blessing;
    this.lookAt = null;
    this.travel(blessing.altarFor(), {
      then: () => {
        if (!blessing.startTest(this.id, this.town.context.minutes)) return this.think();
        this.lookAt = blessing.statueAt;
        this.wait(between(1, 2), () => this.stayBlessed());
      },
      fail: () => this.think(),
    });
  }

  stayBlessed() {
    const blessing = this.town.blessing;
    this.lookAt = null;
    const settle = () => {
      if (!blessing.member(this.id, this.town.context.minutes)) return this.think();
      if (this.purse.energy < VILLAGER.restUntil) return this.lieDown();
      this.lookAt = blessing.statueAt;
      this.wait(between(...BLESSING.villagerStay), () => this.think());
    };
    this.travel(blessing.stayPoint(), { then: settle, fail: settle });
  }

  goRest(tries = 0) {
    this.task = 'rest';
    this.lookAt = null;
    const settle = () => {
      if (!this.town.restBlocked(this.position)) this.lieDown();
      else if (tries < 3) this.goRest(tries + 1);
      else this.wait(between(2, 4), () => this.think());
    };
    this.travel(this.town.fieldEdgePoint(), {
      speed: this.walkSpeed,
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

  homeSleep() {
    return homeActivity(this.town.estate.houseOf(this.id));
  }

  activityNow(ctx) {
    if (this.state === 'away') return ctx.night ? this.homeSleep() : 'idle';
    if (this.state === 'inn') return this.lodge?.id ?? 'inn';
    if (this.state === 'resting') return this.lyingDown ? (inStudyRoom(this.position) ? 'studyRest' : 'rest') : 'idle';
    if (this.state === 'seated' && this.studying && (this.town.context.phase.kind === 'period' || this.task === 'selfstudy' || this.task === 'exam')) return 'study';
    if (this.state === 'seated' || this.state === 'teaching') return 'seated';
    return activityOf(this.velocity, this.walkSpeed, this.runSpeed);
  }

  tickEnergy(ctx) {
    const activity = this.activityNow(ctx);
    const stay = this.state === 'inn' ? activity : null;
    const blessed = this.town.blessing?.blessed(this.id, this.position, ctx.minutes) ?? false;
    this.purse.liveEnergy(ctx.minutes, activity, stay ?? this.homeSleep(), stay ?? 'idle', blessed ? BLESSING.recovery : 1);
    this.blessingQuiz(blessed);
    this.tired = this.purse.energy <= 0;
    if (this.purse.energy < ENERGY.low && !this.canEat(ctx)) this.snack();
    const mood = moodOf(this.purse.energy);
    this.bubble.setMood(mood);
    this.seatBubble?.setMood(mood);
  }

  settleBlessing() {
    const tally = this.blessingTally;
    if (!tally || this.town.blessing?.session(this.town.context.minutes) === tally.session) return;
    this.blessingTally = null;
    const money = Math.floor(tally.correct / CERTIFY.blessingCoinPer);
    const intellect = Math.floor(tally.correct / CERTIFY.blessingIntellectPer);
    if (money > 0) economy.reward(this.purse, money);
    if (intellect > 0) this.purse.addIntellect(intellect);
  }

  blessingQuiz(blessed) {
    this.settleBlessing();
    if (!blessed || !this.town.blessing.testing(this.id, this.town.context.minutes)) {
      this.blessingAsk = null;
      return;
    }
    const ask = (this.blessingAsk ??= { at: this.now + BLESSING.firstQuiz, answerAt: null });
    if (ask.answerAt === null) {
      if (this.now < ask.at || !certify.pool(this.id).length) return;
      const thinking = between(...FISHING.villagerAnswer);
      ask.answerAt = this.now + thinking;
      this.say('🤔', thinking);
      return;
    }
    if (this.now < ask.answerAt) return;
    ask.answerAt = null;
    ask.at = this.now + BLESSING.quizSeconds;
    if (Math.random() >= (FISHING.villagerSkill[this.kind] ?? 0.5)) return;
    const session = this.town.blessing.session(this.town.context.minutes);
    if (this.blessingTally?.session !== session) this.blessingTally = { session, correct: 0 };
    this.blessingTally.correct += 1;
    this.say('✓', 1.2);
  }

  debt() {
    return this.town.bank?.debt(this.id) ?? 0;
  }

  frugal() {
    if (this.debt() > 0) return true;
    const flow = economy.dailyFlow(this.id);
    return !!flow && flow.spent > flow.earn && this.purse.money < MIND.comfortMoney;
  }

  wantsFood(ctx) {
    if (this.purse.energy >= ENERGY.low || ctx.minute < EATERY.open || ctx.minute >= EATERY.close) return false;
    return Object.values(FOODS).some((food) => food.price <= this.purse.money);
  }

  wantsInn() {
    return this.innGoer && this.purse.energy < ENERGY.low && !this.frugal() && !!this.pickLodge(false);
  }

  pickLodge(allowGround = true) {
    const money = this.purse.money;
    const options = [];
    const spots = this.frugal() ? [] : this.town.lodgeSpots;
    for (const spot of spots) {
      const lodge = roomTier(spot.id);
      if (lodge.price * VILLAGER.lodgeNights > money || !isFree(spot.id, this)) continue;
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
    const rent = roomTier(spot.id).price;
    if (!this.purse.spend(rent)) {
      leaveRoom(this);
      this.say('Hết tiền thuê phòng rồi...', 2);
      if (this.town.context.night) this.sleepOut();
      else this.wait(between(1.5, 3));
      return;
    }
    economy.collect(rent * ECONOMY.vat, this.id, rent);
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

  needsSleep(ctx) {
    if (!ctx.night) return false;
    const energy = this.purse.energy;
    if (energy < ENERGY.low) return true;
    const left = Math.max(0, nextShift(ctx.minutes) - ctx.minutes) / 60;
    const awake = Math.min(VILLAGER.nightAwakeHours, left);
    const morning = energy - ENERGY.drain.walk * ENERGY.nightFactor * awake - energyRate(this.homeSleep(), true) * (left - awake);
    return Math.min(ENERGY.max, morning) < VILLAGER.morningEnergy;
  }

  wantsSleep(ctx) {
    if (!ctx.night) return false;
    return this.needsSleep(ctx) || !this.plan(ctx);
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
    const eaten = this.feast(FOODS, 'cook');
    this.say(eaten.length ? `Ăn ${eaten.join('')} no bụng rồi!` : 'Hết tiền ăn rồi...', 2.2);
    this.wait(between(2, 4), () => this.finishService());
  }

  feast(foods, seller) {
    const purse = this.purse;
    const eaten = [];
    const frugal = this.frugal();
    const full = ENERGY.max * (frugal ? VILLAGER.frugalFull : 0.8);
    const order = frugal ? (a, b) => a.price / a.energy - b.price / b.energy : (a, b) => b.energy - a.energy;
    for (const food of Object.values(foods).sort(order)) {
      while (purse.energy < full && purse.energy + food.energy <= ENERGY.max + 5 && purse.spend(food.price)) {
        economy.income(seller, food.price, this.id);
        purse.addEnergy(food.energy);
        eaten.push(food.icon);
      }
    }
    return eaten;
  }

  vendorGap() {
    const vendor = this.town.vendor;
    return Math.hypot(vendor.position.x - this.position.x, vendor.position.z - this.position.z);
  }

  vendorOut() {
    const vendor = this.town.vendor;
    return !vendor || vendor.state === 'away' || vendor.task === 'home';
  }

  snack() {
    const purse = this.purse;
    const energyOf = ([item]) => SNACKS[ITEMS[item].snack].energy;
    const [item] = purse.entries('snack').sort((a, b) => energyOf(a) - energyOf(b))[0] ?? [];
    if (item && purse.take(item, 1)) purse.addEnergy(SNACKS[ITEMS[item].snack].energy);
  }

  nearestMart() {
    const stands = this.town.martStands ?? [];
    return stands.reduce((best, stand) => (!best || Math.hypot(stand.x - this.position.x, stand.z - this.position.z) < Math.hypot(best.x - this.position.x, best.z - this.position.z) ? stand : best), null);
  }

  wantsMart() {
    return !!this.nearestMart() && this.purse.total('snack') === 0 && this.purse.money >= MART.reserve && Math.random() < MART.chance && !this.frugal();
  }

  goMart() {
    this.cancel();
    this.task = 'shop';
    const buy = () => {
      const [id, snack] = Object.entries(SNACKS).sort((a, b) => a[1].price - b[1].price)[0];
      if (!this.town.context.martOpen) this.say('Siêu thị đóng cửa mất rồi!', 1.8);
      else if (this.town.market.buy(this.purse, snackId(id), MART.stock)) this.say(`Mua ${MART.stock} gói ${snack.icon} để dành`, 2.2);
      this.wait(between(1.5, 3), () => this.think());
    };
    this.travel(this.nearestMart(), { then: buy, fail: () => this.think() });
  }

  canEat(ctx) {
    return this.wantsVendor() || this.wantsFood(ctx);
  }

  goMeal(ctx) {
    if (this.wantsVendor()) this.goVendor();
    else if (this.wantsFood(ctx)) this.goEat();
    else return false;
    return true;
  }

  wantsVendor() {
    if (this === this.town.vendor || this.purse.energy >= ENERGY.low || this.vendorOut() || this.vendorGap() > VENDOR.lure) return false;
    return Object.values(VENDOR.foods).some((food) => food.price <= this.purse.money);
  }

  goVendor(tries = 0) {
    this.cancel();
    this.task = 'eat';
    const vendor = this.town.vendor;
    vendor.hold(VENDOR.hold, this.position);
    const dx = this.position.x - vendor.position.x;
    const dz = this.position.z - vendor.position.z;
    const keep = VENDOR.chat / Math.max(this.vendorGap(), 0.01);
    const stand = this.town.walkable({ x: vendor.position.x + dx * keep, z: vendor.position.z + dz * keep });
    const buy = () => this.buyFromVendor(tries);
    this.travel(stand, { then: buy, fail: buy });
  }

  buyFromVendor(tries) {
    if (this.vendorOut() || this.vendorGap() > VENDOR.reach) {
      if (tries < VENDOR_TRIES && this.wantsVendor()) this.goVendor(tries + 1);
      else this.think();
      return;
    }
    const vendor = this.town.vendor;
    vendor.hold(VENDOR.hold, this.position);
    this.lookAt = vendor.position;
    const eaten = this.feast(VENDOR.foods, 'vendor');
    this.say(eaten.length ? `Ăn ${eaten.join('')} ngon quá!` : 'Hết tiền ăn rồi...', 2.2);
    this.wait(between(2, 4), () => this.think());
  }
}
