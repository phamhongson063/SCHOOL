import { QUIZ } from './config.js';

export function createQuiz({ quiz, onPass = null, onEmpty = null, onVillagers = null } = {}) {
  let left = QUIZ.seconds;
  let villagersLeft = QUIZ.seconds;
  let asking = false;

  async function ask() {
    asking = true;
    let passed = false;
    while (!passed) {
      const result = await quiz.ask({ icon: '📖' });
      if (result.empty) {
        onEmpty?.();
        break;
      }
      passed = result.correct;
    }
    if (passed) onPass?.();
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
