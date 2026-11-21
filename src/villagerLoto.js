import { between } from './random.js';
import { LOTO } from './config.js';
import { callMinutes, lotoEnd, lotoGatherAt, lotoPool, lotoSignOpen } from './lotoRules.js';
import { lotoWorth } from './loto.js';

const LOTO_POLL = 1.5;

export class LotoBehavior {
  lotoOption(ctx, need) {
    const loto = this.town.loto;
    const court = this.town.lotoCourt;
    if (!loto || !court || !lotoSignOpen(ctx.minutes) || loto.joined(this.id, ctx.minutes) || this.purse.money < LOTO.fee) return null;
    const worth = lotoWorth(this.id, ctx.minutes, loto.entrants(ctx.minutes), loto.pot(ctx.minutes));
    if (!(worth > 0)) return null;
    const minutes = this.walkMinutes(court.center) + LOTO.gather + lotoPool(ctx.day).length * callMinutes;
    return { kind: 'loto', minutes, rate: (worth * need) / minutes, go: () => this.goLoto() };
  }

  goLoto() {
    const court = this.town.lotoCourt;
    this.task = 'loto';
    this.lookAt = null;
    const leave = () => {
      court.leaveSpot(this.id);
      this.think();
    };
    this.travel(court.spotFor(this.id, this.position, this.walkSpeed), {
      then: () => {
        const outcome = this.town.loto.register(this.id, this.town.context.minutes);
        if (outcome !== 'ok' && outcome !== 'already') return leave();
        if (outcome === 'ok') this.say('🎴', 1.6);
        this.stayLoto();
      },
      fail: leave,
    });
  }

  lotoSeatWanted(ctx = this.town.context) {
    const loto = this.town.loto;
    if (!loto || !this.town.lotoCourt || this.lotoGaveUp === ctx.day || !loto.joined(this.id, ctx.minutes) || loto.result(ctx.minutes)) return false;
    return ctx.minutes >= lotoGatherAt(ctx.day) && ctx.minutes < lotoEnd(ctx.day) && !this.needsSleep(ctx);
  }

  goLotoSeat() {
    const court = this.town.lotoCourt;
    this.task = 'loto';
    this.lookAt = null;
    this.travel(court.spotFor(this.id, this.position, this.walkSpeed), {
      then: () => this.stayLoto(),
      fail: () => {
        court.leaveSpot(this.id);
        this.lotoGaveUp = this.town.context.day;
        this.task = null;
        this.wait(between(2, 4));
      },
    });
  }

  seatLoto() {
    const spot = this.town.lotoCourt.spotFor(this.id, this.position, this.walkSpeed);
    this.position.copy(spot);
    this.setVisible(true);
    this.stayLoto();
  }

  stayLoto() {
    const loto = this.town.loto;
    const court = this.town.lotoCourt;
    const ctx = this.town.context;
    const result = loto?.result(ctx.minutes);
    const early = ctx.minutes < lotoGatherAt(ctx.day);
    if (!loto || !court || early || !this.lotoSeatWanted(ctx)) {
      if (result?.winners.includes(this.id)) this.say('Kinh! 🎉', 2.5);
      this.endLoto();
      return;
    }
    this.task = 'loto';
    this.lookAt = court.caller.at;
    this.bubble.setLoto(loto.near(this.id, ctx.minutes));
    this.wait(LOTO_POLL, () => this.stayLoto());
  }

  endLoto() {
    this.town.lotoCourt?.leaveSpot(this.id);
    this.bubble.setLoto(false);
    this.lookAt = null;
    this.task = null;
    this.wait(between(1, 2.5));
  }
}
