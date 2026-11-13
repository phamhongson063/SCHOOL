import * as THREE from 'three';
import { ARRIVAL, ISLAND, SPECTATORS, STAGES, fighterSpot, onIsland, stageOf, wander } from './arenaIsland.js';
import { PLAYER } from './inventory.js';
import { onStage } from './arenaReplay.js';

const HOME_DELAY = 8;
const IDLE = [4, 11];
const CHEERS = ['Hay!', 'Đẹp!', 'Tuyệt!', '👏', '🔥', 'Ồ!', 'Cố lên!'];
const CHEER_REACH = 22;
const CHEER_CHANCE = 0.35;
const HOME_WARP = 0xffe6a8;

const between = (a, b) => a + Math.random() * (b - a);
const facingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

function stageSpots(event, now) {
  const spots = new Map();
  const busy = [];
  const round = event.rounds[event.round];
  if (!round) return { spots, busy };
  round.forEach((match, index) => {
    if (!onStage(match, now)) return;
    spots.set(match.a, fighterSpot(round.length, index, 'a'));
    spots.set(match.b, fighterSpot(round.length, index, 'b'));
    busy.push(stageOf(round.length, index));
  });
  return { spots, busy };
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

export function createArenaTrip({ arena, player, town, busy = () => false, say = null, warp = null }) {
  const where = new Map();
  const lives = new Map();
  let back = null;
  let pulledFor = null;
  let wantUp = false;
  let homeAt = null;
  let fighting = false;

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
    player.place(new THREE.Vector3(spot.x, spot.y, spot.z), spot.facing + Math.PI);
    player.facing = spot.facing;
  }

  function goUp() {
    if (!ready()) return false;
    wantUp = false;
    if (!playerHere()) back = { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw };
    placePlayer(ARRIVAL);
    warp?.(ARRIVAL);
    say?.('⚔️ Truyền tống tới lôi đài!');
    return true;
  }

  function goDown() {
    if (!ready()) return false;
    const spot = back ?? deskSpot();
    back = null;
    homeAt = null;
    fighting = false;
    const y = spot.y ?? town.nav.heightAt(spot.x, spot.z) ?? 0;
    player.place(new THREE.Vector3(spot.x, y, spot.z), spot.yaw ?? 0);
    warp?.({ x: spot.x, y, z: spot.z }, HOME_WARP);
    return true;
  }

  function deskSpot() {
    const spots = town.arenaDesk?.spots;
    const spot = spots?.[Math.floor(Math.random() * spots.length)] ?? { x: player.spawn.x, z: player.spawn.z };
    return { x: spot.x, z: spot.z };
  }

  function syncPlayer(event, running, now, t) {
    const entrant = running && event.entrants.includes(PLAYER);
    if (entrant && pulledFor !== event.at) {
      pulledFor = event.at;
      wantUp = !playerHere();
    }
    const live = arena.liveMatch(PLAYER);
    if (live && !playerHere()) wantUp = true;
    if (wantUp && !playerHere()) goUp();
    if (live && playerHere()) {
      const round = event.rounds[event.round];
      const index = round.indexOf(live);
      const spot = fighterSpot(round.length, index, live.a === PLAYER ? 'a' : 'b');
      if (!fighting && ready()) {
        fighting = true;
        placePlayer(spot);
        warp?.(spot, undefined, 0.6);
      }
    } else if (fighting) {
      fighting = false;
      placePlayer(ARRIVAL);
      warp?.(ARRIVAL, undefined, 0.6);
    }
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

  function syncVillagers(event, running, now, t) {
    const villagers = new Map(town.members.map((member) => [member.id, member]));
    const staying = running || (event?.phase === 'done' && homeAt !== null && t < homeAt);
    const { spots, busy: active } = running ? stageSpots(event, now) : { spots: new Map(), busy: [] };
    const order = event?.entrants.filter((id) => villagers.has(id)) ?? [];
    if (staying) {
      order.forEach((id, i) => {
        const member = villagers.get(id);
        const fight = spots.get(id);
        const anchor = SPECTATORS[i % SPECTATORS.length];
        const spot = fight ?? anchor;
        const key = `${spot.x},${spot.z}`;
        if (member.state !== 'arena') {
          member.enterArena(spot);
          warp?.(spot);
        } else if (where.get(id) !== key) {
          member.placeArena(spot);
          warp?.(spot, undefined, 0.6);
        }
        where.set(id, key);
        if (!fight) liven(member, anchor, nearest(active, member.position) ?? ISLAND, t);
      });
    }
    for (const member of villagers.values()) {
      if (member.state !== 'arena' || (staying && order.includes(member.id))) continue;
      const spot = deskSpot();
      member.leaveArena(spot);
      warp?.({ x: spot.x, y: member.position.y, z: spot.z }, HOME_WARP, 0.8);
      where.delete(member.id);
      lives.delete(member.id);
    }
  }

  return {
    get fighting() {
      return fighting;
    },
    get here() {
      return playerHere();
    },
    returnSpot() {
      if (!playerHere()) return null;
      return back ?? deskSpot();
    },
    leave() {
      wantUp = false;
      goDown();
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
      const event = arena.event;
      const running = event?.phase === 'running';
      if (event) syncPlayer(event, running, now, t);
      else if (playerHere()) goDown();
      syncVillagers(event, running, now, t);
    },
  };
}
