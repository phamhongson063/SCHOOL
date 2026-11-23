import { SAND_FEST } from './config.js';
import { coins } from './format.js';

export const SAND_CASTLE_NAME = 'Lầu cát';

const HOST_LINES = ['Lầu cát sắp có hội lớn đó!', 'Ghé xem hội lầu cát nhé!'];
const NOT_OPEN = 'Hội lầu cát chưa mở, bạn quay lại sau nhé!';

export function sandFestMenu() {
  return [
    { id: 'join', name: `Ghi danh · ${coins(SAND_FEST.fee)}`, icon: '🏰' },
    { id: 'prize', name: `Giải thưởng ${coins(SAND_FEST.prize)}`, icon: '🏆', info: true },
  ];
}

export function sandFestReply(choice) {
  return choice === 'join' ? NOT_OPEN : null;
}

export const sandHostLine = (roll) => HOST_LINES[Math.floor(roll * HOST_LINES.length) % HOST_LINES.length];
