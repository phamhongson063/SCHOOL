import * as THREE from 'three';
import { HUNTING, PRAYER } from './config.js';
import { MOUNTAIN, PAGODA, createMountainScenery, terrainHeight } from './terrain.js';
import { createWildlife } from './wildlife.js';
import { dailyMark } from './daily.js';
import { hasModel } from './characterModels.js';
import { keeperNPC } from './village.js';

const PRAYER_KEY = 'truong-lang-xua.prayedDay';
const MONKS = [
  { name: 'Sư cụ', model: 'monk', dx: -2.3, dz: 3.4, turn: 0.35 },
  { name: 'Sư ông', model: 'monk-brown', dx: 2.3, dz: 3.4, turn: -0.35 },
];
const MONK_GREETINGS = ['A Di Đà Phật!', 'Mô Phật, thí chủ lên chùa lễ Phật à?', 'Nam mô A Di Đà Phật.'];
const MONK_DISTANCE = 60;

export function createMountain({ nav, purse, quiz, player, say, day, onBoarHit }) {
  const scenery = createMountainScenery();
  const wildlife = createWildlife({ nav, onBoarHit });
  const group = new THREE.Group();
  group.add(scenery.group, wildlife.group);
  let busy = false;
  let clock = 0;
  const monks = MONKS.filter((spec) => hasModel(spec.model)).map((spec, i) => {
    const npc = keeperNPC({}, spec.model);
    const x = PAGODA.x + spec.dx;
    const z = PAGODA.z + spec.dz;
    npc.walker.group.position.set(x, terrainHeight(x, z), z);
    npc.walker.group.rotation.y = spec.turn;
    group.add(npc.walker.group);
    return { ...npc, name: spec.name, phase: i * 2.1 };
  });
  const monkOf = (object) => monks.find((monk) => {
    for (let node = object; node; node = node.parent) if (node === monk.walker.group) return true;
    return false;
  });
  const prayer = dailyMark(PRAYER_KEY);

  function pray() {
    if (prayer.done(day())) return 'Hôm nay đã thắp hương rồi.';
    prayer.mark(day());
    purse.shiftEnergy(PRAYER.energy);
    return `🙏 Thắp nén hương, lòng nhẹ nhõm. +${PRAYER.energy} sức`;
  }

  function catchAnimal(animal) {
    if (busy || quiz.open) return null;
    if (!wildlife.reachable(animal, player.position)) return animal.state === 'flee' || animal.state === 'gone' ? 'Nó chạy mất rồi!' : 'Xa quá, lại gần thêm chút!';
    if (!purse.spendEnergy(HUNTING.energy)) return 'Mệt quá, không đuổi nổi nữa!';
    busy = true;
    wildlife.freeze(animal);
    player.faceToward(animal.x, animal.z);
    const name = animal.spec.name;
    quiz.ask({ icon: animal.spec.icon }).then(({ correct }) => {
      busy = false;
      if (correct && animal.state === 'frozen') {
        purse.add(wildlife.capture(animal), 1);
        say(`🎯 Bắt được ${name}! +1`, 2);
        return;
      }
      wildlife.scare(animal, player.position);
      say('Sổng mất rồi!', 2);
    });
    return null;
  }

  return {
    wildlife,
    update(dt, options) {
      clock += dt;
      for (const monk of monks) {
        const near = options.camera.position.distanceTo(monk.walker.group.position) < MONK_DISTANCE;
        monk.walker.group.visible = near;
        if (!near) continue;
        monk.bubble.update(clock);
        monk.walker.head.rotation.y = Math.sin(clock * 0.4 + monk.phase) * 0.4;
        monk.walker.head.rotation.x = 0.05 + Math.sin(clock * 0.7 + monk.phase) * 0.04;
        monk.walker.pose?.();
      }
      scenery.update(dt);
      wildlife.update(dt, player, options);
    },
    region() {
      return {
        id: 'mountain',
        name: 'Núi',
        bounds: MOUNTAIN,
        pinned: true,
        staticNav: true,
        target(hit) {
          if (hit.object === scenery.pagoda) return { kind: 'pagoda', index: 'pagoda', x: PAGODA.x, z: PAGODA.z, stand: PAGODA.stand };
          const monk = monkOf(hit.object);
          if (monk) return { kind: 'pagoda', monk, index: `monk:${monk.name}`, x: PAGODA.x, z: PAGODA.z, stand: PAGODA.stand };
          const animal = wildlife.animalOf(hit.object);
          if (!animal?.spec.gentle) return null;
          const stand = wildlife.standFor(animal, player.position);
          return { kind: 'animal', animal, index: `animal:${animal.mesh.id}`, x: animal.x, z: animal.z, stand };
        },
        actionFor() {
          return { id: 'catch', hint: 'hand' };
        },
        labelOf(target) {
          if (target.monk) return target.monk.name;
          return target.kind === 'pagoda' ? 'Chùa Núi' : target.animal.spec.name;
        },
        topOf(target) {
          if (target.kind === 'pagoda') return new THREE.Vector3(PAGODA.x, terrainHeight(PAGODA.x, PAGODA.z) + 7, PAGODA.z);
          return new THREE.Vector3(target.animal.x, target.animal.y + 1.3, target.animal.z);
        },
        act(action, target) {
          if (target.monk) target.monk.bubble.show(MONK_GREETINGS[Math.floor(Math.random() * MONK_GREETINGS.length)], 2.4, clock);
          return target.kind === 'pagoda' ? pray() : catchAnimal(target.animal);
        },
        load() {
          return { group, clickables: [scenery.ground, scenery.pagoda, ...monks.map((monk) => monk.walker.group), ...wildlife.clickables], obstacles: [] };
        },
      };
    },
  };
}
