import { writeGameItem } from './seal.js';

export function dailyMark(key) {
  let marked = null;
  try {
    marked = localStorage.getItem(key);
  } catch {}
  return {
    done: (day) => marked === String(day),
    mark(day) {
      marked = String(day);
      try {
        writeGameItem(key, marked);
      } catch {}
    },
  };
}
