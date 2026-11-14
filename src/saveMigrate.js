import { gameKeys, worldKey } from './saveKeys.js';
import { SEAL_KEY, WORLD_SEAL_KEY, holdWrites, writeGameItem } from './seal.js';
import { LEGACY_VILLAGER_IDS } from './villagerIds.js';
import { LEGACY_NPC_IDS } from './npcIds.js';

const ID_FIELDS = new Set(['id', 'owner']);

function renameVillagerIds(value) {
  if (typeof value === 'string') return LEGACY_VILLAGER_IDS.get(value) ?? value;
  if (Array.isArray(value)) return value.map(renameVillagerIds);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [renameVillagerIds(key), renameVillagerIds(item)]));
  return value;
}

function renameNpcIds(value, field = null) {
  if (typeof value === 'string') return ID_FIELDS.has(field) ? LEGACY_NPC_IDS.get(value) ?? value : value;
  if (Array.isArray(value)) return value.map((item) => renameNpcIds(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [LEGACY_NPC_IDS.get(key) ?? key, renameNpcIds(item, key)]));
  return value;
}

function rewriteSaves(flag, rename) {
  const done = worldKey(flag);
  if (localStorage.getItem(done) !== null) return;
  holdWrites(() => {
    for (const key of gameKeys()) {
      if (key === SEAL_KEY || key === WORLD_SEAL_KEY) continue;
      let data;
      try {
        data = JSON.parse(localStorage.getItem(key));
      } catch {
        continue;
      }
      const before = JSON.stringify(data);
      const after = JSON.stringify(rename(data));
      if (after !== before) writeGameItem(key, after);
    }
    writeGameItem(done, '1');
  });
}

export function migrateSaves() {
  try {
    rewriteSaves('villagerIdsV2', renameVillagerIds);
    rewriteSaves('npcIdsV2', renameNpcIds);
  } catch {}
}
