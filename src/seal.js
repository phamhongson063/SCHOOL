import { OLD_PREFIX, PREFIX, WORLD_PREFIX, gameKeys, isGameKey, renamedKey, scopeOf } from './saveKeys.js';

export const SEAL_KEY = PREFIX + 'seal';
export const WORLD_SEAL_KEY = WORLD_PREFIX + 'seal';
const SEALS = { self: SEAL_KEY, world: WORLD_SEAL_KEY };
const SALT = 0x5c3a91e7;

function digest(key, value) {
  const text = `${key}\n${value}`;
  let h1 = 0xdeadbeef ^ SALT;
  let h2 = 0x41c6ce57 ^ SALT;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function readSeal(scope) {
  try {
    const seal = JSON.parse(localStorage.getItem(SEALS[scope]) ?? 'null');
    return seal && typeof seal === 'object' && !Array.isArray(seal) ? seal : null;
  } catch {
    return null;
  }
}

function writeSeal(scope, seal) {
  try {
    localStorage.setItem(SEALS[scope], JSON.stringify(seal));
  } catch {}
}

const isSealKey = (key) => key === SEAL_KEY || key === WORLD_SEAL_KEY;
const sealedKeys = (scope) => gameKeys(scope).filter((key) => !isSealKey(key));

function sealAll(scope) {
  const seal = {};
  for (const key of sealedKeys(scope)) seal[key] = digest(key, localStorage.getItem(key));
  return seal;
}

export function writeGameItem(key, value) {
  localStorage.setItem(key, value);
  const scope = scopeOf(key);
  const seal = readSeal(scope) ?? sealAll(scope);
  seal[key] = digest(key, value);
  writeSeal(scope, seal);
}

export function removeGameItem(key) {
  localStorage.removeItem(key);
  const scope = scopeOf(key);
  const seal = readSeal(scope) ?? sealAll(scope);
  delete seal[key];
  writeSeal(scope, seal);
}

function auditScope(scope) {
  const seal = readSeal(scope);
  if (!seal) {
    writeSeal(scope, sealAll(scope));
    return [];
  }
  const keys = new Set([...Object.keys(seal).filter((key) => isGameKey(key) && scopeOf(key) === scope), ...sealedKeys(scope)]);
  return [...keys].filter((key) => {
    const value = localStorage.getItem(key);
    return seal[key] !== (value === null ? undefined : digest(key, value));
  });
}

export const auditSeal = () => Object.keys(SEALS).flatMap(auditScope);

export function dropTampered(keys) {
  for (const scope of Object.keys(SEALS)) {
    const owned = keys.filter((key) => scopeOf(key) === scope);
    if (!owned.length) continue;
    const seal = readSeal(scope) ?? {};
    for (const key of owned) {
      localStorage.removeItem(key);
      delete seal[key];
    }
    writeSeal(scope, seal);
  }
}

function resealed(text, entries) {
  let seal = null;
  try {
    seal = JSON.parse(text);
  } catch {}
  if (!seal || typeof seal !== 'object' || Array.isArray(seal)) return text;
  const next = {};
  for (const [key, mark] of Object.entries(seal)) {
    const value = entries[key];
    if (typeof value === 'string' && mark === digest(key, value)) next[renamedKey(key)] = digest(renamedKey(key), value);
  }
  return JSON.stringify(next);
}

export function renameOldKeys(entries) {
  const next = {};
  for (const [key, value] of Object.entries(entries)) {
    const target = renamedKey(key);
    next[target] = target !== key && isSealKey(target) ? resealed(value, entries) : value;
  }
  return next;
}

export function renameOldStorage() {
  try {
    const old = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(OLD_PREFIX)) old[key] = localStorage.getItem(key);
    }
    for (const [key, value] of Object.entries(renameOldKeys(old))) localStorage.setItem(key, value);
    for (const key of Object.keys(old)) localStorage.removeItem(key);
  } catch {}
}
