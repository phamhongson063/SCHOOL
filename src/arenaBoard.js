import { ARENA } from './config.js';
import { capacityOf, nextAt, nextStart, roundName } from './arena.js';
import { onStage } from './arenaReplay.js';
import { closable } from './dialog.js';
import { clockText } from './clock.js';
import { PLAYER } from './inventory.js';

export const BOARD_SIZE = { width: 2048, height: 1200 };

export const PALETTES = {
  board: { ornate: true, font: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Noto Serif", serif', title: '#ffe9a8', text: '#eef4ff', dim: '#8fa3bf', win: '#ffe08a', winBox: 'rgba(255, 214, 120, 0.16)', line: '#e2c27a', glow: 'rgba(255, 214, 120, 0.85)', live: '#9ad8ff', box: 'rgba(160, 200, 255, 0.08)', you: '#9ad8ff' },
  paper: { bg: null, title: '#2b1c12', text: '#2b1c12', dim: '#a8998a', win: '#9a2418', line: '#8a7a68', live: '#2f6f8e', box: 'rgba(43, 28, 18, 0.06)', you: '#2f6f8e' },
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const END_REASONS = {
  ko: 'Hạ gục',
  turns: `Hết ${ARENA.turns} lượt, so máu`,
  empty: 'Không còn từ chung để ra đề',
  forfeit: 'Vắng mặt',
  bye: 'Không có đối thủ',
};

export const countdown = (minutes) => {
  const seconds = Math.max(0, Math.ceil(minutes * 60));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function waitText(event, now) {
  const next = nextAt(event);
  if (next === null) return null;
  if (event.round < 0) return `Khai mạc sau ${countdown(next - now)}`;
  const round = event.rounds[event.round];
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
  if (event.phase === 'open') return `${time} · Ghi danh ${event.entrants.length}/${capacityOf(event)}`;
  if (event.phase === 'done') return `${time} · Đã kết thúc`;
  return `${time} · ${waitText(event, now) ?? roundName(event.rounds[event.round].length)}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cloudCurl(ctx, x, y, size, flipX, flipY) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX, flipY);
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.5, Math.PI, Math.PI * 2.4);
  ctx.moveTo(size * 0.2, size * 0.5);
  ctx.arc(size * 0.5, size * 0.5, size * 0.3, Math.PI, Math.PI * 2.1);
  ctx.moveTo(size, size * 0.5);
  ctx.quadraticCurveTo(size * 1.6, size * 0.1, size * 2.4, size * 0.4);
  ctx.stroke();
  ctx.restore();
}

function paintPanel(ctx, width, height, s, palette) {
  const inset = 6 * s;
  roundRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 34 * s);
  const fill = ctx.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, 'rgba(22, 40, 62, 0.95)');
  fill.addColorStop(1, 'rgba(10, 18, 34, 0.95)');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 16 * s;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 4 * s;
  roundRect(ctx, 16 * s, 16 * s, width - 32 * s, height - 32 * s, 26 * s);
  ctx.stroke();
  ctx.lineWidth = 1.5 * s;
  roundRect(ctx, 28 * s, 28 * s, width - 56 * s, height - 56 * s, 20 * s);
  ctx.stroke();
  ctx.lineWidth = 2.5 * s;
  const curl = 30 * s;
  const edge = 34 * s;
  cloudCurl(ctx, edge, edge, curl, 1, 1);
  cloudCurl(ctx, width - edge, edge, curl, -1, 1);
  cloudCurl(ctx, edge, height - edge, curl, 1, -1);
  cloudCurl(ctx, width - edge, height - edge, curl, -1, -1);
  ctx.restore();
}

export function drawBracket(ctx, { width, height }, event, { nameOf, now, palette }) {
  const s = width / 1024;
  const font = palette.font ?? FONT;
  ctx.clearRect(0, 0, width, height);
  if (palette.ornate) paintPanel(ctx, width, height, s, palette);
  else if (palette.bg) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.save();
  if (palette.glow) {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 14 * s;
  }
  ctx.fillStyle = palette.title;
  ctx.font = `bold ${36 * s}px ${font}`;
  ctx.fillText(headline(event, now), width / 2, (palette.ornate ? 66 : 40) * s);
  ctx.restore();
  if (!event?.rounds.length) return;
  const first = event.rounds[0].length;
  const columns = Math.log2(first) + 2;
  const margin = (palette.ornate ? 56 : 24) * s;
  const boxW = Math.min(220 * s, (width - margin * 2) / columns - 18 * s);
  const top = (palette.ornate ? 150 : 110) * s;
  const area = height - top - (palette.ornate ? 50 : 20) * s;
  const boxH = Math.min(42 * s, (area / (first * 2)) * 0.84);
  const nameSize = Math.min(22 * s, boxH * 0.52);
  const colX = (k) => margin + (k * (width - margin * 2 - boxW)) / (columns - 1);
  const ys = [];
  for (let k = 0; k < columns; k++) {
    const count = (first * 2) / 2 ** k;
    ys[k] = Array.from({ length: count }, (_, j) => (k === 0 ? top + ((j + 0.5) * area) / count : (ys[k - 1][2 * j] + ys[k - 1][2 * j + 1]) / 2));
  }
  ctx.font = `bold ${20 * s}px ${font}`;
  ctx.fillStyle = palette.dim;
  for (let k = 0; k < columns; k++) ctx.fillText(k === columns - 1 ? 'Vô địch' : roundName(first / 2 ** k), colX(k) + boxW / 2, top - 30 * s);
  ctx.save();
  if (palette.glow) {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 6 * s;
  }
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = palette.line;
  for (let k = 0; k < columns - 1; k++) {
    for (let j = 0; j < ys[k].length; j += 2) {
      const x0 = colX(k) + boxW;
      const x1 = colX(k + 1);
      const mid = (x0 + x1) / 2;
      const target = ys[k + 1][j / 2];
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
  ctx.restore();
  for (let k = 0; k < columns; k++) {
    ys[k].forEach((y, j) => {
      const slot = slotOf(event, k, j, now);
      const x = colX(k);
      ctx.fillStyle = slot.state === 'win' && palette.winBox ? palette.winBox : palette.box;
      roundRect(ctx, x, y - boxH / 2, boxW, boxH, 8 * s);
      ctx.fill();
      if (slot.state === 'live' || slot.id === PLAYER) {
        ctx.strokeStyle = slot.state === 'live' ? palette.live : palette.you;
        ctx.lineWidth = 2.5 * s;
        roundRect(ctx, x + 1.5 * s, y - boxH / 2 + 1.5 * s, boxW - 3 * s, boxH - 3 * s, 7 * s);
        ctx.stroke();
      }
      const name = slot.id ? nameOf(slot.id) : '';
      const label = slot.id === PLAYER ? 'Bạn' : name;
      ctx.font = `${slot.state === 'win' ? 'bold ' : ''}${nameSize}px ${font}`;
      ctx.fillStyle = slot.state === 'win' ? palette.win : slot.state === 'lose' ? palette.dim : slot.state === 'live' ? palette.live : palette.text;
      ctx.textAlign = 'left';
      const shown = fit(ctx, `${label}${slot.forfeit ? ' (vắng)' : ''}`, boxW - 20 * s);
      ctx.fillText(slot.id ? shown : '—', x + 10 * s, y + 1 * s);
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
