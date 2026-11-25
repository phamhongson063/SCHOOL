import { DECKS, DECK_IDS, unitOf } from './studyDecks.js';
import { certify } from './certify.js';
import { japanese, spokenOf } from './ruby.js';
import { CERTIFY, SPEAK } from './config.js';
import { coins, notEnough } from './format.js';
import { economy } from './economy.js';
import { PLAYER } from './inventory.js';
import { paintIcon } from './itemArt.js';
import { INTERNAL_SPAN } from './examRules.js';
import { classTeacherOf } from './npcIds.js';
import { dayOf, gameNow } from './clock.js';
import { joinPieces, rewardSpeech, scoreSpeech, speechKeys, speechLines, speechSegments } from './speaking.js';
import { playVoice, stopVoice } from './voiceClips.js';
import { shuffle } from './random.js';

const ARENA_CLASH = { soon: 'Sắp tới giờ lôi đài rồi, con không kịp thi đâu.', running: 'Lôi đài đang diễn ra, con thi sau nhé.' };

const FURIGANA_KEY = 'langsch.studyFurigana';
const MODES = { learn: { name: 'Học hôm nay', fee: CERTIFY.learnFee }, today: { name: 'Xem lại hôm nay' }, review: { name: 'Ôn chứng chỉ', fee: CERTIFY.reviewFee }, speak: { name: 'Luyện nói', fee: CERTIFY.speakFee } };
const Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition ?? null;
const SPEAK_PAUSE = 900;
const SPEAK_WRONG_VOLUME = 0.3;
const SPEAK_CORRECT_VOLUME = 0.1;
const SPEAK_SILENCE = 3000;
const SPEAK_START_WAIT = 6000;
const MIC_BLOCKED = new Set(['not-allowed', 'service-not-allowed']);
const MIC_FATAL = new Set([...MIC_BLOCKED, 'audio-capture', 'network', 'language-not-supported']);

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

export function createStudy({ purse, music = null, sounds = null, exams, onQualified = null, onSitOver = null, onPaid = null, arenaClash = () => null }) {
  const panel = document.getElementById('study');
  const reopen = document.getElementById('studyOpen');
  const start = document.getElementById('studyStart');
  const status = document.getElementById('studyStatus');
  const learnName = document.getElementById('studyLearnName');
  const learnInfo = document.getElementById('studyLearnInfo');
  const reviewInfo = document.getElementById('studyReviewInfo');
  const notice = document.getElementById('studyNotice');
  const learnPick = start.querySelector('[data-mode="learn"]');
  const reviewPick = start.querySelector('[data-mode="review"]');
  const speakPick = start.querySelector('[data-mode="speak"]');
  const speakInfo = document.getElementById('studySpeakInfo');
  const speakArea = document.getElementById('studySpeak');
  const scoreText = document.getElementById('studyScore');
  const mic = document.getElementById('studyMic');
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
  const voice = document.getElementById('studyVoice');
  const furiganaBtn = document.getElementById('studyFurigana');
  const translateBtn = document.getElementById('studyTranslate');
  const dim = document.getElementById('studyDim');
  const timer = document.getElementById('studyTimer');
  const timerFill = timer.firstElementChild;
  let deckId = DECK_IDS[0];
  let deck = DECKS[deckId];
  let mode = null;
  let current = null;
  let order = [];
  let pos = 0;
  let shown = 0;
  let speakShown = 0;
  let seated = false;
  let studying = false;
  let dimmed = false;
  let paid = new Set();
  let weakDrilled = false;
  let sitSeconds = 0;
  let sitWords = 0;
  let speakRun = 0;
  let speakLines = [];
  let speakLine = 0;
  let speakMarks = [];
  let micState = 'idle';
  let listening = null;

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
    const examTaken = certify.examTaken(PLAYER, deckId);
    const learnedAll = learning.length > 0 && !examTaken && !certify.learnLeft(PLAYER, deckId).length;
    status.textContent = statusText();
    learnName.textContent = MODES[learnedAll ? 'today' : 'learn'].name;
    learnInfo.textContent = learning.length ? `${done}/${learning.length}` : '—';
    const total = certify.deckSize(deckId);
    reviewInfo.textContent = `🎓 ${certified}/${total}`;
    learnPick.disabled = learning.length === 0 || examTaken;
    reviewPick.disabled = certified === 0;
    speakPick.hidden = !canSpeak();
    speakInfo.textContent = `🎓 ${certified}/${total}`;
    speakPick.disabled = certified === 0;
  }

  function pay(name) {
    if (paid.has(name)) return true;
    const fee = certify.fee(deckId, MODES[name].fee);
    if (!purse.spend(fee)) {
      showNotice(notEnough(fee));
      return false;
    }
    economy.tuition(classTeacherOf(deckId), fee);
    paid.add(name);
    onPaid?.();
    showNotice(null);
    return true;
  }

  function endSit() {
    if (!seated) return;
    seated = false;
    onSitOver?.(paid.size > 0);
  }

  function stopMode() {
    stopVoice();
    stopSpeak();
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

  function exampleNodes({ title: situation, lines }, follow) {
    const ja = el('p', 'study-example-ja');
    ja.lang = 'ja';
    const vi = el('p', 'study-example-vi');
    const [only] = lines;
    if (lines.length === 1 && !only[0]) {
      const spoken = spokenOf(only[1]);
      ja.classList.toggle('spoken', spoken !== null);
      ja.append(japanese(markFollow(spoken ?? only[1], follow)));
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

  function showExamples(examples, follow = []) {
    example.replaceChildren(...examples.flatMap((item) => exampleNodes(item, follow)));
  }

  function kanjiLines({ char, hanViet: name, parts, on, kun }) {
    const head = el('span', 'study-kanji-head', `${char} ${name}`);
    if (parts) head.append(el('span', 'study-kanji-parts', parts));
    const reads = el('span', 'study-kanji-reads');
    reads.lang = 'ja';
    for (const [tag, text] of [['音', on], ['訓', kun]]) {
      if (!text) continue;
      const group = el('span', 'study-kanji-read');
      group.append(el('span', 'study-kanji-tag', tag), text);
      reads.append(group);
    }
    return [head, reads];
  }

  function japaneseSpan(className, text) {
    const span = el('span', className);
    span.lang = 'ja';
    span.append(japanese(text));
    return span;
  }

  const NUANCE = /［([^］]+)］/g;

  function grammarGloss(gloss) {
    const line = el('span', 'study-grammar-gloss');
    line.append(japaneseSpan('study-grammar-text', gloss.replace(NUANCE, '').trim()));
    const nuances = [...gloss.matchAll(NUANCE)].flatMap((match) => match[1].split(/[・／]/));
    if (nuances.length) {
      const tags = el('span', 'study-grammar-tags');
      tags.append(...nuances.map((nuance) => japaneseSpan('study-grammar-tag', nuance)));
      line.append(tags);
    }
    return line;
  }

  function grammarForm(form) {
    const line = el('span', 'study-grammar-form');
    const [before, after] = form.split(/\s*＋\s*/);
    if (after === undefined) {
      line.append(japaneseSpan('study-grammar-text', form));
      return line;
    }
    const [, ending, remark] = after.match(/^(.*?)(?:（([^）]{3,})）)?$/);
    line.append(
      ...before.split('／').map((part) => japaneseSpan('study-grammar-pill', part)),
      el('span', 'study-grammar-plus', '＋'),
      japaneseSpan('study-grammar-ending', ending),
    );
    if (remark) {
      const note = el('span', 'study-grammar-remark');
      note.append(japanese(remark));
      line.append(note);
    }
    return line;
  }

  const JAPANESE_RUN = /([\u3040-\u30ff\u3400-\u9fff々〜～]+)/;

  function grammarExplain(explain) {
    const text = el('span', 'study-grammar-explain');
    text.append(
      ...explain.split(JAPANESE_RUN).map((part, i) => (i % 2 ? japaneseSpan('study-grammar-ja', part) : document.createTextNode(part))),
    );
    return text;
  }

  function grammarSection(label, content) {
    const section = el('span', 'study-grammar-section');
    section.append(el('span', 'study-grammar-label', label), content);
    return section;
  }

  function grammarLines({ gloss, form, explain }) {
    const box = el('span', 'study-grammar-box');
    if (form) box.append(grammarSection('Cách nối', grammarForm(form)));
    if (explain) box.append(grammarSection('Lưu ý', grammarExplain(explain)));
    return [gloss && grammarGloss(gloss), box.childElementCount && box].filter(Boolean);
  }

  function markFollow(text, follow) {
    let marked = text;
    for (const tail of follow) {
      const at = marked.lastIndexOf(tail);
      const before = marked.slice(0, at);
      if (at < 0 || before.split('[').length !== before.split(']').length || before.split('⟪').length !== before.split('⟫').length || before.split('{').length !== before.split('}').length) continue;
      marked = `${before}⟪${tail}⟫${marked.slice(at + tail.length)}`;
    }
    return marked;
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
    note.classList.toggle('grammar', Boolean(card.grammar));
    if (card.kanji) note.replaceChildren(...kanjiLines(card.kanji));
    else if (card.grammar) note.replaceChildren(...grammarLines(card.grammar));
    else note.textContent = card.note;
    showExamples(card.examples, card.grammar?.follow);
    stopVoice();
    voice.hidden = !card.audio;
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

  function paintSpeakTime() {
    timerFill.style.transform = `scaleX(${Math.min(1, speakShown / SPEAK.dialogSeconds)})`;
    next.disabled = speakShown < SPEAK.dialogSeconds;
  }

  function restartTimer(paint = paintLearnCount) {
    timer.hidden = false;
    timerFill.style.transition = 'none';
    paint();
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
    if (certify.examTaken(PLAYER, deckId)) return;
    if (!certify.learnLeft(PLAYER, deckId).length) {
      browse(learnedToday(), 'today');
      return;
    }
    if (!pay('learn')) return;
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
    music?.start(chip === 'review' ? 'review' : 'study');
    showTranslation(false);
    setStudying(true);
    showChip(chip);
    nav.hidden = false;
    prev.hidden = false;
    next.disabled = false;
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

  const canSpeak = () => Boolean(Recognition && deck.speak);

  function later(run, ms) {
    const token = speakRun;
    setTimeout(() => {
      if (token === speakRun && mode === 'speak') run();
    }, ms);
  }

  function setMic(state, count = 0) {
    micState = state;
    mic.disabled = state === 'busy' || state === 'wait';
    mic.classList.toggle('listening', state === 'listening');
    mic.textContent = state === 'wait' ? String(count) : '🎤';
  }

  function stopSpeak() {
    speakRun += 1;
    const recognition = listening;
    listening = null;
    recognition?.abort();
    speakArea.hidden = true;
    scoreText.textContent = '';
    micState = 'idle';
  }

  function segmentNode(segment, missed) {
    let node = document.createTextNode(segment.text);
    if (segment.reading) {
      const ruby = document.createElement('ruby');
      const rt = document.createElement('rt');
      rt.textContent = segment.reading;
      ruby.append(node, rt);
      node = ruby;
    }
    if (missed !== undefined && segment.sounds.length) {
      const span = el('span', missed ? 'speak-miss' : 'speak-ok');
      span.append(node);
      node = span;
    }
    if (segment.mark) {
      const mark = document.createElement('mark');
      mark.append(node);
      node = mark;
    }
    return node;
  }

  function renderSpeech() {
    const ja = el('p', 'study-example-ja');
    ja.lang = 'ja';
    const vi = el('p', 'study-example-vi');
    const situation = unitOf(current).examples[0].title;
    if (situation) ja.append(el('span', 'study-situation', situation));
    speakLines.forEach((item, i) => {
      const row = el('span', 'study-line speak-line');
      row.classList.toggle('now', i === speakLine);
      const words = el('span', 'study-words');
      const misses = speakMarks[i];
      words.append(...speechSegments(item.text).map((segment, at) => segmentNode(segment, misses ? misses.has(at) : undefined)));
      row.append(el('b', 'study-speaker', item.speaker), words);
      ja.append(row);
    });
    vi.append(...speakLines.filter((item) => item.vi).map((item) => el('span', 'study-line', `${item.speaker}: ${item.vi}`)));
    example.replaceChildren(ja, vi);
  }

  function playLine() {
    renderSpeech();
    if (speakLine >= speakLines.length) {
      finishDialog();
      return;
    }
    setMic('ready');
  }

  function replayDialog() {
    speakLine = 0;
    speakMarks = speakLines.map(() => null);
    scoreText.textContent = '';
    playLine();
  }

  function openDialog() {
    fill(order[pos]);
    modeChip.textContent = `${pos + 1}/${order.length}`;
    speakLines = speechLines(current);
    speakShown = 0;
    restartTimer(paintSpeakTime);
    replayDialog();
  }

  function nextDialog() {
    if (mode !== 'speak' || speakShown < SPEAK.dialogSeconds) return;
    speakRun += 1;
    const recognition = listening;
    listening = null;
    recognition?.abort();
    pos += 1;
    if (pos >= order.length) {
      endSit();
      return;
    }
    openDialog();
  }

  function finishDialog() {
    rewardSpeech(PLAYER, deckId, current, dayOf(gameNow()));
    later(replayDialog, SPEAK_PAUSE);
  }

  function cooldown(left) {
    if (left <= 0) {
      setMic('ready');
      return;
    }
    setMic('wait', left);
    later(() => cooldown(left - 1), 1000);
  }

  function judge(heards) {
    const result = scoreSpeech(speakLines[speakLine].text, heards);
    speakMarks[speakLine] = result.misses;
    scoreText.textContent = `${Math.round(result.score * 100)}%`;
    renderSpeech();
    if (!result.passed) {
      sounds?.wrong(SPEAK_WRONG_VOLUME);
      cooldown(SPEAK.retry);
      return;
    }
    sounds?.correct(SPEAK_CORRECT_VOLUME);
    setMic('busy');
    speakLine += 1;
    later(playLine, SPEAK_PAUSE);
  }

  function listen() {
    if (mode !== 'speak') return;
    if (micState === 'listening') {
      listening?.stop();
      return;
    }
    if (micState !== 'ready') return;
    const token = speakRun;
    const line = speakLines[speakLine].text;
    let said = [];
    let heards = null;
    let failure = null;
    let quiet = null;
    let done = false;
    let recognition = null;
    const session = {
      stop() {
        done = true;
        clearTimeout(quiet);
        recognition?.stop();
      },
      abort() {
        done = true;
        clearTimeout(quiet);
        recognition?.abort();
      },
    };
    const live = () => token === speakRun && mode === 'speak' && listening === session;
    const wait = (ms) => {
      clearTimeout(quiet);
      quiet = setTimeout(() => session.stop(), ms);
    };
    const settle = () => {
      clearTimeout(quiet);
      if (!live()) return;
      listening = null;
      if (heards) {
        judge(heards);
        return;
      }
      if (MIC_BLOCKED.has(failure)) scoreText.textContent = '🎤✗';
      setMic('ready');
    };
    const open = () => {
      recognition = new Recognition();
      recognition.lang = 'ja-JP';
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.continuous = true;
      recognition.onresult = (event) => {
        const pieces = [...event.results].map((result) => [...result].map((alternative) => alternative.transcript));
        heards = joinPieces([...said, ...pieces]);
        const result = scoreSpeech(line, heards);
        if (result.passed && result.ended) session.stop();
        else wait(SPEAK_SILENCE);
      };
      recognition.onerror = (event) => {
        failure = event.error;
      };
      recognition.onend = () => {
        if (done || MIC_FATAL.has(failure) || !live()) {
          settle();
          return;
        }
        said = heards ?? said;
        try {
          open();
        } catch {
          settle();
        }
      };
      recognition.start();
    };
    listening = session;
    scoreText.textContent = '';
    setMic('listening');
    wait(SPEAK_START_WAIT);
    try {
      open();
    } catch {
      settle();
    }
  }

  function beginSpeak() {
    if (exams.running || !canSpeak()) return;
    const keys = speechKeys(PLAYER, deckId, dayOf(gameNow()));
    if (!keys.length || !pay('speak')) return;
    mode = 'speak';
    timer.hidden = true;
    music?.stop();
    showTranslation(false);
    setStudying(true);
    showChip('speak');
    nav.hidden = false;
    prev.hidden = true;
    start.hidden = true;
    body.hidden = false;
    body.classList.remove('covered');
    remembered.hidden = true;
    speakArea.hidden = false;
    order = keys;
    pos = 0;
    openDialog();
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
    const clash = arenaClash(INTERNAL_SPAN);
    if (clash) return ARENA_CLASH[clash];
    const fee = certify.fee(id, CERTIFY.internalFee);
    if (purse.money < fee) return `Lệ phí thi là ${coins(fee)}, con chưa đủ tiền.`;
    return null;
  }

  async function takeInternal(id) {
    if (exams.running) return null;
    const blocker = internalBlocker(id);
    if (blocker) return blocker;
    const fee = certify.fee(id, CERTIFY.internalFee);
    if (!purse.spend(fee)) return `Lệ phí thi là ${coins(fee)}, con chưa đủ tiền.`;
    economy.tuition(classTeacherOf(id), fee);
    const results = await exams.run({
      title: 'Thi nội bộ',
      deck: id,
      keys: certify.beginInternal(PLAYER, id) ?? [],
      icon: '📝',
      minSeconds: CERTIFY.internalMinutes * 60,
      more: (last) => certify.internalExtra(PLAYER, id, last),
      stops: (result) => certify.internalStops(PLAYER, id, result),
      cardOnly: true,
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
    if (mode !== 'speak' || !panel.classList.contains('show') || document.visibilityState !== 'visible') return;
    if (speakShown >= SPEAK.dialogSeconds) return;
    speakShown += 1;
    paintSpeakTime();
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
  useDeck(DECK_IDS[0]);
  learnPick.addEventListener('click', beginLearn);
  reviewPick.addEventListener('click', beginReview);
  speakPick.addEventListener('click', beginSpeak);
  mic.addEventListener('click', listen);
  modeChip.addEventListener('click', showStart);
  body.addEventListener('click', (event) => {
    if (body.classList.contains('covered')) {
      if (!event.target.closest('button')) setCovered(false);
      return;
    }
    const onWord = Boolean(event.target.closest('.study-word')) && Boolean(hanViet.textContent);
    hanViet.classList.toggle('show', onWord && !hanViet.classList.contains('show'));
  });
  voice.addEventListener('click', (event) => {
    event.stopPropagation();
    if (voice.classList.contains('playing')) {
      stopVoice();
      return;
    }
    const clip = unitOf(current)?.audio;
    if (!clip) return;
    voice.classList.add('playing');
    const done = () => voice.classList.remove('playing');
    playVoice(clip, done).then((started) => started || done());
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
  next.addEventListener('click', () => (mode === 'speak' ? nextDialog() : go(1)));
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
    open(id = DECK_IDS[0]) {
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
