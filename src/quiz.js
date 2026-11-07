const PLAY_SECONDS = 5 * 60;

const TEXT = {
  ask: { title: 'Kiểm tra toán', hint: 'Trả lời đúng để chơi tiếp 5 phút nhé!', badge: '🧮' },
  retry: { title: 'Chưa đúng rồi!', hint: 'Thử câu khác nhé, cố lên!', badge: '🤔' },
};

const digit = () => Math.floor(Math.random() * 10);

export function createQuiz({ onPass } = {}) {
  const dialog = document.getElementById('quizDialog');
  const form = document.getElementById('quizForm');
  const badge = dialog.querySelector('.quiz-badge');
  const title = document.getElementById('quizTitle');
  const hint = dialog.querySelector('.quiz-hint');
  const question = document.getElementById('quizQuestion');
  const input = document.getElementById('quizAnswer');
  let left = PLAY_SECONDS;
  let answer = 0;

  function ask(retry) {
    const add = Math.random() < 0.5;
    let a = digit();
    let b = digit();
    if (!add && b > a) [a, b] = [b, a];
    answer = add ? a + b : a - b;
    question.textContent = `${a} ${add ? '+' : '−'} ${b} =`;
    const text = retry ? TEXT.retry : TEXT.ask;
    badge.textContent = text.badge;
    title.textContent = text.title;
    hint.textContent = text.hint;
    dialog.classList.toggle('retry', retry);
    input.value = '';
    dialog.showModal();
    input.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value.trim() === '') return;
    const correct = Number(input.value) === answer;
    dialog.close();
    if (!correct) {
      ask(true);
      return;
    }
    left = PLAY_SECONDS;
    onPass?.();
  });
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
