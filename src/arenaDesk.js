import { ARENA } from './config.js';
import { exitOf, nextStart, roundName } from './arena.js';
import { closable } from './dialog.js';
import { coins } from './format.js';
import { setRich } from './goldArt.js';
import { clockText } from './clock.js';
import { PLAYER } from './inventory.js';

function message(arena, now) {
  const event = arena.event;
  const reason = arena.blocked(PLAYER);
  const count = event ? `${event.entrants.length}/${ARENA.size}` : '';
  if (!reason) return `Khai mạc ${clockText(event.at)} · Lệ phí ${coins(ARENA.fee)} · ${count}`;
  if (reason === 'joined') return `Ngươi đã ghi danh. Khai mạc ${clockText(event.at)} · ${count}`;
  if (reason === 'full') return `Lôi đài đã đủ ${ARENA.size} người.`;
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
  if (place) {
    const prizes = [place.money > 0 ? coins(place.money) : null, place.intellect > 0 ? `${place.intellect} 💡` : null].filter(Boolean);
    lines.push(`Lôi đài ${clockText(event.at)}: ngươi đạt hạng ${place.rank}${prizes.length ? `, nhận ${prizes.join(' + ')}` : ''}.`);
  } else if (exit) {
    lines.push(`Lôi đài ${clockText(event.at)}: ngươi dừng bước ở ${roundName(exit.round)}${exit.forfeit ? ' vì vắng mặt' : ''}.`);
  }
  const champion = event.places.find((item) => item.rank === 1);
  if (champion && champion.id !== PLAYER) lines.push(`🏆 Vô địch: ${nameOf(champion.id)}.`);
  return lines;
}

export function createArenaDesk({ arena, minutes, greet = null, onBracket = null }) {
  const dialog = document.getElementById('arenaDialog');
  const text = document.getElementById('arenaText');
  const join = document.getElementById('arenaJoin');
  const bracket = document.getElementById('arenaBracket');
  closable(dialog);

  function render() {
    setRich(text, message(arena, minutes()));
    join.hidden = !!arena.blocked(PLAYER);
    bracket.hidden = !arena.event?.rounds.length;
  }

  bracket.addEventListener('click', () => {
    dialog.close();
    onBracket?.();
  });

  join.addEventListener('click', () => {
    if (arena.register(PLAYER)) greet?.('Ghi danh xong, nhớ có mặt đúng giờ!');
    render();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open() {
      greet?.('Muốn tranh tài lôi đài à?');
      render();
      dialog.showModal();
    },
  };
}
