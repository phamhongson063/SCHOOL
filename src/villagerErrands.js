import { between } from './random.js';
import { VILLAGER, BANK, ATM } from './config.js';
import { BLOCKED, NAGS, pick } from './villagerData.js';
import { economy } from './economy.js';

export class ErrandBehavior {
  enqueue(queue, serve) {
    this.queue = queue;
    this.serve = serve;
    queue.join(this);
    this.followQueue();
  }

  lineUp(queue, serve) {
    this.queue = queue;
    this.serve = serve;
    this.approachQueue();
  }

  approachQueue() {
    const queue = this.queue;
    if (!queue) return;
    if (queue.reached(this.position)) {
      queue.join(this);
      this.followQueue();
      return;
    }
    this.travel(queue.tail(), {
      then: () => this.approachQueue(),
      fail: () => this.retryQueue(() => this.approachQueue()),
    });
  }

  retryQueue(next) {
    this.queueTries = (this.queueTries ?? 0) + 1;
    if (this.queueTries > 3) {
      this.queueTries = 0;
      this.finishService();
      return;
    }
    this.wait(between(0.6, 1.4), next);
  }

  leaveQueue() {
    if (!this.queue) return;
    this.queue.leave(this);
    this.queue = null;
    this.queueIndex = -1;
    this.serve = null;
    if (this.blocked) {
      this.blocked = false;
      this.lookAt = null;
    }
  }

  followQueue() {
    const index = this.queue?.indexOf(this) ?? -1;
    if (index < 0) {
      this.leaveQueue();
      this.wait(0.5);
      return;
    }
    this.queueIndex = index;
    const spot = this.queue.slot(index);
    if (this.town.playerBlocks(this.queue, spot)) {
      this.waitForPlayer();
      return;
    }
    if (this.blocked) {
      this.blocked = false;
      this.lookAt = null;
    }
    this.travel(spot, {
      then: () => {
        this.queueTries = 0;
        this.queued();
      },
      fail: () => this.retryQueue(() => this.followQueue()),
    });
  }

  queued() {
    const index = this.queue?.indexOf(this) ?? -1;
    if (index < 0) {
      this.leaveQueue();
      this.wait(0.5);
      return;
    }
    if (index !== this.queueIndex) {
      this.followQueue();
      return;
    }
    if (index === 0) {
      this.facing = this.queue.facingAt(0);
      this.lookAt = this.queue.look;
      const serve = this.serve;
      this.serve = null;
      this.state = 'idle';
      this.timer = 0;
      serve?.();
      return;
    }
    this.state = 'queued';
  }

  waitForPlayer() {
    this.route = null;
    this.state = 'queued';
    this.blocked = true;
    this.lookAt = this.town.player?.position ?? null;
    if (this.now < (this.nagAt ?? 0)) return;
    this.nagAt = this.now + BLOCKED.nagEvery;
    this.say(pick(NAGS), 2.6);
  }

  finishService() {
    this.leaveQueue();
    this.fishing = null;
    this.task = null;
    this.think();
  }

  goShop() {
    this.cancel();
    this.task = 'shop';
    this.lineUp(this.town.queues.shop, () => this.trade());
  }

  trade() {
    if (!this.town.context.shopOpen) {
      this.say('Tiệm đóng cửa mất rồi!');
      this.wait(1.5, () => this.finishService());
      return;
    }
    const lines = this.town.market.trade(this);
    if (lines.length) this.say(lines.join(' · '), 2.6);
    this.wait(between(1.5, 3), () => this.finishService());
  }

  goFishShop() {
    this.cancel();
    this.task = 'fishshop';
    this.lineUp(this.town.queues.fish, () => this.fishTrade());
  }

  fishTrade() {
    if (!this.town.context.fishOpen) {
      this.say('Hàng cá đóng cửa mất rồi!');
      this.wait(1.5, () => this.finishService());
      return;
    }
    const lines = this.town.market.fishTrade(this);
    if (lines.length) this.say(lines.join(' · '), 2.6);
    this.wait(between(1.5, 3), () => this.finishService());
  }

  bankClient() {
    return { id: this.id, purse: this.purse, thrift: this.thrift, roll: this.bankRoll, income: economy.dailyFlow(this.id) };
  }

  nearestAtm() {
    let best = null;
    let bestDistance = Infinity;
    for (const atm of this.town.atms) {
      const queue = this.town.queues[`atm:${atm.id}`];
      const distance = this.distanceTo(queue.line[0]);
      if (distance < bestDistance) {
        best = queue;
        bestDistance = distance;
      }
    }
    return best;
  }

  distanceTo(point) {
    return Math.hypot(point.x - this.position.x, point.z - this.position.z);
  }

  moneyErrand(ctx) {
    const bank = this.town.bank;
    if (!bank) return null;
    const since = this.bankAt === null ? Infinity : ctx.minutes - this.bankAt;
    if (since < BANK.npc.urgentGap) return null;
    const client = this.bankClient();
    const desk = ctx.bankOpen ? this.town.queues.bank : null;
    const atm = this.nearestAtm();
    const deskPlan = desk ? bank.npcPlan(client) : null;
    const atmPlan = atm ? bank.npcAtmPlan(client) : null;
    const plan = deskPlan ?? atmPlan;
    if (!plan || (!plan.urgent && since < BANK.npc.restGap)) return null;
    const useAtm = !!atmPlan && (!deskPlan || this.distanceTo(desk.line[0]) > this.distanceTo(atm.line[0]) + ATM.detour);
    const queue = useAtm ? atm : desk;
    if (!plan.urgent && queue.members.length >= BANK.npc.maxLine) return null;
    return { queue, atm: useAtm };
  }

  goMoney({ queue, atm }) {
    this.cancel();
    this.task = atm ? 'atm' : 'bank';
    this.bankAt = this.town.context.minutes;
    this.lineUp(queue, () => (atm ? this.visitAtm() : this.visitBank()));
  }

  visitAtm() {
    this.say(this.town.bank.npcAtmServe(this.bankClient()), 2.6);
    this.bankRoll = Math.random();
    this.wait(between(1.5, 3), () => this.finishService());
  }

  visitBank() {
    this.say(this.town.context.bankOpen ? this.town.bank.npcServe(this.bankClient()) : 'Ngân hàng đóng cửa mất rồi!', 2.6);
    this.bankRoll = Math.random();
    this.wait(between(1.5, 3), () => this.finishService());
  }

  goChief() {
    this.cancel();
    this.task = 'chief';
    this.lineUp(this.town.queues.chief, () => this.visitChief());
  }

  visitChief() {
    const house = this.town.context.chiefOpen ? this.town.estate.buyFor(this.id, this.purse, VILLAGER.houseReserve) : null;
    this.say(house ? `🏠 Mua được nhà số ${house.id} rồi!` : this.town.context.chiefOpen ? 'Chưa đủ tiền mua nhà...' : 'Lý trưởng nghỉ mất rồi!', 2.6);
    this.wait(between(1.5, 3), () => this.finishService());
  }
}
