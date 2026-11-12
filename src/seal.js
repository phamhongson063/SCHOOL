import { PREFIX, gameKeys } from './saveKeys.js';

export const SEAL_KEY = PREFIX + 'seal';
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

function readSeal() {
  try {
    const seal = JSON.parse(localStorage.getItem(SEAL_KEY) ?? 'null');
    return seal && typeof seal === 'object' && !Array.isArray(seal) ? seal : null;
  } catch {
    return null;
  }
}

function writeSeal(seal) {
  try {
    localStorage.setItem(SEAL_KEY, JSON.stringify(seal));
  } catch {}
}

const sealedKeys = () => gameKeys().filter((key) => key !== SEAL_KEY);

function sealAll() {
  const seal = {};
  for (const key of sealedKeys()) seal[key] = digest(key, localStorage.getItem(key));
  return seal;
}

export function writeGameItem(key, value) {
  localStorage.setItem(key, value);
  const seal = readSeal() ?? sealAll();
  seal[key] = digest(key, value);
  writeSeal(seal);
}

export function removeGameItem(key) {
  localStorage.removeItem(key);
  const seal = readSeal() ?? sealAll();
  delete seal[key];
  writeSeal(seal);
}

export function auditSeal() {
  const seal = readSeal();
  if (!seal) {
    writeSeal(sealAll());
    return [];
  }
  const keys = new Set([...Object.keys(seal), ...sealedKeys()]);
  return [...keys].filter((key) => {
    const value = localStorage.getItem(key);
    return seal[key] !== (value === null ? undefined : digest(key, value));
  });
}

export function dropTampered(keys) {
  const seal = readSeal() ?? {};
  for (const key of keys) {
    localStorage.removeItem(key);
    delete seal[key];
  }
  writeSeal(seal);
}
