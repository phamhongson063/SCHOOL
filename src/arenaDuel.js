import { ARENA } from './config.js';
import { roundName } from './arena.js';
import { skillOf } from './arenaReplay.js';
import { DECKS, plainText, unitOf } from './studyDecks.js';
import { PLAYER } from './inventory.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const COUNTDOWN = ['3', '2', '1', 'Đấu!'];
const BEAT_MS = 800;
const REVEAL_MS = 1300;
const STRIKE_MS = 1900;
const END_MS = 2200;
const MEANINGS = [...new Set(Object.values(DECKS).flatMap((deck) => deck.cards.map((card) => card.meaning)))];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function buildQuestion(key) {
  const card = unitOf(key);
  const reading = !!card.reading && (card.distractors?.length ?? 0) >= LETTERS.length - 1 && Math.random() < 0.5;
  const answer = reading ? card.reading : card.meaning;
  const pool = reading ? card.distractors : MEANINGS.filter((meaning) => meaning !== card.meaning && !(card.siblingMeanings ?? []).includes(meaning));
  const options = shuffle([answer, ...shuffle([...pool]).slice(0, LETTERS.length - 1)]);
  return { word: plainText(card.word).replace(/[[\]]/g, ''), reading, answer, options };
}

function cardView(root) {
  return {
    root,
    face: root.querySelector('.duel-face'),
    name: root.querySelector('.duel-name'),
    fill: root.querySelector('.duel-hp-fill'),
    hp: root.querySelector('.duel-hp-text'),
    state: root.querySelector('.duel-state'),
    pop: root.querySelector('.duel-pop'),
  };
}

function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

export function createArenaDuel({ arena, nameOf, portraitOf, sounds = null, onTurn = null }) {
  const dialog = document.getElementById('duelDialog');
  const cards = { me: cardView(dialog.querySelector('.duel-card.me')), foe: cardView(dialog.querySelector('.duel-card.foe')) };
  const banner = dialog.querySelector('.duel-banner');
  const turnLabel = dialog.querySelector('.duel-turn');
  const kind = dialog.querySelector('.duel-kind');
  const clock = dialog.querySelector('.duel-clock');
  const bar = dialog.querySelector('.duel-bar');
  const word = dialog.querySelector('.duel-word');
  const options = dialog.querySelector('.duel-options');
  const log = dialog.querySelector('.duel-log');
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  let running = false;
  let ticker = null;

  const label = (id) => (id === PLAYER ? 'Bạn' : nameOf(id));

  function setHp(view, hp) {
    const share = Math.max(0, hp) / ARENA.hp;
    view.fill.style.transform = `scaleX(${share})`;
    view.fill.classList.toggle('mid', share <= 0.5 && share > 0.25);
    view.fill.classList.toggle('low', share <= 0.25);
    view.hp.textContent = `${Math.max(0, hp)}/${ARENA.hp}`;
  }

  function setFighter(view, id, hp) {
    view.name.textContent = label(id);
    const face = portraitOf(id);
    if (face) view.face.setAttribute('src', face);
    view.state.textContent = '';
    setHp(view, hp);
  }

  async function shout(text, ms = BEAT_MS) {
    banner.textContent = text;
    banner.style.animationDuration = `${ms}ms`;
    replay(banner, 'show');
    await wait(ms);
  }

  function hit(view, damage) {
    view.pop.textContent = `-${damage}`;
    replay(view.pop, 'show');
    replay(view.root, 'hit');
  }

  function runBar(seconds, from) {
    clearInterval(ticker);
    ticker = setInterval(() => {
      const left = Math.max(0, seconds - (performance.now() - from) / 1000);
      bar.style.transform = `scaleX(${left / seconds})`;
      clock.textContent = `${Math.ceil(left)}s`;
      if (left <= 0) clearInterval(ticker);
    }, 100);
  }

  function optionButtons(quiz) {
    const buttons = quiz.options.map((value, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duel-option';
      button.disabled = true;
      button.lang = quiz.reading ? 'ja' : 'vi';
      const letter = document.createElement('span');
      letter.className = 'duel-letter';
      letter.textContent = LETTERS[i];
      const text = document.createElement('span');
      text.textContent = value;
      const marks = document.createElement('span');
      marks.className = 'duel-marks';
      button.append(letter, text, marks);
      button.dataset.value = value;
      return button;
    });
    options.replaceChildren(...buttons);
    return buttons;
  }

  function mark(button, text, foe) {
    const tag = document.createElement('span');
    tag.className = foe ? 'duel-mark foe' : 'duel-mark';
    tag.textContent = text;
    button.querySelector('.duel-marks').append(tag);
  }

  async function readPhase(seconds) {
    bar.style.transform = 'scaleX(1)';
    for (let left = seconds; left > 0; left--) {
      clock.textContent = `Đọc đề ${left}`;
      await wait(1000);
    }
  }

  function pickPhase(buttons, seconds) {
    return new Promise((resolve) => {
      const started = performance.now();
      runBar(seconds, started);
      const timeout = setTimeout(() => finish(null), seconds * 1000);
      let done = false;
      function finish(button) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        clearInterval(ticker);
        for (const item of buttons) item.disabled = true;
        resolve({ button, seconds: button ? (performance.now() - started) / 1000 : seconds, started });
      }
      for (const button of buttons) {
        button.disabled = false;
        button.addEventListener('click', () => {
          if (done) return;
          button.classList.add('picked');
          finish(button);
        });
      }
    });
  }

  async function playTurn(asked, size, matchKey) {
    const quiz = buildQuestion(asked.key);
    const foeId = asked.opponent;
    turnLabel.textContent = `${roundName(size)} · Lượt ${asked.turn}`;
    kind.textContent = quiz.reading ? 'Cách đọc?' : 'Nghĩa là gì?';
    word.textContent = quiz.word;
    log.textContent = '';
    cards.me.state.textContent = '';
    cards.foe.state.textContent = 'Đang đọc đề…';
    const buttons = optionButtons(quiz);
    await readPhase(ARENA.read);
    cards.foe.state.textContent = 'Đang nghĩ…';
    const foeReady = setTimeout(() => (cards.foe.state.textContent = 'Đã chọn'), asked.rival.seconds * 1000);
    const choice = await pickPhase(buttons, asked.seconds);
    cards.me.state.textContent = choice.button ? 'Đã chọn' : 'Hết giờ';
    const foeLeft = asked.rival.seconds - (performance.now() - choice.started) / 1000;
    if (foeLeft > 0) {
      log.textContent = `Chờ ${label(foeId)} chọn…`;
      await wait(foeLeft * 1000);
    }
    clearTimeout(foeReady);
    const correct = choice.button?.dataset.value === quiz.answer;
    const wrongs = buttons.filter((button) => button.dataset.value !== quiz.answer);
    const foeButton = asked.rival.correct ? buttons.find((button) => button.dataset.value === quiz.answer) : wrongs[Math.floor(Math.random() * wrongs.length)];
    for (const button of buttons) {
      button.classList.remove('picked');
      if (button.dataset.value === quiz.answer) button.classList.add('right');
    }
    if (choice.button) {
      if (!correct) choice.button.classList.add('wrong');
      mark(choice.button, 'Bạn', false);
    }
    if (foeButton) {
      if (!asked.rival.correct) foeButton.classList.add('wrong');
      mark(foeButton, label(foeId), true);
    }
    log.textContent = '';
    if (correct) sounds?.correct();
    else sounds?.wrong();
    await wait(REVEAL_MS);
    const turn = arena.play(PLAYER, { correct, seconds: choice.seconds });
    if (!turn) return null;
    onTurn?.();
    const sides = { me: asked.side, foe: asked.side === 'a' ? 'b' : 'a' };
    const shouts = [];
    for (const [who, side] of Object.entries(sides)) {
      const move = turn[side];
      const target = who === 'me' ? 'foe' : 'me';
      cards[who].state.textContent = move.correct ? `✓ ${move.seconds.toFixed(1)}s` : '✗';
      if (!move.correct) continue;
      const skill = skillOf(`${matchKey}:${asked.turn - 1}:${side}`);
      shouts.push(`${label(who === 'me' ? PLAYER : foeId)} ${skill.icon} ${skill.name}`);
      hit(cards[target], move.damage);
    }
    log.textContent = shouts.length ? shouts.join(' · ') : 'Cả hai đều trượt!';
    setHp(cards.me, turn.hp[sides.me]);
    setHp(cards.foe, turn.hp[sides.foe]);
    await wait(STRIKE_MS);
    return turn;
  }

  return {
    get open() {
      return dialog.open;
    },
    get running() {
      return running;
    },
    async run() {
      if (running) return;
      const event = arena.event;
      const match = arena.liveMatch(PLAYER);
      if (!event || !match) return;
      running = true;
      const round = event.rounds[event.round];
      const size = round.length;
      const matchKey = `${event.at}:${event.round}:${round.indexOf(match)}`;
      const side = match.a === PLAYER ? 'a' : 'b';
      const foe = side === 'a' ? 'b' : 'a';
      try {
        setFighter(cards.me, PLAYER, match.hp[side]);
        setFighter(cards.foe, match[foe], match.hp[foe]);
        turnLabel.textContent = roundName(size);
        kind.textContent = '';
        clock.textContent = '';
        word.textContent = '';
        log.textContent = `${label(match[foe])} đã sẵn sàng`;
        options.replaceChildren();
        if (!dialog.open) dialog.showModal();
        for (const text of COUNTDOWN) await shout(text);
        for (let asked = arena.question(PLAYER); asked; asked = arena.question(PLAYER)) {
          if (!(await playTurn(asked, size, matchKey))) break;
        }
        const won = match.winner === PLAYER;
        if (match.winner) await shout(won ? 'THẮNG!' : 'THUA', END_MS);
      } finally {
        clearInterval(ticker);
        if (dialog.open) dialog.close();
        running = false;
      }
    },
  };
}
