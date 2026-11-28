import { FIREWORKS } from './config.js';
import { clockText } from './clock.js';
import { coins } from './format.js';

export const SAND_CASTLE_NAME = 'Lầu cát';
export const FIREWORKS_NAME = 'Hội pháo hoa';

const HOST_LINES = ['Hôm nay có pháo hoa chữ trên lầu cát!', 'Ghé lầu cát ngắm pháo hoa nhé!'];

export function sandFestMenu(prize) {
  return [
    { id: 'join', name: `Ghi danh · ${coins(FIREWORKS.fee)}`, icon: '🎆' },
    { id: 'prize', name: `Giải thưởng ${coins(prize)}`, icon: '🏆', info: true },
  ];
}

const WEEKDAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const slotText = (slot) => `${clockText(slot.signOpen)}–${clockText(slot.start + FIREWORKS.minutes)}${slot.weekdays ? ` (${slot.weekdays.map((day) => WEEKDAY_NAMES[day]).join(', ')})` : ''}`;

const REPLIES = {
  ok: () => 'Ghi danh xong rồi! Hẹn bạn lúc pháo hoa lên nhé.',
  already: (start) => `Bạn đã ghi danh rồi, ${clockText(start)} pháo hoa lên nhé!`,
  poor: () => `Ghi danh cần ${coins(FIREWORKS.fee)} đó.`,
  closed: () => `Ghi danh mở ${FIREWORKS.slots.map(slotText).join(', ')}.`,
};

export const sandFestClosedMenu = () => [{ id: 'hours', name: REPLIES.closed(), icon: '🎆', info: true }];

export const sandFestReply = (outcome, start) => REPLIES[outcome]?.(start) ?? null;

export const sandHostLine = (roll) => HOST_LINES[Math.floor(roll * HOST_LINES.length) % HOST_LINES.length];
