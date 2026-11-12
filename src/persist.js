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

export function haltStores() {
  for (const store of stores) store.halt();
}
