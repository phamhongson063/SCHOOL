import { N2_VOCAB } from './vocabN2.js';

const INDEX_KEY = 'truong-lang-xua.n2Index';
const MODES = { random: '🔀 Ngẫu nhiên', order: '🔢 Theo thứ tự' };

function loadIndex() {
  try {
    const value = Number(localStorage.getItem(INDEX_KEY));
    return Number.isInteger(value) && value >= 0 && value < N2_VOCAB.length ? value : 0;
  } catch {
    return 0;
  }
}

function saveIndex(index) {
  try {
    localStorage.setItem(INDEX_KEY, String(index));
  } catch {}
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function createStudy() {
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
  const total = N2_VOCAB.length;
  let mode = null;
  let order = [];
  let pos = 0;
  let seated = false;

  function showStart() {
    mode = null;
    start.hidden = false;
    body.hidden = true;
    modeChip.hidden = true;
  }

  function render() {
    const entry = N2_VOCAB[order[pos]];
    word.textContent = entry.word;
    reading.textContent = entry.reading;
    hanViet.textContent = entry.hanViet;
    meaning.textContent = entry.meaning;
    count.textContent = `${pos + 1}/${total}`;
    bar.style.transform = `scaleX(${(pos + 1) / total})`;
  }

  function begin(next) {
    mode = next;
    const all = N2_VOCAB.map((_, i) => i);
    order = mode === 'random' ? shuffle(all) : all;
    pos = mode === 'random' ? 0 : loadIndex();
    modeChip.textContent = MODES[mode];
    modeChip.hidden = false;
    start.hidden = true;
    body.hidden = false;
    render();
  }

  function go(step) {
    pos = (pos + step + total) % total;
    if (mode === 'order') saveIndex(pos);
    render();
  }

  function setVisible(visible) {
    panel.classList.toggle('show', visible);
    panel.setAttribute('aria-hidden', String(!visible));
    reopen.hidden = visible || !seated;
  }

  for (const button of start.querySelectorAll('[data-mode]')) button.addEventListener('click', () => begin(button.dataset.mode));
  modeChip.addEventListener('click', showStart);
  document.getElementById('studyPrev').addEventListener('click', () => go(-1));
  document.getElementById('studyNext').addEventListener('click', () => go(1));
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
