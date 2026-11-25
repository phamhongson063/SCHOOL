import { FISH, FISHING, WORLD } from './config.js';
import { minuteOfDay } from './clock.js';
import { writeGameItem } from './seal.js';
import { worldKey } from './saveKeys.js';
import { BOAT_X, DOCK_X, SEGMENT, clearOfCrossing, lowestNorth, northBank } from './riverShape.js';
import { readSaved } from './persist.js';

const KEY = worldKey('river');
const BANK = { x0: WORLD.x0 + 5, x1: WORLD.x1 - 5 };
const BERTH_GAP = 1.6;
const CROWD_RADIUS = 8;
const CROWD_PENALTY = 25;
const SPREAD = 6;
const PLACE_TRIES = 40;

const randomInt = ([lo, hi]) => lo + Math.floor(Math.random() * (hi - lo + 1));
const clearOfDock = (x) => Math.abs(x - DOCK_X) > 4 && Math.abs(x - BOAT_X) > 3 && clearOfCrossing(x, 2);
const onBank = (x) => x >= BANK.x0 && x <= BANK.x1 && clearOfDock(x);
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const standAt = (x) => ({ x, z: lowestNorth(x, SEGMENT) - 0.5 });
const floatAt = (x) => ({ x, z: northBank(x) + 2.5 });
const facingOf = (stand, float) => Math.atan2(float.x - stand.x, float.z - stand.z);

export const BANK_POINTS = [];
for (let x = BANK.x0; x <= BANK.x1; x += 5) if (clearOfDock(x)) BANK_POINTS.push(standAt(x));

function randomBankX() {
  for (let i = 0; i < PLACE_TRIES; i++) {
    const x = BANK.x0 + Math.random() * (BANK.x1 - BANK.x0);
    if (clearOfDock(x)) return x;
  }
  return BANK_POINTS[Math.floor(Math.random() * BANK_POINTS.length)].x;
}

function loadZones() {
  const saved = readSaved(KEY);
  if (saved && Array.isArray(saved.zones) && Array.isArray(saved.pending)) return saved;
  return null;
}

export function createFishZones(startedAt) {
  const spots = [];
  const pending = [];
  const heading = new Map();
  let nextId = 0;
  let snap = (point) => point;

  const berths = () => spots.flatMap((spot) => spot.berths);
  const zoneCount = () => spots.reduce((count, spot) => count + (spot.fish > 0 ? 1 : 0), 0);
  const busy = (spot) => spot.berths.some((berth) => berth.who) || [...heading.values()].some((berth) => berth.spot === spot);

  function fit(berth) {
    berth.stand = snap(berth.stand);
    berth.facing = facingOf(berth.stand, berth.float);
  }

  function addSpot(x, fish, until) {
    const stand = standAt(x);
    const float = floatAt(x);
    const spot = { id: nextId++, x, stand, float, facing: facingOf(stand, float), berths: [], fish, until, jumpAt: 0, rippleAt: 0 };
    spot.berths = [-BERTH_GAP, 0, BERTH_GAP]
      .map((dx) => x + dx)
      .filter(clearOfDock)
      .map((bx) => ({ stand: standAt(bx), float: floatAt(bx), facing: 0, who: null, spot }));
    for (const berth of spot.berths) fit(berth);
    spots.push(spot);
  }

  function openZone(minutes) {
    if (zoneCount() >= FISHING.zones) return;
    addSpot(randomBankX(), randomInt(FISHING.zoneFish), minutes + randomInt(FISHING.zoneLife));
  }

  function save() {
    const zones = spots.filter((spot) => spot.fish > 0).map((spot) => [spot.x, spot.fish, spot.until]);
    try {
      writeGameItem(KEY, JSON.stringify({ zones, pending }));
    } catch {}
  }

  const saved = loadZones();
  if (saved) {
    for (const zone of saved.zones) {
      if (!Array.isArray(zone) || zoneCount() >= FISHING.zones) continue;
      const [x, fish, until] = zone;
      if (!Number.isFinite(x) || !onBank(x) || !Number.isFinite(fish) || fish < 1) continue;
      addSpot(x, Math.floor(fish), Number.isFinite(until) ? until : startedAt + randomInt(FISHING.zoneLife));
    }
    pending.push(...saved.pending.filter(Number.isFinite).sort((a, b) => a - b).slice(0, Math.max(0, FISHING.zones - zoneCount())));
  } else {
    for (let i = 0; i < FISHING.zones; i++) openZone(startedAt);
    save();
  }

  function refill(minutes) {
    let changed = false;
    for (const spot of [...spots]) {
      if ((spot.fish > 0 && spot.until > minutes) || busy(spot)) continue;
      const expired = spot.fish > 0;
      spots.splice(spots.indexOf(spot), 1);
      if (expired) openZone(minutes);
      changed = true;
    }
    while (pending.length && pending[0] <= minutes) {
      pending.shift();
      openZone(minutes);
      changed = true;
    }
    while (zoneCount() + pending.length < FISHING.zones) {
      pending.push(minutes + randomInt(FISHING.zoneRespawn));
      pending.sort((a, b) => a - b);
      changed = true;
    }
    if (changed) save();
  }

  const expected = (who) => [...berths().filter((item) => item.who && item.who !== who), ...[...heading].filter(([other]) => other !== who).map(([, berth]) => berth)];
  const crowdAt = (point, who) => expected(who).filter((item) => gap(item.stand, point) < CROWD_RADIUS).length;

  function freeBerth(spot, who, point) {
    const others = expected(who);
    let best = null;
    let bestScore = -Infinity;
    for (const item of spot.berths) {
      if (item.who && item.who !== who) continue;
      let room = SPREAD;
      for (const other of others) room = Math.min(room, gap(item.stand, other.stand));
      const score = room - (point ? gap(item.stand, point) * 0.1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return best;
  }

  const release = (who) => {
    for (const item of berths()) if (item.who === who) item.who = null;
  };

  return {
    spots,
    setSnap(fn) {
      snap = fn;
      for (const berth of berths()) fit(berth);
    },
    refill,
    hasFish(spot) {
      return spot.fish > 0;
    },
    get hasRoom() {
      return spots.some((spot) => spot.fish > 0 && spot.berths.some((item) => !item.who));
    },
    get anglers() {
      return berths().filter((item) => item.who).length + heading.size;
    },
    nearestFish(point, radius) {
      let best = null;
      let bestD = radius;
      for (const spot of spots) {
        if (spot.fish <= 0) continue;
        const d = gap(spot.float, point);
        if (d < bestD) {
          bestD = d;
          best = spot;
        }
      }
      return best;
    },
    pick(point, who) {
      let best = null;
      let bestScore = Infinity;
      for (const spot of spots) {
        if (spot.fish <= 0) continue;
        const berth = freeBerth(spot, who, point);
        if (!berth) continue;
        const score = gap(berth.stand, point) + crowdAt(berth.stand, who) * CROWD_PENALTY;
        if (score < bestScore) {
          bestScore = score;
          best = berth;
        }
      }
      return best;
    },
    berthFor(who, spot, point) {
      return freeBerth(spot, who, point);
    },
    aim(who, berth) {
      release(who);
      heading.set(who, berth);
      return berth;
    },
    hold(who, berth) {
      if (berth.who && berth.who !== who) return false;
      heading.delete(who);
      release(who);
      berth.who = who;
      return true;
    },
    leave(who) {
      heading.delete(who);
      release(who);
    },
    take(spot) {
      if (spot.fish <= 0) return false;
      spot.fish -= 1;
      save();
      return true;
    },
    rollFish(minutes) {
      const t = minuteOfDay(minutes);
      const night = t >= 1140 || t < 300;
      const entries = Object.entries(FISH).map(([id, fish]) => [id, fish.weight * (night && (id === 'catfish' || id === 'snakehead') ? 1.8 : 1)]);
      let r = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
      for (const [id, w] of entries) if ((r -= w) <= 0) return id;
      return entries[0][0];
    },
  };
}
