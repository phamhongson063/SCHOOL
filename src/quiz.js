import { QUIZ } from './config.js';

export function createQuiz({ quiz, onPass = null, onVillagers = null } = {}) {
  let left = QUIZ.seconds;
  let villagersLeft = QUIZ.seconds;
  let asking = false;

  async function ask() {
    asking = true;
    let passed = false;
    while (!passed) {
      ({ correct: passed } = await quiz.ask({ icon: '📖' }));
    }
    onPass?.();
    asking = false;
    left = QUIZ.seconds;
  }

  return {
    get open() {
      return asking;
    },
    update(dt, counting) {
      villagersLeft -= dt;
      if (villagersLeft <= 0) {
        villagersLeft = QUIZ.seconds;
        onVillagers?.();
      }
      if (asking || quiz.open || !counting) return;
      left -= dt;
      if (left <= 0) ask();
    },
  };
}
