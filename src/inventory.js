import { CROPS } from './crops.js';
import { STARTER, FISH, FISHING, ENERGY, WILDLIFE, LODGE_ROOMS, SNACKS, CERTIFY } from './config.js';
import { energyRate, isNight, nextShift, OFFLINE_GAP } from './stamina.js';
import { createPairStore, without } from './persist.js';
import { playerId, selfKey, worldKey } from './saveKeys.js';

const WORLD_KEY = worldKey('ledger');
const SELF_KEY = selfKey('ledger');
const FULL_MARGIN = 0.5;

export const PLAYER = playerId();
export const seedId = (crop) => `seed:${crop}`;

export const ITEMS = {};
for (const [id, crop] of Object.entries(CROPS)) {
  ITEMS[id] = { icon: crop.icon, art: id, name: crop.name, kind: 'produce', crop: id, unit: crop.unit };
}
for (const [id, crop] of Object.entries(CROPS)) {
  ITEMS[seedId(id)] = { icon: crop.icon, art: id, name: crop.seedName, kind: 'seed', crop: id, unit: 'gói' };
}
ITEMS.fertilizer = { icon: '🧪', name: 'Phân bón', kind: 'fertilizer', unit: 'bao' };
export const fishId = (fish) => `fish:${fish}`;
for (const [id, fish] of Object.entries(FISH)) {
  ITEMS[fishId(id)] = { icon: fish.icon, art: id, name: fish.name, kind: 'fish', fish: id, unit: 'con' };
}
export const gameId = (animal) => `game:${animal}`;
for (const [id, animal] of Object.entries(WILDLIFE)) {
  if (animal.gentle) ITEMS[gameId(id)] = { icon: animal.icon, name: animal.name, kind: 'game', animal: id, unit: 'con' };
}
export const snackId = (snack) => `snack:${snack}`;
for (const [id, snack] of Object.entries(SNACKS)) {
  ITEMS[snackId(id)] = { icon: snack.icon, name: snack.name, kind: 'snack', snack: id, unit: 'gói' };
}
ITEMS.rod = { icon: '🎣', name: 'Cần câu tre', kind: 'gear', unit: 'cái' };
ITEMS.bait = { icon: '🪱', name: 'Mồi giun', kind: 'gear', unit: 'lần' };
ITEMS.firefly = { icon: '✨', name: 'Đom đóm', kind: 'gear', unit: 'con' };
ITEMS.intellect = { icon: '💡', name: 'Trí lực', kind: 'gear', unit: 'điểm' };

const GIFTS = ['fishing', 'intellect'];
const blank = () => ({ money: 0, items: {}, gifts: [], energy: ENERGY.max, energyAt: null, sleeping: false, lodging: false });

function starter() {
  const account = blank();
  for (const [item, count] of Object.entries(STARTER)) account.items[item] = count;
  account.items.intellect = CERTIFY.starterIntellect;
  account.gifts = [...GIFTS];
  return account;
}

function giftFishing(account) {
  if (account.gifts.includes('fishing')) return;
  account.gifts.push('fishing');
  account.items.rod = Math.max(1, account.items.rod ?? 0);
  account.items.bait = (account.items.bait ?? 0) + FISHING.baitPerPack;
}

function giftIntellect(account) {
  if (account.gifts.includes('intellect')) return;
  account.gifts.push('intellect');
  account.items.intellect = (account.items.intellect ?? 0) + CERTIFY.starterIntellect;
}

function clean(raw) {
  const account = blank();
  if (!raw || typeof raw !== 'object') return account;
  account.money = Math.max(0, Math.floor(Number(raw.money) || 0));
  account.energy = Number.isFinite(raw.energy) ? Math.min(ENERGY.max, Math.max(0, raw.energy)) : ENERGY.max;
  account.energyAt = Number.isFinite(raw.energyAt) ? raw.energyAt : null;
  account.sleeping = raw.sleeping === true;
  account.lodging = account.sleeping && (raw.lodging === true ? 'inn' : LODGE_ROOMS[raw.lodging] ? raw.lodging : false);
  account.gifts = Array.isArray(raw.gifts) ? raw.gifts.filter((gift) => GIFTS.includes(gift)) : [];
  for (const [id, amount] of Object.entries(raw.items ?? {})) {
    if (ITEMS[id] && Number.isFinite(amount) && amount > 0) account.items[id] = Math.floor(amount);
  }
  const legacyIntellect = Math.floor(Number(raw.intellect) || 0);
  if (legacyIntellect > 0) account.items.intellect = (account.items.intellect ?? 0) + legacyIntellect;
  return account;
}

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

export class Purse {
  constructor(ledger, id, data) {
    this.ledger = ledger;
    this.id = id;
    this.data = data;
    this.listeners = [];
  }

  get money() {
    return this.data.money;
  }

  count(item) {
    return this.data.items[item] ?? 0;
  }

  entries(kind = null) {
    return Object.entries(this.data.items).filter(([id, amount]) => amount > 0 && ITEMS[id] && (!kind || ITEMS[id].kind === kind));
  }

  total(kind) {
    return this.entries(kind).reduce((sum, [, amount]) => sum + amount, 0);
  }

  add(item, amount) {
    if (!ITEMS[item] || !(amount > 0)) return;
    this.data.items[item] = this.count(item) + amount;
    this.changed({ item, amount });
  }

  take(item, amount = 1) {
    if (!(amount > 0) || this.count(item) < amount) return false;
    const left = this.count(item) - amount;
    if (left > 0) this.data.items[item] = left;
    else delete this.data.items[item];
    this.changed({ item, amount: -amount });
    return true;
  }

  earn(amount) {
    if (!(amount > 0)) return;
    this.data.money += Math.floor(amount);
    this.changed({ money: amount });
  }

  spend(amount) {
    if (!(amount >= 0) || this.data.money < amount) return false;
    this.data.money -= amount;
    this.changed({ money: -amount });
    return true;
  }

  get energy() {
    return this.data.energy;
  }

  get intellect() {
    return this.count('intellect');
  }

  addIntellect(amount) {
    this.add('intellect', Math.floor(amount));
  }

  get full() {
    return this.data.energy >= ENERGY.max - FULL_MARGIN;
  }

  get sleeping() {
    return this.data.sleeping;
  }

  get lodging() {
    return this.data.lodging;
  }

  setSleeping(on, lodging = false) {
    const stay = on && lodging ? lodging : false;
    if (this.data.sleeping === on && this.data.lodging === stay) return;
    this.data.sleeping = on;
    this.data.lodging = stay;
    this.ledger.save();
  }

  spendEnergy(amount) {
    if (this.data.energy + 1e-6 < amount) return false;
    this.data.energy = Math.max(0, Math.round((this.data.energy - amount) * 100) / 100);
    this.changed({ energy: -amount });
    return true;
  }

  addEnergy(amount) {
    if (!(amount > 0)) return;
    this.data.energy = Math.min(ENERGY.max, this.data.energy + amount);
    this.changed({ energy: amount });
  }

  liveEnergy(minutes, activity, offlineNight, offlineDay = 'idle') {
    const last = this.data.energyAt;
    if (last === null || minutes - last > OFFLINE_GAP) {
      this.catchUpEnergy(minutes, offlineNight, offlineDay);
      return;
    }
    this.tickEnergy(minutes, energyRate(activity, isNight(minutes)));
  }

  tickEnergy(minutes, ratePerHour) {
    const last = this.data.energyAt ?? minutes;
    this.data.energyAt = minutes;
    if (minutes > last) this.shiftEnergy((-ratePerHour * (minutes - last)) / 60);
  }

  catchUpEnergy(minutes, nightActivity, dayActivity = 'idle') {
    let t = this.data.energyAt ?? minutes;
    let energy = this.data.energy;
    while (t < minutes) {
      const night = isNight(t);
      const end = Math.min(minutes, nextShift(t));
      energy -= (energyRate(night ? nightActivity : dayActivity, night) * (end - t)) / 60;
      energy = Math.min(ENERGY.max, Math.max(0, energy));
      t = end;
    }
    this.data.energyAt = minutes;
    this.shiftEnergy(energy - this.data.energy);
  }

  shiftEnergy(delta) {
    const before = Math.floor(this.data.energy);
    this.data.energy = Math.min(ENERGY.max, Math.max(0, this.data.energy + delta));
    if (Math.floor(this.data.energy) !== before) this.changed({ energy: 0 });
  }

  changed(detail) {
    this.ledger.save();
    for (const listener of this.listeners) listener(detail);
  }

  onChange(listener) {
    this.listeners.push(listener);
  }
}

export class Ledger {
  constructor() {
    const world = readJSON(WORLD_KEY);
    const mine = readJSON(SELF_KEY);
    const raw = { ...world, ...(mine && { [PLAYER]: mine }) };
    this.accounts = {};
    for (const [id, account] of Object.entries(raw)) {
      this.accounts[id] = clean(account);
      giftFishing(this.accounts[id]);
      giftIntellect(this.accounts[id]);
    }
    this.purses = new Map();
    this.store = createPairStore(WORLD_KEY, () => without(this.accounts, PLAYER), SELF_KEY, () => this.accounts[PLAYER] ?? null);
    this.store.flush();
  }

  purse(id) {
    let purse = this.purses.get(id);
    if (purse) return purse;
    this.accounts[id] ??= starter();
    purse = new Purse(this, id, this.accounts[id]);
    this.purses.set(id, purse);
    this.save();
    return purse;
  }

  save() {
    this.store.save();
  }

  flush() {
    this.store.flush();
  }
}
