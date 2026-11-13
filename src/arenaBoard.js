import { ARENA } from './config.js';
import { nextStart, roundName } from './arena.js';
import { onStage } from './arenaReplay.js';
import { closable } from './dialog.js';
import { clockText } from './clock.js';
import { PLAYER } from './inventory.js';

export const BOARD_SIZE = { width: 1024, height: 600 };

export const PALETTES = {
  board: { bg: '#2a1a3a', title: '#ffe08a', text: '#f3e9d2', dim: '#8a7f99', win: '#ffe08a', line: '#c9a24a', live: '#9ad8ff', box: '#3a2850', you: '#9ad8ff' },
  paper: { bg: null, title: '#2b1c12', text: '#2b1c12', dim: '#a8998a', win: '#9a2418', line: '#8a7a68', live: '#2f6f8e', box: 'rgba(43, 28, 18, 0.06)', you: '#2f6f8e' },
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const countdown = (minutes) => {
  const seconds = Math.max(0, Math.ceil(minutes * 60));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function waitText(event, now) {
  if (event?.phase !== 'running') return null;
  if (event.round < 0) return `Khai mạc sau ${countdown((event.firstAt ?? event.at) - now)}`;
  const round = event.rounds[event.round];
  if (round.some((match) => !match.winner)) return null;
  const next = round[0].startAt + ARENA.roundMinutes;
  return round.length === 1 ? `Trao thưởng sau ${countdown(next - now)}` : `${roundName(round.length / 2)} sau ${countdown(next - now)}`;
}

export function bracketKey(event, now) {
  if (!event) return 'none';
  const parts = [event.at, event.phase, event.round, event.entrants.length, waitText(event, now)];
  for (const round of event.rounds) for (const match of round) parts.push(`${match.a}|${match.b}|${match.winner ?? ''}|${onStage(match, now) ? 1 : 0}`);
  return parts.join(';');
}

function slotOf(event, column, index, now) {
  const rounds = event.rounds;
  const last = Math.log2(rounds[0].length) + 1;
  if (column === last) {
    const final = rounds[last - 1]?.[0];
    return { id: final?.winner ?? null, state: final?.winner ? 'win' : 'pending' };
  }
  const match = rounds[column]?.[Math.floor(index / 2)];
  const side = index % 2 ? 'b' : 'a';
  const id = match ? match[side] : (rounds[column - 1]?.[index]?.winner ?? null);
  if (!match) return { id, state: 'pending' };
  if (match.winner) return { id, state: id === match.winner ? 'win' : 'lose', forfeit: match.forfeit === id };
  return { id, state: onStage(match, now) ? 'live' : 'pending' };
}

function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function headline(event, now) {
  if (!event) return `Lôi đài ${clockText(nextStart(now))}`;
  const time = `Lôi đài ${clockText(event.at)}`;
  if (event.phase === 'open') return `${time} · Ghi danh ${event.entrants.length}/${ARENA.size}`;
  if (event.phase === 'done') return `${time} · Đã kết thúc`;
  return `${time} · ${waitText(event, now) ?? roundName(event.rounds[event.round].length)}`;
}

export function drawBracket(ctx, { width, height }, event, { nameOf, now, palette }) {
  ctx.clearRect(0, 0, width, height);
  if (palette.bg) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.title;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(headline(event, now), width / 2, 40);
  if (!event?.rounds.length) return;
  const first = event.rounds[0].length;
  const columns = Math.log2(first) + 2;
  const margin = 24;
  const boxW = Math.min(220, (width - margin * 2) / columns - 18);
  const boxH = 40;
  const top = 110;
  const area = height - top - 20;
  const colX = (k) => margin + (k * (width - margin * 2 - boxW)) / (columns - 1);
  const ys = [];
  for (let k = 0; k < columns; k++) {
    const count = (first * 2) / 2 ** k;
    ys[k] = Array.from({ length: count }, (_, j) => (k === 0 ? top + ((j + 0.5) * area) / count : (ys[k - 1][2 * j] + ys[k - 1][2 * j + 1]) / 2));
  }
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = palette.dim;
  for (let k = 0; k < columns; k++) ctx.fillText(k === columns - 1 ? 'Vô địch' : roundName(first / 2 ** k), colX(k) + boxW / 2, 84);
  ctx.lineWidth = 3;
  for (let k = 0; k < columns - 1; k++) {
    for (let j = 0; j < ys[k].length; j += 2) {
      const x0 = colX(k) + boxW;
      const x1 = colX(k + 1);
      const mid = (x0 + x1) / 2;
      const target = ys[k + 1][j / 2];
      ctx.strokeStyle = palette.line;
      ctx.beginPath();
      ctx.moveTo(x0, ys[k][j]);
      ctx.lineTo(mid, ys[k][j]);
      ctx.lineTo(mid, ys[k][j + 1]);
      ctx.moveTo(x0, ys[k][j + 1]);
      ctx.lineTo(mid, ys[k][j + 1]);
      ctx.moveTo(mid, target);
      ctx.lineTo(x1, target);
      ctx.stroke();
    }
  }
  for (let k = 0; k < columns; k++) {
    ys[k].forEach((y, j) => {
      const slot = slotOf(event, k, j, now);
      const x = colX(k);
      ctx.fillStyle = palette.box;
      ctx.fillRect(x, y - boxH / 2, boxW, boxH);
      if (slot.state === 'live' || slot.id === PLAYER) {
        ctx.strokeStyle = slot.state === 'live' ? palette.live : palette.you;
        ctx.strokeRect(x + 1.5, y - boxH / 2 + 1.5, boxW - 3, boxH - 3);
      }
      const name = slot.id ? nameOf(slot.id) : '';
      const label = slot.id === PLAYER ? 'Bạn' : name;
      ctx.font = `${slot.state === 'win' ? 'bold ' : ''}22px ${FONT}`;
      ctx.fillStyle = slot.state === 'win' ? palette.win : slot.state === 'lose' ? palette.dim : slot.state === 'live' ? palette.live : palette.text;
      ctx.textAlign = 'left';
      const shown = fit(ctx, `${label}${slot.forfeit ? ' (vắng)' : ''}`, boxW - 20);
      ctx.fillText(slot.id ? shown : '—', x + 10, y + 1);
      ctx.textAlign = 'center';
    });
  }
}

export function createBracketDialog({ arena, nameOf, now }) {
  const dialog = document.getElementById('bracketDialog');
  const canvas = document.getElementById('bracketCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = BOARD_SIZE.width;
  canvas.height = BOARD_SIZE.height;
  closable(dialog);
  let timer = null;
  let shown = null;

  function paint() {
    const key = bracketKey(arena.event, now());
    if (key === shown) return;
    shown = key;
    drawBracket(ctx, BOARD_SIZE, arena.event, { nameOf, now: now(), palette: PALETTES.paper });
  }

  dialog.addEventListener('close', () => {
    clearInterval(timer);
    timer = null;
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open() {
      shown = null;
      paint();
      if (!dialog.open) dialog.showModal();
      clearInterval(timer);
      timer = setInterval(paint, 1000);
    },
  };
}
