export const PREFIX = 'truong-lang-xua.';
export const ACCOUNT_KEY = PREFIX + 'account';

const DEVICE_KEYS = new Set([...['lessonMode', 'lessonChoice', 'furigana', 'translate', 'bagTab', 'music'].map((key) => PREFIX + key), ACCOUNT_KEY]);

export const isGameKey = (key) => Boolean(key?.startsWith(PREFIX)) && !DEVICE_KEYS.has(key);

export function gameKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isGameKey(key)) keys.push(key);
    }
  } catch {}
  return keys;
}
