import { N2_VOCAB } from './vocabN2.js';
import { recall, MASTERED_BOX } from './recall.js';
import { japanese } from './ruby.js';

const FURIGANA_KEY = 'truong-lang-xua.studyFurigana';
const MODES = { random: { icon: '🔀', name: 'Ngẫu nhiên' }, smart: { icon: '🧠', name: 'Thông minh' } };
const NEW_PER_SESSION = 10;
const WORDS = N2_VOCAB.map((entry) => entry.word);

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function loadFurigana() {
  try {
    return localStorage.getItem(FURIGANA_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function createStudy({ onComplete } = {}) {
  const panel = document.getElementById('study');
  const reopen = document.getElementById('studyOpen');
  const start = document.getElementById('studyStart');
  const body = document.getElementById('studyBody');
  const modeChip = document.getElementById('studyMode');
  const word = document.getElementById('studyWord');
  const reading = document.getElementById('studyReading');
  const hanViet = document.getElementById('studyHanViet');
  const meaning = document.getElementById('studyMeaning');
  const count = document.getElementById('studyCount');
  const bar = document.getElementById('studyBar');
  const prev = document.getElementById('studyPrev');
  const next = document.getElementById('studyNext');
  const forgot = document.getElementById('studyForgot');
  const remembered = document.getElementById('studyRemembered');
  const example = document.getElementById('studyExample');
  const exampleVi = document.getElementById('studyExampleVi');
  const furiganaBtn = document.getElementById('studyFurigana');
  const total = N2_VOCAB.length;
  let mode = null;
  let order = [];
  let pos = 0;
  let current = -1;
  let fresh = 0;
  let answered = 0;
  let caughtUp = false;
  let seated = false;

  recall.seed(WORDS);
  showFurigana(loadFurigana());

  function showStart() {
    mode = null;
    start.hidden = false;
    body.hidden = true;
    modeChip.hidden = true;
  }

  function fill(index) {
    current = index;
    const entry = N2_VOCAB[index];
    word.textContent = entry.word;
    reading.textContent = entry.reading;
    hanViet.textContent = entry.hanViet;
    meaning.textContent = entry.meaning;
    example.replaceChildren(japanese(entry.example));
    exampleVi.textContent = entry.exampleVi;
  }

  function showFurigana(on) {
    panel.classList.toggle('no-furigana', !on);
    furiganaBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Ẩn furigana' : 'Hiện furigana';
    furiganaBtn.title = label;
    furiganaBtn.setAttribute('aria-label', label);
  }

  function showProgress(done) {
    count.textContent = `${done}/${total}`;
    bar.style.transform = `scaleX(${done / total})`;
  }

  function setCovered(covered) {
    body.classList.toggle('covered', covered);
    meaning.textContent = covered ? '?' : N2_VOCAB[current].meaning;
    forgot.hidden = covered;
    remembered.hidden = covered;
  }

  function pickSmart() {
    let upcoming = -1;
    for (let i = 0; i < total; i++) {
      if (i === current) continue;
      const due = recall.due(WORDS[i]);
      if (due !== null && (upcoming < 0 || due < recall.due(WORDS[upcoming]))) upcoming = i;
    }
    if (upcoming >= 0 && recall.due(WORDS[upcoming]) <= recall.step) return upcoming;
    if (fresh < NEW_PER_SESSION) {
      const unseen = WORDS.findIndex((w, i) => i !== current && recall.due(w) === null);
      if (unseen >= 0) {
        fresh += 1;
        return unseen;
      }
    }
    if (answered > 0 && !caughtUp) {
      caughtUp = true;
      body.classList.add('done');
      onComplete?.();
    }
    return upcoming >= 0 ? upcoming : Math.max(current, 0);
  }

  function renderRandom() {
    fill(order[pos]);
    showProgress(pos + 1);
  }

  function renderSmart() {
    fill(pickSmart());
    setCovered(true);
    showProgress(WORDS.filter((w) => recall.box(w) >= MASTERED_BOX).length);
  }

  function begin(nextMode) {
    mode = nextMode;
    const smart = mode === 'smart';
    current = -1;
    prev.hidden = smart;
    next.hidden = smart;
    modeChip.textContent = MODES[mode].icon;
    modeChip.setAttribute('aria-label', MODES[mode].name);
    modeChip.hidden = false;
    start.hidden = true;
    body.hidden = false;
    body.classList.remove('done');
    if (smart) {
      fresh = 0;
      answered = 0;
      caughtUp = false;
      renderSmart();
      return;
    }
    body.classList.remove('covered');
    forgot.hidden = true;
    remembered.hidden = true;
    order = shuffle(N2_VOCAB.map((_, i) => i));
    pos = 0;
    renderRandom();
  }

  function go(step) {
    pos = (pos + step + total) % total;
    renderRandom();
  }

  function answer(knew) {
    recall.record(WORDS[current], knew);
    answered += 1;
    renderSmart();
  }

  function setVisible(visible) {
    panel.classList.toggle('show', visible);
    panel.setAttribute('aria-hidden', String(!visible));
    reopen.hidden = visible || !seated;
  }

  for (const button of start.querySelectorAll('[data-mode]')) button.addEventListener('click', () => begin(button.dataset.mode));
  modeChip.addEventListener('click', showStart);
  body.addEventListener('click', (event) => {
    if (body.classList.contains('covered') && !event.target.closest('button')) setCovered(false);
  });
  furiganaBtn.addEventListener('click', () => {
    const on = panel.classList.contains('no-furigana');
    showFurigana(on);
    try {
      localStorage.setItem(FURIGANA_KEY, on ? 'on' : 'off');
    } catch {}
  });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  forgot.addEventListener('click', () => answer(false));
  remembered.addEventListener('click', () => answer(true));
  document.getElementById('studyClose').addEventListener('click', () => setVisible(false));
  reopen.addEventListener('click', () => setVisible(true));

  return {
    get visible() {
      return panel.classList.contains('show');
    },
    open() {
      seated = true;
      showStart();
      setVisible(true);
    },
    close() {
      seated = false;
      setVisible(false);
    },
  };
}
