export const SQUEEZE = { spacing: 0.4, room: 0.9, probe: 1, step: 0.1, hold: 1, turn: 1.25, pace: 0.55, ease: 10 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function squeezePast(body, other) {
  if (!(body.squeezeLeft > 0)) {
    const p = body.position;
    body.squeezeSide = wrap(Math.atan2(other.x - p.x, other.z - p.z) - body.facing) >= 0 ? 1 : -1;
  }
  body.squeezeLeft = SQUEEZE.hold;
}

export function squeezeTurn(body, dt) {
  const target = body.squeezeLeft > 0 ? body.squeezeSide * SQUEEZE.turn : 0;
  const yaw = body.squeezeYaw ?? 0;
  body.squeezeYaw = yaw + (target - yaw) * (1 - Math.exp(-SQUEEZE.ease * dt));
  return body.squeezeYaw;
}
