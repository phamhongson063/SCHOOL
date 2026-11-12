import { CERTIFY } from './config.js';

const ANSWER_PAUSE_MS = 1200;

export function createExams({ quiz, sounds = null }) {
  let running = false;

  async function run({ title, deck, keys, icon }) {
    running = true;
    const results = [];
    try {
      for (let i = 0; i < keys.length; i++) {
        const { correct } = await quiz.ask({
          key: keys[i],
          icon,
          seconds: CERTIFY.seconds[deck],
          level: `${title} · ${i + 1}/${keys.length}`,
          closeAfter: ANSWER_PAUSE_MS,
          kind: Math.random() < 0.5 ? 'reading' : 'meaning',
          choices: deck === 'n2' ? 4 : 0,
          onAnswer: (right) => (right ? sounds?.correct() : sounds?.wrong()),
        });
        results.push({ key: keys[i], correct: !!correct });
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
