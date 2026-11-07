const PLAY_SECONDS = 5 * 60;

const TEXT = {
  ask: { title: 'Kiểm tra toán', hint: 'Trả lời đúng để chơi tiếp 5 phút nhé!', badge: '🧮' },
  retry: { title: 'Chưa đúng rồi!', hint: 'Thử câu khác nhé, cố lên!', badge: '🤔' },
};

const digit = () => Math.floor(Math.random() * 10);
const LETTERS = ['A', 'B', 'C', 'D'];

function choicesFor(answer) {
  const picks = new Set([answer]);
  while (picks.size < LETTERS.length) {
    const wrong = answer + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3));
    if (wrong >= 0 && wrong <= 18) picks.add(wrong);
  }
  const list = [...picks];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function createQuiz({ onPass } = {}) {
  const dialog = document.getElementById('quizDialog');
  const badge = dialog.querySelector('.quiz-badge');
  const title = document.getElementById('quizTitle');
  const hint = dialog.querySelector('.quiz-hint');
  const question = document.getElementById('quizQuestion');
  const options = document.getElementById('quizOptions');
  let left = PLAY_SECONDS;
  let answer = 0;

  function ask(retry) {
    const add = Math.random() < 0.5;
    let a = digit();
    let b = digit();
    if (!add && b > a) [a, b] = [b, a];
    answer = add ? a + b : a - b;
    question.textContent = `${a} ${add ? '+' : '−'} ${b} = ?`;
    options.replaceChildren(
      ...choicesFor(answer).map((value, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        const letter = document.createElement('b');
        letter.textContent = LETTERS[i];
        button.append(letter, String(value));
        button.addEventListener('click', () => choose(value));
        return button;
      }),
    );
    const text = retry ? TEXT.retry : TEXT.ask;
    badge.textContent = text.badge;
    title.textContent = text.title;
    hint.textContent = text.hint;
    dialog.classList.toggle('retry', retry);
    dialog.showModal();
    options.firstElementChild?.focus({ preventScroll: true });
  }

  function choose(value) {
    dialog.close();
    if (value !== answer) {
      ask(true);
      return;
    }
    left = PLAY_SECONDS;
    onPass?.();
  }

  dialog.addEventListener('cancel', (event) => event.preventDefault());

  return {
    get open() {
      return dialog.open;
    },
    update(dt, counting) {
      if (dialog.open || !counting) return;
      left -= dt;
      if (left <= 0) ask(false);
    },
  };
}
