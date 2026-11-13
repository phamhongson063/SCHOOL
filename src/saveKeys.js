export const PREFIX = 'langsch.';
export const WORLD_PREFIX = PREFIX + 'world.';
export const ACCOUNT_KEY = PREFIX + 'account';
const LOCAL_PLAYER = 'player';

const DEVICE_KEYS = new Set([...['lessonMode', 'lessonChoice', 'furigana', 'studyFurigana', 'translate', 'bagTab', 'music'].map((key) => PREFIX + key), ACCOUNT_KEY]);

export const worldKey = (name) => WORLD_PREFIX + name;

export const NEWEST_KEYS = [worldKey('arena')];
export const selfKey = (name) => `${PREFIX}me.${name}`;

export const isGameKey = (key) => Boolean(key?.startsWith(PREFIX)) && !DEVICE_KEYS.has(key);
export const isWorldKey = (key) => Boolean(key?.startsWith(WORLD_PREFIX));
export const scopeOf = (key) => (isWorldKey(key) ? 'world' : 'self');

export function gameKeys(scope = null) {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isGameKey(key) && (!scope || scopeOf(key) === scope)) keys.push(key);
    }
  } catch {}
  return keys;
}

export function playerId() {
  try {
    const uid = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null')?.uid;
    if (typeof uid === 'string' && uid) return uid;
  } catch {}
  return LOCAL_PLAYER;
}
