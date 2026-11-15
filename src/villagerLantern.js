import * as THREE from 'three';
import { between } from './random.js';
import { LANTERN } from './config.js';
import { answerOf, festivalShare, landedAt, lanternSeconds, lanternSignWorth, lanternTry, lanternWorth, signupOpen } from './lanterns.js';
import { arenaWindow } from './arena.js';
import { pick } from './villagerData.js';

const LANDING_POLL = 1;
const STAND_SPREAD = 0.7;

export class LanternBehavior {
  wantsLanternSignup(ctx = this.town.context) {
    const lanterns = this.town.lanterns;
    if (!lanterns || !this.town.lanternDesk || !signupOpen(ctx.minutes) || lanterns.signed(this.id, ctx.minutes)) return false;
    if (this.lanternPlan?.day !== ctx.day) this.lanternPlan = { day: ctx.day, join: lanternSignWorth(this.id, this.moneyNeed(), this.diligence, lanterns.energyAt(ctx.minutes), this.arenaBusy()) > 0 };
    return this.lanternPlan.join && this.purse.money >= LANTERN.fee;
  }

  arenaBusy() {
    const event = this.town.arena?.event;
    if (!event || event.phase === 'done' || !event.entrants.includes(this.id)) return 0;
    const { from, to } = arenaWindow(event);
    return festivalShare(from, to);
  }

  arenaCost(minutes) {
    const lanterns = this.town.lanterns;
    const event = this.town.arena?.event;
    if (!lanterns || event?.phase !== 'open' || !lanterns.signed(this.id, event.at)) return 0;
    const { from, to } = arenaWindow(event);
    const share = festivalShare(from, to);
    if (!(share > 0)) return 0;
    const need = this.moneyNeed();
    const worth = lanternSignWorth(this.id, need, this.diligence, lanterns.energyAt(minutes)) + LANTERN.fee * need;
    return (Math.max(0, worth) * share) / need;
  }

  goLanternDesk() {
    const desk = this.town.lanternDesk;
    this.task = 'lanternDesk';
    this.lookAt = null;
    this.travel(pick(desk.spots), {
      then: () => {
        this.lookAt = desk.at;
        if (this.town.lanterns.register(this.id, this.town.context.minutes) === 'ok') {
          this.say('🏮', 1.6);
          desk.say('Ghi danh xong!');
        } else this.lanternPlan = { day: this.town.context.day, join: false };
        this.wait(between(1.5, 2.5), () => this.think());
      },
      fail: () => this.think(),
    });
  }

  lanternOption(ctx, need) {
    const lantern = this.town.lanterns?.pickFor(this.id, this.position, ctx.minutes);
    if (!lantern) return null;
    const gain = lanternWorth(this.id, lantern.key, need, this.diligence, this.town.lanterns.energyAt(ctx.minutes));
    const minutes = Math.max(this.walkMinutes(lantern), landedAt(lantern) - ctx.minutes) + lanternSeconds(lantern.key) / 60;
    return { kind: 'lantern', rate: gain / minutes, go: () => this.goLantern(lantern.id) };
  }

  goLantern(id) {
    const lanterns = this.town.lanterns;
    const lantern = lanterns.get(id);
    if (!lantern || lantern.doneAt !== null) {
      this.think();
      return;
    }
    lanterns.claim(this.id, id);
    this.task = 'lantern';
    this.lookAt = null;
    const stand = new THREE.Vector3(lantern.x + between(-STAND_SPREAD, STAND_SPREAD), 0, lantern.z + between(-STAND_SPREAD, STAND_SPREAD));
    this.travel(stand, { then: () => this.awaitLantern(), fail: () => this.endLantern() });
  }

  awaitLantern() {
    const lantern = this.town.lanterns.claimOf(this.id);
    const ctx = this.town.context;
    if (!lantern) {
      this.endLantern();
      return;
    }
    this.lookAt = { x: lantern.x, z: lantern.z };
    if (ctx.minutes < landedAt(lantern)) {
      this.wait(LANDING_POLL, () => this.awaitLantern());
      return;
    }
    this.bubble.setLantern(true);
    const { correct, seconds } = lanternTry(this.id, lantern.key, ctx.day);
    this.lanternSolve = { id: lantern.id, correct, at: ctx.minutes + seconds / 60 };
    this.wait(seconds, () => this.solveLantern(correct));
  }

  lanternJob(minutes) {
    if (this.task !== 'lantern') return null;
    const lantern = this.town.lanterns?.claimOf(this.id);
    if (!lantern) return null;
    const solve = this.lanternSolve;
    if (solve?.id === lantern.id) return { ...solve };
    return { id: lantern.id, at: Math.max(minutes + this.walkMinutes(lantern), landedAt(lantern)) + lanternSeconds(lantern.key) / 60 };
  }

  resumeLantern(job, minutes) {
    const lantern = this.town.lanterns?.get(job.id);
    if (!lantern || lantern.doneAt !== null) return false;
    this.cancel();
    const near = Math.hypot(lantern.x - this.position.x, lantern.z - this.position.z) <= LANTERN.reach;
    if (typeof job.correct !== 'boolean' || !near) {
      this.goLantern(lantern.id);
      return true;
    }
    this.town.lanterns.claim(this.id, lantern.id);
    this.task = 'lantern';
    this.lookAt = { x: lantern.x, z: lantern.z };
    this.lanternSolve = { id: lantern.id, correct: job.correct, at: job.at };
    this.bubble.setLantern(true);
    this.wait(Math.max(0, job.at - minutes) * 60, () => this.solveLantern(job.correct));
    return true;
  }

  solveLantern(correct) {
    const lanterns = this.town.lanterns;
    const lantern = lanterns.claimOf(this.id);
    if (lantern) {
      const outcome = lanterns.attempt(this.id, lantern.id, correct ? answerOf(lantern.key) : '', this.town.context.minutes);
      if (outcome.ok) this.say('🏮✨', 1.8);
      else if (outcome.reason === 'wrong') this.say('Sai mất rồi...', 1.6);
    }
    this.endLantern();
  }

  endLantern() {
    this.town.lanterns?.release(this.id);
    this.lanternSolve = null;
    this.bubble.setLantern(false);
    this.lookAt = null;
    this.task = null;
    this.wait(between(0.5, 1.5));
  }
}
