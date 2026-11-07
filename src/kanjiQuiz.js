import { FISHING } from './config.js';

const RECENT = 40;

let bank = null;

function loadBank() {
  bank ??= import('./kanji.js').then(
    (module) => module.KANJI,
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
  const recent = [];
  let pending = null;

  function pick(entries) {
    const fresh = entries.filter((entry) => !recent.includes(entry.word));
    const pool = fresh.length ? fresh : entries;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    recent.push(entry.word);
    if (recent.length > RECENT) recent.shift();
    return entry;
  }

  function settle(correct, chosen) {
    if (!pending || pending.answered) return;
    const current = pending;
    current.answered = true;
    current.correct = correct;
    clearInterval(current.tick);
    for (const button of options.children) {
      button.disabled = true;
      if (button.dataset.reading === current.entry.reading) button.classList.add('right');
      else if (button.dataset.reading === chosen) button.classList.add('wrong');
    }
    result.className = correct ? 'kanji-result right' : 'kanji-result wrong';
    result.textContent = correct
      ? `✔ Đúng rồi! ${current.entry.word}（${current.entry.reading}）: ${current.entry.meaning}`
      : `✘ ${chosen ? 'Sai rồi' : 'Hết giờ'}! ${current.entry.word} đọc là「${current.entry.reading}」: ${current.entry.meaning}`;
    closeBtn.hidden = false;
    closeBtn.focus({ preventScroll: true });
  }

  function finish() {
    const current = pending;
    if (!current?.answered) return;
    pending = null;
    if (dialog.open) dialog.close();
    current.resolve({ correct: current.correct, entry: current.entry });
  }

  closeBtn.addEventListener('click', finish);

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (pending?.answered) finish();
    else if (pending) settle(false, null);
  });

  return {
    get open() {
      return !!pending;
    },
    async ask() {
      const entries = await loadBank();
      if (!entries.length) return { correct: true, entry: null };
      const entry = pick(entries);
      return new Promise((resolve) => {
        pending = { entry, resolve, answered: false, correct: false, tick: null };
        closeBtn.hidden = true;
        word.textContent = entry.word;
        level.textContent = entry.level;
        result.textContent = 'Chọn cách đọc đúng để kéo cá lên!';
        result.className = 'kanji-result';
        options.replaceChildren(
          ...shuffle([entry.reading, ...entry.distractors]).map((reading) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.lang = 'ja';
            button.dataset.reading = reading;
            button.textContent = reading;
            button.addEventListener('click', () => settle(reading === entry.reading, reading));
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
        options.firstElementChild?.focus({ preventScroll: true });
      });
    },
    cancel() {
      if (!pending) return;
      const current = pending;
      clearInterval(current.tick);
      pending = null;
      if (dialog.open) dialog.close();
      current.resolve({ correct: false, entry: current.entry, cancelled: true });
    },
  };
}
