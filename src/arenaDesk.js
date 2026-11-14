import { ARENA } from './config.js';
import { capacityOf, exitOf, nextStart, roundName } from './arena.js';
import { END_REASONS } from './arenaBoard.js';
import { coins } from './format.js';
import { clockText } from './clock.js';
import { PLAYER } from './inventory.js';

function entrantsRow(event) {
  if (event?.phase !== 'open') return [];
  return [{ id: 'entrants', name: `Đã ghi danh ${event.entrants.length}/${capacityOf(event)}`, icon: '👥', info: true }];
}

export function arenaMenu(arena) {
  if (arena.event?.phase === 'running') return null;
  return [
    { id: 'join', name: ARENA.fee > 0 ? `Ghi danh · ${coins(ARENA.fee)}` : 'Ghi danh', icon: '⚔️', art: 'scroll' },
    { id: 'prize', name: `Quỹ thưởng ${coins(arena.prize)}`, icon: '🏆', info: true },
    ...entrantsRow(arena.event),
  ];
}

function refusal(arena, reason, now) {
  const event = arena.event;
  if (reason === 'joined') return `Ngươi đã ghi danh. Khai mạc ${clockText(event.at)} · ${event.entrants.length}/${capacityOf(event)}`;
  if (reason === 'full') return `Lôi đài đã đủ ${capacityOf(event)} người.`;
  if (reason === 'money') return `Ngươi không đủ ${coins(ARENA.fee)} lệ phí.`;
  if (event?.phase === 'running') return 'Lôi đài đang tranh tài.';
  const start = nextStart(now);
  return `Ghi danh từ ${clockText(start - ARENA.lead)} đến ${clockText(start)}.`;
}

export function arenaLines(event, nameOf) {
  if (!event.rounds.length) return ['Lôi đài không đủ người tranh tài, lệ phí đã được hoàn lại.'];
  const lines = [];
  const place = event.places.find((item) => item.id === PLAYER);
  const exit = exitOf(event, PLAYER);
  const prize = place?.money > 0 ? `, nhận ${coins(place.money)}` : '';
  if (place && place.rank <= 3) {
    lines.push(`Lôi đài ${clockText(event.at)}: ngươi đạt hạng ${place.rank}${prize}.`);
  } else if (exit) {
    const reason = END_REASONS[exit.reason];
    lines.push(`Lôi đài ${clockText(event.at)}: ngươi dừng bước ở ${roundName(exit.round)}${reason ? ` (${reason.toLowerCase()})` : ''}${prize}.`);
  }
  const champion = event.places.find((item) => item.rank === 1);
  if (champion && champion.id !== PLAYER) lines.push(`🏆 Vô địch: ${nameOf(champion.id)}.`);
  return lines;
}

export function createArenaDesk({ arena, minutes, greet = null }) {
  function join() {
    const reason = arena.blocked(PLAYER);
    if (!reason && arena.register(PLAYER)) greet?.('Ghi danh xong, nhớ có mặt đúng giờ!');
    else greet?.(refusal(arena, reason, minutes()), 3);
  }

  return {
    act(choice) {
      if (choice === 'join') join();
      else if (arena.event?.phase === 'running') greet?.(refusal(arena, 'closed', minutes()));
    },
  };
}
