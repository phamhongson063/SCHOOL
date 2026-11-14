import * as THREE from 'three';
import { Batch, shapes, toonMaterial } from './toon.js';
import { GILT, JADE, LACQUER, MARBLE, additive, motes, runeTexture, swirlTexture } from './arenaIsland.js';

const RING = { radius: 1.85, tube: 0.32, lift: 0.35 };
const SCALE = 0.6;
const PLACE = { front: 5.2, ahead: 1.3, side: 4.9 };
const WALK_OUT = 1.9;
const STAND = 1.7;
const OPEN_RATE = 2.4;
const CLOSE_RATE = 1.6;

const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

export function gateSpot(desk) {
  const out = desk.out;
  const x = desk.at.x + out * PLACE.side;
  const z = desk.at.z + out * (PLACE.front + PLACE.ahead);
  return {
    x,
    z,
    out,
    look: { x: desk.at.x, z: desk.at.z },
    inside: { x, z: z - out * 0.2 },
    exit: { x, z: z + out * WALK_OUT },
    stand: { x, z: z + out * STAND },
  };
}

function frameMesh() {
  const b = new Batch();
  const gx = RING.radius + RING.tube;
  const y = RING.radius + RING.lift;
  b.add(shapes.torus(RING.radius, RING.tube, 40), MARBLE, { p: [0, y, 0] });
  b.add(shapes.torus(RING.radius + RING.tube * 0.9, 0.06, 40), GILT, { p: [0, y, 0] });
  b.add(shapes.box(gx * 2 + 0.8, 0.3, 1), MARBLE, { p: [0, 0.15, 0] });
  for (const side of [-1, 1]) {
    b.add(shapes.box(0.7, 0.9, 0.9), MARBLE, { p: [side * gx, 0.55, 0] });
    b.add(shapes.cone(0.32, 0.6, 8), JADE, { p: [side * gx, 1.3, 0] });
  }
  b.add(shapes.box(gx * 2 + 1.6, 0.16, 1.3), LACQUER, { p: [0, RING.radius * 2 + 0.9, 0] });
  b.add(shapes.box(gx * 2 + 2.2, 0.1, 1.5), JADE, { p: [0, RING.radius * 2 + 1.04, 0] });
  return b.mesh(toonMaterial({ vertexColors: true, emissive: 0x2c2e34 }));
}

export function createTownGate({ desk, isOpen = () => false, onEnter = () => null }) {
  const spot = gateSpot(desk);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.position.set(spot.x, 0, spot.z);
  group.rotation.y = spot.out > 0 ? 0 : Math.PI;
  group.add(body);
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(RING.radius - 0.05, 40), additive({ map: swirlTexture(), opacity: 0.9 }));
  vortex.position.set(0, RING.radius + RING.lift, 0);
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), additive({ map: runeTexture(), opacity: 0.75 }));
  runes.rotation.x = -Math.PI / 2;
  runes.position.set(0, 0.03, 2.2);
  const sparks = motes(40, 1.6, 0.2, 5, 0xbfe8ff, 0.3, 77);
  body.add(frameMesh(), vortex, runes, sparks.points);
  const clickables = [];
  let level = 0;

  function scaleBody() {
    const s = SCALE * Math.max(0.001, easeOutBack(level));
    body.scale.set(s, s, s);
  }
  scaleBody();

  return {
    spot,
    burst() {
      level = 0;
      scaleBody();
    },
    region: {
      id: 'arenaGate',
      name: 'Cổng truyền tống',
      bounds: { x0: spot.x - 3, z0: spot.z - 2, x1: spot.x + 3, z1: spot.z + 3 },
      staticNav: true,
      shown: () => level > 0.01,
      target(hit) {
        if (!clickables.includes(hit.object)) return null;
        return { kind: 'gate', id: 'gate', index: 'gate', x: spot.x, z: spot.z, stand: spot.stand };
      },
      actionFor() {
        return { id: 'visit', hint: 'hand' };
      },
      topOf() {
        return new THREE.Vector3(spot.x, (RING.radius * 2 + 1.6) * SCALE, spot.z);
      },
      act() {
        return onEnter();
      },
      load() {
        return {
          group,
          clickables,
          update(t, dt = 0) {
            const open = isOpen();
            level = open ? Math.min(1, level + dt * OPEN_RATE) : Math.max(0, level - dt * CLOSE_RATE);
            scaleBody();
            const ready = open && level > 0.5;
            if (ready && !clickables.length) clickables.push(vortex, runes);
            else if (!ready && clickables.length) clickables.length = 0;
            vortex.rotation.z = -t * 1.4;
            runes.rotation.z = t * 0.35;
            sparks.update(dt);
          },
        };
      },
    },
  };
}
