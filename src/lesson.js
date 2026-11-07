import { LESSONS } from './lessons.js';

const RUBY = /([\u3400-\u9fff\u3005\u3006\uff21-\uff3a\uff41-\uff5a]+)\{([^}]+)\}/g;

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendRuby(target, text) {
  let last = 0;
  for (const match of text.matchAll(RUBY)) {
    if (match.index > last) target.append(document.createTextNode(text.slice(last, match.index)));
    const ruby = el('ruby');
    ruby.append(document.createTextNode(match[1]), el('rt', null, match[2]));
    target.append(ruby);
    last = match.index + match[0].length;
  }
  if (last < text.length) target.append(document.createTextNode(text.slice(last)));
}

function japanese(text) {
  const fragment = document.createDocumentFragment();
  for (const part of text.split(/(\[[^\]]+\])/)) {
    if (!part) continue;
    if (part.startsWith('[')) {
      const mark = el('mark');
      appendRuby(mark, part.slice(1, -1));
      fragment.append(mark);
    } else {
      appendRuby(fragment, part);
    }
  }
  return fragment;
}

const MODE_KEY = 'truong-lang-xua.lessonMode';
const CHOICE_KEY = 'truong-lang-xua.lessonChoice';

function loadChoice() {
  try {
    const no = Number(localStorage.getItem(CHOICE_KEY));
    return Math.max(0, LESSONS.findIndex((lesson) => lesson.no === no));
  } catch {
    return 0;
  }
}
const FURIGANA_KEY = 'truong-lang-xua.furigana';
const TRANSLATE_KEY = 'truong-lang-xua.translate';

function loadFurigana() {
  try {
    return localStorage.getItem(FURIGANA_KEY) !== 'off';
  } catch {
    return true;
  }
}

function loadTranslate() {
  try {
    return localStorage.getItem(TRANSLATE_KEY) === 'on';
  } catch {
    return false;
  }
}

function loadMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'choose' ? 'choose' : 'random';
  } catch {
    return 'random';
  }
}

export function createLesson() {
  const panel = document.getElementById('lesson');
  const reopen = document.getElementById('lessonOpen');
  const phrase = panel.querySelector('.lesson-phrase');
  const romaji = panel.querySelector('.lesson-romaji');
  const meaning = document.getElementById('lessonMeaning');
  const situation = panel.querySelector('.lesson-situation');
  const lines = panel.querySelector('.lesson-lines');
  const close = document.getElementById('lessonClose');
  const furiganaBtn = document.getElementById('lessonFurigana');
  const translateBtn = document.getElementById('lessonTranslate');

  const deck = () => shuffle(LESSONS.flatMap((lesson, li) => lesson.examples.map((_, ei) => [li, ei])));
  let order = deck();
  let shown = 0;
  const perLesson = LESSONS.map((lesson) => ({ order: shuffle(lesson.examples.map((_, i) => i)), shown: 0 }));
  let mode = loadMode();
  let choice = loadChoice();
  let current = null;
  let seated = false;

  function render() {
    const [li, ei] = current;
    const lesson = LESSONS[li];
    const example = lesson.examples[ei];
    phrase.replaceChildren(japanese(lesson.phrase));
    romaji.textContent = lesson.romaji;
    meaning.textContent = lesson.meaning;
    situation.textContent = example.title;
    lines.replaceChildren(
      ...example.lines.map(([speaker, text, translation]) => {
        const row = el('p', 'lesson-line');
        const body = el('span', 'lesson-text');
        body.append(japanese(text));
        if (translation) body.append(el('span', 'lesson-vi', translation));
        row.append(el('span', 'lesson-speaker', speaker), body);
        return row;
      }),
    );
  }

  function pickRandom() {
    if (shown >= order.length) {
      order = deck();
      shown = 0;
    }
    current = order[shown];
    shown += 1;
    render();
  }

  function pickFrom(li) {
    const state = perLesson[li];
    if (state.shown >= state.order.length) {
      state.order = shuffle(state.order);
      state.shown = 0;
    }
    current = [li, state.order[state.shown]];
    state.shown += 1;
    render();
  }

  function pickNext() {
    if (mode === 'choose') pickFrom(choice);
    else pickRandom();
  }

  function ensure() {
    if (current) render();
    else pickNext();
  }

  function setVisible(visible) {
    panel.classList.toggle('show', visible);
    panel.setAttribute('aria-hidden', String(!visible));
    reopen.hidden = visible || !seated;
  }

  function showFurigana(on) {
    panel.classList.toggle('no-furigana', !on);
    furiganaBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Ẩn furigana' : 'Hiện furigana';
    furiganaBtn.title = label;
    furiganaBtn.setAttribute('aria-label', label);
  }

  showFurigana(loadFurigana());
  furiganaBtn.addEventListener('click', () => {
    const on = panel.classList.contains('no-furigana');
    showFurigana(on);
    try {
      localStorage.setItem(FURIGANA_KEY, on ? 'on' : 'off');
    } catch {}
  });

  function showTranslation(on) {
    panel.classList.toggle('show-vi', on);
    translateBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Ẩn bản dịch tiếng Việt' : 'Hiện bản dịch tiếng Việt';
    translateBtn.title = label;
    translateBtn.setAttribute('aria-label', label);
  }

  showTranslation(loadTranslate());
  translateBtn.addEventListener('click', () => {
    const on = !panel.classList.contains('show-vi');
    showTranslation(on);
    try {
      localStorage.setItem(TRANSLATE_KEY, on ? 'on' : 'off');
    } catch {}
  });

  close.addEventListener('click', () => setVisible(false));
  reopen.addEventListener('click', () => setVisible(true));

  return {
    get mode() {
      return mode;
    },
    get visible() {
      return panel.classList.contains('show');
    },
    get choice() {
      return LESSONS[choice].no;
    },
    setMode(next, lessonNo) {
      mode = next === 'choose' ? 'choose' : 'random';
      const index = LESSONS.findIndex((lesson) => lesson.no === lessonNo);
      if (index >= 0) choice = index;
      try {
        localStorage.setItem(MODE_KEY, mode);
        localStorage.setItem(CHOICE_KEY, String(LESSONS[choice].no));
      } catch {}
      if (mode === 'choose' && current && current[0] !== choice) current = null;
      if (!current && panel.classList.contains('show')) ensure();
    },
    nextPeriod() {
      current = null;
      pickNext();
    },
    open() {
      seated = true;
      ensure();
      setVisible(true);
    },
    close() {
      seated = false;
      setVisible(false);
    },
  };
}
