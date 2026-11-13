import { FISH, FISHING, PHRASE_QUIZ } from './config.js';
import { paintIcon } from './itemArt.js';
import { japanese } from './ruby.js';
import { DECKS, unitOf, plainText as plain } from './studyDecks.js';

const RECENT = 40;
const AUTO_CLOSE_MS = 3000;
const QUICK_CLOSE_MS = 3000;
const CLOSE_ANIMATION_MS = 600;
const LETTERS = ['A', 'B', 'C', 'D'];
const MARKS = /\[([^\]]+)\]/g;
const RUBY = /[㐀-鿿々〆Ａ-Ｚａ-ｚ]+\{([^}]+)\}/g;

const ALL_KEYS = Object.values(DECKS).flatMap((deck) => deck.cards.map((card) => card.key));
const CLOZE_ANSWERS = DECKS.sugu1.cards.filter((card) => card.cloze).map((card) => card.cloze.answer);
const N2_MEANINGS = [...new Set(DECKS.n2.cards.map((card) => card.meaning))];

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
    clock: node('Clock'),
    icon: node(iconId),
  };
}

function clozeLines(lines, cloze) {
  const blanks = [];
  let blanked = false;
  const nodes = lines.map(([speaker, text]) => {
    const line = document.createElement('p');
    line.className = 'phrase-line';
    if (speaker) {
      const who = document.createElement('b');
      who.textContent = speaker;
      line.append(who);
    }
    const words = document.createElement('span');
    let from = 0;
    for (const match of text.matchAll(MARKS)) {
      words.append(japanese(text.slice(from, match.index)));
      if (cloze.all || !blanked) {
        const blank = document.createElement('span');
        blank.className = 'phrase-blank';
        words.append(blank);
        blanks.push(blank);
        blanked = true;
      } else words.append(japanese(match[1]));
      from = match.index + match[0].length;
    }
    words.append(japanese(text.slice(from)));
    line.append(words);
    return line;
  });
  return { nodes, blanks };
}

function pickLine(text) {
  const line = document.createElement('p');
  line.className = 'phrase-line';
  const words = document.createElement('span');
  const blanks = [];
  let from = 0;
  for (const match of text.matchAll(MARKS)) {
    words.append(japanese(text.slice(from, match.index)));
    const blank = document.createElement('span');
    blank.className = 'phrase-blank';
    blank.lang = 'ja';
    blank.textContent = match[1].replace(RUBY, '$1');
    blank.dataset.fill = match[1];
    words.append(blank);
    blanks.push(blank);
    from = match.index + match[0].length;
  }
  words.append(japanese(text.slice(from)));
  line.append(words);
  return { nodes: [line], blanks };
}

function kanjiPick(entry) {
  const example = entry.examples[Math.floor(Math.random() * entry.examples.length)];
  return { kind: 'pick', answer: entry.word, wrong: shuffle([...entry.kanjiChoices]), text: example.lines[0][1] };
}

function question(entry, kind, choices) {
  if (entry.deck === 'n2') {
    if (kind !== 'meaning' && entry.kanjiChoices.length && entry.examples.length) return kanjiPick(entry);
    const byMeaning = kind === 'meaning' || !entry.distractors.length;
    const answer = byMeaning ? entry.meaning : entry.reading;
    const others = byMeaning ? shuffle(N2_MEANINGS.filter((meaning) => meaning !== answer && !entry.siblingMeanings.includes(meaning))) : shuffle([...entry.distractors]);
    return { kind: byMeaning ? 'meaning' : 'reading', answer, wrong: others.slice(0, choices ? choices - 1 : byMeaning ? 3 : others.length) };
  }
  const count = (choices || PHRASE_QUIZ.choices) - 1;
  const answer = entry.cloze.answer;
  const seen = new Set([plain(answer)]);
  const forms = shuffle([...CLOZE_ANSWERS]).filter((form) => !seen.has(plain(form)) && seen.add(plain(form)));
  const ending = plain(answer).at(-1);
  const wrong = [...forms.filter((form) => plain(form).at(-1) === ending), ...forms.filter((form) => plain(form).at(-1) !== ending)].slice(0, count);
  return { kind: 'cloze', answer, wrong, lines: entry.examples[0].lines, cloze: entry.cloze };
}

function quizSeconds(kind, phrase) {
  if (!phrase) return FISHING.quizSeconds;
  return kind === 'cloze' || kind === 'pick' ? PHRASE_QUIZ.clozeSeconds : PHRASE_QUIZ.meaningSeconds;
}

const levelOf = (entry) => DECKS[entry.deck].level;

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

  function pick(keys) {
    const fresh = keys.filter((key) => !recent.includes(key));
    const pool = fresh.length ? fresh : keys;
    const key = pool[Math.floor(Math.random() * pool.length)];
    recent.push(key);
    while (recent.length > Math.min(RECENT, keys.length - 1)) recent.shift();
    return unitOf(key);
  }

  function settle(correct, chosen) {
    if (!pending || pending.answered) return;
    const current = pending;
    const ui = current.view;
    current.answered = true;
    current.correct = correct;
    clearInterval(current.tick);
    ui.icon.classList.remove('hooked');
    if (correct) ui.icon.classList.add('caught');
    for (const button of ui.options.children) {
      button.disabled = true;
      if (button.dataset.value === current.answer) button.classList.add('right');
      else if (button.dataset.value === chosen) button.classList.add('wrong');
    }
    ui.result.className = `${ui.prefix}-result ${correct ? 'right' : 'wrong'}`;
    const shown = plain(current.entry.word);
    ui.result.textContent = current.entry.reading ? `${shown}（${current.entry.reading}）: ${current.entry.meaning}` : `${shown}: ${current.entry.meaning}`;
    for (const blank of current.blanks) {
      const mark = document.createElement('mark');
      mark.append(japanese(blank.dataset.fill ?? current.answer));
      blank.replaceChildren(mark);
      blank.classList.add('filled');
    }
    current.onAnswer?.(correct);
    if (!current.brief) ui.close.hidden = false;
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
      return [];
    }
    if (asked.kind === 'pick') {
      const sentence = pickLine(asked.text);
      ui.text.className = 'phrase-text dialogue';
      ui.text.replaceChildren(...sentence.nodes);
      return sentence.blanks;
    }
    if (asked.kind !== 'cloze') {
      ui.text.className = 'phrase-text single';
      ui.text.replaceChildren(japanese(entry.word));
      return [];
    }
    const cloze = clozeLines(asked.lines, asked.cloze);
    ui.text.className = 'phrase-text dialogue';
    ui.text.replaceChildren(...cloze.nodes);
    return cloze.blanks;
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
    async ask({ keys = ALL_KEYS, key = null, fish = null, icon = null, quick = false, kind = 'reading', choices = 0, closeAfter = null, onAnswer = null, brief = false, seconds = null, level = null, note = null, clock = null } = {}) {
      endClosing();
      const entry = key ? unitOf(key) : keys.length ? pick(keys) : null;
      if (!entry) return { correct: false, entry: null, empty: true };
      const asked = question(entry, kind, choices);
      const phrase = entry.deck !== 'n2' || asked.kind === 'pick';
      const ui = phrase ? views.phrase : views.kanji;
      const lettered = phrase || choices > 0;
      return new Promise((resolve) => {
        pending = { view: ui, entry, answer: asked.answer, resolve, quick: quick || !!fish, closeAfter, onAnswer, brief, answered: false, correct: false, tick: null, closeAt: null, blanks: [] };
        ui.close.hidden = true;
        ui.dialog.classList.toggle('brief', brief);
        paintIcon(ui.icon, icon ? { icon } : { icon: FISH[fish]?.icon ?? '', art: fish });
        ui.icon.className = 'quiz-icon hooked';
        pending.blanks = showPrompt(ui, entry, asked);
        ui.level.textContent = [level ?? levelOf(entry), note].filter(Boolean).join(' · ');
        ui.clock.textContent = clock ?? '';
        ui.clock.hidden = !clock;
        ui.result.textContent = '';
        ui.result.className = `${ui.prefix}-result`;
        ui.options.classList.toggle('lettered', lettered);
        ui.options.classList.toggle('meanings', asked.kind === 'meaning');
        ui.options.replaceChildren(...shuffle([asked.answer, ...asked.wrong]).map((value, i) => optionButton(ui, asked, value, lettered ? LETTERS[i] : null)));
        const started = performance.now();
        const total = (seconds ?? quizSeconds(asked.kind, phrase)) * 1000;
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
