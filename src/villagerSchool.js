import { between } from './random.js';
import { ROUTINE, SCHOOL, CERTIFY } from './config.js';
import { certify } from './certify.js';
import { DECK_IDS } from './studyDecks.js';
import { examOpen } from './examHall.js';
import { BACK, BROKE, CLASS_FULL, LATE, PAID, PLAY, SELF_STUDY, TAKEN, pick } from './villagerData.js';
import { economy } from './economy.js';
import { CX, HOUSE } from './school.js';

const CLASS_DOOR = { x: CX, z: HOUSE.front - 1.5 };
const INTERNAL_TRIES = 3;
const FORGET = 0.15;
const INTERNAL_TALK = [3, 6];

const answerSkill = (member) => Math.min(0.99, 0.9 + 0.09 * member.diligence);
const simulate = (member, keys) => keys.map((key) => ({ key, correct: Math.random() < answerSkill(member) }));

export class SchoolBehavior {
  classSession(ctx) {
    const phase = ctx.phase;
    const start = phase.kind === 'free' ? phase.next?.start : phase.start;
    const session = start < SCHOOL.afternoon ? 'morning' : start < SCHOOL.evening ? 'afternoon' : 'evening';
    return `${phase.day}:${session}`;
  }

  turnAway() {
    const seat = this.town.spareSeat(this);
    if (seat) {
      this.targetSeat = seat;
      this.town.seats.reserve(seat, this);
      this.travel(seat.spot, { speed: this.returnSpeed, then: () => this.takeSeat(), fail: () => this.takeSeat() });
      return;
    }
    this.targetSeat = null;
    this.turnedAway = this.classSession(this.town.context);
    this.say(pick(CLASS_FULL), 2);
    this.think();
  }

  goToClass() {
    const seats = this.town.seats;
    const own = this.homeSeat && seats.isFreeFor(this.homeSeat, this) ? this.homeSeat : this.town.spareSeat(this);
    this.cancel();
    if (!own) {
      this.task = 'class';
      this.targetSeat = null;
      this.travel(this.town.walkable(CLASS_DOOR), { then: () => this.turnAway(), fail: () => this.turnAway() });
      return;
    }
    this.task = 'class';
    seats.reserve(own, this);
    this.targetSeat = own;
    this.homeSeat ??= own;
    const phase = this.town.context.phase;
    const hurry = phase.kind !== 'free' || phase.remaining < 6;
    this.travel(own.spot, {
      speed: hurry ? this.runSpeed : this.walkSpeed,
      then: () => this.takeSeat(),
      fail: () => {
        this.cancel();
        this.goFarm();
      },
    });
  }

  retargetSeat() {
    const seats = this.town.seats;
    seats.unreserve(this.targetSeat, this);
    const next = this.town.spareSeat(this);
    this.targetSeat = next;
    if (!next) {
      this.turnAway();
      return;
    }
    seats.reserve(next, this);
    this.say(pick(TAKEN));
    this.travel(next.spot, {
      speed: Math.max(this.cruise, this.returnSpeed),
      then: () => this.takeSeat(),
      fail: () => {
        this.cancel();
        this.goFarm();
      },
    });
  }

  takeSeat() {
    const seats = this.town.seats;
    if (!this.targetSeat || !seats.canTake(this.targetSeat, this)) {
      this.retargetSeat();
      return;
    }
    seats.occupy(this.targetSeat, this);
    this.seatRef = this.targetSeat;
    this.targetSeat = null;
    this.seatRef.place(this.seated.group);
    this.from.copy(this.position);
    this.timer = 0;
    this.state = 'sitting';
  }

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

  studyDeckWanted() {
    return DECK_IDS.find((deck) => certify.learnLeft(this.id, deck).length > 0 || this.canTakeInternal(deck)) ?? null;
  }

  studySeatFor(deck) {
    if (!deck || this.purse.money < CERTIFY.learnFee) return null;
    const seats = this.town.studySeats;
    return seats.nearestFree(this.position, this, (seat) => seat.deck === deck && seats.restLeft(seat, this, this.now) <= 0);
  }

  wantsSelfStudy(ctx) {
    if (!this.seated || this.now < this.studyRestAt) return false;
    const deck = this.studyDeckWanted();
    if (!deck || Math.random() >= SELF_STUDY.chance * this.diligence) return false;
    if (!ctx.night && this.wantsInternal(deck)) return true;
    return !!this.studySeatFor(deck);
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

  goSelfStudy() {
    const seats = this.town.studySeats;
    const deck = this.studyDeckWanted();
    if (deck && !this.town.context.night && this.wantsInternal(deck)) {
      this.goInternal(deck);
      return;
    }
    const seat = this.studySeatFor(deck);
    this.cancel();
    if (!seat) {
      this.quitSelfStudy();
      return;
    }
    this.task = 'selfstudy';
    seats.reserve(seat, this);
    this.targetSeat = seat;
    this.travel(seat.spot, { then: () => this.takeStudySeat(), fail: () => this.quitSelfStudy() });
  }

  takeStudySeat() {
    const seats = this.town.studySeats;
    const seat = this.targetSeat;
    if (!seat || !seats.canTake(seat, this)) {
      this.goSelfStudy();
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

  takeInternal() {
    const deck = this.internalDeck;
    const teacher = this.town.classTeachers[deck];
    const done = () => {
      teacher?.release(this);
      this.internalDeck = null;
      this.finishService();
    };
    teacher?.attend(this);
    if (!this.canTakeInternal(deck) || !this.purse.spend(CERTIFY.internalFee)) {
      this.wait(between(1, 2), done);
      return;
    }
    economy.income('teacher', CERTIFY.internalFee, this.id);
    this.internalTries[deck] = (this.internalTries[deck] ?? 0) + 1;
    const { passed } = certify.gradeInternal(this.id, deck, simulate(this, certify.internalQuestions(this.id, deck)));
    this.wait(between(...INTERNAL_TALK), () => {
      this.say(passed ? '📝✓' : '📝✗', 1.8);
      this.wait(between(1, 2), done);
    });
  }

  learnTick(t) {
    const deck = this.seatRef?.deck;
    if (!deck) return false;
    const left = certify.learnLeft(this.id, deck);
    if (!left.length) return true;
    if (t - this.studyMark < CERTIFY.viewSeconds) return false;
    this.studyMark = t;
    const key = left[(this.learnTurn = (this.learnTurn ?? 0) + 1) % left.length];
    if (Math.random() < FORGET * (1 - this.diligence)) certify.forget(this.id, deck, key);
    else {
      certify.remember(this.id, deck, key);
      this.sitWords += 1;
    }
    return false;
  }

  examDeckWanted(ctx) {
    if (!this.seated || ctx.night || !examOpen(ctx.minutes)) return null;
    if (this.purse.intellect < CERTIFY.examIntellect || this.purse.money < CERTIFY.examFee) return null;
    return DECK_IDS.find((deck) => certify.qualified(this.id, deck) && !certify.examTaken(this.id, deck)) ?? null;
  }

  goExam() {
    const deck = this.examDeckWanted(this.town.context);
    const seat = deck ? this.town.spareSeat(this) : null;
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
      then: () => this.takeSeat(),
      fail: () => {
        this.cancel();
        this.task = null;
        this.wait(between(1, 2));
      },
    });
  }

  startExam() {
    const deck = this.examDeck;
    const purse = this.purse;
    const ready = deck && certify.qualified(this.id, deck) && !certify.examTaken(this.id, deck);
    if (!ready || !purse.take('intellect', CERTIFY.examIntellect)) {
      this.examDeck = null;
      this.rise(() => this.think(), between(0.5, 2));
      return;
    }
    if (!purse.spend(CERTIFY.examFee)) {
      purse.add('intellect', CERTIFY.examIntellect);
      this.examDeck = null;
      this.rise(() => this.think(), between(0.5, 2));
      return;
    }
    economy.income('teacher', CERTIFY.examFee, this.id);
    this.examKeys = certify.examQuestions(this.id, deck);
    this.examUntil = this.now + this.examKeys.length * CERTIFY.seconds[deck] * between(0.4, 0.8);
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
      this.recess = false;
      if (!this.purse.spend(CERTIFY.learnFee)) {
        this.task = null;
        this.rise(() => this.think(), between(0.3, 1.5));
        return;
      }
      economy.income('teacher', CERTIFY.learnFee, this.id);
      this.task = 'selfstudy';
      this.studying = true;
      this.studyUntil = this.now + CERTIFY.sitSeconds;
      this.studyMark = this.now;
      this.sitWords = 0;
      return;
    }
    if (this.task === 'exam') {
      this.recess = false;
      this.startExam();
      return;
    }
    this.task = 'class';
    this.recess = false;
    const phase = this.town.context.phase;
    if (phase.kind === 'period' && !this.studying) this.payAt = this.now + between(0.1, 0.6);
    const waiting = phase.kind !== 'free' || (phase.next && phase.remaining <= ROUTINE.schoolLead);
    if (!waiting || this.town.context.night) this.rise(() => this.think(), between(1, 3));
  }

  seatDirect(seat) {
    this.cancel();
    this.town.seats.occupy(seat, this);
    this.homeSeat ??= seat;
    this.seatRef = seat;
    seat.place(this.seated.group);
    this.position.copy(seat.sit);
    this.setVisible(false);
    this.showSeated(true);
    this.state = 'seated';
    this.task = 'class';
  }

  standUp(after) {
    this.town.seats.vacate(this.seatRef, this);
    this.showSeated(false);
    this.studying = false;
    this.payAt = null;
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

  pay() {
    this.payAt = null;
    const purse = this.purse;
    const credit = purse.useCredit();
    if (credit || purse.spend(SCHOOL.tuition)) {
      if (!credit) economy.income('teacher', SCHOOL.tuition, purse.id);
      this.studying = true;
      if (Math.random() < 0.35) this.say(pick(PAID), 1.6);
      return;
    }
    this.studying = false;
    if (Math.random() < 0.4) this.say(pick(BROKE), 2);
  }

  periodStart(ctx) {
    if (this.task === 'selfstudy') return;
    this.studying = false;
    if (this.state === 'seated') this.payAt = this.now + between(0.1, 0.6);
  }

  periodEnd() {
    if (this.task === 'selfstudy') return;
    this.studying = false;
    this.payAt = null;
  }

  startRecess(delay) {
    if (this.task !== 'class') return;
    this.returnSpeed = Math.random() < 0.4 ? this.runSpeed : this.walkSpeed;
    this.returnMargin = between(4, 9);
    if (this.state === 'seated') {
      this.rise(() => {
        this.recess = true;
        this.chooseActivity();
      }, delay);
      return;
    }
    if (this.state === 'sitting' || this.state === 'rising') return;
    if (this.targetSeat) this.town.seats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.recess = true;
    this.chooseActivity();
  }

  dueBack(breakLeft) {
    if (!this.recess || this.activity === 'return' || (this.state !== 'walking' && this.state !== 'idle')) return false;
    const spot = (this.seatRef ?? this.homeSeat)?.spot;
    if (!spot) return false;
    const distance = Math.hypot(spot.x - this.position.x, spot.z - this.position.z) * 1.35 + 2;
    return breakLeft <= distance / (this.returnSpeed * 0.8) + this.returnMargin;
  }

  endRecess(late = false) {
    if (!this.recess) return;
    if (this.state === 'rising') {
      this.state = 'seated';
      this.recess = false;
      return;
    }
    this.town.releaseSlot(this);
    this.lookAt = null;
    this.activity = 'return';
    this.pauseTimer = 0;
    this.state = 'heeding';
    this.route = null;
    this.timer = late ? between(0, 0.5) : between(0, 1.6);
    if (late) this.returnSpeed = this.runSpeed;
    this.lateReturn = late;
  }

  headBack() {
    const seats = this.town.seats;
    const mine = this.seatRef ?? this.homeSeat;
    const own = mine && seats.isFreeFor(mine, this);
    const target = own ? mine : this.town.spareSeat(this);
    this.recess = false;
    this.activity = null;
    if (!target) {
      this.task = null;
      this.think();
      return;
    }
    seats.reserve(target, this);
    this.targetSeat = target;
    this.task = 'class';
    if (!own) this.say(pick(TAKEN));
    else if (Math.random() < 0.6) this.say(pick(this.lateReturn ? LATE : BACK), 1.6);
    this.travel(target.spot, { speed: this.returnSpeed, then: () => this.takeSeat(), fail: () => this.takeSeat() });
  }

  leaveSchool(delay = between(0.3, 4)) {
    if (this.state === 'seated') {
      this.rise(() => this.think(), delay);
      return;
    }
    if (this.state === 'rising') {
      this.afterLeave = () => this.think();
      return;
    }
    if (this.recess || this.task === 'class') {
      if (this.state === 'sitting') return;
      this.cancel();
      this.task = null;
      if (this.state === 'walking' || this.state === 'idle' || this.state === 'heeding') this.think();
    }
  }

  chooseActivity() {
    this.lookAt = null;
    const r = Math.random();
    if (r < 0.45) {
      const slot = this.town.reserveSlot(this);
      if (slot) {
        this.activity = 'chat';
        this.lookAt = slot.center;
        this.travel(slot.position, { then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
        return;
      }
    }
    if (r < 0.75) {
      this.activity = 'wander';
      this.travel(this.town.yardPoint(), { speed: this.walkSpeed, then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
      return;
    }
    this.activity = 'play';
    this.playLegs = 3 + Math.floor(Math.random() * 3);
    this.say(pick(PLAY), 1.4);
    this.travel(this.nearby(4), { speed: this.runSpeed, then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
  }

  arriveActivity() {
    if (!this.recess) {
      this.wait(0.5);
      return;
    }
    if (this.activity === 'chat') {
      this.wait(between(6, 11), () => this.recessNext());
      this.nextLine = between(0.5, 2.5) / this.chatty;
      return;
    }
    if (this.activity === 'play' && --this.playLegs > 0) {
      if (Math.random() < 0.3) this.say(pick(PLAY), 1.2);
      this.travel(this.nearby(4), { speed: this.runSpeed, then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
      return;
    }
    this.wait(between(1.5, 4.5), () => this.recessNext());
  }

  recessNext() {
    this.town.releaseSlot(this);
    if (this.recess) this.chooseActivity();
    else this.think();
  }
}
