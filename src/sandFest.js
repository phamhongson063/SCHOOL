import { FIREWORKS } from './config.js';
import { clockText } from './clock.js';
import { coins } from './format.js';

export const SAND_CASTLE_NAME = 'Lầu cát';
export const FIREWORKS_NAME = 'Hội pháo hoa';

const HOST_LINES = ['Đêm nay có pháo hoa chữ trên lầu cát!', 'Ghé lầu cát ngắm pháo hoa nhé!'];

export function sandFestMenu(prize) {
  return [
    { id: 'join', name: `Ghi danh · ${coins(FIREWORKS.fee)}`, icon: '🎆' },
    { id: 'prize', name: `Giải thưởng ${coins(prize)}`, icon: '🏆', info: true },
  ];
}

const REPLIES = {
  ok: 'Ghi danh xong rồi! Hẹn bạn lúc pháo hoa lên nhé.',
  already: `Bạn đã ghi danh rồi, ${clockText(FIREWORKS.start)} pháo hoa lên nhé!`,
  poor: `Ghi danh cần ${coins(FIREWORKS.fee)} đó.`,
  closed: `Ghi danh mở từ ${clockText(FIREWORKS.signOpen)} đến ${clockText(FIREWORKS.start)}.`,
};

export const sandFestReply = (outcome) => REPLIES[outcome] ?? null;

export const sandHostLine = (roll) => HOST_LINES[Math.floor(roll * HOST_LINES.length) % HOST_LINES.length];
