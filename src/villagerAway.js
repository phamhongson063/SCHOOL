import { AWAY, BANK, CERTIFY, ENERGY, FISHING, FOODS, HUNTING, MIND, QUIZ, ROUTINE, VENDOR, VILLAGER, WILDLIFE } from './config.js';
import { dayOf, isOpenAt } from './clock.js';
import { certify } from './certify.js';
import { gameId } from './inventory.js';
import { energyRate, homeActivity } from './stamina.js';
import { between } from './random.js';
import { AVERAGE_CASTS } from './villagerMind.js';
import { simulate } from './villagerSchool.js';
import { SELF_STUDY } from './villagerData.js';
import { DECK_IDS } from './studyDecks.js';

const SIT = CERTIFY.sitSeconds / 60;
const VIEW = CERTIFY.viewSeconds / 60;
const CAST = MIND.castSeconds / 60;
const HUNT = MIND.huntSeconds / 60;
const FARM = MIND.workSeconds / 60;
const COOLDOWN = SELF_STUDY.cooldown / 60;
const QUIZ_MINUTES = QUIZ.seconds / 60;
const PREY = Object.entries(WILDLIFE).filter(([, animal]) => animal.gentle);
const PREY_TOTAL = PREY.reduce((sum, [, animal]) => sum + animal.count, 0);

function pickPrey() {
  let roll = Math.random() * PREY_TOTAL;
  for (const [kind, animal] of PREY) if ((roll -= animal.count) <= 0) return kind;
  return PREY[0][0];
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const hasRoom = (crew, member, cap) => crew.has(member) || crew.size < cap;

export function createAwaySim({ town, contextAt }) {
  const { farm, market, river, bank, estate } = town;
  const seatsOf = Object.fromEntries(DECK_IDS.map((deck) => [deck, town.studySeats.list.filter((seat) => seat.deck === deck).length]));
  const memos = new Map();
  let quizCarry = 0;

  function memoOf(member) {
    if (!memos.has(member.id)) memos.set(member.id, { night: null, room: null, stay: null, studyAt: -Infinity, busyUntil: -Infinity, busyAs: 'walk' });
    return memos.get(member.id);
  }

  function nightRoom(member, ctx) {
    const memo = memoOf(member);
    const night = dayOf(ctx.minutes - ROUTINE.wake);
    if (memo.night !== night) {
      const spot = memo.stay ? null : member.pickLodge(true);
      memo.night = night;
      memo.room = memo.stay ?? (spot && member.payRoom(spot.id) ? spot.id : null);
      memo.stay = null;
    }
    return memo.room;
  }

  function sleep(member, ctx, end) {
    const purse = member.purse;
    if (purse.energy < ENERGY.low && !(isOpenAt(VENDOR, ctx.minutes) && member.feast(VENDOR.foods, 'vendor').length)) member.snack();
    const house = estate.houseOf(member.id);
    if (house) memoOf(member).stay = null;
    const activity = house ? homeActivity(house) : nightRoom(member, ctx) ?? 'rest';
    purse.tickEnergy(end, energyRate(activity, true));
  }

  function lodged(member, end) {
    const memo = memoOf(member);
    if (memo.stay && member.purse.full) memo.stay = null;
    if (!memo.stay && member.wantsInn()) {
      const spot = member.pickLodge(false);
      if (spot && member.payRoom(spot.id)) memo.stay = spot.id;
    }
    if (!memo.stay) return false;
    member.purse.tickEnergy(end, energyRate(memo.stay, false));
    return true;
  }

  function eat(member, ctx) {
    if (member.purse.energy >= ENERGY.low) return;
    if (!(member.wantsFood(ctx) && member.feast(FOODS, 'cook').length)) member.snack();
  }

  function exams(member, ctx) {
    if (!member.seated) return;
    const deck = member.examDeckWanted(ctx);
    if (deck) {
      const keys = member.beginExam(deck, CERTIFY.seconds[deck] * between(0.4, 0.8));
      if (keys) certify.gradeExam(member.id, deck, simulate(member, keys));
    }
    for (const other of DECK_IDS) {
      if (!member.wantsInternal(other)) continue;
      const keys = member.beginInternal(other);
      if (keys) certify.gradeInternal(member.id, other, simulate(member, keys));
    }
  }

  function banking(member, ctx) {
    const since = member.bankAt === null ? Infinity : ctx.minutes - member.bankAt;
    if (!bank || since < BANK.npc.urgentGap) return;
    const client = member.bankClient();
    const desk = ctx.bankOpen ? bank.npcPlan(client) : null;
    const plan = desk ?? (town.atms.length ? bank.npcAtmPlan(client) : null);
    if (!plan || (!plan.urgent && since < BANK.npc.restGap)) return;
    member.bankAt = ctx.minutes;
    if (desk) bank.npcServe(client);
    else bank.npcAtmServe(client);
    member.bankRoll = Math.random();
  }

  function errands(member, ctx) {
    const purse = member.purse;
    eat(member, ctx);
    if (ctx.martOpen && member.wantsMart()) member.buySnacks();
    exams(member, ctx);
    if (town.arena?.consider(member.id)) town.arena.register(member.id);
    banking(member, ctx);
    if (ctx.shopOpen && market.wantsTrade(member)) market.trade(member);
    if (ctx.fishOpen && market.wantsFish(member)) market.fishTrade(member);
    if (ctx.chiefOpen && estate.affordableFor(member.id, purse.money - VILLAGER.houseReserve)) estate.buyFor(member.id, purse, VILLAGER.houseReserve);
  }

  function tend(member, job) {
    if (job.action === 'lease') farm.signLease(job.bed, member.id, job.offer);
    else if (member.purse.spendEnergy(ENERGY.costs[job.action] ?? 0)) member.tend(job);
    return AWAY.walk + FARM;
  }

  const canFish = (member, slots) => {
    const purse = member.purse;
    return purse.count('rod') > 0 && purse.count('bait') > 0 && purse.energy >= ENERGY.costs.fish && hasRoom(slots.anglers, member, FISHING.villagerAnglers) && river.spots.some((spot) => spot.fish > 0);
  };

  function fish(member, ctx, slots) {
    slots.anglers.add(member);
    const [lo, hi] = FISHING.villagerCasts;
    let casts = lo + Math.floor(Math.random() * (hi - lo + 1));
    let spent = AWAY.walk;
    while (casts > 0) {
      const spot = river.spots.find((item) => item.fish > 0);
      if (!spot || !member.payCast()) break;
      casts -= 1;
      spent += CAST;
      member.landFish(spot, ctx.minutes, ctx.day);
    }
    return spent;
  }

  const canHunt = (member, slots) => member.purse.energy >= HUNTING.energy + ENERGY.workMin && hasRoom(slots.hunters, member, HUNTING.villagerHunters);

  function hunt(member, slots) {
    slots.hunters.add(member);
    if (member.purse.spendEnergy(HUNTING.energy) && Math.random() < (HUNTING.villagerSkill[member.kind] ?? 0.5)) {
      member.purse.add(gameId(pickPrey()), 1);
      member.luckyIntellect();
    }
    return AWAY.walk + HUNT;
  }

  function studyDeck(member, ctx, slots) {
    if (!member.seated || ctx.minutes < memoOf(member).studyAt || member.purse.money < CERTIFY.learnFee) return null;
    const deck = member.studyDeckWanted(ctx);
    if (!deck || !certify.learnLeft(member.id, deck).length) return null;
    return slots.study.get(member) === deck || slots.seats[deck] > 0 ? deck : null;
  }

  function study(member, ctx, deck, slots) {
    if (slots.study.get(member) !== deck) {
      slots.study.set(member, deck);
      slots.seats[deck] -= 1;
    }
    if (!member.payStudy()) return AWAY.walk;
    let words = 0;
    for (let at = VIEW; at <= SIT && words < CERTIFY.sitWords && certify.learnLeft(member.id, deck).length; at += VIEW) {
      if (member.learnWord(deck)) words += 1;
    }
    if (Math.random() >= member.diligence) memoOf(member).studyAt = ctx.minutes + SIT + COOLDOWN;
    return AWAY.walk + SIT;
  }

  function choose(member, ctx, slots) {
    const need = member.moneyNeed();
    const options = [];
    const job = farm.jobFor(member, member.seedChoice());
    if (job) options.push({ kind: 'farm', as: 'walk', rate: member.farmGain(need, job) / (AWAY.walk + FARM), run: () => tend(member, job) });
    if (canFish(member, slots)) {
      const casts = Math.min(AVERAGE_CASTS, member.purse.count('bait'));
      options.push({ kind: 'fish', as: 'walk', rate: member.fishGain(need, casts) / (AWAY.walk + casts * CAST), run: () => fish(member, ctx, slots) });
    }
    if (canHunt(member, slots)) options.push({ kind: 'hunt', as: 'walk', rate: member.huntGain(need) / (AWAY.walk + HUNT), run: () => hunt(member, slots) });
    const deck = studyDeck(member, ctx, slots);
    if (deck) options.push({ kind: 'study', as: 'study', rate: member.studyGain(need, SIT) / (AWAY.walk + SIT), run: () => study(member, ctx, deck, slots) });
    const floor = ctx.night ? 0 : MIND.leisureValue;
    let best = null;
    for (const option of options) {
      if (!(option.rate > 0)) continue;
      option.score = option.rate * member.tasteFor(option.kind) * between(...MIND.noise);
      if (option.score > floor && (!best || option.score > best.score)) best = option;
    }
    return best;
  }

  function work(member, ctx, minutes, slots) {
    const memo = memoOf(member);
    const end = ctx.minutes + minutes;
    const used = { walk: 0, study: 0 };
    if (memo.busyUntil > ctx.minutes) used[memo.busyAs] += Math.min(memo.busyUntil, end) - ctx.minutes;
    let clock = Math.max(ctx.minutes, memo.busyUntil);
    while (clock < end && member.purse.energy >= ENERGY.workMin) {
      const option = choose(member, ctx, slots);
      if (!option) break;
      const spent = option.run();
      used[option.as] += Math.min(spent, end - clock);
      clock += spent;
      memo.busyAs = option.as;
    }
    memo.busyUntil = clock;
    return used;
  }

  function drain(member, ctx, end, minutes, used) {
    const idle = Math.max(0, minutes - used.walk - used.study);
    const total = used.walk + used.study + idle;
    const rate = (energyRate('walk', ctx.night) * used.walk + energyRate('study', ctx.night) * used.study + energyRate('idle', ctx.night) * idle) / total;
    member.purse.tickEnergy(end, rate);
  }

  function live(member, ctx, minutes, slots) {
    const end = ctx.minutes + minutes;
    if (memoOf(member).busyUntil < end) {
      if (ctx.night && member.needsSleep(ctx)) return sleep(member, ctx, end);
      if (!ctx.night) {
        errands(member, ctx);
        if (lodged(member, end)) return;
      }
      if (member.purse.energy < ENERGY.workMin) return member.purse.tickEnergy(end, energyRate('rest', ctx.night));
    }
    const used = work(member, ctx, minutes, slots);
    if (ctx.night && !used.walk && !used.study) return sleep(member, ctx, end);
    drain(member, ctx, end, minutes, used);
  }

  return {
    during(run) {
      const before = town.context;
      try {
        return farm.quietly(run);
      } finally {
        town.context = before;
      }
    },
    step(from, to) {
      const minutes = to - from;
      if (!(minutes > 0)) return;
      const ctx = contextAt(from);
      town.context = ctx;
      town.arena?.tick(from);
      farm.grow();
      river.restock(from);
      const slots = { anglers: new Set(), hunters: new Set(), study: new Map(), seats: { ...seatsOf } };
      for (const member of shuffled(town.members)) live(member, ctx, minutes, slots);
      quizCarry += minutes;
      while (quizCarry >= QUIZ_MINUTES) {
        quizCarry -= QUIZ_MINUTES;
        town.quizRound();
      }
    },
  };
}
