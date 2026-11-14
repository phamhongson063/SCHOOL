const HOLD_MARGIN = 10;
const HOLD_SLACK = 2.5;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function lineSlots({ x, z }, facing, rows) {
  const ahead = { x: Math.sin(facing), z: Math.cos(facing) };
  const side = { x: ahead.z, z: -ahead.x };
  return rows.map(({ reach, offsets }) => offsets.map((offset) => ({ x: x + ahead.x * reach + side.x * offset, z: z + ahead.z * reach + side.z * offset })));
}

export function arcSlots({ x, z }, facing, rows) {
  return rows.map(({ radius, angles }) => angles.map((angle) => ({ x: x + Math.sin(facing + angle) * radius, z: z + Math.cos(facing + angle) * radius })));
}

export function inSector({ x, z }, facing, { radius, spread }, px, pz) {
  const dx = px - x;
  const dz = pz - z;
  if (Math.hypot(dx, dz) > radius) return false;
  return Math.abs(wrapAngle(Math.atan2(dx, dz) - facing)) <= spread;
}

export function claimHold(from, to, speed) {
  return (Math.hypot(to.x - from.x, to.z - from.z) / Math.max(0.6, speed)) * HOLD_SLACK + HOLD_MARGIN;
}

export function createSlotClaims(rows) {
  const claims = new Map();
  const taken = (slot, now) => (claims.get(slot)?.until ?? -Infinity) > now;
  const release = (id) => {
    for (const [slot, claim] of claims) if (claim.id === id) claims.delete(slot);
  };
  return {
    claim(id, now, hold) {
      release(id);
      const row = rows.find((list) => list.some((slot) => !taken(slot, now)));
      if (!row) {
        const back = rows[rows.length - 1];
        return back[Math.floor(Math.random() * back.length)];
      }
      const free = row.filter((slot) => !taken(slot, now));
      const slot = free[Math.floor(Math.random() * free.length)];
      claims.set(slot, { id, until: now + hold });
      return slot;
    },
    release,
  };
}
