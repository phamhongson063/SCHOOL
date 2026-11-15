import { LANTERN } from './config.js';
import { DECKS, unitOf } from './studyDecks.js';
import { clozeLines } from './kanjiQuiz.js';
import { answerOf, lanternTiles } from './lanterns.js';

const CLOSE_MS = 1600;
const REASONS = {
  gone: 'Đèn này đã có người giải rồi.',
  falling: 'Đèn chưa hạ xuống.',
  unknown: 'Đoạn hội thoại này bạn chưa học.',
  locked: 'Bạn vừa giải sai đèn này, chờ chút nhé.',
  unregistered: 'Bạn chưa đăng ký hội đèn trời hôm nay.',
};

const node = (id) => document.getElementById(id);

export function createLanternDialog({ sounds, attempt }) {
  const dialog = node('lanternDialog');
  const text = node('lanternText');
  const tiles = node('lanternTiles');
  const result = node('lanternResult');
  const level = node('lanternLevel');
  const close = node('lanternClose');
  let current = null;
  let timer = null;

  function finish() {
    clearTimeout(timer);
    timer = null;
    current = null;
    if (dialog.open) dialog.close();
  }

  close.addEventListener('click', finish);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish();
  });

  function render() {
    const spelled = current.picked.map((i) => current.letters[i]).join('');
    for (const blank of current.blanks) {
      blank.textContent = spelled;
      blank.classList.toggle('filled', current.done && current.solved);
    }
    current.buttons.forEach((button, i) => (button.disabled = current.done || current.picked.includes(i)));
    current.back.disabled = current.done || !current.picked.length;
  }

  function settle(message, tone) {
    current.done = true;
    result.textContent = message;
    result.className = tone ? `phrase-result ${tone}` : 'phrase-result';
    render();
    timer = setTimeout(finish, CLOSE_MS);
  }

  function submit() {
    const outcome = attempt(current.id, current.picked.map((i) => current.letters[i]).join(''));
    if (outcome.ok) {
      current.solved = true;
      sounds.correct();
      const { energy = 0, intellect = 0 } = outcome.prize ?? {};
      settle(['Đúng rồi!', energy > 0 ? `+${energy} ⚡` : '', intellect > 0 ? `+${intellect} 💡` : ''].filter(Boolean).join('  '), 'right');
      return;
    }
    if (outcome.reason === 'wrong') {
      sounds.wrong();
      settle(`Sai rồi! Chờ ${LANTERN.lock} giây mới thử lại đèn này.`, 'wrong');
      return;
    }
    settle(REASONS[outcome.reason] ?? '', 'wrong');
  }

  function pick(i) {
    if (current.done || current.picked.includes(i)) return;
    current.picked.push(i);
    sounds.click();
    render();
    if (current.picked.length === current.length) submit();
  }

  function button(label, onPress, className = '') {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    if (className) el.className = className;
    el.addEventListener('click', onPress);
    return el;
  }

  return {
    get open() {
      return dialog.open;
    },
    get lanternId() {
      return current?.id ?? null;
    },
    show(lantern) {
      const card = unitOf(lantern.key);
      clearTimeout(timer);
      const { nodes, blanks } = clozeLines(card.examples[0].lines, card.cloze);
      text.replaceChildren(...nodes);
      level.textContent = DECKS[card.deck].level;
      result.textContent = '';
      result.className = 'phrase-result';
      const letters = lanternTiles(lantern);
      current = { id: lantern.id, letters, blanks, picked: [], done: false, solved: false, length: Array.from(answerOf(lantern.key)).length };
      current.buttons = letters.map((letter, i) => button(letter, () => pick(i)));
      current.back = button('⌫', () => {
        if (current.done || !current.picked.length) return;
        current.picked.pop();
        render();
      }, 'back');
      tiles.replaceChildren(...current.buttons, current.back);
      render();
      if (!dialog.open) dialog.showModal();
    },
    gone(id) {
      if (current?.id === id && !current.done) settle(REASONS.gone, 'wrong');
    },
    close: finish,
  };
}
