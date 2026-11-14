import { between } from './random.js';
import { BLESSING, CROP_ECONOMY, ENERGY, FISH, FISHING, HUNTING, MIND, MOVE, CERTIFY, SHOP, WILDLIFE } from './config.js';
import { certify } from './certify.js';
import { absorption } from './absorption.js';
import { minuteOfDay } from './clock.js';
import { averageYield } from './market.js';
import { SELF_STUDY } from './villagerData.js';

const KINDS = ['farm', 'fish', 'hunt', 'study', 'blessing'];

const weighted = (entries) => {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return entries.reduce((sum, [price, weight]) => sum + price * weight, 0) / total;
};

const HARVEST_VALUE = Object.keys(CROP_ECONOMY).reduce((sum, crop) => sum + averageYield(crop) * CROP_ECONOMY[crop].price, 0) / Object.keys(CROP_ECONOMY).length;
const FISH_VALUE = weighted(Object.values(FISH).map((fish) => [fish.price, fish.weight]));
const GAME_VALUE = weighted(Object.values(WILDLIFE).filter((animal) => animal.gentle).map((animal) => [animal.price, animal.count]));
const BAIT_PER_CAST = FISHING.baitPack / FISHING.baitPerPack;
export const AVERAGE_CASTS = (FISHING.villagerCasts[0] + FISHING.villagerCasts[1]) / 2;
const BLESSING_ASK_SECONDS = BLESSING.quizSeconds + (FISHING.villagerAnswer[0] + FISHING.villagerAnswer[1]) / 2;
export const BLESSING_STAY = (BLESSING.villagerStay[0] + BLESSING.villagerStay[1]) / 2 / 60;

function blessingMinutesLeft(minutes) {
  const m = minuteOfDay(minutes);
  const window = BLESSING.windows.find(([start, end]) => m >= start && m < end);
  return window ? window[1] - m : 0;
}

export class MindBehavior {
  tasteFor(kind) {
    if (!this.taste) {
      this.taste = Object.fromEntries(KINDS.map((name) => [name, between(...MIND.taste)]));
      if (this.kind === 'farmer') this.taste.farm += MIND.farmerFarmTaste;
    }
    return this.taste[kind] ?? 1;
  }

  moneyNeed() {
    const net = this.purse.money - this.debt();
    return MIND.comfortMoney / Math.max(MIND.comfortMoney * MIND.debtFloor, MIND.comfortMoney + net);
  }

  walkMinutes(point) {
    return Math.hypot(point.x - this.position.x, point.z - this.position.z) / MOVE.walk / 60;
  }

  farmGain(need, job) {
    const action = job.action === 'clear' && this.town.farm.ownerOf(job.index) !== this.id ? 'clearOther' : job.action;
    const share = MIND.harvestShare[action] ?? MIND.harvestShare.clear;
    const supplies = job.action === 'fertilize' ? SHOP.fertilizer : 0;
    return (HARVEST_VALUE * share - supplies) * need - (ENERGY.costs[job.action] ?? 0) * MIND.energyCoin;
  }

  fishGain(need, casts) {
    const skill = FISHING.villagerSkill[this.kind] ?? 0.5;
    return casts * ((skill * FISH_VALUE - BAIT_PER_CAST) * need - ENERGY.costs.fish * MIND.energyCoin);
  }

  huntGain(need) {
    const skill = HUNTING.villagerSkill[this.kind] ?? 0.5;
    return skill * GAME_VALUE * need - HUNTING.energy * MIND.energyCoin;
  }

  studyGain(need, sit) {
    return MIND.studyValue * this.diligence * sit - CERTIFY.learnFee * need;
  }

  reviewGain(need, sit, deck) {
    const fresh = this.studiedToday() ? 0 : MIND.reviewValue * sit;
    const weak = certify.reviewQuestions(this.id, deck).length * MIND.weakValue;
    return (fresh + weak) * this.diligence - CERTIFY.reviewFee * need;
  }

  answerOdds() {
    const keys = certify.pool(this.id);
    if (!keys.length) return 0;
    return keys.reduce((sum, key) => sum + absorption.chance(this.id, key), 0) / keys.length;
  }

  blessingGain(need, stay) {
    const correct = (this.answerOdds() * stay * 60) / BLESSING_ASK_SECONDS;
    return (correct / CERTIFY.blessingCoinPer) * need + (correct / CERTIFY.blessingIntellectPer) * MIND.intellectValue * this.diligence;
  }

  blessingOption(ctx, need) {
    const blessing = this.town.blessing;
    if (!blessing?.active(ctx.minutes) || blessing.member(this.id, ctx.minutes)) return null;
    const walk = this.walkMinutes(blessing.official.at);
    const stay = Math.min(blessingMinutesLeft(ctx.minutes) - walk, BLESSING_STAY);
    if (stay <= 0) return null;
    return { kind: 'blessing', rate: this.blessingGain(need, stay) / (walk + stay), go: () => this.goBlessing() };
  }

  farmOption(need) {
    const job = this.town.farm.jobFor(this, this.seedChoice());
    if (!job) return null;
    const spot = job.stand ?? this.town.farm.spot(job.index);
    const gain = this.farmGain(need, job);
    const minutes = this.walkMinutes(spot) + MIND.workSeconds / 60;
    return { kind: 'farm', rate: gain / minutes, go: () => this.goFarm(() => this.leisure(), job) };
  }

  fishOption(need) {
    if (!this.canFish()) return null;
    const river = this.town.river;
    const berth = river.pick(this.position, this);
    if (!berth) return null;
    const casts = Math.min(AVERAGE_CASTS, berth.spot.fish, this.purse.count('bait'));
    const gain = this.fishGain(need, casts);
    const minutes = this.walkMinutes(berth.stand) + (casts * MIND.castSeconds) / 60;
    const crowd = 1 - MIND.crowdCut * (river.anglers / FISHING.villagerAnglers);
    return { kind: 'fish', rate: (gain / minutes) * crowd, go: () => this.goFish() || this.leisure() };
  }

  huntOption(need) {
    const wildlife = this.town.wildlife;
    if (!this.canHunt()) return null;
    const prey = wildlife.nearestPrey(this.position);
    if (!prey) return null;
    const gain = this.huntGain(need);
    const minutes = this.walkMinutes(prey) + MIND.huntSeconds / 60;
    const crowd = 1 - MIND.crowdCut * (wildlife.hunters / HUNTING.villagerHunters);
    return { kind: 'hunt', rate: (gain / minutes) * crowd, go: () => this.goHunt() || this.leisure() };
  }

  studyOption(ctx, need) {
    if (!this.seated || this.now < this.studyRestAt || this.purse.money < CERTIFY.learnFee) return null;
    const deck = this.studyDeckWanted(ctx);
    if (!deck) return null;
    if (!ctx.night && this.wantsInternal(deck)) {
      const queue = this.town.queues[`teacher:${deck}`];
      const minutes = this.walkMinutes(queue.line[0]) + (MIND.queueSeconds * (queue.members.length + 1)) / 60;
      const gain = MIND.internalValue * this.diligence - CERTIFY.internalFee * need;
      return { kind: 'study', rate: gain / minutes, go: () => this.goInternal(deck) };
    }
    if (!certify.learnLeft(this.id, deck).length) return null;
    const seat = this.studySeatFor(deck);
    const waiting = !seat && this.canWaitForSeat(deck);
    if (!seat && !waiting) return null;
    const sit = CERTIFY.sitSeconds / 60;
    const target = seat ? seat.spot : this.town.seatWait.look(deck);
    const minutes = this.walkMinutes(target) + sit + (waiting ? SELF_STUDY.waitMax / 60 : 0);
    const gain = this.studyGain(need, sit);
    const crowd = 1 - MIND.crowdCut * (1 - this.hallRoom(deck));
    return { kind: 'study', rate: (gain / minutes) * crowd, go: () => this.goSelfStudy(deck) };
  }

  reviewOption(ctx, need) {
    if (!this.seated || this.now < this.studyRestAt) return null;
    const deck = this.reviewDeckWanted(ctx);
    const seat = deck && this.studySeatFor(deck, CERTIFY.reviewFee);
    if (!seat) return null;
    const sit = CERTIFY.sitSeconds / 60;
    const crowd = 1 - MIND.crowdCut * (1 - this.hallRoom(deck));
    return { kind: 'study', rate: (this.reviewGain(need, sit, deck) / (this.walkMinutes(seat.spot) + sit)) * crowd, go: () => this.goReview(deck) };
  }

  plan(ctx) {
    const need = this.moneyNeed();
    const options = [this.farmOption(need), this.fishOption(need), this.huntOption(need), this.studyOption(ctx, need), this.reviewOption(ctx, need), this.blessingOption(ctx, need)];
    const floor = ctx.night ? 0 : MIND.leisureValue;
    let best = null;
    for (const option of options) {
      if (!option || !(option.rate > 0)) continue;
      const stick = option.kind === this.lastPlan && this.now - this.lastPlanAt < MIND.stickSeconds ? MIND.stick : 1;
      option.score = option.rate * this.tasteFor(option.kind) * stick * between(...MIND.noise);
      if (option.score > floor && (!best || option.score > best.score)) best = option;
    }
    return best;
  }

  follow(option) {
    this.lastPlan = option.kind;
    this.lastPlanAt = this.now;
    option.go();
  }
}
