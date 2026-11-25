import { writeGameItem } from './seal.js';

const stores = [];

export function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

export function readEntries(key, clean) {
  const saved = readSaved(key);
  const entries = {};
  if (!saved || typeof saved !== 'object') return entries;
  for (const [id, raw] of Object.entries(saved)) {
    const entry = clean(raw, id);
    if (entry) entries[id] = entry;
  }
  return entries;
}

export function createStore(key, read) {
  let pending = false;
  let halted = false;

  function flush() {
    pending = false;
    if (halted) return;
    try {
      writeGameItem(key, JSON.stringify(read()));
    } catch {}
  }

  const store = {
    save() {
      if (pending || halted) return;
      pending = true;
      queueMicrotask(flush);
    },
    flush,
    halt() {
      halted = true;
    },
  };
  stores.push(store);
  return store;
}

export function createPairStore(worldKey, readWorld, selfKey, readSelf) {
  const pair = [createStore(worldKey, readWorld), createStore(selfKey, readSelf)];
  return {
    save() {
      for (const store of pair) store.save();
    },
    flush() {
      for (const store of pair) store.flush();
    },
  };
}

export const without = (map, id) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== id));

export function haltStores() {
  for (const store of stores) store.halt();
}
