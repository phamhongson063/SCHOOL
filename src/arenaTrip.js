import * as THREE from 'three';
import { ARRIVAL, SPECTATORS, fighterSpot, onIsland } from './arenaIsland.js';
import { PLAYER } from './inventory.js';
import { onStage } from './arenaReplay.js';

const HOME_DELAY = 8;

function stageSpots(event, now) {
  const spots = new Map();
  const round = event.rounds[event.round];
  if (!round) return spots;
  round.forEach((match, index) => {
    if (!onStage(match, now)) return;
    spots.set(match.a, fighterSpot(round.length, index, 'a'));
    spots.set(match.b, fighterSpot(round.length, index, 'b'));
  });
  return spots;
}

export function createArenaTrip({ arena, player, town, busy = () => false, say = null }) {
  const where = new Map();
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
    say?.('⚔️ Truyền tống tới lôi đài!');
    return true;
  }

  function goDown() {
    if (!ready()) return false;
    const spot = back ?? deskSpot();
    back = null;
    homeAt = null;
    fighting = false;
    player.place(new THREE.Vector3(spot.x, spot.y ?? town.nav.heightAt(spot.x, spot.z) ?? 0, spot.z), spot.yaw ?? 0);
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
      }
    } else if (fighting) {
      fighting = false;
      placePlayer(ARRIVAL);
    }
    if (!running && playerHere()) {
      homeAt ??= t + HOME_DELAY;
      if (t >= homeAt) goDown();
    } else homeAt = null;
  }

  function syncVillagers(event, running, now, t) {
    const villagers = new Map(town.members.map((member) => [member.id, member]));
    const staying = running || (event?.phase === 'done' && homeAt !== null && t < homeAt);
    const stage = running ? stageSpots(event, now) : new Map();
    const order = event?.entrants.filter((id) => villagers.has(id)) ?? [];
    if (staying) {
      order.forEach((id, i) => {
        const member = villagers.get(id);
        const spot = stage.get(id) ?? SPECTATORS[i % SPECTATORS.length];
        const key = `${spot.x},${spot.z}`;
        if (member.state !== 'arena') member.enterArena(spot);
        else if (where.get(id) !== key) member.placeArena(spot);
        where.set(id, key);
      });
    }
    for (const member of villagers.values()) {
      if (member.state !== 'arena' || (staying && order.includes(member.id))) continue;
      member.leaveArena(deskSpot());
      where.delete(member.id);
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
    update(now, t) {
      const event = arena.event;
      const running = event?.phase === 'running';
      if (event) syncPlayer(event, running, now, t);
      else if (playerHere()) goDown();
      syncVillagers(event, running, now, t);
    },
  };
}
