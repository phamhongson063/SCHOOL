import { nextAt, roundName } from './arena.js';
import { onStage } from './arenaReplay.js';
import { clockText } from './clock.js';
import { PLAYER } from './inventory.js';

const FINAL_COUNT = 5;

function seconds(left) {
  const whole = Math.max(0, Math.ceil(left));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function castInfo(event, now) {
  if (!event) return null;
  if (event.phase === 'done') {
    const champion = event.places.find((place) => place.rank === 1)?.id ?? null;
    return champion ? { stage: 'Kết thúc', title: 'Vô địch', left: null, pairs: [], champion } : null;
  }
  if (event.phase !== 'running') return null;
  const next = nextAt(event);
  if (next === null) return null;
  if (event.round >= 0 && event.rounds[event.round].some((match) => onStage(match, now))) return null;
  const left = (next - now) * 60;
  if (event.round < 0) {
    const first = event.rounds[0];
    return { stage: 'Khai mạc', title: roundName(first.length), left, pairs: first.map((match) => [match.a, match.b]) };
  }
  const round = event.rounds[event.round];
  if (round.length === 1) return { stage: 'Chung kết đã xong', title: 'Trao thưởng', left, pairs: [], champion: round[0].winner };
  const pairs = Array.from({ length: round.length / 2 }, (_, i) => [round[2 * i].winner, round[2 * i + 1].winner]);
  return { stage: 'Sắp diễn ra', title: roundName(round.length / 2), left, pairs };
}

export function createArenaCast({ nameOf }) {
  const cast = document.getElementById('arenaCast');
  const count = document.getElementById('arenaCount');
  const label = cast.querySelector('.cast-event');
  const stage = cast.querySelector('.cast-stage');
  const title = cast.querySelector('.cast-title');
  const timer = cast.querySelector('.cast-timer');
  const list = cast.querySelector('.cast-list');
  const popover = typeof cast.showPopover === 'function';
  const shown = new Map();
  let listKey = null;
  let lastCount = null;

  const name = (id) => (id === PLAYER ? 'Bạn' : id ? nameOf(id) : '—');
  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };

  function show(node, visible) {
    if (shown.get(node) === visible) return;
    shown.set(node, visible);
    node.classList.toggle('shown', visible);
    if (!popover) return;
    if (visible) node.showPopover();
    else node.hidePopover();
  }

  function renderList(info) {
    const key = JSON.stringify([info.pairs, info.champion ?? null]);
    if (key === listKey) return;
    listKey = key;
    const rows = info.pairs.map(([a, b]) => {
      const row = document.createElement('li');
      if (a === PLAYER || b === PLAYER) row.className = 'mine';
      const left = document.createElement('b');
      left.textContent = name(a);
      const vs = document.createElement('em');
      vs.textContent = 'VS';
      const right = document.createElement('b');
      right.textContent = name(b);
      row.append(left, vs, right);
      return row;
    });
    if (info.champion) {
      const row = document.createElement('li');
      row.className = info.champion === PLAYER ? 'champion mine' : 'champion';
      row.textContent = `🏆 ${name(info.champion)}`;
      rows.push(row);
    }
    list.replaceChildren(...rows);
  }

  function pulse(text) {
    if (text === lastCount) return;
    lastCount = text;
    count.textContent = text;
    count.classList.remove('beat');
    void count.offsetWidth;
    count.classList.add('beat');
  }

  return {
    update(event, now, visible) {
      const info = visible ? castInfo(event, now) : null;
      show(cast, !!info);
      if (!info) {
        show(count, false);
        lastCount = null;
        return;
      }
      setText(label, `Lôi đài ${clockText(event.at)}`);
      setText(stage, info.stage);
      setText(title, info.title);
      setText(timer, info.left === null ? '' : seconds(info.left));
      renderList(info);
      const final = info.left !== null && info.left > 0 && info.left <= FINAL_COUNT;
      show(count, final);
      if (final) pulse(String(Math.ceil(info.left)));
      else lastCount = null;
    },
  };
}
