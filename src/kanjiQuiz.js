import { FISH, FISHING } from './config.js';
import { paintIcon } from './itemArt.js';
import { recall } from './recall.js';
import { japanese } from './ruby.js';

const RECENT = 40;
const AUTO_CLOSE_MS = 3000;
const QUICK_CLOSE_MS = 3000;
const CLOSE_ANIMATION_MS = 600;
const LETTERS = ['A', 'B', 'C', 'D'];
const PHRASE_CHOICES = 4;
const MARK = /\[([^\]]+)\]/;
const MARKS = /\[[^\]]+\]/g;
const plain = (text) => text.replace(/\{[^}]+\}/g, '');

let bank = null;

function n2Bank() {
  return import('./vocabN2.js').then(
    (module) =>
      module.N2_VOCAB.filter((entry) => entry.distractors?.length).map((entry) => ({
        key: entry.word,
        deck: 'n2',
        word: entry.word,
        reading: entry.reading,
        distractors: entry.distractors,
        meaning: entry.meaning,
        level: 'N2',
      })),
    () => [],
  );
}

function phraseBank() {
  return import('./studyDecks.js').then(
    ({ DECKS }) =>
      DECKS.sugu1.cards.map((card) => ({
        key: card.key,
        deck: 'sugu1',
        word: card.word,
        meaning: card.meaning,
        level: DECKS.sugu1.title,
        clozes: card.examples
          .filter((example) => example.lines.reduce((sum, line) => sum + (line[1].match(MARKS)?.length ?? 0), 0) === 1)
          .map((example) => ({ lines: example.lines, answer: example.lines.map((line) => line[1].match(MARK)?.[1]).find(Boolean) })),
      })),
    () => [],
  );
}

function loadBank() {
  bank ??= Promise.all([n2Bank(), phraseBank()]).then((decks) => decks.flat());
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
    const fresh = entries.filter((entry) => !recent.includes(entry.key));
    const pool = fresh.length ? fresh : entries;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    recent.push(entry.key);
    while (recent.length > Math.min(RECENT, entries.length - 1)) recent.shift();
    return entry;
  }

  function clozeLines(lines) {
    let blank = null;
    const nodes = lines.map(([speaker, text]) => {
      const line = document.createElement('span');
      line.className = 'kanji-line';
      if (speaker) {
        const who = document.createElement('b');
        who.textContent = speaker;
        line.append(who);
      }
      const match = text.match(MARK);
      if (!match) {
        line.append(japanese(text));
        return line;
      }
      blank = document.createElement('span');
      blank.className = 'kanji-blank';
      line.append(japanese(text.slice(0, match.index)), blank, japanese(text.slice(match.index + match[0].length)));
      return line;
    });
    return { nodes, blank };
  }

  function question(entry, entries, kind, choices) {
    if (entry.deck === 'n2') {
      const byMeaning = kind === 'meaning';
      const answer = byMeaning ? entry.meaning : entry.reading;
      const others = byMeaning
        ? shuffle([...new Set(entries.filter((other) => other.deck === 'n2').map((other) => other.meaning))].filter((meaning) => meaning !== answer))
        : shuffle([...entry.distractors]);
      return { kind: byMeaning ? 'meaning' : 'reading', answer, wrong: others.slice(0, choices ? choices - 1 : others.length) };
    }
    const count = (choices || PHRASE_CHOICES) - 1;
    const rest = entries.filter((other) => other.deck === entry.deck && other.key !== entry.key);
    if (!entry.clozes.length || Math.random() < 0.5) {
      const others = shuffle([...new Set(rest.map((other) => other.meaning))].filter((meaning) => meaning !== entry.meaning));
      return { kind: 'meaning', answer: entry.meaning, wrong: others.slice(0, count) };
    }
    const cloze = entry.clozes[Math.floor(Math.random() * entry.clozes.length)];
    const seen = new Set([plain(cloze.answer)]);
    const forms = shuffle(rest.flatMap((other) => other.clozes.map((item) => item.answer))).filter((form) => !seen.has(plain(form)) && seen.add(plain(form)));
    const ending = plain(cloze.answer).at(-1);
    const wrong = [...forms.filter((form) => plain(form).at(-1) === ending), ...forms.filter((form) => plain(form).at(-1) !== ending)].slice(0, count);
    return { kind: 'cloze', answer: cloze.answer, wrong, lines: cloze.lines };
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
    const shown = plain(current.entry.word);
    result.textContent = current.entry.reading ? `${shown}（${current.entry.reading}）: ${current.entry.meaning}` : `${shown}: ${current.entry.meaning}`;
    if (current.blank) {
      const mark = document.createElement('mark');
      mark.append(japanese(current.answer));
      current.blank.replaceChildren(mark);
      current.blank.classList.add('filled');
    }
    recall.record(current.entry.key, correct);
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
      const asked = question(entry, entries, kind, choices);
      const { answer, wrong } = asked;
      const byMeaning = asked.kind === 'meaning';
      const lettered = choices > 0 || entry.deck !== 'n2';
      const cloze = asked.kind === 'cloze' ? clozeLines(asked.lines) : null;
      return new Promise((resolve) => {
        pending = { entry, answer, resolve, quick: quick || !!fish, closeAfter, onAnswer, brief, answered: false, correct: false, tick: null, closeAt: null, blank: cloze?.blank ?? null };
        closeBtn.hidden = true;
        dialog.classList.toggle('brief', brief);
        paintIcon(fishIcon, icon ? { icon } : { icon: FISH[fish]?.icon ?? '', art: fish });
        fishIcon.className = 'kanji-fish hooked';
        word.className = cloze ? 'kanji-word cloze' : entry.deck === 'n2' ? 'kanji-word' : 'kanji-word phrase';
        if (cloze) word.replaceChildren(...cloze.nodes);
        else word.replaceChildren(japanese(entry.word));
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
            const text = asked.kind === 'cloze' ? japanese(value) : value;
            if (lettered) button.append(`${LETTERS[i]}. `, text);
            else button.append(text);
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
