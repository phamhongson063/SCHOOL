import { writeGameItem } from './seal.js';

const stores = [];

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
