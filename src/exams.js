import { CERTIFY } from './config.js';

const ANSWER_PAUSE_MS = 1200;

export function createExams({ quiz, sounds = null }) {
  let running = false;

  async function run({ title, deck, keys, icon, minSeconds = 0, more = null }) {
    running = true;
    const results = [];
    const endAt = performance.now() + minSeconds * 1000;
    try {
      for (let i = 0; ; i++) {
        const left = Math.ceil((endAt - performance.now()) / 1000);
        const key = i < keys.length ? keys[i] : left > 0 ? more?.(results.at(-1)?.key ?? null) : null;
        if (!key) break;
        const count = i < keys.length ? `${i + 1}/${keys.length}` : `${i + 1}`;
        const clock = left > 0 ? ` · ⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
        const { correct } = await quiz.ask({
          key,
          icon,
          seconds: CERTIFY.seconds[deck],
          level: `${title} · ${count}${clock}`,
          closeAfter: ANSWER_PAUSE_MS,
          kind: Math.random() < 0.5 ? 'reading' : 'meaning',
          choices: deck === 'n2' ? 4 : 0,
          onAnswer: (right) => (right ? sounds?.correct() : sounds?.wrong()),
        });
        results.push({ key, correct: !!correct });
      }
    } finally {
      running = false;
    }
    return results;
  }

  return {
    get running() {
      return running;
    },
    run,
  };
}
