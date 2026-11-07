const STORAGE_KEY = 'truong-lang-xua.inventory';

export const ITEMS = {
  tomato: { icon: '🍅', name: 'Cà chua' },
  corn: { icon: '🌽', name: 'Bắp' },
  watermelon: { icon: '🍉', name: 'Dưa hấu' },
  sweetPotato: { icon: '🍠', name: 'Khoai lang' },
};

export class Inventory {
  constructor() {
    this.items = {};
    this.listeners = [];
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      for (const [id, amount] of Object.entries(saved)) {
        if (ITEMS[id] && Number.isFinite(amount) && amount > 0) this.items[id] = Math.floor(amount);
      }
    } catch {}
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {}
  }

  count(id) {
    return this.items[id] ?? 0;
  }

  entries() {
    return Object.entries(this.items).filter(([, amount]) => amount > 0);
  }

  add(id, amount) {
    if (!ITEMS[id] || !(amount > 0)) return;
    this.items[id] = this.count(id) + amount;
    this.save();
    for (const listener of this.listeners) listener(id, amount);
  }

  onChange(listener) {
    this.listeners.push(listener);
  }
}
