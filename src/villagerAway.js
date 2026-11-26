import { AWAY, BANK, BLESSING, CERTIFY, FIREWORKS, LOTO, ENERGY, FIREFLY, FISHING, FOODS, HUNTING, MIND, MOVE, QUIZ, SELF_STUDY, TRAINING, VENDOR, VILLAGER, WILDLIFE } from './config.js';
import { DAY_MINUTES, dayOf, isOpenAt } from './clock.js';
import { certify } from './certify.js';
import { gameId } from './inventory.js';
import { energyRate, homeActivity } from './stamina.js';
import { between } from './random.js';
import { AVERAGE_CASTS, BLESSING_STAY, blessingStayMinutes } from './villagerMind.js';
import { blessingSlots, economy } from './economy.js';
import { simulateExam, simulateInternal } from './villagerSchool.js';
import { DECK_IDS } from './studyDecks.js';
import { NPC } from './npcIds.js';
import { traits } from './traits.js';
import { quests } from './quests.js';
import { nearestFlyGap, passingCatch } from './fireflyRules.js';
import { answerOf, landedAt, lanternSeconds, lanternTry, lanternWorth } from './lanterns.js';
import { book, leaveRoom, lodgeNightOf } from './lodging.js';
import { applySpeech, planSpeech } from './speaking.js';
import { lotoEnd, lotoGatherAt, lotoMinutes, lotoSignOpen } from './lotoRules.js';
import { fireworksSignOpen, fireworksStayMinutes, fireworksWindow } from './fireworksSchedule.js';
import { payTraining, trainingAnswers, trainingIntellect } from './training.js';
import { advancePatrol, patrolEnergyRate } from './patrol.js';

const SIT = CERTIFY.sitSeconds / 60;
const VIEW = CERTIFY.viewSeconds / 60;
const CAST = MIND.castSeconds / 60;
const HUNT = MIND.huntSeconds / 60;
const FARM = MIND.workSeconds / 60;
const SWAT = FIREFLY.villagerSwat / 60;
const COOLDOWN = SELF_STUDY.cooldown / 60;
const QUIZ_MINUTES = QUIZ.seconds / 60;
const INTERNAL_TRIP = AWAY.walk + MIND.queueSeconds / 60;
const examPace = (deck) => CERTIFY.seconds[deck] * between(0.4, 0.8);
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

function blessingWindow(from, to) {
  for (const day of [dayOf(from) - 1, dayOf(from)]) {
    for (const { index, start, end } of blessingSlots(day)) {
      const open = day * DAY_MINUTES + start;
      const close = day * DAY_MINUTES + end;
      if (open < to && close > from) return { session: `${day}:${index}`, open, close };
    }
  }
  return null;
}

function blessingAnswers(member, minutes) {
  let left = minutes * 60 - BLESSING.firstQuiz;
  let correct = 0;
  let wrong = 0;
  while (left > 0 && certify.pool(member.id).length) {
    left -= Math.max(BLESSING.answerLock, between(...BLESSING.villagerAnswer));
    if (left < 0) break;
    if (member.answerPool()) correct += 1;
    else wrong += 1;
    left -= BLESSING.quizSeconds;
  }
  return { correct, wrong };
}

export function createAwaySim({ town, contextAt }) {
  const { farm, market, river, bank, estate } = town;
  const seatsOf = Object.fromEntries(DECK_IDS.map((deck) => [deck, town.studySeats.list.filter((seat) => seat.deck === deck).length]));
  const examSeats = town.seats.list.map(() => []);
  const internalSeats = Object.fromEntries(DECK_IDS.map((deck) => [deck, town.internalSeats.list.filter((seat) => seat.deck === deck).map(() => [])]));
  const allSeats = () => [examSeats, ...Object.values(internalSeats)].flat();
  const memos = new Map();
  let quizCarry = 0;

  function savedEntry(member, create = false) {
    if (create && (!town.saved || typeof town.saved !== 'object')) town.saved = {};
    if (create && !Array.isArray(town.saved.members)) town.saved.members = [];
    const entries = Array.isArray(town.saved?.members) ? town.saved.members : [];
    let entry = entries.find((item) => item?.id === member.id) ?? null;
    if (!entry && create) {
      entry = { id: member.id };
      entries.push(entry);
    }
    return entry;
  }

  function keepLanternJob(member, job) {
    if (town.started) return;
    const entry = savedEntry(member, Boolean(job));
    if (!entry) return;
    if (job) {
      entry.lantern = job;
      town.lanterns?.claim(member.id, job.id);
    } else {
      delete entry.lantern;
      town.lanterns?.release(member.id);
    }
  }

  function savedLanternJob(member) {
    const job = town.started ? null : savedEntry(member)?.lantern;
    if (!job || !Number.isInteger(job.id) || !Number.isFinite(job.at)) return null;
    return { id: job.id, at: job.at, correct: typeof job.correct === 'boolean' ? job.correct : null };
  }

  function keepInn(member, stay) {
    if (town.started) return;
    const entry = savedEntry(member, Boolean(stay));
    if (!entry) return;
    if (stay) entry.inn = stay;
    else delete entry.inn;
  }

  function lodgeIn(member, room) {
    if (room) book(room, member);
    else leaveRoom(member);
  }

  function seedInn(member, memo, stay) {
    if (!stay || town.started) return;
    if (Number.isInteger(stay.night) && (typeof stay.room === 'string' || stay.room === null)) {
      memo.night = stay.night;
      memo.room = stay.room;
    } else if (stay.night === null && typeof stay.room === 'string') memo.stay = stay.room;
    lodgeIn(member, memo.stay ?? memo.room);
  }

  function seedStudy(memo, study) {
    const from = town.saved?.minutes;
    if (town.started || !(study?.left > 0) || !Number.isFinite(from)) return;
    const until = from + study.left / 60;
    if (until <= memo.busyUntil) return;
    occupy(memo, -Infinity, until, 'study');
  }

  function occupy(memo, from, to, as) {
    const start = Math.max(from, memo.busyUntil);
    if (to > start) memo.busy.push({ from: start, to, as });
    memo.busyUntil = Math.max(memo.busyUntil, to);
  }

  function busyTime(memo, from, end, used) {
    for (const part of memo.busy) used[part.as] += Math.max(0, Math.min(part.to, end) - Math.max(part.from, from));
    memo.busy = memo.busy.filter((part) => part.to > end);
  }

  const seatFree = (bookings, from, to) => bookings.every(([start, stop]) => stop <= from || start >= to);

  function earliestSeat(seats, from, length) {
    const times = [from, ...seats.flat().map(([, stop]) => stop).filter((stop) => stop > from)].sort((a, b) => a - b);
    for (const at of times) {
      const seat = seats.find((bookings) => seatFree(bookings, at, at + length));
      if (seat) return { seat, at };
    }
    return null;
  }

  function memoOf(member) {
    if (!memos.has(member.id)) {
      const memo = { night: null, room: null, stay: null, studyAt: -Infinity, busyUntil: -Infinity, busy: [], lantern: savedLanternJob(member) };
      if (memo.lantern) {
        occupy(memo, -Infinity, memo.lantern.at, 'walk');
        town.lanterns?.claim(member.id, memo.lantern.id);
      }
      const entry = town.started ? null : savedEntry(member);
      seedInn(member, memo, entry?.inn);
      seedStudy(memo, entry?.study);
      memos.set(member.id, memo);
    }
    return memos.get(member.id);
  }

  function deferLantern(member, job) {
    memoOf(member).lantern = job;
    keepLanternJob(member, job);
  }

  function finishLantern(member, end) {
    const memo = memoOf(member);
    const job = memo.lantern;
    if (!job || job.at > end) return;
    memo.lantern = null;
    keepLanternJob(member, null);
    const lantern = town.lanterns?.get(job.id);
    if (!lantern || lantern.doneAt !== null) return;
    const correct = job.correct ?? lanternTry(member.id, lantern.key, dayOf(job.at)).correct;
    town.lanterns.attempt(member.id, lantern.id, correct ? answerOf(lantern.key) : '', job.at);
  }

  function nightRoom(member, ctx) {
    const memo = memoOf(member);
    const night = lodgeNightOf(ctx.minutes);
    if (memo.night !== night) {
      const spot = memo.stay ? null : member.pickLodge(true);
      memo.night = night;
      memo.room = memo.stay ?? (spot && member.payRoom(spot.id) ? spot.id : null);
      memo.stay = null;
      lodgeIn(member, memo.room);
      keepInn(member, { room: memo.room, night });
    }
    return memo.room;
  }

  function sleep(member, ctx, end) {
    const purse = member.purse;
    if (purse.energy < ENERGY.low && !(isOpenAt(VENDOR, ctx.minutes) && member.feast(VENDOR.foods, NPC.vendor).length)) member.snack();
    const house = estate.houseOf(member.id);
    if (house && memoOf(member).stay) {
      memoOf(member).stay = null;
      leaveRoom(member);
    }
    const activity = house ? homeActivity(house) : nightRoom(member, ctx) ?? 'rest';
    purse.tickEnergy(end, energyRate(activity, true));
  }

  function lodged(member, end) {
    const memo = memoOf(member);
    const before = memo.stay;
    if (memo.stay && member.purse.full) memo.stay = null;
    if (!memo.stay && member.wantsInn()) {
      const spot = member.pickLodge(false);
      if (spot && member.payRoom(spot.id)) memo.stay = spot.id;
    }
    if (memo.stay !== before) {
      lodgeIn(member, memo.stay);
      keepInn(member, memo.stay ? { room: memo.stay, night: null } : null);
    }
    if (!memo.stay) return false;
    member.purse.tickEnergy(end, energyRate(memo.stay, false));
    return true;
  }

  function eat(member, ctx) {
    const line = member.hungerLine(ctx);
    if (member.purse.energy < line) member.purse.eatEnergy();
    if (member.purse.energy >= line) return;
    if (!(member.wantsFood(ctx) && member.feast(FOODS, NPC.cook).length)) member.snack();
  }

  function patrolEntry(guard) {
    if (!town.saved || typeof town.saved !== 'object') town.saved = {};
    if (!Array.isArray(town.saved.guards)) town.saved.guards = [];
    let entry = town.saved.guards.find((item) => item?.id === guard.id);
    if (!entry) town.saved.guards.push((entry = { id: guard.id }));
    if (!Number.isInteger(entry.stop) || entry.stop < 0 || entry.stop >= town.patrolXs.length) Object.assign(entry, { stop: 0, step: 1 });
    if (entry.step !== -1) entry.step = 1;
    return entry;
  }

  function patrol(guard, ctx, end) {
    guard.purse.tickEnergy(end, patrolEnergyRate(town.patrolXs, ctx.night));
    eat(guard, ctx);
    const entry = patrolEntry(guard);
    const next = advancePatrol(entry, end - ctx.minutes, town.patrolXs);
    Object.assign(entry, { stop: next.stop, step: next.step, carry: next.carry });
    if (next.moved) delete entry.at;
  }

  function examAt(member, at) {
    if (!member.seated) return false;
    const ctx = contextAt(at);
    const deck = member.examDeckWanted(ctx);
    if (!deck) return false;
    const pace = examPace(deck);
    const arrive = at + AWAY.walk;
    const longest = (Math.ceil((CERTIFY.examMinutes * 60) / pace) * pace) / 60;
    const seat = examSeats.find((bookings) => seatFree(bookings, at, arrive + longest));
    if (!seat) return false;
    const keys = member.beginExam(deck, pace);
    if (!keys) return false;
    const results = simulateExam(member, deck, keys);
    const done = arrive + (results.length * pace) / 60;
    seat.push([at, done]);
    traits.note(member.id, certify.gradeExam(member.id, deck, results).passed ? 'pass' : 'fail', ctx.day);
    occupy(memoOf(member), at, done, 'study');
    return true;
  }

  function exams(member, ctx, end) {
    const memo = memoOf(member);
    let at = Math.max(ctx.minutes, memo.busyUntil);
    while (at < end && examAt(member, at)) at = memo.busyUntil;
  }

  function internalDeck(member, clock) {
    if (!member.seated || contextAt(clock).night) return null;
    return DECK_IDS.find((deck) => internalSeats[deck].length && member.wantsInternal(deck)) ?? null;
  }

  function takeInternal(member, deck, clock) {
    const pace = examPace(deck);
    const keys = member.beginInternal(deck, pace);
    if (!keys) return AWAY.walk;
    const results = simulateInternal(member, deck, keys);
    const length = (results.length * pace) / 60;
    const { seat, at } = earliestSeat(internalSeats[deck], clock + INTERNAL_TRIP, length);
    seat.push([at, at + length]);
    certify.gradeInternal(member.id, deck, results);
    return at + length - clock;
  }

  function signUp(member, ctx) {
    const arena = town.arena;
    if (!town.arenaDesk || !arena?.consider(member.id, ctx.minutes, member.arenaCost(ctx.minutes))) return;
    const memo = memoOf(member);
    const leave = Math.max(ctx.minutes, memo.busyUntil);
    const arrive = leave + AWAY.walk;
    occupy(memo, leave, arrive, 'walk');
    if (arrive < arena.event.at) arena.register(member.id);
  }

  function signLanterns(member, ctx) {
    if (!member.wantsLanternSignup(ctx)) return;
    const memo = memoOf(member);
    const leave = Math.max(ctx.minutes, memo.busyUntil);
    occupy(memo, leave, leave + AWAY.walk, 'walk');
    town.lanterns.register(member.id, ctx.minutes);
  }

  function lanternPlan(member, clock) {
    const lantern = town.lanterns?.pickFor(member.id, member.position, clock);
    if (!lantern) return null;
    return { lantern, ready: Math.max(AWAY.walk, landedAt(lantern) - clock), solve: lanternSeconds(lantern.key) / 60 };
  }

  function solveLantern(member, clock, end, { lantern, ready }) {
    const { correct, seconds } = lanternTry(member.id, lantern.key, dayOf(clock));
    const at = clock + ready + seconds / 60;
    if (at > end) deferLantern(member, { id: lantern.id, at, correct });
    else town.lanterns.attempt(member.id, lantern.id, correct ? answerOf(lantern.key) : '', at);
    return at - clock;
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

  function errands(member, ctx, end) {
    const purse = member.purse;
    eat(member, ctx);
    if (ctx.martOpen && member.wantsMart()) member.buySnacks();
    exams(member, ctx, end);
    signUp(member, ctx);
    signLanterns(member, ctx);
    member.tendQuests(ctx);
    banking(member, ctx);
    if (ctx.shopOpen && market.wantsTrade(member)) market.trade(member);
    if (ctx.fishOpen && market.wantsFish(member)) market.fishTrade(member);
    if (ctx.chiefOpen && estate.affordableFor(member.id, purse.money - VILLAGER.houseReserve)) estate.buyFor(member.id, purse, VILLAGER.houseReserve);
  }

  function tend(member, jobs) {
    for (const job of jobs) {
      if (job.action === 'lease') farm.signLease(job.bed, member.id, job.offer);
      else if (member.purse.spendEnergy(ENERGY.costs[job.action] ?? 0)) {
        member.tend(job);
        const follow = farm.followUp(job.action, job.index, member.id);
        if (follow && member.purse.spendEnergy(ENERGY.costs[follow] ?? 0)) member.tend({ index: job.index, action: follow });
      }
    }
    return AWAY.walk + jobs.length * FARM;
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
    if (member.payHunt() && Math.random() < traits.skill(member.id, 'hunt')) {
      member.purse.add(gameId(pickPrey()), 1);
      quests.note(member.id, 'hunt', town.context.day);
      member.luckyIntellect();
    }
    return AWAY.walk + HUNT;
  }

  const flyDensity = () => town.fireflies?.density ?? 0;
  const swatMinutes = () => nearestFlyGap(flyDensity()) / MOVE.walk / 60 + SWAT;

  function swat(member) {
    member.purse.add('firefly', 1);
    return swatMinutes();
  }

  function sweep(member, walked) {
    const expected = passingCatch(walked * 60, MOVE.walk, flyDensity());
    const caught = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
    if (caught > 0) member.purse.add('firefly', caught);
  }

  function studyDeck(member, ctx, slots) {
    if (!member.seated || ctx.minutes < memoOf(member).studyAt || member.purse.money < CERTIFY.learnFee) return null;
    const deck = member.studyDeckWanted(ctx);
    if (!deck || !certify.learnLeft(member.id, deck).length) return null;
    return slots.study.get(member) === deck || slots.seats[deck] > 0 ? deck : null;
  }

  function takeSeat(member, deck, slots) {
    if (slots.study.get(member) === deck) return;
    slots.study.set(member, deck);
    slots.seats[deck] -= 1;
  }

  function reviewDeck(member, ctx, slots) {
    if (!member.seated || ctx.minutes < memoOf(member).studyAt) return null;
    const deck = member.reviewDeckWanted(ctx);
    return deck && (slots.study.get(member) === deck || slots.seats[deck] > 0) ? deck : null;
  }

  function review(member, ctx, deck, slots) {
    takeSeat(member, deck, slots);
    if (!member.payReview(deck)) return AWAY.walk;
    member.drillWeak(deck, CERTIFY.sitSeconds);
    quests.note(member.id, 'sit', ctx.day, SIT, deck);
    memoOf(member).studyAt = ctx.minutes + SIT + COOLDOWN;
    return AWAY.walk + SIT;
  }

  function speakDeck(member, ctx, slots) {
    if (!member.seated || ctx.minutes < memoOf(member).studyAt) return null;
    const deck = member.speakDeckWanted(ctx);
    return deck && (slots.study.get(member) === deck || slots.seats[deck] > 0) ? deck : null;
  }

  function speak(member, ctx, deck, slots) {
    takeSeat(member, deck, slots);
    if (!member.payReview(deck, CERTIFY.speakFee)) return AWAY.walk;
    const run = planSpeech(member.id, deck, CERTIFY.sitSeconds, ctx.day);
    applySpeech(member.id, deck, run.done, run.seconds, ctx.day);
    const sit = run.seconds / 60;
    quests.note(member.id, 'sit', ctx.day, sit, deck);
    memoOf(member).studyAt = ctx.minutes + sit + COOLDOWN;
    return AWAY.walk + sit;
  }

  function prepDeck(member, ctx, slots) {
    if (!member.seated || ctx.minutes < memoOf(member).studyAt) return null;
    const deck = member.prepDeckWanted(ctx);
    return deck && (slots.study.get(member) === deck || slots.seats[deck] > 0) ? deck : null;
  }

  function prep(member, ctx, deck, slots) {
    takeSeat(member, deck, slots);
    if (!member.payReview(deck)) return AWAY.walk;
    member.drillCertified(deck, CERTIFY.sitSeconds);
    quests.note(member.id, 'sit', ctx.day, SIT, deck);
    memoOf(member).studyAt = ctx.minutes + SIT + COOLDOWN;
    return AWAY.walk + SIT;
  }

  function study(member, ctx, deck, slots) {
    takeSeat(member, deck, slots);
    if (!member.payStudy(deck)) return AWAY.walk;
    let words = 0;
    for (let at = VIEW; at <= SIT && words < CERTIFY.sitWords && certify.learnLeft(member.id, deck).length; at += VIEW) {
      if (member.learnWord(deck)) words += 1;
    }
    quests.note(member.id, 'sit', ctx.day, SIT, deck);
    if (Math.random() >= member.diligence) memoOf(member).studyAt = ctx.minutes + SIT + COOLDOWN;
    return AWAY.walk + SIT;
  }

  function blessingPlan(member, clock, end) {
    const window = blessingWindow(clock, end);
    if (!window || memoOf(member).blessing === window.session || town.blessing?.member(member.id, window.open) || member.purse.money < BLESSING.fee) return null;
    const from = Math.max(clock + AWAY.walk, window.open);
    const stay = Math.min(window.close - from, BLESSING_STAY);
    return stay > 0 ? { window, from, stay } : null;
  }

  function bless(member, clock, { window, from }) {
    memoOf(member).blessing = window.session;
    if (!economy.joinBlessing(member.id, window.session, member.purse)) return AWAY.walk;
    const minutes = blessingStayMinutes(from, window.close);
    member.settleBlessing();
    member.blessingTally = { session: window.session, ...blessingAnswers(member, minutes) };
    return from - clock + minutes;
  }

  function trainingPlan(member, clock) {
    if (!member.trainingWanted(contextAt(clock))) return null;
    const seat = examSeats.find((bookings) => seatFree(bookings, clock, clock + AWAY.walk + TRAINING.minutes));
    return seat ? { seat } : null;
  }

  function train(member, clock, { seat }) {
    if (!payTraining(member.purse, member.id)) return AWAY.walk;
    const gained = trainingIntellect(trainingAnswers(() => member.answerPool()));
    if (gained > 0) member.purse.addIntellect(gained);
    seat.push([clock, clock + AWAY.walk + TRAINING.minutes]);
    return AWAY.walk + TRAINING.minutes;
  }

  function lotoPlan(member, clock) {
    const loto = town.loto;
    if (!loto || !lotoSignOpen(clock) || loto.joined(member.id, clock) || member.purse.money < LOTO.fee) return null;
    const worth = loto.worth(member.id, clock);
    if (!(worth > 0)) return null;
    return { worth, minutes: AWAY.walk + LOTO.gather + lotoMinutes(dayOf(clock)) };
  }

  function playLoto(member, clock) {
    town.loto.register(member.id, clock);
    return AWAY.walk;
  }

  function lotoAt(member, clock) {
    const loto = town.loto;
    const day = dayOf(clock);
    if (!loto || !loto.joined(member.id, clock) || loto.result(clock) || clock < lotoGatherAt(day) || clock >= lotoEnd(day)) return false;
    occupy(memoOf(member), clock, lotoEnd(day), 'idle');
    return true;
  }

  function fireworksPlan(member, clock, need) {
    const fireworks = town.fireworks;
    if (!fireworks || !fireworksSignOpen(clock) || fireworks.joined(member.id, clock) || member.purse.money < FIREWORKS.fee) return null;
    const worth = fireworks.worth(member.id, clock, need, member.diligence);
    if (!(worth > 0)) return null;
    return { worth, minutes: AWAY.walk + fireworksStayMinutes(clock) };
  }

  function playFireworks(member, clock) {
    town.fireworks.register(member.id, clock);
    return AWAY.walk;
  }

  function fireworksAt(member, clock) {
    const fireworks = town.fireworks;
    const window = fireworksWindow(clock);
    if (!fireworks || !window || !fireworks.joined(member.id, clock) || fireworks.result(clock) || clock < window.gather) return false;
    occupy(memoOf(member), clock, window.end, 'idle');
    return true;
  }

  function choose(member, ctx, slots, clock, end) {
    const need = member.moneyNeed();
    const options = [];
    const blessing = blessingPlan(member, clock, end);
    if (blessing) options.push({ kind: 'blessing', as: 'idle', rate: member.blessingGain(need, blessing.stay, blessing.window.session) / (blessing.from - clock + blessing.stay), run: () => bless(member, clock, blessing) });
    const loto = lotoPlan(member, clock);
    if (loto) options.push({ kind: 'loto', as: 'idle', rate: (loto.worth * need) / loto.minutes, run: () => playLoto(member, clock) });
    const fireworks = fireworksPlan(member, clock, need);
    if (fireworks) options.push({ kind: 'fireworks', as: 'idle', rate: fireworks.worth / fireworks.minutes, run: () => playFireworks(member, clock) });
    const lantern = lanternPlan(member, clock);
    if (lantern) options.push({ kind: 'lantern', as: 'walk', rate: lanternWorth(member.id, lantern.lantern.key, need, member.diligence, town.lanterns.energyAt(clock)) / (lantern.ready + lantern.solve), run: () => solveLantern(member, clock, end, lantern) });
    const trip = member.farmTrip(need);
    if (trip.jobs.length) options.push({ kind: 'farm', as: 'walk', rate: trip.gain / (AWAY.walk + trip.jobs.length * FARM), run: () => tend(member, trip.jobs) });
    if (canFish(member, slots)) {
      const casts = Math.min(AVERAGE_CASTS, member.purse.count('bait'));
      options.push({ kind: 'fish', as: 'walk', rate: member.fishGain(need, casts) / (AWAY.walk + casts * CAST), run: () => fish(member, ctx, slots) });
    }
    if (canHunt(member, slots)) options.push({ kind: 'hunt', as: 'walk', rate: member.huntGain(need) / (AWAY.walk + HUNT), run: () => hunt(member, slots) });
    if (ctx.night && flyDensity() > 0) options.push({ kind: 'firefly', as: 'walk', rate: member.fireflyGain() / swatMinutes(), run: () => swat(member) });
    const internal = internalDeck(member, clock);
    if (internal) options.push({ kind: 'study', as: 'study', rate: (MIND.internalValue * member.diligence - certify.fee(internal, CERTIFY.internalFee) * need) / INTERNAL_TRIP, run: () => takeInternal(member, internal, clock) });
    const training = trainingPlan(member, clock);
    if (training) options.push({ kind: 'study', as: 'study', rate: member.trainingGain(need) / (AWAY.walk + TRAINING.minutes), run: () => train(member, clock, training) });
    const deck = studyDeck(member, ctx, slots);
    if (deck) options.push({ kind: 'study', as: 'study', rate: member.studyGain(need, SIT, deck) / (AWAY.walk + SIT), run: () => study(member, ctx, deck, slots) });
    const reviewing = reviewDeck(member, ctx, slots);
    if (reviewing) options.push({ kind: 'study', as: 'study', rate: member.reviewGain(need, SIT, reviewing) / (AWAY.walk + SIT), run: () => review(member, ctx, reviewing, slots) });
    const speaking = speakDeck(member, ctx, slots);
    if (speaking) options.push({ kind: 'study', as: 'study', rate: member.speakGain(need, SIT, speaking, ctx.day) / (AWAY.walk + SIT), run: () => speak(member, ctx, speaking, slots) });
    const prepping = prepDeck(member, ctx, slots);
    if (prepping) options.push({ kind: 'study', as: 'study', rate: member.prepGain(need, SIT, prepping, ctx.day) / (AWAY.walk + SIT), run: () => prep(member, ctx, prepping, slots) });
    const floor = ctx.night ? 0 : MIND.leisureValue;
    let best = null;
    for (const option of options) {
      if (!(option.rate > 0)) continue;
      option.score = option.rate * member.tasteFor(option.kind) * quests.pull(member.id, option.kind, ctx.day) * between(...MIND.noise);
      if (option.score > floor && (!best || option.score > best.score)) best = option;
    }
    return best;
  }

  function work(member, ctx, minutes, slots) {
    const memo = memoOf(member);
    const end = ctx.minutes + minutes;
    let clock = Math.max(ctx.minutes, memo.busyUntil);
    while (clock < end && member.purse.energy >= ENERGY.workMin) {
      if (examAt(member, clock) || lotoAt(member, clock) || fireworksAt(member, clock)) {
        clock = memo.busyUntil;
        continue;
      }
      const option = choose(member, ctx, slots, clock, end);
      if (!option) break;
      const spent = option.run();
      traits.did(member.id, option.kind, ctx.day, spent);
      occupy(memo, clock, clock + spent, option.as);
      clock += spent;
    }
    const used = { walk: 0, study: 0, idle: 0 };
    busyTime(memo, ctx.minutes, end, used);
    return used;
  }

  function drain(member, ctx, end, minutes, used) {
    const idle = Math.max(0, minutes - used.walk - used.study);
    const total = used.walk + used.study + idle;
    const burner = member.lampBurner();
    const lamp = burner.lit(ctx.night, used.study > 0, member.purse.count('firefly'));
    if (lamp) burner.spend(member.purse, used.study);
    const rate = (energyRate('walk', ctx.night) * used.walk + energyRate(lamp ? 'lampStudy' : 'study', ctx.night) * used.study + energyRate('idle', ctx.night) * idle) / total;
    member.purse.tickEnergy(end, rate);
  }

  function holdArena(member, ctx, hold, end, slots) {
    const memo = memoOf(member);
    if (memo.lantern) {
      memo.lantern = null;
      keepLanternJob(member, null);
    }
    const tonight = contextAt(hold.from).night && memo.night === lodgeNightOf(hold.from);
    if (memo.stay || (memo.room && !tonight)) {
      memo.stay = null;
      memo.room = null;
      memo.night = null;
      leaveRoom(member);
      keepInn(member, null);
    }
    memo.busy = [];
    memo.busyUntil = hold.to;
    member.purse.tickEnergy(hold.to, energyRate('idle', ctx.night));
    if (hold.to < end) live(member, contextAt(hold.to), end - hold.to, slots);
  }

  function live(member, ctx, minutes, slots) {
    const end = ctx.minutes + minutes;
    const memo = memoOf(member);
    memo.busy = memo.busy.filter((part) => part.to > ctx.minutes);
    if (!ctx.night && !memo.stay) leaveRoom(member);
    const hold = town.arena?.holdOf(member.id, ctx.minutes, end);
    if (hold) {
      if (hold.from > ctx.minutes) live(member, ctx, hold.from - ctx.minutes, slots);
      return holdArena(member, ctx, hold, end, slots);
    }
    finishLantern(member, end);
    member.settleBlessing();
    if (memo.busyUntil < end) {
      if (ctx.night && member.needsSleep(ctx)) return sleep(member, ctx, end);
      if (!ctx.night) {
        errands(member, ctx, end);
        if (lodged(member, end)) return;
      } else member.tendQuests(ctx);
      if (member.purse.energy < ENERGY.workMin) return member.purse.tickEnergy(end, energyRate('rest', ctx.night));
    }
    const used = work(member, ctx, minutes, slots);
    if (ctx.night && !used.walk && !used.study) return sleep(member, ctx, end);
    if (ctx.night) sweep(member, used.walk);
    drain(member, ctx, end, minutes, used);
  }

  return {
    begin() {
      town.suspend();
      memos.clear();
      for (const bookings of allSeats()) bookings.length = 0;
      for (const member of town.members) memoOf(member);
    },
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
      const event = town.arena?.event;
      if (event && event.phase !== 'done' && event.at < to) town.arena.tick(to);
      town.lanterns?.tick(from);
      town.loto?.tick(from);
      town.fireworks?.tick(from);
      farm.grow();
      river.restock(from);
      for (const bookings of allSeats()) bookings.splice(0, bookings.length, ...bookings.filter(([, stop]) => stop > from));
      const slots = { anglers: new Set(), hunters: new Set(), study: new Map(), seats: { ...seatsOf } };
      for (const member of shuffled(town.members)) live(member, ctx, minutes, slots);
      for (const guard of town.guards) patrol(guard, ctx, to);
      quizCarry += minutes;
      while (quizCarry >= QUIZ_MINUTES) {
        quizCarry -= QUIZ_MINUTES;
        town.quizRound();
      }
    },
  };
}
