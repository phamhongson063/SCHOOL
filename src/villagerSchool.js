import { between } from './random.js';
import { CERTIFY } from './config.js';
import { certify } from './certify.js';
import { DECK_IDS } from './studyDecks.js';
import { examOpen } from './examHall.js';
import { SELF_STUDY } from './villagerData.js';
import { economy } from './economy.js';
import { absorption } from './absorption.js';

const INTERNAL_TRIES = 3;
const INTERNAL_SEAT_RETRY = 1;

export const simulate = (member, keys) => keys.map((key) => ({ key, correct: absorption.answer(member.id, key) }));

export class SchoolBehavior {
  internalTriesLeft(deck) {
    const day = this.town.context.day;
    if (this.internalDay !== day) {
      this.internalDay = day;
      this.internalTries = {};
    }
    return INTERNAL_TRIES - (this.internalTries[deck] ?? 0);
  }

  canTakeInternal(deck) {
    return certify.internalReady(this.id, deck) && this.purse.money >= CERTIFY.internalFee && this.internalTriesLeft(deck) > 0;
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
      const learning = certify.learnLeft(this.id, deck).length > 0;
      const internal = !ctx.night && this.canTakeInternal(deck);
      if (!learning && !internal) continue;
      const score = (internal && !learning ? 1 : this.hallRoom(deck)) + Math.random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = deck;
      }
    }
    return best;
  }

  studySeatFor(deck) {
    if (!deck || this.purse.money < CERTIFY.learnFee) return null;
    const seats = this.town.studySeats;
    const wait = this.town.seatWait;
    return seats.nearestFree(this.position, this, (seat) => seat.deck === deck && seats.restLeft(seat, this, this.now) <= 0 && (!wait || wait.openTo(seat, this, this.now)));
  }

  canWaitForSeat(deck) {
    const ctx = this.town.context;
    if (!deck || !this.town.seatWait?.hasRoom(deck) || ctx.night || this.needsSleep(ctx)) return false;
    return this.purse.money >= CERTIFY.learnFee && certify.learnLeft(this.id, deck).length > 0;
  }

  waitForSeat(deck) {
    const spot = this.town.seatWait.join(deck, this, {
      ready: () => this.task === 'seatwait' && this.purse.money >= CERTIFY.learnFee && certify.learnLeft(this.id, deck).length > 0,
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
    if (!wait.has(this) || ctx.night || this.needsSleep(ctx) || this.now >= this.seatWaitUntil) {
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
    const seats = this.town.studySeats;
    this.cancel();
    this.lookAt = null;
    this.task = 'selfstudy';
    seats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, { then: () => this.claimSeat(seats, () => this.goSelfStudy()), fail: () => this.quitSelfStudy() });
  }

  wantsInternal(deck) {
    return !certify.learnLeft(this.id, deck).length && this.canTakeInternal(deck) && !!this.town.queues[`teacher:${deck}`];
  }

  goInternal(deck) {
    this.cancel();
    this.task = 'internal';
    this.internalDeck = deck;
    this.lineUp(this.town.queues[`teacher:${deck}`], () => this.takeInternal());
  }

  goSelfStudy(deck = this.studyDeckWanted()) {
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
    const seats = this.town.studySeats;
    const seat = this.studySeatFor(deck);
    this.cancel();
    if (!seat) {
      if (this.canWaitForSeat(deck)) this.waitForSeat(deck);
      else this.quitSelfStudy();
      return;
    }
    this.task = 'selfstudy';
    seats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, { then: () => this.claimSeat(seats, () => this.goSelfStudy()), fail: () => this.quitSelfStudy() });
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
    this.town.studySeats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.task = null;
    this.wait(between(1, 2));
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
    if (!this.canTakeInternal(deck) || !this.purse.spend(CERTIFY.internalFee)) return null;
    economy.income('teacher', CERTIFY.internalFee, this.id);
    this.internalTries[deck] = (this.internalTries[deck] ?? 0) + 1;
    const keys = certify.internalQuestions(this.id, deck);
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
    this.internalKeys = keys;
    this.internalUntil = this.now + this.internalKeys.length * pace;
    this.studying = true;
  }

  internalUpdate(t) {
    if (!this.internalKeys || t < this.internalUntil) return;
    const deck = this.internalDeck;
    const keys = this.internalKeys;
    this.internalDeck = null;
    this.internalKeys = null;
    const { passed } = certify.gradeInternal(this.id, deck, simulate(this, keys));
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
    if (absorption.forgets(this.id)) {
      certify.forget(this.id, deck, key);
      return false;
    }
    certify.remember(this.id, deck, key);
    return true;
  }

  examDeckWanted(ctx) {
    if (!this.seated || ctx.night || !examOpen(ctx.minutes)) return null;
    if (this.purse.intellect < CERTIFY.examIntellect || this.purse.money < CERTIFY.examFee) return null;
    return DECK_IDS.find((deck) => certify.qualified(this.id, deck) && !certify.examTaken(this.id, deck)) ?? null;
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
    if (!ready || !purse.take('intellect', CERTIFY.examIntellect)) return null;
    if (!purse.spend(CERTIFY.examFee)) {
      purse.add('intellect', CERTIFY.examIntellect);
      return null;
    }
    economy.income('teacher', CERTIFY.examFee, this.id);
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
    this.examKeys = keys;
    this.examUntil = this.now + keys.length * pace;
    this.studying = true;
  }

  examUpdate(t) {
    if (!this.examKeys || t < this.examUntil) return;
    const deck = this.examDeck;
    const keys = this.examKeys;
    this.examDeck = null;
    this.examKeys = null;
    const result = certify.gradeExam(this.id, deck, simulate(this, keys));
    this.say(result.passed ? '🎓' : '📄', 2.4);
    this.rise(() => {
      this.task = null;
      this.think();
    }, between(0.3, 1.5));
  }

  selfStudyUpdate(t) {
    const ctx = this.town.context;
    const done = this.learnTick(t);
    const sitOver = t >= this.studyUntil || this.sitWords >= CERTIFY.sitWords;
    if (!sitOver && !this.needsSleep(ctx) && !done) return;
    const deck = this.seatRef?.deck;
    if (sitOver) this.town.studySeats.rest(this.seatRef, this, t + CERTIFY.seatRest);
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
    if (this.seatRef.study) {
      if (!this.payStudy()) {
        this.task = null;
        this.rise(() => this.think(), between(0.3, 1.5));
        return;
      }
      this.task = 'selfstudy';
      this.studying = true;
      this.studyUntil = this.now + CERTIFY.sitSeconds;
      this.studyMark = this.now;
      this.sitWords = 0;
      return;
    }
    if (this.task === 'exam') {
      this.startExam();
      return;
    }
    if (this.task === 'internal') {
      this.startInternal();
      return;
    }
    this.rise(() => this.think(), between(1, 3));
  }

  payStudy() {
    if (!this.purse.spend(CERTIFY.learnFee)) return false;
    economy.income('teacher', CERTIFY.learnFee, this.id);
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
