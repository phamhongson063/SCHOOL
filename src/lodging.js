import { LODGES, LODGE_ROOMS, ROUTINE } from './config.js';
import { dayOf } from './clock.js';
import { coins } from './format.js';

const guests = new Map();

export const roomTier = (id) => LODGES[LODGE_ROOMS[id].tier];

export const lodgeNightOf = (minutes) => dayOf(minutes - ROUTINE.wake);

export function isFree(id, who) {
  const guest = guests.get(id);
  return !guest || guest === who;
}

export function leaveRoom(who) {
  for (const [id, guest] of guests) if (guest === who) guests.delete(id);
}

export function release(id, who) {
  if (guests.get(id) === who) guests.delete(id);
}

export function book(id, who) {
  if (!isFree(id, who)) return false;
  leaveRoom(who);
  guests.set(id, who);
  return true;
}

export function lodgeLabel(id) {
  const tier = roomTier(id);
  const busy = guests.has(id) ? ' · có người' : '';
  return `${LODGE_ROOMS[id].name} · ${coins(tier.price)} · +${tier.perHour}⚡/giờ${busy}`;
}
