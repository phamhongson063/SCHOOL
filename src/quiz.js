const PLAY_SECONDS = 5 * 60;

export function createQuiz({ quiz, onPass } = {}) {
  let left = PLAY_SECONDS;
  let asking = false;

  async function ask() {
    asking = true;
    let passed = false;
    while (!passed) {
      ({ correct: passed } = await quiz.ask({ icon: '📖', prompt: 'Chọn cách đọc đúng để chơi tiếp!' }));
    }
    asking = false;
    left = PLAY_SECONDS;
    onPass?.();
  }

  return {
    get open() {
      return asking;
    },
    update(dt, counting) {
      if (asking || quiz.open || !counting) return;
      left -= dt;
      if (left <= 0) ask();
    },
  };
}
