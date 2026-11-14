import { ARENA } from './config.js';
import { comboOf, roundName } from './arena.js';
import { fighterSpot, stageOf } from './arenaIsland.js';
import { onStage, replayState, resolveAt, skillOf } from './arenaReplay.js';
import { plainText, unitOf } from './studyDecks.js';
import { LETTERS, buildQuestion, pickOf, seeded } from './arenaQuestion.js';
import { PLAYER } from './inventory.js';

const LATE_MINUTES = 1.5 / 60;
const CRITICAL = 1.4;
const SIDES = ['a', 'b'];
const other = (side) => (side === 'a' ? 'b' : 'a');

const wordOf = (key) => {
  const card = key ? unitOf(key) : null;
  return card ? plainText(card.word).replace(/[[\]]/g, '') : '';
};

function sideView(root) {
  return {
    face: root.querySelector('.battle-face'),
    name: root.querySelector('.battle-name'),
    fill: root.querySelector('.battle-hp-fill'),
    hp: root.querySelector('.battle-hp-text'),
    note: root.querySelector('.battle-note'),
  };
}

const setText = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};

export function createArenaBattle({ arena, fx, nameOf, portraitOf, here, cast, hidden = () => false, onHit = null, onWatch = null }) {
  const hud = document.getElementById('battleHud');
  const views = { a: sideView(hud.querySelector('.battle-side.a')), b: sideView(hud.querySelector('.battle-side.b')) };
  const round = hud.querySelector('.battle-round');
  const word = hud.querySelector('.battle-word');
  const turnLabel = hud.querySelector('.battle-turn');
  const quizBox = hud.querySelector('.battle-quiz');
  const quizHint = hud.querySelector('.battle-kind');
  const quizOptions = hud.querySelector('.battle-options');
  let quiz = null;
  const popover = typeof hud.showPopover === 'function';
  const fired = new Set();
  let eventAt = null;
  let open = false;
  let watching = null;

  hud.addEventListener('click', () => {
    if (open && watching) onWatch?.(watching);
  });

  function toggle(node, visible) {
    node.classList.toggle('shown', visible);
    if (!popover) return;
    if (visible) node.showPopover();
    else node.hidePopover();
  }

  function show(visible) {
    if (visible === open) return;
    open = visible;
    toggle(hud, visible);
  }



  function fire(key, size, index, match, turnIndex) {
    const turn = match.turns[turnIndex];
    const spot = (side) => fighterSpot(size, index, side);
    const striker = turn.striker;
    for (const side of SIDES) {
      if (!turn[side].correct) fx.label(spot(side), 'Trượt', { color: '#cfc8dc', size: 0.75 });
    }
    if (!striker) {
      if (turn.a.correct && turn.b.correct) for (const side of SIDES) fx.label(spot(side), 'Triệt tiêu', { color: '#9ad8ff', size: 0.8 });
      return;
    }
    const move = turn[striker];
    const rival = other(striker);
    const skill = skillOf(`${key}:${turnIndex}:${striker}`);
    const color = `#${skill.color.toString(16).padStart(6, '0')}`;
    fx.charge(spot(striker), skill.color);
    fx.cast(spot(striker), spot(rival), skill.color, move.damage >= ARENA.hit * CRITICAL ? 1.6 : 1);
    fx.label(spot(striker), `${skill.icon} ${skill.name}`, { color, size: 0.95 });
    if (move.combo >= 2) fx.label(spot(striker), `Liên kích ×${comboOf(move.combo).toFixed(1)}`, { color: '#ffe08a', delay: 0.2, lift: 0.5, size: 0.8 });
    if (move.rage) fx.label(spot(striker), '🔥 Bạo nộ!', { color: '#ff5a5a', delay: 0.1, lift: 0.95, size: 0.85 });
    fx.label(spot(rival), `-${move.damage}`, { color: '#ff6b6b', delay: 0.45, size: 1.25 });
    if (turn[rival].blocked) {
      fx.shield(spot(rival), 0.4);
      fx.label(spot(rival), '🛡 Đỡ', { color: '#9ad8ff', delay: 0.4, lift: 0.55, size: 0.8 });
    }
    onHit?.(stageOf(size, index));
  }

  function noteOf(key, match, turnIndex, side, state) {
    const turn = match.turns[turnIndex];
    if (!turn) return '';
    const move = turn[side];
    const answered = state.live || state.elapsed >= ARENA.read + move.seconds;
    if (!answered) return '⏳';
    if (!move.correct) return `✗ ${move.seconds.toFixed(1)}s`;
    if (turnIndex >= state.resolved) return `✓ ${move.seconds.toFixed(1)}s`;
    if (turn.striker !== side) return '🛡 Đỡ đòn';
    const skill = skillOf(`${key}:${turnIndex}:${side}`);
    return `${skill.icon} ${skill.name} −${move.damage}${move.combo >= 2 ? ` ×${move.combo}` : ''}`;
  }

  function showQuiz(focus, state) {
    const { key, match } = focus;
    const turn = match.turns[state.index];
    if (state.live || !turn) {
      quizBox.hidden = true;
      quiz = null;
      return null;
    }
    quizBox.hidden = false;
    const id = `${key}:${state.index}`;
    if (quiz?.id !== id) {
      const question = buildQuestion(turn.key, turn.tier, seeded(id));
      const picks = { a: pickOf(question, turn.a.correct, seeded(`${id}:a`)), b: pickOf(question, turn.b.correct, seeded(`${id}:b`)) };
      const chips = question.options.map((value, i) => {
        const chip = document.createElement('span');
        chip.className = 'battle-option';
        chip.lang = question.kind === 'meaning' ? 'vi' : 'ja';
        const letter = document.createElement('b');
        letter.textContent = LETTERS[i];
        const text = document.createElement('span');
        text.textContent = value;
        const marks = document.createElement('i');
        chip.append(letter, text, marks);
        return { chip, value, marks };
      });
      quizOptions.replaceChildren(...chips.map((item) => item.chip));
      quiz = { id, question, picks, chips, shown: '' };
      setText(quizHint, question.hint ?? '');
    }
    const answered = SIDES.filter((side) => state.elapsed >= ARENA.read + turn[side].seconds);
    const resolved = state.index < state.resolved;
    const shown = `${answered.join('')}:${resolved}`;
    if (shown !== quiz.shown) {
      quiz.shown = shown;
      for (const { chip, value, marks } of quiz.chips) {
        chip.classList.toggle('right', resolved && value === quiz.question.answer);
        chip.classList.toggle('wrong', resolved && value !== quiz.question.answer && answered.some((side) => quiz.picks[side] === value));
        marks.replaceChildren(
          ...answered
            .filter((side) => quiz.picks[side] === value)
            .map((side) => {
              const tag = document.createElement('em');
              tag.className = side;
              tag.textContent = match[side] === PLAYER ? 'Bạn' : nameOf(match[side]);
              return tag;
            }),
        );
      }
    }
    return quiz.question;
  }

  function render(focus, now) {
    const { key, match, size } = focus;
    const state = replayState(match, now);
    for (const side of SIDES) {
      const view = views[side];
      const id = match[side];
      setText(view.name, id === PLAYER ? 'Bạn' : nameOf(id));
      const face = portraitOf(id);
      if (face && view.face.getAttribute('src') !== face) view.face.setAttribute('src', face);
      const hp = Math.max(0, state.hp[side]);
      view.fill.style.transform = `scaleX(${hp / ARENA.hp})`;
      setText(view.hp, `${hp}`);
      setText(view.note, state.index >= 0 ? noteOf(key, match, state.index, side, state) : '');
    }
    const shown = match.turns[Math.max(0, state.index)];
    const set = state.live ? match.set ?? 1 : shown?.set ?? 1;
    const inSet = state.live ? match.turns.filter((item) => (item.set ?? 1) === set).length + (match.pending ? 1 : 0) : match.turns.slice(0, state.index + 1).filter((item) => (item.set ?? 1) === set).length;
    setText(round, roundName(size));
    setText(turnLabel, `${(match.need ?? 1) > 1 ? `Hiệp ${set} · ` : ''}Lượt ${Math.max(1, inSet)}`);
    const question = showQuiz(focus, state);
    setText(word, question ? question.word : state.live ? wordOf(match.pending ?? match.turns.at(-1)?.key) : wordOf(match.turns[state.index]?.key));
  }

  return {
    played() {
      const event = arena.event;
      const current = event?.rounds[event.round];
      const index = current?.findIndex((match) => match.a === PLAYER || match.b === PLAYER) ?? -1;
      if (index < 0) return;
      const match = current[index];
      const key = `${event.at}:${event.round}:${index}`;
      const turn = match.turns.length - 1;
      if (turn < 0 || fired.has(`${key}:${turn}`)) return;
      fired.add(`${key}:${turn}`);
      fire(key, current.length, index, match, turn);
    },
    update(now, dt, position) {
      fx.update(dt);
      const event = arena.event;
      if (event?.at !== eventAt) {
        eventAt = event?.at ?? null;
        fired.clear();
      }
      const quiet = hidden() || !here();
      cast.update(event, now, !quiet);
      if (event?.phase !== 'running') {
        show(false);
        return;
      }
      const current = event.rounds[event.round];
      if (!current) {
        show(false);
        return;
      }
      let focus = null;
      let best = Infinity;
      current.forEach((match, index) => {
        if (!onStage(match, now)) return;
        const key = `${event.at}:${event.round}:${index}`;
        const state = replayState(match, now);
        const mine = match.a === PLAYER || match.b === PLAYER;
        for (let i = 0; i < state.resolved; i++) {
          const id = `${key}:${i}`;
          if (fired.has(id)) continue;
          fired.add(id);
          if (!match.live && !hidden() && now - resolveAt(match, i) < LATE_MINUTES) fire(key, current.length, index, match, i);
        }
        const stage = stageOf(current.length, index);
        const distance = mine ? -1 : Math.hypot(stage.x - position.x, stage.z - position.z);
        if (distance < best) {
          best = distance;
          focus = { key, match, size: current.length, stage };
        }
      });
      const visible = !!focus && !quiet;
      watching = visible ? focus.stage : null;
      show(visible);
      if (visible) render(focus, now);
    },
  };
}
