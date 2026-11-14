import { DECKS, unitOf } from './studyDecks.js';
import { certify } from './certify.js';
import { japanese } from './ruby.js';
import { CERTIFY } from './config.js';
import { coins, notEnough } from './format.js';
import { economy } from './economy.js';
import { PLAYER } from './inventory.js';
import { paintIcon } from './itemArt.js';

const FURIGANA_KEY = 'langsch.studyFurigana';
const MODES = { learn: { name: 'Học hôm nay', fee: CERTIFY.learnFee }, review: { name: 'Ôn chứng chỉ', fee: CERTIFY.reviewFee } };

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

export function createStudy({ purse, music = null, exams, onQualified = null, onSitOver = null }) {
  const panel = document.getElementById('study');
  const reopen = document.getElementById('studyOpen');
  const start = document.getElementById('studyStart');
  const status = document.getElementById('studyStatus');
  const learnInfo = document.getElementById('studyLearnInfo');
  const reviewInfo = document.getElementById('studyReviewInfo');
  const notice = document.getElementById('studyNotice');
  const learnPick = start.querySelector('[data-mode="learn"]');
  const reviewPick = start.querySelector('[data-mode="review"]');
  for (const pick of [learnPick, reviewPick]) paintIcon(pick.querySelector('span'), { art: 'scroll' });
  const body = document.getElementById('studyBody');
  const modeChip = document.getElementById('studyMode');
  const word = document.getElementById('studyWord');
  const reading = document.getElementById('studyReading');
  const hanViet = document.getElementById('studyHanViet');
  const meaning = document.getElementById('studyMeaning');
  const note = document.getElementById('studyNote');
  const title = panel.querySelector('.study-title');
  const nav = body.querySelector('.study-nav');
  const prev = document.getElementById('studyPrev');
  const next = document.getElementById('studyNext');
  const remembered = document.getElementById('studyRemembered');
  const example = document.getElementById('studyExample');
  const furiganaBtn = document.getElementById('studyFurigana');
  const translateBtn = document.getElementById('studyTranslate');
  const dim = document.getElementById('studyDim');
  const timer = document.getElementById('studyTimer');
  const timerFill = timer.firstElementChild;
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
  let paid = new Set();
  let weakDrilled = false;
  let sitSeconds = 0;
  let sitWords = 0;

  showFurigana(loadFurigana());
  showTranslation(false);

  function showChip(name) {
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
    if (certify.needsInternal(PLAYER, deckId)) {
      if (!certify.internalTriesLeft(PLAYER, deckId)) return `Hôm nay bạn đã thi nội bộ đủ ${CERTIFY.internalTries} lần. Mai quay lại thi tiếp nhé.`;
      return 'Đã học xong. Hãy gặp cô giáo cuối lớp để thi nội bộ.';
    }
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
    learnPick.disabled = learning.length === 0 || certify.examTaken(PLAYER, deckId);
    reviewPick.disabled = certified === 0;
  }

  function pay(name) {
    if (paid.has(name)) return true;
    const { fee } = MODES[name];
    if (!purse.spend(fee)) {
      showNotice(notEnough(fee));
      return false;
    }
    economy.income('teacher', fee);
    paid.add(name);
    showNotice(null);
    return true;
  }

  function endSit() {
    if (!seated) return;
    seated = false;
    onSitOver?.();
  }

  function stopMode() {
    mode = null;
    current = null;
    timer.hidden = true;
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

  function exampleNodes({ title: situation, lines }) {
    const ja = el('p', 'study-example-ja');
    ja.lang = 'ja';
    const vi = el('p', 'study-example-vi');
    const [only] = lines;
    if (lines.length === 1 && !only[0]) {
      ja.append(japanese(only[1]));
      vi.textContent = only[2];
      return [ja, vi];
    }
    ja.append(
      ...(situation ? [el('span', 'study-situation', situation)] : []),
      ...lines.map(([speaker, text]) => {
        const line = el('span', 'study-line');
        const words = el('span', 'study-words');
        words.append(japanese(text));
        line.append(el('b', 'study-speaker', speaker), words);
        return line;
      }),
    );
    vi.append(...lines.filter((line) => line[2]).map(([speaker, , text]) => el('span', 'study-line', `${speaker}: ${text}`)));
    return [ja, vi];
  }

  function showExamples(examples) {
    example.replaceChildren(...examples.flatMap(exampleNodes));
  }

  function fill(key) {
    current = key;
    const card = unitOf(key);
    word.replaceChildren(japanese(card.word));
    fitWord();
    reading.textContent = card.reading;
    hanViet.textContent = card.hanViet;
    hanViet.classList.remove('show');
    word.classList.toggle('has-hint', Boolean(card.hanViet));
    meaning.textContent = card.meaning;
    note.textContent = card.note;
    showExamples(card.examples);
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
    remembered.hidden = covered;
  }

  const waitLeft = () => Math.max(0, CERTIFY.viewSeconds - shown);

  function paintLearnCount() {
    timerFill.style.transform = `scaleX(${Math.min(1, shown / CERTIFY.viewSeconds)})`;
    remembered.disabled = waitLeft() > 0;
  }

  function restartTimer() {
    timer.hidden = false;
    timerFill.style.transition = 'none';
    paintLearnCount();
    void timerFill.offsetWidth;
    timerFill.style.transition = '';
  }

  function paintLearnOrder() {
    const learning = certify.batch(PLAYER, deckId).filter((item) => !item.ready);
    modeChip.textContent = `${learning.findIndex((item) => item.key === current) + 1}/${learning.length}`;
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
    restartTimer();
    paintLearnOrder();
  }

  const learnedToday = () =>
    certify
      .batch(PLAYER, deckId)
      .filter((item) => !item.ready)
      .map((item) => item.key);

  function beginLearn() {
    if (certify.examTaken(PLAYER, deckId) || !pay('learn')) return;
    if (!certify.learnLeft(PLAYER, deckId).length) {
      browse(learnedToday(), 'learn');
      return;
    }
    mode = 'learn';
    music?.start();
    setStudying(true);
    showChip('learn');
    current = null;
    nav.hidden = true;
    start.hidden = true;
    body.hidden = false;
    nextLearn();
  }

  function renderReview() {
    fill(order[pos]);
    modeChip.textContent = `${pos + 1}/${order.length}`;
  }

  async function beginReview() {
    if (exams.running || !pay('review')) return;
    if (!weakDrilled) {
      weakDrilled = true;
      const keys = certify.reviewQuestions(PLAYER, deckId);
      if (keys.length) certify.gradeReview(PLAYER, deckId, await exams.run({ title: 'Ôn từ yếu', deck: deckId, keys, icon: '📖' }));
      if (!seated) return;
    }
    browse(shuffle(certify.certified(PLAYER, deckId)), 'review');
  }

  function browse(keys, chip) {
    if (!keys.length) return;
    mode = 'review';
    timer.hidden = true;
    music?.start();
    showTranslation(false);
    setStudying(true);
    showChip(chip);
    nav.hidden = false;
    start.hidden = true;
    body.hidden = false;
    body.classList.remove('covered');
    remembered.hidden = true;
    remembered.disabled = false;
    order = keys;
    pos = 0;
    renderReview();
  }

  function go(step) {
    pos = (pos + step + order.length) % order.length;
    showTranslation(false);
    renderReview();
  }

  function answer() {
    if (mode !== 'learn' || !current || waitLeft() > 0) return;
    certify.remember(PLAYER, deckId, current);
    sitWords += 1;
    if (sitWords >= CERTIFY.sitWords) {
      endSit();
      return;
    }
    nextLearn();
  }

  function internalRefusal(id) {
    const unit = DECKS[id].unit;
    if (certify.finished(PLAYER, id)) return 'Con học hết bộ này rồi, giỏi lắm!';
    if (certify.examTaken(PLAYER, id)) return 'Hôm nay con khảo thí rồi, mai quay lại nhé.';
    if (!certify.needsInternal(PLAYER, id)) return 'Con đủ điều kiện khảo thí hôm nay rồi.';
    const left = certify.learnLeft(PLAYER, id).length;
    if (left) return `Con học nốt ${left} ${unit} hôm nay rồi hẵng đến thi nhé.`;
    if (!certify.internalTriesLeft(PLAYER, id)) return `Hôm nay con thi nội bộ đủ ${CERTIFY.internalTries} lần rồi, mai quay lại nhé.`;
    return null;
  }

  function internalBlocker(id) {
    const refusal = internalRefusal(id);
    if (refusal) return refusal;
    if (purse.money < CERTIFY.internalFee) return `Lệ phí thi là ${coins(CERTIFY.internalFee)}, con chưa đủ tiền.`;
    return null;
  }

  async function takeInternal(id) {
    if (exams.running) return null;
    const blocker = internalBlocker(id);
    if (blocker) return blocker;
    if (!purse.spend(CERTIFY.internalFee)) return `Lệ phí thi là ${coins(CERTIFY.internalFee)}, con chưa đủ tiền.`;
    economy.income('teacher', CERTIFY.internalFee);
    const results = await exams.run({
      title: 'Thi nội bộ',
      deck: id,
      keys: certify.beginInternal(PLAYER, id) ?? [],
      icon: '📝',
      minSeconds: CERTIFY.internalMinutes * 60,
      more: (last) => certify.internalExtra(PLAYER, id, last),
    });
    const graded = certify.gradeInternal(PLAYER, id, results);
    const right = results.filter((result) => result.correct).length;
    if (deckId === id && !start.hidden) paintStart();
    if (graded.passed) {
      onQualified?.(id);
      return `Đậu rồi (${right}/${results.length})! Con đủ điều kiện khảo thí hôm nay.`;
    }
    const parts = [`Chưa đậu (${right}/${results.length}).`];
    if (graded.failed.length) parts.push(`${graded.failed.length} ${DECKS[id].unit} mới cần học lại.`);
    if (graded.revoked.length) parts.push(`${graded.revoked.length} ${DECKS[id].unit} bị thu hồi chứng chỉ.`);
    return parts.join(' ');
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
    const on = panel.classList.contains('show');
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
    if (!seated || document.visibilityState !== 'visible') return;
    sitSeconds += 1;
    if (sitSeconds >= CERTIFY.sitSeconds) endSit();
  }, 1000);

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
  modeChip.addEventListener('click', showStart);
  body.addEventListener('click', (event) => {
    if (body.classList.contains('covered')) {
      if (!event.target.closest('button')) setCovered(false);
      return;
    }
    const onWord = Boolean(event.target.closest('.study-word')) && Boolean(hanViet.textContent);
    hanViet.classList.toggle('show', onWord && !hanViet.classList.contains('show'));
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
  remembered.addEventListener('click', answer);
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
    internalBlocker,
    takeInternal,
    open(id = 'n2') {
      useDeck(id);
      seated = true;
      paid = new Set();
      weakDrilled = false;
      sitSeconds = 0;
      sitWords = 0;
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
