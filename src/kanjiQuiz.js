import { FISH, FISHING, PHRASE_QUIZ } from './config.js';
import { paintIcon } from './itemArt.js';
import { recall } from './recall.js';
import { japanese } from './ruby.js';

const RECENT = 40;
const AUTO_CLOSE_MS = 3000;
const QUICK_CLOSE_MS = 3000;
const CLOSE_ANIMATION_MS = 600;
const LETTERS = ['A', 'B', 'C', 'D'];
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

function view(prefix, textId, iconId) {
  const node = (id) => document.getElementById(`${prefix}${id}`);
  return {
    prefix,
    dialog: node('Dialog'),
    text: node(textId),
    level: node('Level'),
    options: node('Options'),
    bar: node('Bar'),
    result: node('Result'),
    close: node('Close'),
    icon: node(iconId),
  };
}

function clozeLines(lines) {
  let blank = null;
  const nodes = lines.map(([speaker, text]) => {
    const line = document.createElement('p');
    line.className = 'phrase-line';
    if (speaker) {
      const who = document.createElement('b');
      who.textContent = speaker;
      line.append(who);
    }
    const words = document.createElement('span');
    const match = text.match(MARK);
    if (!match) words.append(japanese(text));
    else {
      blank = document.createElement('span');
      blank.className = 'phrase-blank';
      words.append(japanese(text.slice(0, match.index)), blank, japanese(text.slice(match.index + match[0].length)));
    }
    line.append(words);
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
  const count = (choices || PHRASE_QUIZ.choices) - 1;
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

function quizSeconds(kind, phrase) {
  if (!phrase) return FISHING.quizSeconds;
  return kind === 'cloze' ? PHRASE_QUIZ.clozeSeconds : PHRASE_QUIZ.meaningSeconds;
}

export function createKanjiQuiz() {
  const views = { kanji: view('kanji', 'Word', 'Fish'), phrase: view('phrase', 'Text', 'Icon') };
  const recent = [];
  let pending = null;
  let closing = null;

  function hide(current) {
    current.dialog.classList.remove('closing');
    if (current.dialog.open) current.dialog.close();
  }

  function endClosing() {
    if (!closing) return;
    const { timer, done, view: shown } = closing;
    clearTimeout(timer);
    closing = null;
    hide(shown);
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

  function settle(correct, chosen) {
    if (!pending || pending.answered) return;
    const current = pending;
    const ui = current.view;
    current.answered = true;
    current.correct = correct;
    clearInterval(current.tick);
    ui.icon.classList.remove('hooked');
    ui.icon.classList.add(correct ? 'caught' : 'escaped');
    for (const button of ui.options.children) {
      button.disabled = true;
      if (button.dataset.value === current.answer) button.classList.add('right');
      else if (button.dataset.value === chosen) button.classList.add('wrong');
    }
    ui.result.className = `${ui.prefix}-result ${correct ? 'right' : 'wrong'}`;
    const shown = plain(current.entry.word);
    ui.result.textContent = current.entry.reading ? `${shown}（${current.entry.reading}）: ${current.entry.meaning}` : `${shown}: ${current.entry.meaning}`;
    if (current.blank) {
      const mark = document.createElement('mark');
      mark.append(japanese(current.answer));
      current.blank.replaceChildren(mark);
      current.blank.classList.add('filled');
    }
    recall.record(current.entry.key, correct);
    current.onAnswer?.(correct);
    if (!current.brief) {
      ui.close.hidden = false;
      ui.close.focus({ preventScroll: true });
    }
    const delay = current.closeAfter ?? (current.quick ? QUICK_CLOSE_MS : correct ? AUTO_CLOSE_MS : null);
    if (delay !== null) current.closeAt = setTimeout(finish, delay);
  }

  function finish() {
    const current = pending;
    if (!current?.answered) return;
    clearTimeout(current.closeAt);
    pending = null;
    const ui = current.view;
    if (!ui.dialog.open || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hide(ui);
      current.resolve({ correct: current.correct, entry: current.entry });
      return;
    }
    ui.dialog.classList.add('closing');
    closing = {
      view: ui,
      timer: setTimeout(endClosing, CLOSE_ANIMATION_MS),
      done: () => current.resolve({ correct: current.correct, entry: current.entry }),
    };
  }

  for (const ui of Object.values(views)) {
    ui.close.addEventListener('click', finish);
    ui.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (pending?.answered) finish();
      else if (pending) settle(false, null);
    });
  }

  function showPrompt(ui, entry, asked) {
    if (ui === views.kanji) {
      ui.text.textContent = entry.word;
      return null;
    }
    if (asked.kind !== 'cloze') {
      ui.text.className = 'phrase-text single';
      ui.text.replaceChildren(japanese(entry.word));
      return null;
    }
    const cloze = clozeLines(asked.lines);
    ui.text.className = 'phrase-text dialogue';
    ui.text.replaceChildren(...cloze.nodes);
    return cloze.blank;
  }

  function optionButton(ui, asked, value, letter) {
    const button = document.createElement('button');
    button.type = 'button';
    button.lang = asked.kind === 'meaning' ? 'vi' : 'ja';
    button.dataset.value = value;
    if (letter) {
      const tag = document.createElement('span');
      tag.className = `${ui.prefix}-letter`;
      tag.textContent = ui === views.kanji ? `${letter}. ` : letter;
      button.append(tag);
    }
    const label = document.createElement('span');
    label.append(asked.kind === 'cloze' ? japanese(value) : value);
    button.append(label);
    button.addEventListener('click', () => settle(value === pending?.answer, value));
    return button;
  }

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
      const phrase = entry.deck !== 'n2';
      const ui = phrase ? views.phrase : views.kanji;
      const lettered = phrase || choices > 0;
      return new Promise((resolve) => {
        pending = { view: ui, entry, answer: asked.answer, resolve, quick: quick || !!fish, closeAfter, onAnswer, brief, answered: false, correct: false, tick: null, closeAt: null, blank: null };
        ui.close.hidden = true;
        ui.dialog.classList.toggle('brief', brief);
        paintIcon(ui.icon, icon ? { icon } : { icon: FISH[fish]?.icon ?? '', art: fish });
        ui.icon.className = `${ui === views.kanji ? 'kanji-fish' : 'phrase-icon'} hooked`;
        pending.blank = showPrompt(ui, entry, asked);
        ui.level.textContent = entry.level;
        ui.result.textContent = '';
        ui.result.className = `${ui.prefix}-result`;
        ui.options.classList.toggle('lettered', lettered);
        ui.options.classList.toggle('meanings', asked.kind === 'meaning');
        ui.options.replaceChildren(...shuffle([asked.answer, ...asked.wrong]).map((value, i) => optionButton(ui, asked, value, lettered ? LETTERS[i] : null)));
        const started = performance.now();
        const total = quizSeconds(asked.kind, phrase) * 1000;
        ui.bar.style.transform = 'scaleX(1)';
        pending.tick = setInterval(() => {
          const left = Math.max(0, 1 - (performance.now() - started) / total);
          ui.bar.style.transform = `scaleX(${left})`;
          if (left <= 0) settle(false, null);
        }, 100);
        if (!ui.dialog.open) ui.dialog.showModal();
        ui.dialog.focus({ preventScroll: true });
      });
    },
    cancel() {
      if (!pending) return;
      const current = pending;
      clearInterval(current.tick);
      clearTimeout(current.closeAt);
      pending = null;
      hide(current.view);
      current.resolve({ correct: false, entry: current.entry, cancelled: true });
    },
  };
}
