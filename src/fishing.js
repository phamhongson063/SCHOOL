import * as THREE from 'three';
import { FISH, ENERGY } from './config.js';
import { fishId } from './inventory.js';

const BITE_DELAY = 3;
const PAUSE = 1.6;
const REACH = 0.9;

export function createPlayerFishing({ river, purse, angler, quiz, harvest, player, say, now, minutes, day }) {
  let session = null;

  function stop() {
    if (!session) return;
    session = null;
    river.leave(player);
    angler.stop();
    if (quiz.open) quiz.cancel();
  }

  const away = () => Math.hypot(session.berth.stand.x - player.position.x, session.berth.stand.z - player.position.z);

  function cast() {
    if (purse.count('bait') < 1) {
      stop();
      say('Hết mồi rồi! Ra hàng cá mua mồi giun nhé.');
      return;
    }
    if (!purse.spendEnergy(ENERGY.costs.fish)) {
      stop();
      say('Đói quá, hết sức câu rồi! Ra quán ăn nạp năng lượng nhé.', 2.6);
      return;
    }
    purse.take('bait', 1);
    const float = session.berth.float;
    player.faceToward(float.x, float.z);
    angler.cast(float);
    session.phase = 'waiting';
    session.at = now() + BITE_DELAY;
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
      purse.catchFish(fishId(fish), day());
      harvest.start({ count: 1, at: { x: float.x, y: 0.05, z: float.z }, height: 0.1, item: fishId(fish) });
      say(`🎣 ${FISH[fish].name}! +1`, 2);
    } else if (correct) {
      say('Cá vừa cắn đã bơi mất...', 2);
    }
    current.phase = 'pause';
    current.at = now() + PAUSE;
  }

  return {
    get active() {
      return !!session;
    },
    start(spot, berth) {
      stop();
      if (purse.count('rod') < 1) return 'Chưa có cần câu! Ra hàng cá mua nhé.';
      if (purse.count('bait') < 1) return 'Hết mồi rồi! Ra hàng cá mua mồi giun nhé.';
      if (purse.energy < ENERGY.costs.fish) return 'Đói quá, hết sức câu rồi! Ra quán ăn nạp năng lượng nhé.';
      if (!river.hasFish(spot)) return 'Chỗ này hết cá rồi!';
      const free = berth && !berth.who ? berth : river.berthFor(player, spot, player.position);
      if (!free) return 'Chỗ này đông người rồi, tìm chỗ khác nhé!';
      river.claim(player, free);
      session = { spot, berth: free, phase: 'walk', at: 0 };
      if (away() > REACH) player.requestMove(new THREE.Vector3(free.stand.x, 0, free.stand.z), false);
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
      if (session.phase === 'walk') cast();
      else if (session.phase === 'waiting' && now() >= session.at) bite();
      else if (session.phase === 'pause' && now() >= session.at) {
        angler.stop();
        cast();
      }
    },
  };
}
