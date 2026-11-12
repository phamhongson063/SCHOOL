import { DECKS, unitOf } from './studyDecks.js';
import { certify } from './certify.js';
import { japanese } from './ruby.js';
import { CERTIFY } from './config.js';
import { coins } from './format.js';
import { economy } from './economy.js';
import { setRich } from './goldArt.js';
import { PLAYER } from './inventory.js';

const FURIGANA_KEY = 'truong-lang-xua.studyFurigana';
const MODES = { learn: { icon: '📘', name: 'Học hôm nay' }, review: { icon: '🔀', name: 'Ôn chứng chỉ' } };
const NO_MONEY = 'Xin lỗi, bạn không đủ tiền thi nội bộ.';

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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const timeText = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function createStudy({ purse, music = null, exams, onQualified = null }) {
  const panel = document.getElementById('study');
  const reopen = document.getElementById('studyOpen');
  const start = document.getElementById('studyStart');
  const status = document.getElementById('studyStatus');
  const learnInfo = document.getElementById('studyLearnInfo');
  const reviewInfo = document.getElementById('studyReviewInfo');
  const internalInfo = document.getElementById('studyInternalInfo');
  const notice = document.getElementById('studyNotice');
  const learnPick = start.querySelector('[data-mode="learn"]');
  const reviewPick = start.querySelector('[data-mode="review"]');
  const internalPick = start.querySelector('[data-mode="internal"]');
  const body = document.getElementById('studyBody');
  const modeChip = document.getElementById('studyMode');
  const word = document.getElementById('studyWord');
  const reading = document.getElementById('studyReading');
  const hanViet = document.getElementById('studyHanViet');
  const meaning = document.getElementById('studyMeaning');
  const note = document.getElementById('studyNote');
  const title = panel.querySelector('.study-title');
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
  const dim = document.getElementById('studyDim');
  let deckId = 'n2';
  let deck = DECKS.n2;
  let mode = null;
  let current = null;
  let order = [];
  let pos = 0;
  let shown = 0;
  let seated = false;
  let studying = false;
  let dimmed = false;

  showFurigana(loadFurigana());
  showTranslation(false);

  function showChip(name) {
    modeChip.textContent = MODES[name].icon;
    modeChip.setAttribute('aria-label', MODES[name].name);
    modeChip.hidden = false;
  }

  function showNotice(text) {
    notice.textContent = text ?? '';
    notice.hidden = !text;
  }

  function statusText() {
    const left = certify.learnLeft(PLAYER, deckId).length;
    if (certify.finished(PLAYER, deckId)) return 'Bạn đã học hết bộ này.';
    if (certify.examTaken(PLAYER, deckId)) return 'Hôm nay bạn đã khảo thí lớp này. Mai quay lại học tiếp nhé.';
    if (left) return `Hôm nay còn ${left} ${deck.unit} cần học.`;
    if (certify.needsInternal(PLAYER, deckId)) return 'Đã học xong. Hãy thi nội bộ để đủ điều kiện khảo thí.';
    return 'Bạn đã đủ điều kiện khảo thí. Hãy tới Trường khảo thí đăng ký nhé.';
  }

  function paintStart() {
    const batch = certify.batch(PLAYER, deckId);
    const learning = batch.filter((item) => !item.ready);
    const done = learning.filter((item) => item.count >= CERTIFY.remember).length;
    const certified = certify.certifiedCount(PLAYER, deckId);
    status.textContent = statusText();
    learnInfo.textContent = learning.length ? `${done}/${learning.length}` : '—';
    reviewInfo.textContent = `🎓 ${certified}`;
    setRich(internalInfo, coins(CERTIFY.internalFee));
    learnPick.disabled = certify.learnLeft(PLAYER, deckId).length === 0;
    reviewPick.disabled = certified === 0;
    internalPick.disabled = !certify.internalReady(PLAYER, deckId) || exams.running;
  }

  function stopMode() {
    mode = null;
    current = null;
    music?.stop();
  }

  function showStart() {
    stopMode();
    setStudying(false);
    start.hidden = false;
    body.hidden = true;
    modeChip.hidden = true;
    paintStart();
  }

  function fitWord() {
    word.style.fontSize = '';
    const room = word.clientWidth;
    const need = word.scrollWidth;
    if (room > 0 && need > room) {
      word.style.fontSize = `${Math.floor((parseFloat(getComputedStyle(word).fontSize) * room) / need)}px`;
    }
  }

  function showExample({ title: situation, lines }) {
    const [only] = lines;
    if (lines.length === 1 && !only[0]) {
      example.replaceChildren(japanese(only[1]));
      exampleVi.textContent = only[2];
      return;
    }
    example.replaceChildren(
      ...(situation ? [el('span', 'study-situation', situation)] : []),
      ...lines.map(([speaker, text]) => {
        const line = el('span', 'study-line');
        const words = el('span', 'study-words');
        words.append(japanese(text));
        line.append(el('b', 'study-speaker', speaker), words);
        return line;
      }),
    );
    exampleVi.replaceChildren(...lines.filter((line) => line[2]).map(([speaker, , vi]) => el('span', 'study-line', `${speaker}: ${vi}`)));
  }

  function fill(key) {
    current = key;
    const card = unitOf(key);
    word.replaceChildren(japanese(card.word));
    fitWord();
    reading.textContent = card.reading;
    hanViet.textContent = card.hanViet;
    meaning.textContent = card.meaning;
    note.textContent = card.note;
    showExample(card.examples[0]);
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

  function setCovered(covered) {
    body.classList.toggle('covered', covered);
    meaning.textContent = covered ? '?' : unitOf(current).meaning;
    forgot.hidden = covered;
    remembered.hidden = covered;
  }

  const waitLeft = () => Math.max(0, CERTIFY.viewSeconds - shown);

  function paintLearnCount() {
    const done = certify.count(PLAYER, deckId, current);
    const left = waitLeft();
    count.textContent = left > 0 ? `${done}/${CERTIFY.remember} · ⏳ ${timeText(left)}` : `${done}/${CERTIFY.remember}`;
    remembered.disabled = left > 0;
  }

  function paintLearnProgress() {
    const learning = certify.batch(PLAYER, deckId).filter((item) => !item.ready);
    const total = learning.length * CERTIFY.remember;
    const done = learning.reduce((sum, item) => sum + Math.min(item.count, CERTIFY.remember), 0);
    bar.style.transform = `scaleX(${total ? done / total : 1})`;
  }

  function nextLearn() {
    const left = certify.learnLeft(PLAYER, deckId);
    if (!left.length) {
      showStart();
      return;
    }
    const at = left.indexOf(current);
    const key = at >= 0 && left.length > 1 ? left[(at + 1) % left.length] : at >= 0 ? current : left[0];
    shown = 0;
    fill(key);
    showTranslation(false);
    setCovered(true);
    paintLearnCount();
    paintLearnProgress();
  }

  function beginLearn() {
    if (!certify.learnLeft(PLAYER, deckId).length) return;
    mode = 'learn';
    music?.start();
    setStudying(true);
    showChip('learn');
    current = null;
    prev.hidden = true;
    next.hidden = true;
    start.hidden = true;
    body.hidden = false;
    nextLearn();
  }

  function renderReview() {
    fill(order[pos]);
    count.textContent = `${pos + 1}/${order.length}`;
    bar.style.transform = `scaleX(${(pos + 1) / order.length})`;
  }

  function beginReview() {
    const keys = certify.certified(PLAYER, deckId);
    if (!keys.length) return;
    mode = 'review';
    music?.start();
    showTranslation(false);
    setStudying(true);
    showChip('review');
    prev.hidden = false;
    next.hidden = false;
    start.hidden = true;
    body.hidden = false;
    body.classList.remove('covered');
    forgot.hidden = true;
    remembered.hidden = true;
    remembered.disabled = false;
    order = shuffle(keys);
    pos = 0;
    renderReview();
  }

  function go(step) {
    pos = (pos + step + order.length) % order.length;
    showTranslation(false);
    renderReview();
  }

  function answer(knew) {
    if (mode !== 'learn' || !current) return;
    if (knew) {
      if (waitLeft() > 0) return;
      certify.remember(PLAYER, deckId, current);
    } else certify.forget(PLAYER, deckId, current);
    nextLearn();
  }

  async function beginInternal() {
    if (!certify.internalReady(PLAYER, deckId) || exams.running) return;
    if (!purse.spend(CERTIFY.internalFee)) {
      showNotice(NO_MONEY);
      return;
    }
    economy.income('teacher', CERTIFY.internalFee);
    showNotice(null);
    const id = deckId;
    internalPick.disabled = true;
    const results = await exams.run({ title: 'Thi nội bộ', deck: id, keys: certify.internalQuestions(PLAYER, id), icon: '📝' });
    const graded = certify.gradeInternal(PLAYER, id, results);
    const right = results.filter((result) => result.correct).length;
    if (graded.passed) {
      showNotice(`Đậu thi nội bộ (${right}/${results.length})! Bạn đã đủ điều kiện khảo thí hôm nay.`);
      onQualified?.(id);
    } else {
      const parts = [`Chưa đậu thi nội bộ (${right}/${results.length}).`];
      if (graded.failed.length) parts.push(`${graded.failed.length} ${DECKS[id].unit} mới cần học lại.`);
      if (graded.revoked.length) parts.push(`${graded.revoked.length} ${DECKS[id].unit} bị thu hồi chứng chỉ.`);
      showNotice(parts.join(' '));
    }
    if (deckId === id && !start.hidden) paintStart();
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
    if (!on) dimmed = false;
    dim.classList.toggle('on', on);
    panel.classList.toggle('focus', on);
  }

  function setStudying(on) {
    studying = on;
    refreshFocus();
  }

  function useDeck(id) {
    deckId = id;
    deck = DECKS[id];
    title.textContent = deck.title;
    panel.setAttribute('aria-label', deck.label);
    reopen.textContent = `📜 ${deck.label}`;
  }

  setInterval(() => {
    if (mode !== 'learn' || !current || !panel.classList.contains('show') || document.visibilityState !== 'visible') return;
    if (waitLeft() <= 0) return;
    shown += 1;
    if (waitLeft() <= 0) certify.viewed(PLAYER, deckId, current);
    paintLearnCount();
  }, 1000);

  certify.onChange((actor) => {
    if (actor === PLAYER && !start.hidden && panel.classList.contains('show')) paintStart();
  });

  addEventListener('resize', fitWord);
  dim.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'opacity') dimmed = dim.classList.contains('on');
  });
  useDeck('n2');
  learnPick.addEventListener('click', beginLearn);
  reviewPick.addEventListener('click', beginReview);
  internalPick.addEventListener('click', beginInternal);
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
    get dimmed() {
      return dimmed;
    },
    open(id = 'n2') {
      useDeck(id);
      seated = true;
      showNotice(null);
      showStart();
      setVisible(true);
    },
    close() {
      seated = false;
      stopMode();
      setStudying(false);
      setVisible(false);
    },
  };
}
