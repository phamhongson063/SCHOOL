import { FISH, FISHING } from './config.js';
import { paintIcon } from './itemArt.js';
import { recall } from './recall.js';

const RECENT = 40;
const AUTO_CLOSE_MS = 3000;
const QUICK_CLOSE_MS = 3000;
const CLOSE_ANIMATION_MS = 600;
const LETTERS = ['A', 'B', 'C', 'D'];

let bank = null;

function loadBank() {
  bank ??= import('./vocabN2.js').then(
    (module) =>
      module.N2_VOCAB.filter((entry) => entry.distractors?.length).map((entry) => ({
        word: entry.word,
        reading: entry.reading,
        distractors: entry.distractors,
        meaning: entry.meaning,
        level: 'N2',
      })),
    () => [],
  );
  return bank;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function createKanjiQuiz() {
  const dialog = document.getElementById('kanjiDialog');
  const word = document.getElementById('kanjiWord');
  const level = document.getElementById('kanjiLevel');
  const options = document.getElementById('kanjiOptions');
  const bar = document.getElementById('kanjiBar');
  const result = document.getElementById('kanjiResult');
  const closeBtn = document.getElementById('kanjiClose');
  const fishIcon = document.getElementById('kanjiFish');
  const recent = [];
  let pending = null;
  let closing = null;

  function hide() {
    dialog.classList.remove('closing');
    if (dialog.open) dialog.close();
  }

  function endClosing() {
    if (!closing) return;
    const { timer, done } = closing;
    clearTimeout(timer);
    closing = null;
    hide();
    done();
  }

  function pick(entries) {
    const fresh = entries.filter((entry) => !recent.includes(entry.word));
    const pool = fresh.length ? fresh : entries;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    recent.push(entry.word);
    while (recent.length > Math.min(RECENT, entries.length - 1)) recent.shift();
    return entry;
  }

  function settle(correct, chosen) {
    if (!pending || pending.answered) return;
    const current = pending;
    current.answered = true;
    current.correct = correct;
    clearInterval(current.tick);
    fishIcon.classList.remove('hooked');
    fishIcon.classList.add(correct ? 'caught' : 'escaped');
    for (const button of options.children) {
      button.disabled = true;
      if (button.dataset.value === current.answer) button.classList.add('right');
      else if (button.dataset.value === chosen) button.classList.add('wrong');
    }
    result.className = correct ? 'kanji-result right' : 'kanji-result wrong';
    result.textContent = `${current.entry.word}（${current.entry.reading}）: ${current.entry.meaning}`;
    recall.record(current.entry.word, correct);
    current.onAnswer?.(correct);
    if (!current.brief) {
      closeBtn.hidden = false;
      closeBtn.focus({ preventScroll: true });
    }
    const delay = current.closeAfter ?? (current.quick ? QUICK_CLOSE_MS : correct ? AUTO_CLOSE_MS : null);
    if (delay !== null) current.closeAt = setTimeout(finish, delay);
  }

  function finish() {
    const current = pending;
    if (!current?.answered) return;
    clearTimeout(current.closeAt);
    pending = null;
    if (!dialog.open || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hide();
      current.resolve({ correct: current.correct, entry: current.entry });
      return;
    }
    dialog.classList.add('closing');
    closing = {
      timer: setTimeout(endClosing, CLOSE_ANIMATION_MS),
      done: () => current.resolve({ correct: current.correct, entry: current.entry }),
    };
  }

  closeBtn.addEventListener('click', finish);

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (pending?.answered) finish();
    else if (pending) settle(false, null);
  });

  return {
    get open() {
      return !!pending || !!closing;
    },
    async ask({ fish = null, icon = null, quick = false, kind = 'reading', choices = 0, closeAfter = null, onAnswer = null, brief = false } = {}) {
      const entries = await loadBank();
      endClosing();
      if (!entries.length) return { correct: true, entry: null };
      const entry = pick(entries);
      const byMeaning = kind === 'meaning';
      const answer = byMeaning ? entry.meaning : entry.reading;
      const others = byMeaning
        ? shuffle([...new Set(entries.map((other) => other.meaning))].filter((meaning) => meaning !== answer))
        : shuffle([...entry.distractors]);
      const wrong = others.slice(0, choices ? choices - 1 : others.length);
      const lettered = choices > 0;
      return new Promise((resolve) => {
        pending = { entry, answer, resolve, quick: quick || !!fish, closeAfter, onAnswer, brief, answered: false, correct: false, tick: null, closeAt: null };
        closeBtn.hidden = true;
        dialog.classList.toggle('brief', brief);
        paintIcon(fishIcon, icon ? { icon } : { icon: FISH[fish]?.icon ?? '', art: fish });
        fishIcon.className = 'kanji-fish hooked';
        word.textContent = entry.word;
        level.textContent = entry.level;
        result.textContent = '';
        result.className = 'kanji-result';
        options.classList.toggle('lettered', lettered);
        options.classList.toggle('meanings', byMeaning);
        options.replaceChildren(
          ...shuffle([answer, ...wrong]).map((value, i) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.lang = byMeaning ? 'vi' : 'ja';
            button.dataset.value = value;
            button.textContent = lettered ? `${LETTERS[i]}. ${value}` : value;
            button.addEventListener('click', () => settle(value === answer, value));
            return button;
          }),
        );
        const started = performance.now();
        const total = FISHING.quizSeconds * 1000;
        bar.style.transform = 'scaleX(1)';
        pending.tick = setInterval(() => {
          const left = Math.max(0, 1 - (performance.now() - started) / total);
          bar.style.transform = `scaleX(${left})`;
          if (left <= 0) settle(false, null);
        }, 100);
        if (!dialog.open) dialog.showModal();
        dialog.focus({ preventScroll: true });
      });
    },
    cancel() {
      if (!pending) return;
      const current = pending;
      clearInterval(current.tick);
      clearTimeout(current.closeAt);
      pending = null;
      hide();
      current.resolve({ correct: false, entry: current.entry, cancelled: true });
    },
  };
}
