import { between } from './random.js';
import { ROUTINE, SCHOOL } from './config.js';
import { BACK, BROKE, CLASS_FULL, LATE, PAID, PLAY, SELF_STUDY, TAKEN, pick } from './villagerData.js';
import { economy } from './economy.js';
import { CX, HOUSE } from './school.js';

const CLASS_DOOR = { x: CX, z: HOUSE.front - 1.5 };

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

  wantsSelfStudy(ctx) {
    if (!this.seated || ctx.night || ctx.phase.kind === 'period' || this.now < this.studyRestAt) return false;
    if (Math.random() >= SELF_STUDY.chance * this.diligence) return false;
    return !!this.town.studySeats.nearestFree(this.position, this);
  }

  goSelfStudy() {
    const seats = this.town.studySeats;
    const seat = seats.nearestFree(this.position, this);
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

  selfStudyUpdate(t) {
    const ctx = this.town.context;
    if (t < this.studyUntil && !ctx.night && !this.shouldAttend(ctx)) return;
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
      this.task = 'selfstudy';
      this.recess = false;
      this.studying = true;
      this.studyUntil = this.now + between(...SELF_STUDY.stay);
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
      if (!credit) economy.income('teacher', SCHOOL.tuition);
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
