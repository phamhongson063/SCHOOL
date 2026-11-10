import * as THREE from 'three';
import { HUNTING, MOVE, PRAYER } from './config.js';
import { HERMITAGE, MOUNTAIN, PAGODA, createMountainScenery, terrainHeight } from './terrain.js';
import { createPagodaHalo } from './pagodaHalo.js';
import { Gait } from './gait.js';
import { createWildlife } from './wildlife.js';
import { dailyMark } from './daily.js';
import { hasModel } from './characterModels.js';
import { keeperNPC } from './village.js';

const PRAYER_KEY = 'truong-lang-xua.prayedDay';
const MONKS = [
  { name: 'Sư cụ', model: 'monk', dx: -1.6, dz: 2.7, turn: 0.15 },
  { name: 'Sư ông', model: 'monk-brown', dx: 1.6, dz: 2.7, turn: -0.15 },
];
const MONK_GREETINGS = ['A Di Đà Phật!', 'Mô Phật, thí chủ lên chùa lễ Phật à?', 'Nam mô A Di Đà Phật.'];
const MONK_DISTANCE = 60;
const MONK_WALK = { speed: MOVE.walk, turn: 6, stagger: 1.6, arrive: 0.05 };
const PLATFORM_HALF = 3.2;

function monkRoute(spec) {
  const side = Math.sign(spec.dx);
  const lane = PAGODA.half + 1.9;
  const front = PAGODA.z + 3.7;
  const back = PAGODA.z - 4.6;
  return [
    [PAGODA.x + spec.dx, PAGODA.z + spec.dz],
    [PAGODA.x + spec.dx, front],
    [PAGODA.x + side * lane, front],
    [PAGODA.x + side * lane, back],
    [HERMITAGE.door.x + side * 0.3, back],
    [HERMITAGE.door.x + side * 0.3, HERMITAGE.door.z],
  ].map(([x, z]) => ({ x, z }));
}

function monkGround(x, z) {
  const onPlatform = Math.abs(x - PAGODA.x) < PLATFORM_HALF && Math.abs(z - PAGODA.z) < PLATFORM_HALF;
  return onPlatform ? terrainHeight(PAGODA.x, PAGODA.z) + PAGODA.porch : terrainHeight(x, z);
}

export function createMountain({ nav, stepSound = null, purse, quiz, player, say, day, onBoarHit }) {
  const scenery = createMountainScenery();
  const wildlife = createWildlife({ nav, onBoarHit });
  const group = new THREE.Group();
  const halo = createPagodaHalo({ x: PAGODA.x, z: PAGODA.z, ground: terrainHeight(PAGODA.x, PAGODA.z) });
  group.add(scenery.group, wildlife.group, halo.group);
  let busy = false;
  let clock = 0;
  const monks = MONKS.filter((spec) => hasModel(spec.model)).map((spec, i) => {
    const npc = keeperNPC({}, spec.model);
    const route = monkRoute(spec);
    const position = new THREE.Vector3(route[0].x, monkGround(route[0].x, route[0].z), route[0].z);
    npc.walker.group.position.copy(position);
    npc.walker.group.rotation.y = spec.turn;
    group.add(npc.walker.group);
    return {
      ...npc,
      name: spec.name,
      phase: i * 2.1,
      spec,
      route,
      position,
      facing: spec.turn,
      gait: new Gait({ stride: 0.55, armSwing: 0.35, bounce: 0.6 }),
      mode: null,
      leg: 0,
      dir: 1,
      delay: 0,
      speed: 0,
      stagger: i * MONK_WALK.stagger,
    };
  });

  function placeMonk(monk, point) {
    monk.position.set(point.x, monkGround(point.x, point.z), point.z);
  }

  function steerMonk(monk, rest, dt) {
    const last = monk.route.length - 1;
    if (monk.mode === null) {
      monk.mode = rest ? 'inside' : 'day';
      placeMonk(monk, monk.route[rest ? last : 0]);
    }
    if (monk.mode === 'day' && rest) Object.assign(monk, { mode: 'walk', dir: 1, leg: 1, delay: monk.stagger });
    else if (monk.mode === 'inside' && !rest) Object.assign(monk, { mode: 'walk', dir: -1, leg: last - 1, delay: monk.stagger });
    monk.speed = 0;
    if (monk.mode !== 'walk') return;
    const dir = rest ? 1 : -1;
    if (dir !== monk.dir) {
      monk.leg += dir;
      monk.dir = dir;
    }
    if (monk.delay > 0) {
      monk.delay -= dt;
      return;
    }
    const goal = monk.route[monk.leg];
    const dx = goal.x - monk.position.x;
    const dz = goal.z - monk.position.z;
    const gap = Math.hypot(dx, dz);
    if (gap < MONK_WALK.arrive) {
      monk.leg += monk.dir;
      if (monk.leg < 0 || monk.leg > last) {
        monk.mode = monk.dir > 0 ? 'inside' : 'day';
        placeMonk(monk, monk.route[monk.dir > 0 ? last : 0]);
      }
      return;
    }
    const stride = Math.min(gap, MONK_WALK.speed * dt);
    monk.position.x += (dx / gap) * stride;
    monk.position.z += (dz / gap) * stride;
    monk.speed = MONK_WALK.speed;
    const ground = monkGround(monk.position.x, monk.position.z);
    monk.position.y += (ground - monk.position.y) * (1 - Math.exp(-12 * dt));
    const want = Math.atan2(dx, dz);
    const turn = Math.atan2(Math.sin(want - monk.facing), Math.cos(want - monk.facing));
    monk.facing += turn * (1 - Math.exp(-MONK_WALK.turn * dt));
  }

  function settleFacing(monk, dt) {
    if (monk.mode !== 'day') return;
    const turn = Math.atan2(Math.sin(monk.spec.turn - monk.facing), Math.cos(monk.spec.turn - monk.facing));
    monk.facing += turn * (1 - Math.exp(-3 * dt));
  }
  const monkOf = (object) => monks.find((monk) => {
    for (let node = object; node; node = node.parent) if (node === monk.walker.group) return true;
    return false;
  });
  const prayer = dailyMark(PRAYER_KEY);
  const incenseTop = new THREE.Box3().setFromObject(scenery.incense).max.y;

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
    quiz.ask({ icon: animal.spec.icon, quick: true }).then(({ correct }) => {
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
    moving() {
      return monks.some((monk) => monk.speed > 0 && monk.walker.group.visible);
    },
    update(dt, options) {
      clock += dt;
      for (const monk of monks) {
        steerMonk(monk, options.rest, dt);
        settleFacing(monk, dt);
        const w = monk.walker;
        const near = monk.mode !== 'inside' && options.camera.position.distanceTo(monk.position) < MONK_DISTANCE;
        w.group.visible = near;
        if (!near) {
          w.group.position.copy(monk.position);
          continue;
        }
        monk.bubble.update(clock);
        const g = monk.gait.update(w, monk.speed, dt, true);
        if (g.step) stepSound?.play(false, monk.position.x, monk.position.y, monk.position.z, true);
        w.group.position.set(monk.position.x, monk.position.y + g.bob, monk.position.z);
        w.group.rotation.set(g.lean, monk.facing, 0);
        const idle = monk.speed === 0;
        w.head.rotation.y = idle ? Math.sin(clock * 0.4 + monk.phase) * 0.4 : 0;
        w.head.rotation.x = idle ? 0.05 + Math.sin(clock * 0.7 + monk.phase) * 0.04 : 0.05;
        w.pose?.();
      }
      halo.update(dt, options);
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
          if (hit.object === scenery.incense) return { kind: 'incense', index: 'incense', x: PAGODA.urn.x, z: PAGODA.urn.z, stand: PAGODA.stand };
          const monk = monkOf(hit.object);
          if (monk?.mode === 'inside') return null;
          if (monk) return { kind: 'monk', monk, index: `monk:${monk.name}`, x: PAGODA.x, z: PAGODA.z, stand: PAGODA.stand };
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
          return target.kind === 'incense' ? 'Lư hương' : target.animal.spec.name;
        },
        topOf(target) {
          if (target.kind === 'incense') return new THREE.Vector3(PAGODA.urn.x, incenseTop + 0.4, PAGODA.urn.z);
          if (target.kind === 'monk') return new THREE.Vector3(target.monk.position.x, target.monk.position.y + 2.3, target.monk.position.z);
          return new THREE.Vector3(target.animal.x, target.animal.y + 1.3, target.animal.z);
        },
        act(action, target) {
          if (target.monk) {
            target.monk.bubble.show(MONK_GREETINGS[Math.floor(Math.random() * MONK_GREETINGS.length)], 2.4, clock);
            return null;
          }
          return target.kind === 'incense' ? pray() : catchAnimal(target.animal);
        },
        load() {
          return { group, clickables: [scenery.ground, scenery.pagoda, scenery.incense, scenery.hermitage, ...monks.map((monk) => monk.walker.group), ...wildlife.clickables], obstacles: [] };
        },
      };
    },
  };
}
