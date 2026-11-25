import { RANKING } from './config.js';
import { clockText, dayOf, minuteOfDay, DAY_MINUTES } from './clock.js';
import { amount, coins } from './format.js';
import { PLAYER } from './inventory.js';
import { closable, el } from './dialog.js';
import { setRich } from './goldArt.js';
import { writeGameItem } from './seal.js';
import { worldKey } from './saveKeys.js';
import { certify } from './certify.js';
import { netWorth } from './profileRules.js';
import { readSaved } from './persist.js';

const KEY = worldKey('ranking');
const MEDALS = ['🥇', '🥈', '🥉'];
const DAILY_TABS = new Set(['arena', 'lantern', 'fireworks']);
const CHECK_MS = 5000;

function load() {
  const saved = readSaved(KEY);
  if (saved && Number.isFinite(saved.slot) && Number.isFinite(saved.at) && Array.isArray(saved.rows)) return saved;
  return null;
}

function latestCheckpoint(minutes) {
  const day = dayOf(minutes);
  const passed = RANKING.hours.filter((hour) => hour <= minuteOfDay(minutes)).length;
  const slot = day * RANKING.hours.length + passed - 1;
  const at = passed > 0 ? day * DAY_MINUTES + RANKING.hours[passed - 1] : (day - 1) * DAY_MINUTES + RANKING.hours.at(-1);
  return { slot, at };
}

function dailyCheckpoint(minutes) {
  const day = dayOf(minutes - RANKING.dailyHour);
  return { day, at: day * DAY_MINUTES + RANKING.dailyHour };
}

function richSpan(className, text) {
  const node = el('span', className);
  setRich(node, text);
  return node;
}

export function createRanking({ ledger, bank, estate, arena, lanterns, fireworks, people, learners, now, onPick = () => {} }) {
  const dialog = document.getElementById('rankDialog');
  const list = document.getElementById('rankList');
  const stamp = document.getElementById('rankStamp');
  const names = new Map(people.map(({ id, name }) => [id, name]));
  const tabs = [...dialog.querySelectorAll('[data-tab]')];
  let board = load();
  let tab = 'worth';

  const titlesOf = (id) => arena.titlesOf(id);
  const learnerIds = people.map(({ id }) => id).filter((id) => learners.has(id));
  const worthOf = (id) => netWorth(id, { ledger, bank, estate });

  function standings(score, previous, ids = people.map(({ id }) => id)) {
    const before = new Map((previous ?? []).map((row) => [row.id, row.score]));
    const rows = ids.map((id) => ({ id, score: score(id) })).sort((a, b) => b.score - a.score);
    rows.forEach((row, i) => {
      row.rank = i + 1;
      row.prev = before.get(row.id) ?? null;
    });
    return rows;
  }

  const certsOf = (id) => certify.certifiedTotal(id);
  const lanternsOf = (id) => lanterns.totalOf(id);
  const fireworksOf = (id) => fireworks.titlesOf(id);

  function certsBaseFor(day) {
    if (board?.certsBase?.day === day) return board.certsBase;
    const rows = board?.certs ?? learnerIds.map((id) => ({ id, score: certsOf(id) }));
    return { day, rows: rows.map(({ id, score }) => ({ id, score })) };
  }

  const dailyFresh = (previous) => previous?.dailyDay === dailyCheckpoint(now()).day && previous.arenaVersion === arena.version && !!previous.arena && !!previous.lantern && !!previous.fireworks;

  function dailyBoard(previous) {
    if (dailyFresh(previous)) return { arena: previous.arena, arenaVersion: previous.arenaVersion, lantern: previous.lantern, fireworks: previous.fireworks, dailyDay: previous.dailyDay, dailyAt: previous.dailyAt };
    const checkpoint = dailyCheckpoint(now());
    return {
      arena: standings(titlesOf, previous?.arenaVersion === arena.version ? previous?.arena : null),
      arenaVersion: arena.version,
      lantern: standings(lanternsOf, previous?.lantern),
      fireworks: standings(fireworksOf, previous?.fireworks),
      dailyDay: checkpoint.day,
      dailyAt: checkpoint.at,
    };
  }

  function snapshot({ slot, at }) {
    const certsBase = certsBaseFor(dayOf(at));
    board = { ...dailyBoard(board), slot, at, rows: standings(worthOf, board?.rows), certs: standings(certsOf, certsBase.rows, learnerIds), certsBase };
    try {
      writeGameItem(KEY, JSON.stringify(board));
    } catch {}
  }

  const scoreCell = {
    worth: (worth) => richSpan(worth < 0 ? 'rank-worth debt' : 'rank-worth', coins(worth)),
    certs: (count) => el('span', 'rank-worth', `🎓 ${amount(count)}`),
    arena: (count) => el('span', 'rank-worth', `🏆 ${amount(count)}`),
    lantern: (count) => el('span', 'rank-worth', `🏮 ${amount(count)}`),
    fireworks: (count) => el('span', 'rank-worth', `🎆 ${amount(count)}`),
  };

  function nameButton(id) {
    const node = el('button', 'rank-name', `${names.get(id) ?? 'người khác'}${id === arena.champions[0]?.id ? ' ⚔️' : ''}`);
    node.type = 'button';
    node.dataset.id = id;
    return node;
  }

  function row({ id, score, rank, prev }) {
    const item = el('li', id === PLAYER ? 'rank-row mine' : 'rank-row');
    const change = Number.isFinite(prev) ? score - prev : 0;
    item.append(
      el('span', 'rank-place', MEDALS[rank - 1] ?? String(rank)),
      nameButton(id),
      scoreCell[tab](score),
      el('span', change > 0 ? 'rank-trend up' : change < 0 ? 'rank-trend down' : 'rank-trend', change > 0 ? `+${amount(change)}` : change < 0 ? `-${amount(-change)}` : ''),
    );
    return item;
  }

  function render() {
    for (const node of tabs) node.setAttribute('aria-selected', String(node.dataset.tab === tab));
    const pick = { certs: board.certs, arena: board.arena.filter((entry) => entry.score > 0), lantern: board.lantern.filter((entry) => entry.score > 0), fireworks: board.fireworks.filter((entry) => entry.score > 0) };
    const rows = (pick[tab] ?? board.rows).filter((entry) => names.has(entry.id));
    list.replaceChildren(...(rows.length ? rows.map(row) : [el('li', 'rank-empty', 'Chưa có nhà vô địch.')]));
    stamp.textContent = `Cập nhật lúc ${clockText(DAILY_TABS.has(tab) ? board.dailyAt : board.at)}`;
  }

  function update() {
    const checkpoint = latestCheckpoint(now());
    const certsFresh = board?.certs?.every(({ id }) => learners.has(id));
    if (board?.slot === checkpoint.slot && certsFresh && dailyFresh(board)) return;
    snapshot(checkpoint);
    if (dialog.open) render();
  }

  update();
  setInterval(update, CHECK_MS);
  const button = document.getElementById('rankBtn');
  button.addEventListener('click', () => {
    update();
    render();
    dialog.showModal();
  });
  button.addEventListener('pointerup', () => button.blur());
  for (const node of tabs) {
    node.addEventListener('click', () => {
      tab = node.dataset.tab;
      render();
    });
  }
  list.addEventListener('click', (event) => {
    const name = event.target.closest('.rank-name');
    if (name) onPick(name.dataset.id);
  });
  closable(dialog);
}
