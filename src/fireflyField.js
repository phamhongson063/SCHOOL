import { FIREFLY } from './config.js';
import { between } from './random.js';

const SAFE_SPAWN = 8;
const HAND_HEIGHT = 0.8;
const HAND_REACH = 1.2;
const MAX_SWEEP = 4;

function gapToPath(fly, from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = dx * dx + dz * dz;
  const k = length > 0 ? Math.min(1, Math.max(0, ((fly.x - from.x) * dx + (fly.z - from.z) * dz) / length)) : 0;
  return Math.hypot(fly.x - (from.x + dx * k), fly.z - (from.z + dz * k));
}

export function createFireflyField({ ground }) {
  const count = Math.round(FIREFLY.density * ground.area);
  const claims = new Map();
  let now = 0;

  function randomHome(avoid) {
    const spot = ground.pick(Math.random, (x, z) => !avoid || Math.hypot(x - avoid.x, z - avoid.z) >= SAFE_SPAWN);
    return spot ? { x: spot.x, y: spot.y + between(0.55, 1.5), z: spot.z } : null;
  }

  const flies = Array.from({ length: count }, () => ({
    home: randomHome(null),
    rate: between(1.4, 3.2),
    phase: Math.random() * Math.PI * 2,
    drift: [between(0.2, 0.5), between(0.3, 0.7), between(0.2, 0.5)],
    reach: between(0.5, 1.2),
    respawnAt: 0,
    x: 0,
    y: 0,
    z: 0,
  }));

  function place(fly) {
    const [a, b, c] = fly.drift;
    fly.x = fly.home.x + Math.sin(now * a + fly.phase) * fly.reach;
    fly.y = fly.home.y + Math.sin(now * b + fly.phase * 1.7) * 0.3;
    fly.z = fly.home.z + Math.cos(now * c + fly.phase * 0.6) * fly.reach;
  }

  function take(fly) {
    fly.home = null;
    fly.respawnAt = now + between(...FIREFLY.respawn);
    for (const [who, claimed] of claims) if (claimed === fly) claims.delete(who);
  }

  function nearest(point, who) {
    const taken = new Set([...claims].filter(([other]) => other !== who).map(([, fly]) => fly));
    let best = null;
    let bestDistance = Infinity;
    for (const fly of flies) {
      if (!fly.home || taken.has(fly)) continue;
      const distance = Math.hypot(fly.x - point.x, fly.z - point.z);
      if (distance < bestDistance) {
        best = fly;
        bestDistance = distance;
      }
    }
    return best;
  }

  return {
    flies,
    density: ground.area > 0 ? count / ground.area : 0,
    step(t, avoid) {
      now = t;
      for (const fly of flies) {
        if (!fly.home && t >= fly.respawnAt) fly.home = randomHome(avoid);
        if (fly.home) place(fly);
      }
    },
    catchAlong(start, to = start) {
      const from = Math.hypot(to.x - start.x, to.z - start.z) > MAX_SWEEP ? to : start;
      let caught = 0;
      for (const fly of flies) {
        if (!fly.home || Math.abs(fly.y - (to.y + HAND_HEIGHT)) >= HAND_REACH || gapToPath(fly, from, to) >= FIREFLY.catchRadius) continue;
        take(fly);
        caught += 1;
      }
      return caught;
    },
    nearest,
    claim(who, point) {
      claims.delete(who);
      const fly = nearest(point, who);
      if (fly) claims.set(who, fly);
      return fly;
    },
    claimOf(who) {
      const fly = claims.get(who);
      return fly?.home ? fly : null;
    },
    release(who) {
      claims.delete(who);
    },
  };
}
