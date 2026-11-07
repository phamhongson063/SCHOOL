import { CROPS } from './crops.js';
import { STARTER, FISH, FISHING, ENERGY } from './config.js';
import { energyRate, isNight, nextShift, OFFLINE_GAP } from './stamina.js';

const KEY = 'truong-lang-xua.ledger';
const LEGACY_PLAYER = 'truong-lang-xua.inventory';
const LEGACY_FARMERS = 'truong-lang-xua.farmers';

export const PLAYER = 'player';
export const seedId = (crop) => `seed:${crop}`;

export const ITEMS = {};
for (const [id, crop] of Object.entries(CROPS)) {
  ITEMS[id] = { icon: crop.icon, name: crop.name, kind: 'produce', crop: id, unit: crop.unit };
}
for (const [id, crop] of Object.entries(CROPS)) {
  ITEMS[seedId(id)] = { icon: crop.icon, name: crop.seedName, kind: 'seed', crop: id, unit: 'gói' };
}
ITEMS.fertilizer = { icon: '🧪', name: 'Phân bón', kind: 'fertilizer', unit: 'bao' };
export const fishId = (fish) => `fish:${fish}`;
for (const [id, fish] of Object.entries(FISH)) {
  ITEMS[fishId(id)] = { icon: fish.icon, name: fish.name, kind: 'fish', fish: id, unit: 'con' };
}
ITEMS.rod = { icon: '🎣', name: 'Cần câu tre', kind: 'gear', unit: 'cái' };
ITEMS.bait = { icon: '🪱', name: 'Mồi giun', kind: 'gear', unit: 'lần' };

const GIFTS = ['fishing'];
const blank = () => ({ money: 0, credits: 0, items: {}, fishDay: null, gifts: [], energy: ENERGY.max, energyAt: null, sleeping: false });

function starter() {
  const account = blank();
  for (const [item, count] of Object.entries(STARTER)) account.items[item] = count;
  account.gifts = [...GIFTS];
  return account;
}

function giftFishing(account) {
  if (account.gifts.includes('fishing')) return;
  account.gifts.push('fishing');
  account.items.rod = Math.max(1, account.items.rod ?? 0);
  account.items.bait = (account.items.bait ?? 0) + FISHING.baitPerPack;
}

function clean(raw) {
  const account = blank();
  if (!raw || typeof raw !== 'object') return account;
  account.money = Math.max(0, Math.floor(Number(raw.money) || 0));
  account.credits = Math.max(0, Math.floor(Number(raw.credits) || 0));
  account.fishDay = Number.isFinite(raw.fishDay) ? raw.fishDay : null;
  account.energy = Number.isFinite(raw.energy) ? Math.min(ENERGY.max, Math.max(0, raw.energy)) : ENERGY.max;
  account.energyAt = Number.isFinite(raw.energyAt) ? raw.energyAt : null;
  account.sleeping = raw.sleeping === true;
  account.gifts = Array.isArray(raw.gifts) ? raw.gifts.filter((gift) => GIFTS.includes(gift)) : [];
  for (const [id, amount] of Object.entries(raw.items ?? {})) {
    if (ITEMS[id] && Number.isFinite(amount) && amount > 0) account.items[id] = Math.floor(amount);
  }
  return account;
}

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function migrate() {
  const accounts = {};
  const player = readJSON(LEGACY_PLAYER);
  if (player && typeof player === 'object') {
    const account = starter();
    for (const [id, amount] of Object.entries(player)) {
      if (ITEMS[id] && Number.isFinite(amount) && amount > 0) account.items[id] = (account.items[id] ?? 0) + Math.floor(amount);
    }
    accounts[PLAYER] = account;
  }
  const farmers = readJSON(LEGACY_FARMERS);
  if (farmers && typeof farmers === 'object') {
    for (const [owner, bag] of Object.entries(farmers)) {
      const account = starter();
      for (const [id, amount] of Object.entries(bag ?? {})) {
        if (ITEMS[id] && Number.isFinite(amount) && amount > 0) account.items[id] = (account.items[id] ?? 0) + Math.floor(amount);
      }
      accounts[owner] = account;
    }
  }
  try {
    localStorage.removeItem(LEGACY_PLAYER);
    localStorage.removeItem(LEGACY_FARMERS);
  } catch {}
  return accounts;
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

  get credits() {
    return this.data.credits;
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

  addCredits(count) {
    if (!(count > 0)) return;
    this.data.credits += Math.floor(count);
    this.changed({ credits: count });
  }

  get energy() {
    return this.data.energy;
  }

  get sleeping() {
    return this.data.sleeping;
  }

  setSleeping(on) {
    if (this.data.sleeping === on) return;
    this.data.sleeping = on;
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

  liveEnergy(minutes, activity, offlineNight) {
    const last = this.data.energyAt;
    if (last === null || minutes - last > OFFLINE_GAP) {
      this.catchUpEnergy(minutes, offlineNight);
      return;
    }
    this.tickEnergy(minutes, energyRate(activity, isNight(minutes)));
  }

  tickEnergy(minutes, ratePerHour) {
    const last = this.data.energyAt ?? minutes;
    this.data.energyAt = minutes;
    if (minutes > last) this.shiftEnergy((-ratePerHour * (minutes - last)) / 60);
  }

  catchUpEnergy(minutes, nightActivity) {
    let t = this.data.energyAt ?? minutes;
    let energy = this.data.energy;
    while (t < minutes) {
      const night = isNight(t);
      const end = Math.min(minutes, nextShift(t));
      energy -= (energyRate(night ? nightActivity : 'idle', night) * (end - t)) / 60;
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

  markFish(day) {
    this.data.fishDay = day;
    this.ledger.save();
  }

  useCredit() {
    if (this.data.credits <= 0) return false;
    this.data.credits -= 1;
    this.changed({ credits: -1 });
    return true;
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
    const saved = readJSON(KEY);
    const raw = saved && typeof saved === 'object' ? saved : migrate();
    this.accounts = {};
    for (const [id, account] of Object.entries(raw)) {
      this.accounts[id] = clean(account);
      giftFishing(this.accounts[id]);
    }
    this.purses = new Map();
    this.pending = false;
    this.halted = false;
    this.flush();
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

  spoilFish(day) {
    const spoiled = [];
    for (const [id, account] of Object.entries(this.accounts)) {
      if (account.fishDay === null || day - account.fishDay < FISHING.spoilDays) continue;
      let lost = 0;
      for (const item of Object.keys(account.items)) {
        if (ITEMS[item]?.kind !== 'fish') continue;
        lost += account.items[item];
        delete account.items[item];
      }
      account.fishDay = null;
      if (!lost) continue;
      spoiled.push(id);
      const purse = this.purses.get(id);
      if (purse) for (const listener of purse.listeners) listener({ spoiled: lost });
    }
    if (spoiled.length) this.save();
    return spoiled;
  }

  halt() {
    this.halted = true;
  }

  save() {
    if (this.pending || this.halted) return;
    this.pending = true;
    queueMicrotask(() => this.flush());
  }

  flush() {
    this.pending = false;
    if (this.halted) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.accounts));
    } catch {}
  }
}
