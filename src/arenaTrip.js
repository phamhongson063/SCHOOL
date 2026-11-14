import * as THREE from 'three';
import { ARRIVAL, ISLAND, SPECTATORS, STAGES, aislePath, crowdSpot, fighterSpot, lineupSpot, onIsland, stageOf, wander } from './arenaIsland.js';
import { PLAYER } from './inventory.js';
import { calledUp, onStage } from './arenaReplay.js';
import { roundName } from './arena.js';
import { clockText } from './clock.js';

const HOME_DELAY = 8;
const IDLE = [4, 11];
const CHEERS = ['Hay!', 'Đẹp!', 'Tuyệt!', '👏', '🔥', 'Ồ!', 'Cố lên!'];
const CHEER_REACH = 22;
const CHEER_CHANCE = 0.35;
const HOME_WARP = 0xffe6a8;
const HOMECOMING = { reach: 5.2, delay: 1.2, stagger: 0.18, linger: [2, 3.5] };
const CROWD = { step: 0.5, gap: 1, clearOfPlayer: 1.2, near: { side: 5, from: 1.4, to: 4.4 }, wide: { side: 8, from: 1, to: 7 } };
const SUMMON_WARP = 0xffe08a;
const EMERGE_DELAY = 0.9;
const PACE = { in: 1.25, out: 0.8 };
const SETTLED = { reach: 0.8, speed: 0.1 };

const between = (a, b) => a + Math.random() * (b - a);
const facingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

function stageSpots(event, now) {
  const spots = new Map();
  const slots = new Map();
  const busy = [];
  const round = event.rounds[event.round];
  if (!round) return { spots, slots, busy };
  round.forEach((match, index) => {
    if (!onStage(match, now)) return;
    for (const side of ['a', 'b']) {
      spots.set(match[side], fighterSpot(round.length, index, side));
      slots.set(match[side], lineupSpot(round.length, index, side));
    }
    busy.push(stageOf(round.length, index));
  });
  return { spots, slots, busy };
}

function lineupOf(event, now) {
  const lineup = new Map();
  for (const [id, call] of calledUp(event, now)) lineup.set(id, lineupSpot(call.count, call.index, call.side));
  return lineup;
}

function nearest(list, from) {
  let best = null;
  let gap = Infinity;
  for (const item of list) {
    const d = Math.hypot(item.x - from.x, item.z - from.z);
    if (d < gap) {
      gap = d;
      best = item;
    }
  }
  return best;
}

export function createArenaTrip({ arena, player, town, busy = () => false, say = null, warp = null, summon = null, gate = null, wake = null }) {
  const where = new Map();
  const lives = new Map();
  const fought = new Map();
  let walkIn = null;
  let backAt = null;
  let pulledFor = null;
  let wantUp = false;
  let homeAt = null;
  let fighting = false;
  let goingHome = false;
  let exit = null;
  let emerge = null;
  let clockNow = 0;
  let clockT = 0;

  const playerHere = () => onIsland(player.position);

  function ready() {
    if (busy()) return false;
    if (player.lying) {
      player.getUp();
      return false;
    }
    if (player.posture !== 'free') {
      player.standUp();
      return false;
    }
    return true;
  }

  function placePlayer(spot) {
    player.clearPath();
    player.place(new THREE.Vector3(spot.x, spot.y, spot.z), spot.facing + Math.PI);
    player.facing = spot.facing;
  }

  function walkPlayer(spot) {
    player.requestMove(new THREE.Vector3(spot.x, 0, spot.z), true);
  }

  function summonLines() {
    const event = arena.event;
    const live = arena.liveMatch(PLAYER);
    const round = event?.rounds[event.round];
    const stage = live && round ? roundName(round.length) : event?.round < 0 ? roundName(event.rounds[0].length) : 'Lôi đài';
    return ['Triệu tập Bạn lên Lôi Đài', `${event ? `Lôi đài ${clockText(event.at)} · ` : ''}${stage}`, live ? 'Tới lượt ngươi xuất chiến!' : 'Khai mạc tranh tài, chớ chậm trễ!'];
  }

  function teleport(ceremony, lines, move) {
    if (!summon) {
      move();
      return;
    }
    summon.run({ ceremony, lines }, move);
  }

  function goUp(ceremony = true) {
    if (ceremony) wake?.();
    if (summon?.busy || !ready()) return false;
    wantUp = false;
    goingHome = false;
    teleport(ceremony, ceremony ? summonLines() : [], () => {
      arena.back(PLAYER);
      placePlayer(ARRIVAL);
      warp?.(ARRIVAL, SUMMON_WARP, 1.8);
      say?.('⚔️ Đã tới Lôi Đài!');
    });
    return true;
  }

  function stepOut() {
    const { inside, exit: out, look } = gate.spot;
    const y = town.nav.heightAt(inside.x, inside.z) ?? 0;
    player.place(new THREE.Vector3(inside.x, y, inside.z), facingTo(look, inside));
    player.facing = facingTo(inside, out);
    player.cloak(true);
    gate.burst();
    emerge = { at: clockT + EMERGE_DELAY, out };
  }

  function goDown(byGate = false) {
    if (summon?.busy || !ready()) return false;
    const spot = homeSpot();
    goingHome = arena.event?.phase !== 'running';
    teleport(false, [], () => {
      homeAt = null;
      fighting = false;
      if (byGate && gate && arena.event?.phase === 'running') {
        arena.leave(PLAYER, clockNow);
        stepOut();
        return;
      }
      const y = spot.y ?? town.nav.heightAt(spot.x, spot.z) ?? 0;
      player.clearPath();
      player.place(new THREE.Vector3(spot.x, y, spot.z), spot.yaw);
      warp?.({ x: spot.x, y, z: spot.z }, HOME_WARP, 1.2);
    });
    return true;
  }

  function finishEmerge(t) {
    if (!emerge || t < emerge.at) return;
    const { out } = emerge;
    emerge = null;
    player.cloak(false);
    player.requestMove(new THREE.Vector3(out.x, 0, out.z));
  }

  function deskFrame() {
    const desk = town.arenaDesk;
    return desk ? { x: desk.at.x, z: desk.at.z, out: desk.out } : { x: player.spawn.x, z: player.spawn.z, out: 1 };
  }

  function freeSpot(x, z) {
    const nav = town.nav;
    if (nav.bodyClear(x, z)) return { x, z };
    const cell = nav.nearest(x, z, 8);
    return cell < 0 ? { x, z } : nav.center(cell);
  }

  function homeSpot() {
    const desk = deskFrame();
    const spot = freeSpot(desk.x, desk.z + desk.out * HOMECOMING.reach);
    return { x: spot.x, z: spot.z, yaw: desk.out > 0 ? 0 : Math.PI };
  }

  function openGround(area, desk, home) {
    const nav = town.nav;
    const homeCell = nav.cellIndex(home.x, home.z);
    const reach = homeCell >= 0 ? nav.components[homeCell] : -1;
    const spots = [];
    for (let dz = area.from; dz <= area.to; dz += CROWD.step) {
      for (let dx = -area.side; dx <= area.side; dx += CROWD.step) {
        const x = desk.x + dx;
        const z = desk.z + desk.out * dz;
        if (Math.hypot(x - home.x, z - home.z) < CROWD.clearOfPlayer || !nav.bodyClear(x, z)) continue;
        const cell = nav.cellIndex(x, z);
        if (reach >= 0 && nav.components[cell] !== reach) continue;
        spots.push({ x, z });
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    return spots;
  }

  function crowdSpots(count) {
    const desk = deskFrame();
    const home = homeSpot();
    const picked = [];
    for (const area of [CROWD.near, CROWD.wide]) {
      for (const spot of openGround(area, desk, home)) {
        if (picked.length >= count) break;
        if (picked.some((other) => Math.hypot(other.x - spot.x, other.z - spot.z) < CROWD.gap)) continue;
        picked.push(spot);
      }
    }
    while (picked.length < count) picked.push(freeSpot(desk.x + (Math.random() - 0.5) * 4, desk.z + desk.out * 2));
    return picked.map((spot) => ({ x: spot.x, z: spot.z, facing: facingTo(spot, home) }));
  }

  function release(leaving, t) {
    if (!leaving.length) {
      exit = null;
      return;
    }
    if (!exit) {
      if (goingHome && playerHere()) return;
      exit = { at: t + (goingHome ? HOMECOMING.delay : 0), slots: new Map(), spots: crowdSpots(leaving.length) };
      goingHome = false;
    }
    for (const member of leaving) {
      if (!exit.slots.has(member.id)) exit.slots.set(member.id, exit.slots.size);
      const slot = exit.slots.get(member.id);
      if (t < exit.at + slot * HOMECOMING.stagger) continue;
      const spot = exit.spots[slot] ?? crowdSpots(1)[0];
      member.leaveArena(spot, between(...HOMECOMING.linger));
      warp?.({ x: spot.x, y: member.position.y, z: spot.z }, HOME_WARP, 0.8);
      where.delete(member.id);
      lives.delete(member.id);
      fought.delete(member.id);
    }
  }

  function settle() {
    if (!walkIn || walkIn.faced) return;
    const { spot } = walkIn;
    if (Math.hypot(player.position.x - spot.x, player.position.z - spot.z) > SETTLED.reach || player.velocity.length() > SETTLED.speed) return;
    walkIn.faced = true;
    player.facing = spot.facing;
  }

  function syncPlayer(event, running, now, t, lineup) {
    const entrant = running && event.entrants.includes(PLAYER);
    if (entrant && pulledFor !== event.at) {
      pulledFor = event.at;
      wantUp = !playerHere() && !arena.away(PLAYER);
    }
    const live = arena.liveMatch(PLAYER);
    if (live && !playerHere() && !arena.away(PLAYER)) wantUp = true;
    if (wantUp && !playerHere()) goUp();
    if (live && playerHere() && !summon?.busy) {
      const round = event.rounds[event.round];
      const index = round.indexOf(live);
      const side = live.a === PLAYER ? 'a' : 'b';
      const spot = fighterSpot(round.length, index, side);
      if (!fighting && ready()) {
        fighting = true;
        walkIn = null;
        backAt = lineupSpot(round.length, index, side);
        placePlayer(spot);
        warp?.(spot, undefined, 0.6);
      }
    } else if (fighting) {
      fighting = false;
      const back = backAt ?? ARRIVAL;
      backAt = null;
      placePlayer(back);
      warp?.(back, undefined, 0.6);
      if (playerHere() && !summon?.busy) {
        const out = crowdSpot(back);
        player.requestMove(new THREE.Vector3(out.x, 0, out.z), false);
      }
    }
    const call = lineup.get(PLAYER);
    if (call && running && playerHere() && !fighting && !summon?.busy) {
      const key = `${event.at}:${event.round}`;
      if (walkIn?.key !== key && ready()) {
        walkIn = { key, spot: call, faced: false };
        walkPlayer(call);
      }
    } else if (!call) walkIn = null;
    settle();
    if (!running && playerHere()) {
      homeAt ??= t + HOME_DELAY;
      if (t >= homeAt) goDown();
    } else homeAt = null;
  }

  function liven(member, anchor, focus, t) {
    const life = lives.get(member.id);
    if (!life || life.anchor !== anchor) {
      lives.set(member.id, { anchor, nextAt: t + between(...IDLE) });
      return;
    }
    if (!member.arenaGoal && t >= life.nextAt) {
      member.arenaGoal = wander(anchor);
      life.nextAt = t + between(...IDLE);
    }
    member.arenaFacing = facingTo(member.position, focus);
  }

  function moveVillager(member, spot, kind) {
    if (kind === 'fight') {
      member.placeArena(spot);
      warp?.(spot, undefined, 0.6);
      return;
    }
    const back = fought.get(member.id);
    if (back) {
      member.placeArena(back);
      warp?.(back, undefined, 0.6);
    }
    member.walkArena(aislePath(member.position, spot), spot.facing, kind === 'line' ? PACE.in : PACE.out);
  }

  function syncVillagers(event, running, now, t, lineup) {
    const villagers = new Map(town.members.map((member) => [member.id, member]));
    const staying = running || (event?.phase === 'done' && homeAt !== null && t < homeAt);
    const { spots, slots, busy: active } = running ? stageSpots(event, now) : { spots: new Map(), slots: new Map(), busy: [] };
    const order = event?.entrants.filter((id) => villagers.has(id)) ?? [];
    if (staying) {
      order.forEach((id, i) => {
        const member = villagers.get(id);
        const fight = spots.get(id);
        const line = lineup.get(id);
        const anchor = SPECTATORS[i % SPECTATORS.length];
        const spot = fight ?? line ?? anchor;
        const key = `${spot.x},${spot.z}`;
        if (member.state !== 'arena') {
          member.enterArena(spot);
          warp?.(spot);
        } else if (where.get(id) !== key) moveVillager(member, spot, fight ? 'fight' : line ? 'line' : 'crowd');
        where.set(id, key);
        if (fight) fought.set(id, slots.get(id));
        else fought.delete(id);
        if (!fight && !line) liven(member, anchor, nearest(active, member.position) ?? ISLAND, t);
      });
    }
    release(
      [...villagers.values()].filter((member) => member.state === 'arena' && !(staying && order.includes(member.id))),
      t,
    );
  }

  return {
    get fighting() {
      return fighting;
    },
    get here() {
      return playerHere();
    },
    get emerging() {
      return !!emerge;
    },
    returnSpot() {
      if (!playerHere()) return null;
      return homeSpot();
    },
    leave() {
      wantUp = false;
      goDown(true);
    },
    enter() {
      if (!arena.mayEnter(PLAYER)) return 'Chỉ người ghi danh mới được qua cổng.';
      if (playerHere()) return null;
      goUp(false);
      return null;
    },
    cheer(stage) {
      for (const member of town.members) {
        if (member.state !== 'arena') continue;
        if (STAGES.some((item) => Math.hypot(item.x - member.position.x, item.z - member.position.z) < item.r)) continue;
        if (Math.hypot(stage.x - member.position.x, stage.z - member.position.z) > CHEER_REACH || Math.random() > CHEER_CHANCE) continue;
        member.say(CHEERS[Math.floor(Math.random() * CHEERS.length)], 1.4);
        member.pop = 0.25;
      }
    },
    update(now, t) {
      clockNow = now;
      clockT = t;
      finishEmerge(t);
      const event = arena.event;
      const running = event?.phase === 'running';
      const lineup = running ? lineupOf(event, now) : new Map();
      if (event) syncPlayer(event, running, now, t, lineup);
      else if (playerHere()) goDown();
      syncVillagers(event, running, now, t, lineup);
    },
  };
}
