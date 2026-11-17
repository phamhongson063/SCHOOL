import { LODGES, LODGE_ROOMS, ROUTINE } from './config.js';
import { dayOf } from './clock.js';
import { coins } from './format.js';

const guests = new Map();

export const roomTier = (id) => LODGES[LODGE_ROOMS[id].tier];

export const lodgeNightOf = (minutes) => dayOf(minutes - ROUTINE.wake);

export const heldTonight = (held, { night, minutes }) => !!held && night && held.night === lodgeNightOf(minutes);

const full = (id) => (guests.get(id)?.size ?? 0) >= roomTier(id).beds;

export function isFree(id, who) {
  return !!guests.get(id)?.has(who) || !full(id);
}

export function leaveRoom(who) {
  for (const [id, stay] of guests) if (stay.delete(who) && !stay.size) guests.delete(id);
}

export function release(id, who) {
  const stay = guests.get(id);
  if (stay?.delete(who) && !stay.size) guests.delete(id);
}

export function book(id, who) {
  if (!isFree(id, who)) return false;
  leaveRoom(who);
  if (!guests.has(id)) guests.set(id, new Set());
  guests.get(id).add(who);
  return true;
}

export function lodgeLabel(id, who) {
  const tier = roomTier(id);
  const busy = isFree(id, who) ? '' : ' · hết phòng';
  return `${LODGE_ROOMS[id].name} · ${coins(tier.price)} · +${tier.perHour}⚡/giờ${busy}`;
}
