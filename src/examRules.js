import { CERTIFY } from './config.js';
import { isOpenAt } from './clock.js';

export const EXAM_HOURS = { open: CERTIFY.open, close: CERTIFY.close };

export const examOpen = (minutes) => isOpenAt(EXAM_HOURS, minutes);

export const EXAM_SPAN = CERTIFY.examMinutes + 2;
export const INTERNAL_SPAN = CERTIFY.internalMinutes + 2;
