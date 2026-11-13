import { ARENA } from './config.js';
import { roundName } from './arena.js';
import { fighterSpot, stageOf } from './arenaIsland.js';
import { onStage, replayState, resolveAt, skillOf } from './arenaReplay.js';
import { plainText, unitOf } from './studyDecks.js';
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

export function createArenaBattle({ arena, fx, nameOf, portraitOf, sayOf, here, cast, hidden = () => false, onHit = null }) {
  const hud = document.getElementById('battleHud');
  const views = { a: sideView(hud.querySelector('.battle-side.a')), b: sideView(hud.querySelector('.battle-side.b')) };
  const round = hud.querySelector('.battle-round');
  const word = hud.querySelector('.battle-word');
  const popover = typeof hud.showPopover === 'function';
  const fired = new Set();
  let eventAt = null;
  let open = false;

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
    const lines = { a: [], b: [] };
    for (const side of SIDES) {
      const move = turn[side];
      if (!move.correct) lines[side].push('✗');
      else if (move.blocked) lines[side].push('🛡');
    }
    const striker = turn.striker;
    if (striker) {
      const move = turn[striker];
      const rival = other(striker);
      const skill = skillOf(`${key}:${turnIndex}:${striker}`);
      fx.cast(fighterSpot(size, index, striker), fighterSpot(size, index, rival), skill.color, move.damage >= ARENA.hit * CRITICAL ? 1.6 : 1);
      lines[rival].push(`-${move.damage}`);
      if (move.combo >= 2) lines[striker].push(`×${move.combo}`);
      if (move.rage) lines[striker].push('🔥');
    }
    for (const side of SIDES) if (lines[side].length) sayOf(match[side], lines[side].join(' '));
    if (striker) onHit?.(stageOf(size, index));
  }

  function noteOf(key, match, turnIndex, side, state) {
    const turn = match.turns[turnIndex];
    if (!turn) return '';
    const move = turn[side];
    const answered = state.live || state.elapsed >= ARENA.read + move.seconds;
    if (!answered) return '…';
    if (!move.correct) return `✗ ${move.seconds.toFixed(1)}s`;
    if (turnIndex >= state.resolved) return `✓ ${move.seconds.toFixed(1)}s`;
    if (turn.striker !== side) return '🛡 Đỡ đòn';
    const skill = skillOf(`${key}:${turnIndex}:${side}`);
    return `${skill.icon} ${skill.name} −${move.damage}${move.combo >= 2 ? ` ×${move.combo}` : ''}`;
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
    setText(round, `${roundName(size)}${(match.need ?? 1) > 1 ? ` · Hiệp ${set}` : ''} · Lượt ${Math.max(1, inSet)}`);
    setText(word, state.live ? wordOf(match.pending ?? match.turns.at(-1)?.key) : wordOf(match.turns[state.index]?.key));
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
        for (let i = 0; i < state.resolved; i++) {
          const id = `${key}:${i}`;
          if (fired.has(id)) continue;
          fired.add(id);
          if (!match.live && now - resolveAt(match, i) < LATE_MINUTES) fire(key, current.length, index, match, i);
        }
        const mine = match.a === PLAYER || match.b === PLAYER;
        const stage = stageOf(current.length, index);
        const distance = mine ? -1 : Math.hypot(stage.x - position.x, stage.z - position.z);
        if (distance < best) {
          best = distance;
          focus = { key, match, size: current.length };
        }
      });
      const visible = !!focus && !quiet;
      show(visible);
      if (visible) render(focus, now);
    },
  };
}
