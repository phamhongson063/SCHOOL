import { ARENA } from './config.js';
import { weekdayOf } from './clock.js';

export const arenaStarts = (day) => (ARENA.schedule.find((item) => item.weekdays.includes(weekdayOf(day)))?.hours ?? []).map((hour) => hour * 60);
