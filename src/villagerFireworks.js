import { between } from './random.js';
import { FIREWORKS } from './config.js';
import { fireworksEnd, fireworksGatherAt, fireworksSignOpen } from './fireworksRules.js';

const WATCH_POLL = 1.5;

export class FireworksBehavior {
  fireworksOption(ctx, need) {
    const fireworks = this.town.fireworks;
    const field = this.town.fireworksField;
    if (!fireworks || !field || !fireworksSignOpen(ctx.minutes) || fireworks.joined(this.id, ctx.minutes) || this.purse.money < FIREWORKS.fee) return null;
    const worth = fireworks.worth(this.id, ctx.minutes, need, this.diligence);
    if (!(worth > 0)) return null;
    const minutes = this.walkMinutes(field.center) + FIREWORKS.gather + FIREWORKS.minutes;
    return { kind: 'fireworks', minutes, rate: worth / minutes, go: () => this.goFireworks() };
  }

  goFireworks() {
    const field = this.town.fireworksField;
    this.task = 'fireworks';
    this.lookAt = null;
    const leave = () => {
      field.leaveSpot(this.id);
      this.think();
    };
    this.travel(field.spotFor(this.id, this.position, this.walkSpeed), {
      then: () => {
        const outcome = this.town.fireworks.register(this.id, this.town.context.minutes);
        if (outcome !== 'ok' && outcome !== 'already') return leave();
        if (outcome === 'ok') this.say('🎆', 1.6);
        this.stayFireworks();
      },
      fail: leave,
    });
  }

  fireworksSeatWanted(ctx = this.town.context) {
    const fireworks = this.town.fireworks;
    if (!fireworks || !this.town.fireworksField || this.fireworksGaveUp === ctx.day || !fireworks.joined(this.id, ctx.minutes) || fireworks.result(ctx.minutes)) return false;
    return ctx.minutes >= fireworksGatherAt(ctx.day) && ctx.minutes < fireworksEnd(ctx.day) && !this.needsSleep(ctx);
  }

  goFireworksSeat() {
    const field = this.town.fireworksField;
    this.task = 'fireworks';
    this.lookAt = null;
    this.travel(field.spotFor(this.id, this.position, this.walkSpeed), {
      then: () => this.stayFireworks(),
      fail: () => {
        field.leaveSpot(this.id);
        this.fireworksGaveUp = this.town.context.day;
        this.task = null;
        this.wait(between(2, 4));
      },
    });
  }

  seatFireworks() {
    const spot = this.town.fireworksField.spotFor(this.id, this.position, this.walkSpeed);
    this.position.copy(spot);
    this.setVisible(true);
    this.stayFireworks();
  }

  stayFireworks() {
    const field = this.town.fireworksField;
    const ctx = this.town.context;
    if (!field || ctx.minutes < fireworksGatherAt(ctx.day) || !this.fireworksSeatWanted(ctx)) {
      this.endFireworks();
      return;
    }
    this.task = 'fireworks';
    this.lookAt = field.sky;
    this.wait(WATCH_POLL, () => this.stayFireworks());
  }

  endFireworks() {
    this.town.fireworksField?.leaveSpot(this.id);
    this.lookAt = null;
    this.task = null;
    this.wait(between(1, 2.5));
  }
}
