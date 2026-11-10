import { N2_VOCAB } from './vocabN2.js';
import { recall, MASTERED_BOX } from './recall.js';
import { japanese } from './ruby.js';
import { STUDY } from './config.js';
import { coins } from './format.js';
import { economy } from './economy.js';
import { setRich } from './goldArt.js';
import { gameNow } from './clock.js';

const FURIGANA_KEY = 'truong-lang-xua.studyFurigana';
const MODES = { random: { icon: '🔀', name: 'Ngẫu nhiên' }, smart: { icon: '🧠', name: 'Thông minh' } };
const NO_MONEY = 'Xin lỗi, bạn không đủ tiền mua gói này.';
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

function packButton(offer) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'study-pick';
  const size = document.createElement('span');
  size.textContent = offer.words;
  const price = document.createElement('span');
  price.className = 'study-pack-price';
  setRich(price, coins(offer.price));
  button.append(size, 'từ mới', price);
  return button;
}

export function createStudy({ purse, music = null }) {
  const panel = document.getElementById('study');
  const reopen = document.getElementById('studyOpen');
  const start = document.getElementById('studyStart');
  const packs = document.getElementById('studyPacks');
  const packList = document.getElementById('studyPackList');
  const packNote = document.getElementById('studyPackNote');
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
  const translateBtn = document.getElementById('studyTranslate');
  const total = N2_VOCAB.length;
  let order = [];
  let pos = 0;
  let current = -1;
  let pack = null;
  let packCard = false;
  let seated = false;
  let studying = false;
  const dim = document.getElementById('studyDim');

  recall.seed(WORDS);
  showFurigana(loadFurigana());
  showTranslation(false);

  function endPack() {
    if (!pack) return;
    const refund = Math.floor(((pack.left * pack.price) / pack.words) * STUDY.refund);
    pack = null;
    music?.stop();
    if (refund <= 0) return;
    economy.refund('teacher', refund);
    purse.earn(refund);
  }

  function showChip(mode) {
    modeChip.textContent = MODES[mode].icon;
    modeChip.setAttribute('aria-label', MODES[mode].name);
    modeChip.hidden = false;
  }

  function showPackLeft() {
    const left = document.createElement('span');
    left.className = 'study-chip-left';
    left.textContent = pack.left;
    modeChip.replaceChildren(MODES.smart.icon, left);
  }

  function showStart() {
    endPack();
    music?.stop();
    setStudying(false);
    start.hidden = false;
    packs.hidden = true;
    body.hidden = true;
    modeChip.hidden = true;
  }

  function showPacks() {
    setStudying(true);
    showChip('smart');
    start.hidden = true;
    packs.hidden = false;
    packNote.hidden = true;
    body.hidden = true;
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

  function showTranslation(on) {
    panel.classList.toggle('show-vi', on);
    translateBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Ẩn bản dịch tiếng Việt' : 'Hiện bản dịch tiếng Việt';
    translateBtn.title = label;
    translateBtn.setAttribute('aria-label', label);
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

  function mostOverdue(now) {
    let overdue = -1;
    for (let i = 0; i < total; i++) {
      if (i === current) continue;
      const due = recall.due(WORDS[i]);
      if (due !== null && due <= now && (overdue < 0 || due < recall.due(WORDS[overdue]))) overdue = i;
    }
    return overdue;
  }

  function weakest() {
    let best = -1;
    for (let i = 0; i < total; i++) {
      if (i === current && total > 1) continue;
      if (best < 0) {
        best = i;
        continue;
      }
      const box = recall.box(WORDS[i]);
      const bestBox = recall.box(WORDS[best]);
      if (box < bestBox || (box === bestBox && recall.due(WORDS[i]) < recall.due(WORDS[best]))) best = i;
    }
    return best;
  }

  function newWord() {
    const unseen = WORDS.findIndex((w, i) => i !== current && recall.due(w) === null);
    return unseen >= 0 ? unseen : weakest();
  }

  function pickSmart() {
    const review = mostOverdue(gameNow());
    if (review >= 0) {
      packCard = false;
      return review;
    }
    if (pack.left <= 0) return -1;
    packCard = true;
    return newWord();
  }

  function renderRandom() {
    fill(order[pos]);
    showProgress(pos + 1);
  }

  function renderSmart() {
    const index = pickSmart();
    if (index < 0) {
      pack = null;
      music?.stop();
      showPacks();
      return;
    }
    fill(index);
    showPackLeft();
    setCovered(true);
    showProgress(WORDS.filter((w) => recall.box(w) >= MASTERED_BOX).length);
  }

  function buy(offer) {
    if (!purse.spend(offer.price)) {
      packNote.textContent = NO_MONEY;
      packNote.hidden = false;
      return;
    }
    economy.income('teacher', offer.price);
    pack = { ...offer, left: offer.words };
    music?.start();
    showTranslation(false);
    current = -1;
    prev.hidden = true;
    next.hidden = true;
    packs.hidden = true;
    body.hidden = false;
    renderSmart();
  }

  function beginRandom() {
    music?.start();
    showTranslation(false);
    setStudying(true);
    showChip('random');
    current = -1;
    prev.hidden = false;
    next.hidden = false;
    start.hidden = true;
    body.hidden = false;
    body.classList.remove('covered');
    forgot.hidden = true;
    remembered.hidden = true;
    order = shuffle(N2_VOCAB.map((_, i) => i));
    pos = 0;
    renderRandom();
  }

  function go(step) {
    pos = (pos + step + total) % total;
    showTranslation(false);
    renderRandom();
  }

  function answer(knew) {
    recall.record(WORDS[current], knew);
    if (packCard) pack.left -= 1;
    showTranslation(false);
    renderSmart();
  }

  function setVisible(visible) {
    panel.classList.toggle('show', visible);
    panel.setAttribute('aria-hidden', String(!visible));
    reopen.hidden = visible || !seated;
    refreshFocus();
  }

  function focused() {
    return studying && panel.classList.contains('show');
  }

  function refreshFocus() {
    const on = focused();
    dim.classList.toggle('on', on);
    panel.classList.toggle('focus', on);  }

  function setStudying(on) {
    studying = on;
    refreshFocus();
  }

  for (const offer of STUDY.packs) {
    const button = packButton(offer);
    button.addEventListener('click', () => buy(offer));
    packList.append(button);
  }
  start.querySelector('[data-mode="random"]').addEventListener('click', beginRandom);
  start.querySelector('[data-mode="smart"]').addEventListener('click', showPacks);
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
  translateBtn.addEventListener('click', () => showTranslation(!panel.classList.contains('show-vi')));
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
    get focused() {
      return focused();
    },
    open() {
      seated = true;
      showStart();
      setVisible(true);
    },
    close() {
      seated = false;
      endPack();
      music?.stop();
      setStudying(false);
      setVisible(false);
    },
  };
}
