import { ARENA } from './config.js';
import { enraged, roundName } from './arena.js';
import { stageOf } from './arenaIsland.js';
import { END_REASONS } from './arenaBoard.js';
import { KIND_LABELS, LETTERS, buildQuestion } from './arenaQuestion.js';
import { PLAYER } from './inventory.js';

const COUNTDOWN = ['3', '2', '1', 'Đấu!'];
const BEAT_MS = 800;
const REVEAL_MS = 1300;
const STRIKE_MS = 1900;
const END_MS = 2200;
const CHOICE_MS = 20000;
const SHOT = { back: 9, rise: 2.4, aim: -1.55 };
const SET_MS = 1800;
const TIER_TAGS = { easy: '', normal: '', hard: ' · ⚡ Câu khó' };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

export function createArenaDuel({ arena, nameOf, portraitOf, now, sounds = null, onTurn = null, onLeave = null, veil = null }) {
  const dialog = document.getElementById('duelDialog');
  const cards = { me: cardView(dialog.querySelector('.duel-card.me')), foe: cardView(dialog.querySelector('.duel-card.foe')) };
  const banner = dialog.querySelector('.duel-banner');
  const turnLabel = dialog.querySelector('.duel-turn');
  const kind = dialog.querySelector('.duel-kind');
  const clock = dialog.querySelector('.duel-clock');
  const bar = dialog.querySelector('.duel-bar');
  const word = dialog.querySelector('.duel-word');
  const hint = dialog.querySelector('.duel-hint');
  const options = dialog.querySelector('.duel-options');
  const log = dialog.querySelector('.duel-log');
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  let running = false;
  let ticker = null;
  let shot = null;

  function setOpen(open) {
    document.body.classList.toggle('in-duel', open);
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }

  const label = (id) => (id === PLAYER ? 'Bạn' : nameOf(id));

  function setHp(view, hp) {
    const share = Math.max(0, hp) / ARENA.hp;
    view.fill.style.transform = `scaleX(${share})`;
    view.fill.classList.toggle('mid', share <= 0.5 && share > 0.25);
    view.fill.classList.toggle('low', share <= 0.25);
    view.hp.textContent = `${Math.max(0, hp)}/${ARENA.hp}`;
    view.root.classList.toggle('rage', enraged(hp));
  }

  function setSets(view, won, need) {
    view.name.textContent = need > 1 ? `${label(view.id)} ${'●'.repeat(won)}${'○'.repeat(need - won)}` : label(view.id);
  }

  function setState(view, text, tone = '') {
    view.state.textContent = text;
    view.state.className = tone ? `duel-state ${tone}` : 'duel-state';
  }

  function setFighter(view, id, hp) {
    view.id = id;
    view.name.textContent = label(id);
    const face = portraitOf(id);
    if (face) view.face.setAttribute('src', face);
    setState(view, '');
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

  function choose(labels) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(0), CHOICE_MS);
      options.replaceChildren(
        ...labels.map((text, i) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = i === 0 ? 'duel-option picked' : 'duel-option';
          button.textContent = text;
          button.addEventListener('click', () => {
            clearTimeout(timer);
            resolve(i);
          });
          return button;
        }),
      );
    });
  }

  async function ending(match, won) {
    const reason = END_REASONS[match.reason] ?? '';
    clearInterval(ticker);
    kind.textContent = '';
    clock.textContent = '';
    bar.style.transform = 'scaleX(0)';
    word.textContent = won ? 'THẮNG' : 'THUA';
    log.textContent = reason;
    options.replaceChildren();
    await shout(won ? 'THẮNG!' : 'THUA', END_MS);
    if (won) return;
    const pick = await choose(['Ở lại xem', 'Về làng']);
    if (pick === 1) onLeave?.();
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
      button.lang = quiz.kind === 'meaning' ? 'vi' : 'ja';
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

  async function playTurn(asked, size, match) {
    const quiz = buildQuestion(asked.key, asked.tier);
    const foeId = asked.opponent;
    const sides = { me: asked.side, foe: asked.side === 'a' ? 'b' : 'a' };
    setSets(cards.me, asked.sets[sides.me], asked.need);
    setSets(cards.foe, asked.sets[sides.foe], asked.need);
    turnLabel.textContent = `${roundName(size)}${asked.need > 1 ? ` · Hiệp ${asked.set}` : ''} · Lượt ${asked.turn}`;
    kind.textContent = `${KIND_LABELS[quiz.kind]}${TIER_TAGS[asked.tier] ?? ''}`;
    word.textContent = quiz.word;
    hint.textContent = quiz.hint;
    log.textContent = '';
    setState(cards.me, '⏳', 'wait');
    setState(cards.foe, '⏳', 'wait');
    const buttons = optionButtons(quiz);
    await readPhase(ARENA.read);
    const foeReady = setTimeout(() => setState(cards.foe, '✓', 'ok'), asked.rival.seconds * 1000);
    const choice = await pickPhase(buttons, asked.seconds);
    setState(cards.me, choice.button ? '✓' : '⌛', choice.button ? 'ok' : 'wait');
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
    const turn = arena.play(PLAYER, { correct, seconds: choice.seconds }, now());
    if (!turn) return null;
    onTurn?.();
    for (const [who, side] of Object.entries(sides)) {
      const move = turn[side];
      if (!move.correct) setState(cards[who], '✗', 'bad');
      else setState(cards[who], `${move.blocked ? '🛡' : '✓'} ${move.seconds.toFixed(1)}s`, 'ok');
    }
    const striker = Object.keys(sides).find((who) => sides[who] === turn.striker);
    log.textContent = '';
    if (striker) hit(cards[striker === 'me' ? 'foe' : 'me'], turn[turn.striker].damage);
    setHp(cards.me, turn.hp[sides.me]);
    setHp(cards.foe, turn.hp[sides.foe]);
    await wait(STRIKE_MS);
    if (turn.setWinner && !match.winner) {
      const sets = match.sets;
      setSets(cards.me, sets[sides.me], asked.need);
      setSets(cards.foe, sets[sides.foe], asked.need);
      await shout(`Hiệp ${turn.set}: ${turn.setWinner === sides.me ? 'Bạn' : label(foeId)} thắng`, SET_MS);
      setHp(cards.me, ARENA.hp);
      setHp(cards.foe, ARENA.hp);
      await shout(`Hiệp ${turn.set + 1}`, SET_MS);
    }
    return turn;
  }

  return {
    get open() {
      return dialog.open;
    },
    get running() {
      return running;
    },
    frame(camera) {
      if (!shot) return;
      camera.position.set(shot.x, shot.y + SHOT.rise, shot.z + shot.toward * SHOT.back);
      camera.lookAt(shot.x, shot.y + SHOT.aim, shot.z);
    },
    async run() {
      if (running) return;
      const event = arena.event;
      const match = arena.liveMatch(PLAYER);
      if (!event || !match) return;
      running = true;
      const round = event.rounds[event.round];
      const size = round.length;
      const side = match.a === PLAYER ? 'a' : 'b';
      const foe = side === 'a' ? 'b' : 'a';
      const stage = stageOf(size, round.indexOf(match));
      shot = { x: stage.x, y: stage.y, z: stage.z, toward: side === 'a' ? 1 : -1 };
      veil?.(match[foe]);
      try {
        setFighter(cards.me, PLAYER, match.hp[side]);
        setFighter(cards.foe, match[foe], match.hp[foe]);
        turnLabel.textContent = roundName(size);
        kind.textContent = '';
        clock.textContent = '';
        word.textContent = '';
        hint.textContent = '';
        log.textContent = `${label(match[foe])} đã sẵn sàng`;
        options.replaceChildren();
        setOpen(true);
        for (const text of COUNTDOWN) await shout(text);
        for (let asked = arena.question(PLAYER, now()); asked; asked = arena.question(PLAYER, now())) {
          if (!(await playTurn(asked, size, match))) break;
        }
        if (match.winner) await ending(match, match.winner === PLAYER);
      } finally {
        clearInterval(ticker);
        setOpen(false);
        veil?.(null);
        shot = null;
        running = false;
      }
    },
  };
}
