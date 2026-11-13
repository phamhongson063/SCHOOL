import * as THREE from 'three';
import { FISH, FISHING, ENERGY } from './config.js';
import { fishId } from './inventory.js';

const REACH = 0.9;
const CROWDED = 'Chỗ này đông người rồi, tìm chỗ khác nhé!';
const NO_BAIT = 'Hết mồi rồi! Ra hàng cá mua mồi giun nhé.';
const NO_ENERGY = 'Đói quá, hết sức câu rồi! Ra quán ăn nạp năng lượng nhé.';

export function createPlayerFishing({ river, purse, angler, quiz, harvest, player, say, now, minutes }) {
  let session = null;

  function stop() {
    if (!session) return;
    session = null;
    river.leave(player);
    angler.stop();
    if (quiz.open) quiz.cancel();
  }

  function shortage() {
    if (purse.count('bait') < 1) return NO_BAIT;
    if (purse.energy < ENERGY.costs.fish) return NO_ENERGY;
    return null;
  }

  const away = () => Math.hypot(session.berth.stand.x - player.position.x, session.berth.stand.z - player.position.z);

  function walkToBerth(berth) {
    river.aim(player, berth);
    session.berth = berth;
    if (away() > REACH) player.requestMove(new THREE.Vector3(berth.stand.x, 0, berth.stand.z), false);
  }

  function holdBerth() {
    if (river.hold(player, session.berth)) return true;
    const other = river.berthFor(player, session.spot, player.position);
    if (!other) {
      stop();
      say(CROWDED, 2);
      return false;
    }
    walkToBerth(other);
    return false;
  }

  function cast() {
    const problem = shortage();
    if (problem) {
      stop();
      say(problem, 2.6);
      return;
    }
    purse.spendEnergy(ENERGY.costs.fish);
    purse.take('bait', 1);
    const float = session.berth.float;
    player.faceToward(float.x, float.z);
    angler.cast(float);
    session.phase = 'waiting';
    session.at = now() + FISHING.biteSeconds;
  }

  async function bite() {
    const current = session;
    current.phase = 'quiz';
    angler.bite();
    const fish = river.rollFish(minutes());
    const { correct } = await quiz.ask({ fish });
    if (session !== current) return;
    angler.reel();
    const float = current.berth.float;
    if (correct && river.take(current.spot)) {
      purse.add(fishId(fish), 1);
      harvest.start({ count: 1, at: { x: float.x, y: 0.05, z: float.z }, height: 0.1, item: fishId(fish) });
      say(`🎣 ${FISH[fish].name}! +1`, 2);
    } else if (correct) {
      say('Cá vừa cắn đã bơi mất...', 2);
    }
    current.phase = 'pause';
    current.at = now() + FISHING.castPause;
  }

  return {
    get active() {
      return !!session;
    },
    start(spot, berth) {
      stop();
      if (purse.count('rod') < 1) return 'Chưa có cần câu! Ra hàng cá mua nhé.';
      const problem = shortage();
      if (problem) return problem;
      if (!river.hasFish(spot)) return 'Chỗ này hết cá rồi!';
      const free = berth && !berth.who ? berth : river.berthFor(player, spot, player.position);
      if (!free) return CROWDED;
      session = { spot, berth: free, phase: 'walk', at: 0 };
      walkToBerth(free);
      return null;
    },
    stop,
    update() {
      if (!session) return;
      if (!river.hasFish(session.spot)) {
        stop();
        say('Chỗ này hết cá rồi!', 2);
        return;
      }
      if (player.posture !== 'free') {
        stop();
        return;
      }
      if (player.path) {
        if (session.phase !== 'walk') stop();
        return;
      }
      if (away() > REACH) {
        stop();
        return;
      }
      if (session.phase === 'walk') {
        if (holdBerth()) cast();
      } else if (session.phase === 'waiting' && now() >= session.at) bite();
      else if (session.phase === 'pause' && now() >= session.at) {
        angler.stop();
        cast();
      }
    },
  };
}
