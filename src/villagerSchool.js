import { between } from './random.js';
import { BLESSING, CERTIFY, SELF_STUDY, TRAINING } from './config.js';
import { certify } from './certify.js';
import { DECK_IDS, READING_IDS } from './studyDecks.js';
import { openPassages, readingFee, simulateReading } from './reading.js';
import { EXAM_SPAN, INTERNAL_SPAN, examOpen } from './examRules.js';
import { economy } from './economy.js';
import { absorption } from './absorption.js';
import { fluency } from './fluency.js';
import { traits } from './traits.js';
import { quests } from './quests.js';
import { NPC, classTeacherOf } from './npcIds.js';
import { SPEAK_DECKS, applySpeech, planSpeech } from './speaking.js';
import { TRAINING_SPAN, payTraining, trainingEarned, trainingThink } from './training.js';
import { realSeconds } from './clock.js';

const INTERNAL_SEAT_RETRY = 1;

function recallOf(member, key) {
  const correct = absorption.answer(member.id, key);
  fluency.recall(member.id, key, member.town.context?.day, correct);
  return { key, correct };
}

export const simulate = (member, keys) => keys.map((key) => recallOf(member, key));

function simulateUntil(member, keys, stops) {
  const results = [];
  for (const key of keys) {
    const result = recallOf(member, key);
    results.push(result);
    if (stops(result)) break;
  }
  return results;
}

export const simulateExam = (member, deck, keys) => simulateUntil(member, keys, (result) => certify.examStops(member.id, deck, result));

export const simulateInternal = (member, deck, keys) => simulateUntil(member, keys, (result) => certify.internalStops(member.id, deck, result));

function sample(list, count) {
  const copy = [...list];
  const taken = Math.min(count, copy.length);
  for (let i = 0; i < taken; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, taken);
}

export class SchoolBehavior {
  canTakeInternal(deck) {
    return certify.internalReady(this.id, deck) && this.purse.money >= certify.fee(deck, CERTIFY.internalFee);
  }

  hallRoom(deck) {
    const seats = this.town.studySeats.list.filter((seat) => seat.deck === deck);
    const free = seats.filter((seat) => this.town.studySeats.isFreeFor(seat, this)).length;
    return seats.length ? free / seats.length : 0;
  }

  studyDeckWanted(ctx = this.town.context) {
    let best = null;
    let bestScore = -Infinity;
    for (const deck of DECK_IDS) {
      const learning = certify.learnLeft(this.id, deck).length > 0 && this.purse.money >= certify.fee(deck, CERTIFY.learnFee);
      const internal = !ctx.night && this.canTakeInternal(deck);
      if (!learning && !internal) continue;
      const score = (internal && !learning ? 1 : this.hallRoom(deck)) + quests.deckPull(this.id, deck, ctx.day) + Math.random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = deck;
      }
    }
    return best;
  }

  studySeatFor(deck, fee = CERTIFY.learnFee) {
    if (!deck || this.purse.money < certify.fee(deck, fee)) return null;
    const seats = this.town.studySeats;
    const wait = this.town.seatWait;
    return seats.nearestFree(this.position, this, (seat) => seat.deck === deck && seats.restLeft(seat, this, this.now) <= 0 && (!wait || wait.openTo(seat, this, this.now)));
  }

  canWaitForSeat(deck) {
    const ctx = this.town.context;
    if (!deck || !this.town.seatWait?.hasRoom(deck) || this.needsSleep(ctx)) return false;
    return this.purse.money >= certify.fee(deck, CERTIFY.learnFee) && certify.learnLeft(this.id, deck).length > 0;
  }

  waitForSeat(deck) {
    const spot = this.town.seatWait.join(deck, this, {
      ready: () => this.task === 'seatwait' && this.purse.money >= certify.fee(deck, CERTIFY.learnFee) && certify.learnLeft(this.id, deck).length > 0,
      take: (seat) => this.takeBookedSeat(seat),
    });
    if (!spot) {
      this.quitSelfStudy();
      return;
    }
    this.task = 'seatwait';
    this.seatWaitDeck = deck;
    this.seatWaitUntil = this.now + SELF_STUDY.waitMax;
    this.travel(spot, { then: () => this.holdSeatWait(), fail: () => this.dropSeatWait() });
  }

  holdSeatWait() {
    const ctx = this.town.context;
    const wait = this.town.seatWait;
    if (!wait.has(this) || this.needsSleep(ctx) || this.now >= this.seatWaitUntil) {
      this.dropSeatWait();
      return;
    }
    this.lookAt = wait.look(this.seatWaitDeck);
    this.wait(SELF_STUDY.waitPoll, () => this.holdSeatWait());
  }

  dropSeatWait() {
    this.town.seatWait.leave(this);
    this.lookAt = null;
    this.quitSelfStudy();
  }

  takeBookedSeat(seat) {
    this.cancel();
    this.lookAt = null;
    this.walkToSeat(seat);
  }

  walkToSeat(seat) {
    const seats = this.town.studySeats;
    this.task = 'selfstudy';
    seats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, { then: () => this.claimSeat(seats, () => this.goSelfStudy()), fail: () => this.quitSelfStudy() });
  }

  wantsInternal(deck) {
    if (this.town.arena?.clash(this.id, this.town.context.minutes, INTERNAL_SPAN)) return false;
    return !certify.learnLeft(this.id, deck).length && this.canTakeInternal(deck) && !!this.town.queues[`teacher:${deck}`];
  }

  goInternal(deck) {
    this.cancel();
    this.task = 'internal';
    this.internalDeck = deck;
    this.lineUp(this.town.queues[`teacher:${deck}`], () => this.takeInternal());
  }

  studiedToday(ctx = this.town.context) {
    return absorption.noted(this.id, 'study', ctx.day);
  }

  reviewDeckWanted(ctx = this.town.context) {
    if (this.purse.money < CERTIFY.reviewFee) return null;
    const studied = this.studiedToday(ctx);
    let best = null;
    let bestScore = -Infinity;
    for (const deck of DECK_IDS) {
      if (!certify.certifiedCount(this.id, deck) || certify.learnLeft(this.id, deck).length) continue;
      if (this.purse.money < certify.fee(deck, CERTIFY.reviewFee)) continue;
      const weak = certify.reviewQuestions(this.id, deck).length;
      if (!weak && studied) continue;
      const score = weak + this.hallRoom(deck) + quests.deckPull(this.id, deck, ctx.day) + Math.random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = deck;
      }
    }
    return best;
  }

  speakDeckWanted() {
    if (this.purse.money < CERTIFY.speakFee) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const deck of SPEAK_DECKS) {
      if (!certify.certifiedCount(this.id, deck) || certify.learnLeft(this.id, deck).length) continue;
      if (this.purse.money < certify.fee(deck, CERTIFY.speakFee)) continue;
      const score = this.hallRoom(deck) + quests.deckPull(this.id, deck, this.town.context.day) + Math.random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = deck;
      }
    }
    return best;
  }

  goSpeak(deck) {
    this.prepping = false;
    this.speaking = true;
    this.goReview(deck);
  }

  goPlainReview(deck) {
    this.prepping = false;
    this.speaking = false;
    this.goReview(deck);
  }

  goPrep(deck) {
    this.speaking = false;
    this.prepping = true;
    this.goReview(deck);
  }

  goReview(deck) {
    this.reviewing = true;
    const wait = this.town.seatWait;
    const entry = wait && !wait.inside(deck, this.position) ? wait.entry(deck) : null;
    if (!entry) {
      this.pickStudySeat(deck);
      return;
    }
    this.cancel();
    this.task = 'selfstudy';
    this.travel(entry, { then: () => this.pickStudySeat(deck), fail: () => this.quitSelfStudy() });
  }

  goSelfStudy(deck = this.studyDeckWanted()) {
    this.reviewing = false;
    this.prepping = false;
    this.speaking = false;
    if (deck && !this.town.context.night && this.wantsInternal(deck)) {
      this.goInternal(deck);
      return;
    }
    const wait = this.town.seatWait;
    const entry = deck && wait && !wait.inside(deck, this.position) ? wait.entry(deck) : null;
    if (!entry) {
      this.pickStudySeat(deck);
      return;
    }
    this.cancel();
    this.task = 'selfstudy';
    this.travel(entry, { then: () => this.pickStudySeat(deck), fail: () => this.quitSelfStudy() });
  }

  pickStudySeat(deck) {
    const seat = this.studySeatFor(deck, this.reviewing ? this.reviewFee() : CERTIFY.learnFee);
    this.cancel();
    if (!seat) {
      if (!this.reviewing && this.canWaitForSeat(deck)) this.waitForSeat(deck);
      else this.quitSelfStudy();
      return;
    }
    this.walkToSeat(seat);
  }

  claimSeat(seats, fallback) {
    const seat = this.targetSeat;
    if (!seat || !seats.canTake(seat, this)) {
      fallback();
      return;
    }
    seats.occupy(seat, this);
    this.seatRef = seat;
    this.targetSeat = null;
    seat.place(this.seated.group);
    this.from.copy(this.position);
    this.timer = 0;
    this.state = 'sitting';
  }

  quitSelfStudy() {
    this.reviewing = false;
    this.prepping = false;
    this.speaking = false;
    this.town.studySeats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.task = null;
    this.wait(between(1, 2));
  }

  readingRoomWanted() {
    if (this.purse.money < readingFee()) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const room of READING_IDS) {
      if (!openPassages(this.id, room).length) continue;
      const score = this.hallRoom(room) + quests.deckPull(this.id, room, this.town.context.day) + Math.random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = room;
      }
    }
    return best;
  }

  goReading(room) {
    const wait = this.town.seatWait;
    const entry = wait && !wait.inside(room, this.position) ? wait.entry(room) : null;
    this.cancel();
    this.task = 'reading';
    if (!entry) {
      this.pickReadingSeat(room);
      return;
    }
    this.travel(entry, { then: () => this.pickReadingSeat(room), fail: () => this.quitReading() });
  }

  pickReadingSeat(room) {
    const seat = this.studySeatFor(room, readingFee());
    this.cancel();
    if (!seat) {
      this.quitReading();
      return;
    }
    const seats = this.town.studySeats;
    this.task = 'reading';
    seats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, { then: () => this.claimSeat(seats, () => this.quitReading()), fail: () => this.quitReading() });
  }

  quitReading() {
    this.town.studySeats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.task = null;
    this.wait(between(1, 2));
  }

  payReading(room) {
    const fee = readingFee();
    if (!this.purse.spend(fee)) return false;
    economy.tuition(classTeacherOf(room), fee, this.id);
    absorption.note(this.id, 'study', this.town.context.day);
    traits.note(this.id, 'study', this.town.context.day);
    return true;
  }

  startReading() {
    const room = this.seatRef.deck;
    if (!this.payReading(room)) {
      this.rise(() => {
        this.task = null;
        this.think();
      }, between(0.5, 2));
      return;
    }
    this.readingResult = simulateReading(this.id, room, CERTIFY.sitSeconds);
    this.readingUntil = this.now + CERTIFY.sitSeconds;
    this.studying = true;
  }

  readingUpdate(t) {
    if (!this.readingResult || (t < this.readingUntil && !this.needsSleep(this.town.context))) return;
    const { right, total, passages } = this.readingResult;
    this.readingResult = null;
    quests.note(this.id, 'read', this.town.context.day, passages, this.seatRef.deck);
    this.town.studySeats.rest(this.seatRef, this, t + CERTIFY.seatRest);
    this.studyRestAt = t + SELF_STUDY.cooldown;
    if (total) this.say(`📖 ${right}/${total}`, 2.4);
    this.rise(() => {
      this.task = null;
      this.think();
    }, between(0.3, 1.5));
  }

  internalSeatFor(deck) {
    return this.town.internalSeats.nearestFree(this.position, this, (seat) => seat.deck === deck);
  }

  takeInternal() {
    const deck = this.internalDeck;
    const teacher = this.town.classTeachers[deck];
    teacher?.attend(this);
    if (!this.canTakeInternal(deck)) {
      this.wait(between(1, 2), () => {
        teacher?.release(this);
        this.internalDeck = null;
        this.finishService();
      });
      return;
    }
    const seat = this.internalSeatFor(deck);
    if (!seat) {
      this.wait(INTERNAL_SEAT_RETRY, () => this.takeInternal());
      return;
    }
    teacher?.release(this);
    this.leaveQueue();
    this.lookAt = null;
    this.town.internalSeats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, { then: () => this.claimSeat(this.town.internalSeats, () => this.quitInternal()), fail: () => this.quitInternal() });
  }

  quitInternal() {
    this.town.internalSeats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.internalDeck = null;
    this.task = null;
    this.wait(between(1, 2));
  }

  beginInternal(deck, pace) {
    const fee = certify.fee(deck, CERTIFY.internalFee);
    if (!this.canTakeInternal(deck) || !this.purse.spend(fee)) return null;
    economy.tuition(classTeacherOf(deck), fee, this.id);
    const keys = certify.beginInternal(this.id, deck) ?? [];
    const count = Math.max(keys.length, Math.ceil((CERTIFY.internalMinutes * 60) / pace));
    while (keys.length < count) {
      const key = certify.internalExtra(this.id, deck, keys.at(-1) ?? null);
      if (!key) break;
      keys.push(key);
    }
    return keys;
  }

  startInternal() {
    const deck = this.internalDeck;
    const pace = CERTIFY.seconds[deck] * between(0.4, 0.8);
    const keys = this.beginInternal(deck, pace);
    if (!keys) {
      this.internalDeck = null;
      this.rise(() => {
        this.task = null;
        this.think();
      }, between(0.5, 2));
      return;
    }
    this.internalResults = simulateInternal(this, deck, keys);
    this.internalUntil = this.now + this.internalResults.length * pace;
    this.studying = true;
  }

  internalUpdate(t) {
    if (!this.internalResults || t < this.internalUntil) return;
    const deck = this.internalDeck;
    const results = this.internalResults;
    this.internalDeck = null;
    this.internalResults = null;
    const { passed } = certify.gradeInternal(this.id, deck, results);
    this.say(passed ? '📝✓' : '📝✗', 1.8);
    this.rise(() => {
      this.task = null;
      this.think();
    }, between(0.3, 1.5));
  }

  learnTick(t) {
    const deck = this.seatRef?.deck;
    if (!deck) return false;
    const left = certify.learnLeft(this.id, deck);
    if (!left.length) return true;
    if (t - this.studyMark < CERTIFY.viewSeconds) return false;
    this.studyMark = t;
    if (this.learnWord(deck, left)) this.sitWords += 1;
    return false;
  }

  learnWord(deck, left = certify.learnLeft(this.id, deck)) {
    const key = left[(this.learnTurn = (this.learnTurn ?? 0) + 1) % left.length];
    absorption.note(this.id, 'study', this.town.context.day);
    traits.note(this.id, 'study', this.town.context.day);
    if (absorption.forgets(this.id)) {
      certify.forget(this.id, deck, key);
      return false;
    }
    certify.remember(this.id, deck, key);
    quests.note(this.id, 'learn', this.town.context.day, 1, deck);
    return true;
  }

  examDeckWanted(ctx) {
    if (!this.seated || ctx.night || !examOpen(ctx.minutes)) return null;
    if (this.town.arena?.clash(this.id, ctx.minutes, EXAM_SPAN)) return null;
    if (this.purse.intellect < CERTIFY.examIntellect) return null;
    return DECK_IDS.find((deck) => certify.qualified(this.id, deck) && !certify.examTaken(this.id, deck) && this.affordsExam(deck)) ?? null;
  }

  trainingWanted(ctx) {
    if (!this.seated || ctx.night || !examOpen(ctx.minutes)) return false;
    if (this.town.arena?.clash(this.id, ctx.minutes, TRAINING_SPAN)) return false;
    return this.purse.money >= TRAINING.fee && certify.pool(this.id).length > 0;
  }

  examShortfall() {
    const short = CERTIFY.examIntellect - this.purse.intellect;
    if (short <= 0) return 0;
    return DECK_IDS.some((deck) => certify.qualified(this.id, deck) && !certify.examTaken(this.id, deck)) ? short : 0;
  }

  goTraining() {
    const seat = this.trainingWanted(this.town.context) ? this.town.seats.nearestFree(this.position, this) : null;
    this.cancel();
    if (!seat) {
      this.task = null;
      this.wait(between(2, 4));
      return;
    }
    this.task = 'training';
    this.town.seats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, {
      then: () => this.claimSeat(this.town.seats, () => this.goTraining()),
      fail: () => {
        this.cancel();
        this.task = null;
        this.wait(between(1, 2));
      },
    });
  }

  startTraining() {
    if (!payTraining(this.purse, this.id)) {
      this.rise(() => {
        this.task = null;
        this.think();
      }, between(0.5, 2));
      return;
    }
    this.training = { until: this.now + realSeconds(TRAINING.minutes), at: this.now + BLESSING.firstQuiz, answerAt: null, correct: 0 };
    this.studying = true;
  }

  trainingUpdate(t) {
    const run = this.training;
    if (!run) return;
    if (t >= run.until) {
      this.training = null;
      this.rise(() => {
        this.task = null;
        this.think();
      }, between(0.3, 1.5));
      return;
    }
    if (run.answerAt === null) {
      if (t < run.at) return;
      const thinking = trainingThink();
      run.answerAt = t + thinking;
      this.say('🤔', thinking);
      return;
    }
    if (t < run.answerAt) return;
    run.answerAt = null;
    run.at = t + TRAINING.gap;
    if (!this.answerPool()) return;
    run.correct += 1;
    const earned = trainingEarned(run.correct);
    if (earned > 0) {
      this.purse.addIntellect(earned);
      this.say('💡', 1.6);
    } else this.say('✓', 1.2);
  }

  affordsExam(deck) {
    const fee = certify.examFee(this.id, deck);
    if (!certify.retaking(this.id, deck)) return this.purse.money >= fee;
    return !this.frugal() && this.purse.money >= fee + certify.fee(deck, CERTIFY.retakeReserve);
  }

  goExam() {
    const deck = this.examDeckWanted(this.town.context);
    const seat = deck ? this.town.seats.nearestFree(this.position, this) : null;
    this.cancel();
    if (!seat) {
      this.task = null;
      this.wait(between(2, 4));
      return;
    }
    this.task = 'exam';
    this.examDeck = deck;
    this.town.seats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, {
      then: () => this.claimSeat(this.town.seats, () => this.goExam()),
      fail: () => {
        this.cancel();
        this.task = null;
        this.wait(between(1, 2));
      },
    });
  }

  beginExam(deck, pace) {
    const purse = this.purse;
    const ready = deck && certify.qualified(this.id, deck) && !certify.examTaken(this.id, deck);
    const fee = certify.examFee(this.id, deck);
    if (!ready || !purse.take('intellect', CERTIFY.examIntellect)) return null;
    if (!purse.spend(fee)) {
      purse.add('intellect', CERTIFY.examIntellect);
      return null;
    }
    economy.tuition(NPC.teacher, fee, this.id);
    const keys = certify.examQuestions(this.id, deck);
    const count = Math.max(keys.length, Math.ceil((CERTIFY.examMinutes * 60) / pace));
    while (keys.length < count) {
      const key = certify.examExtra(this.id, deck, keys.at(-1) ?? null);
      if (!key) break;
      keys.push(key);
    }
    return keys;
  }

  startExam() {
    const deck = this.examDeck;
    const pace = CERTIFY.seconds[deck] * between(0.4, 0.8);
    const keys = this.beginExam(deck, pace);
    if (!keys) {
      this.examDeck = null;
      this.rise(() => this.think(), between(0.5, 2));
      return;
    }
    this.examResults = simulateExam(this, deck, keys);
    this.examUntil = this.now + this.examResults.length * pace;
    this.studying = true;
  }

  examUpdate(t) {
    if (!this.examResults || t < this.examUntil) return;
    const deck = this.examDeck;
    const results = this.examResults;
    this.examDeck = null;
    this.examResults = null;
    const result = certify.gradeExam(this.id, deck, results);
    traits.note(this.id, result.passed ? 'pass' : 'fail', this.town.context.day);
    this.say(result.passed ? '🎓' : '📄', 2.4);
    this.rise(() => {
      this.task = null;
      this.think();
    }, between(0.3, 1.5));
  }

  creditSit(t, day) {
    const deck = this.seatRef?.deck;
    const minutes = Math.floor((t - this.sitCredit) / 60);
    if (!deck || !(minutes >= 1)) return;
    this.sitCredit += minutes * 60;
    quests.note(this.id, 'sit', day, minutes, deck);
  }

  selfStudyUpdate(t) {
    const ctx = this.town.context;
    this.creditSit(t, ctx.day);
    if (this.reviewing) {
      if (t < this.studyUntil && !this.needsSleep(ctx)) return;
      this.reviewing = false;
      if (this.speaking) applySpeech(this.id, this.seatRef.deck, this.speechRun?.done ?? [], t - this.studyMark, ctx.day);
      else if (this.prepping) this.drillCertified(this.seatRef.deck, t - this.studyMark);
      else this.drillWeak(this.seatRef.deck, t - this.studyMark);
      this.prepping = false;
      this.speaking = false;
      this.speechRun = null;
      this.town.studySeats.rest(this.seatRef, this, t + CERTIFY.seatRest);
      this.studyRestAt = t + SELF_STUDY.cooldown;
      this.rise(() => {
        this.task = null;
        this.think();
      }, between(0.3, 1.5));
      return;
    }
    const done = this.learnTick(t);
    const sitOver = t >= this.studyUntil || this.sitWords >= CERTIFY.sitWords;
    if (!sitOver && !this.needsSleep(ctx) && !done) return;
    const deck = this.seatRef?.deck;
    if (sitOver) {
      this.town.studySeats.rest(this.seatRef, this, t + CERTIFY.seatRest);
    }
    if (done && !ctx.night && deck && this.wantsInternal(deck)) {
      this.studyRestAt = t + SELF_STUDY.cooldown;
      this.rise(() => this.goInternal(deck), between(0.3, 1.5));
      return;
    }
    if (sitOver && !done && !this.needsSleep(ctx) && Math.random() < this.diligence) {
      this.rise(() => this.goSelfStudy(), between(0.3, 1.5));
      return;
    }
    this.studyRestAt = t + SELF_STUDY.cooldown;
    this.rise(() => {
      this.task = null;
      this.think();
    }, between(0.3, 1.5));
  }

  sitDown() {
    this.setVisible(false);
    this.showSeated(true);
    this.position.copy(this.seatRef.sit);
    this.facing = Math.PI;
    this.velocity = 0;
    this.state = 'seated';
    if (this.task === 'reading') {
      this.startReading();
      return;
    }
    if (this.seatRef.study) {
      if (!(this.reviewing ? this.payReview(this.seatRef.deck) : this.payStudy(this.seatRef.deck))) {
        this.reviewing = false;
        this.prepping = false;
        this.speaking = false;
        this.task = null;
        this.rise(() => this.think(), between(0.3, 1.5));
        return;
      }
      if (this.reviewing && !this.speaking) quests.note(this.id, 'review', this.town.context.day, 1, this.seatRef.deck);
      this.task = 'selfstudy';
      this.studying = true;
      this.studyUntil = this.now + CERTIFY.sitSeconds;
      this.studyMark = this.now;
      this.sitCredit = this.now;
      this.sitWords = 0;
      if (this.speaking) {
        this.speechRun = planSpeech(this.id, this.seatRef.deck, CERTIFY.sitSeconds, this.town.context.day);
        this.studyUntil = this.now + this.speechRun.seconds;
      }
      return;
    }
    if (this.task === 'exam') {
      this.startExam();
      return;
    }
    if (this.task === 'training') {
      this.startTraining();
      return;
    }
    if (this.task === 'internal') {
      this.startInternal();
      return;
    }
    this.rise(() => this.think(), between(1, 3));
  }

  drillWeak(deck, seconds) {
    const keys = certify.reviewQuestions(this.id, deck, seconds / between(0.4, 0.8));
    if (keys.length) certify.gradeReview(this.id, deck, simulate(this, keys));
  }

  drillCertified(deck, seconds) {
    const keys = sample(certify.certified(this.id, deck), Math.floor(seconds / (CERTIFY.seconds[deck] * between(0.4, 0.8))));
    if (keys.length) simulate(this, keys);
  }

  reviewFee() {
    return this.speaking ? CERTIFY.speakFee : CERTIFY.reviewFee;
  }

  payReview(deck, base = this.reviewFee()) {
    const fee = certify.fee(deck, base);
    if (!this.purse.spend(fee)) return false;
    economy.tuition(classTeacherOf(deck), fee, this.id);
    absorption.note(this.id, 'study', this.town.context.day);
    traits.note(this.id, 'study', this.town.context.day);
    return true;
  }

  payStudy(deck) {
    const fee = certify.fee(deck, CERTIFY.learnFee);
    if (!this.purse.spend(fee)) return false;
    economy.tuition(classTeacherOf(deck), fee, this.id);
    return true;
  }

  resumeStudy(seat, { left, words, mark }, t) {
    if (!certify.learnLeft(this.id, seat.deck).length || !this.town.studySeats.canTake(seat, this)) return false;
    this.cancel();
    this.town.studySeats.occupy(seat, this);
    this.seatRef = seat;
    seat.place(this.seated.group);
    this.position.copy(seat.sit);
    this.setVisible(false);
    this.showSeated(true);
    this.now = t;
    this.state = 'seated';
    this.task = 'selfstudy';
    this.studying = true;
    this.studyUntil = t + left;
    this.studyMark = t - mark;
    this.sitCredit = t;
    this.sitWords = words;
    return true;
  }

  standUp(after) {
    this.town.seats.vacate(this.seatRef, this);
    this.showSeated(false);
    this.studying = false;
    this.setVisible(true);
    this.position.copy(this.seatRef.sit);
    this.from.copy(this.seatRef.sit);
    this.facing = Math.PI;
    this.pop = 0.25;
    this.timer = 0;
    this.afterLeave = after;
    this.state = 'leaving';
  }

  rise(after, delay = between(0.2, 3)) {
    if (this.state !== 'seated') return false;
    this.afterLeave = after;
    this.state = 'rising';
    this.timer = delay;
    return true;
  }

}
