import * as THREE from 'three';
import { FISH, ENERGY } from './config.js';
import { fishId } from './inventory.js';

const CAST_DELAY = 0.7;
const PAUSE = 1.6;
const SLOT_TOLERANCE = 0.6;
const MAX_RETRIES = 3;

export function createPlayerFishing({ river, purse, angler, quiz, harvest, player, say, now, minutes, day }) {
  let session = null;

  function stop() {
    if (!session) return;
    session = null;
    river.leave(player);
    angler.stop();
    if (quiz.open) quiz.cancel();
  }

  function follow() {
    const queue = session.spot.queue;
    const index = queue.indexOf(player);
    if (index < 0) {
      stop();
      return;
    }
    session.phase = 'queue';
    session.index = index;
    session.faced = -1;
    const slot = queue.slot(index);
    if (Math.hypot(slot.x - player.position.x, slot.z - player.position.z) <= 0.3) return;
    session.moving = true;
    player.requestMove(new THREE.Vector3(slot.x, 0, slot.z), false);
  }

  function cast() {
    if (!session) return;
    if (purse.count('bait') < 1) {
      stop();
      say('Hết mồi rồi! Ra tiệm buôn mua mồi giun nhé.');
      return;
    }
    if (!purse.spendEnergy(ENERGY.costs.fish)) {
      stop();
      say('Đói quá, hết sức câu rồi! Ra quán ăn nạp năng lượng nhé.', 2.6);
      return;
    }
    purse.take('bait', 1);
    player.faceToward(session.spot.float.x, session.spot.float.z);
    angler.cast(session.spot.float);
    session.phase = 'waiting';
    session.at = now() + CAST_DELAY + river.biteDelay(minutes());
  }

  async function bite() {
    const current = session;
    current.phase = 'quiz';
    angler.bite();
    const fish = river.rollFish(minutes());
    const { correct, entry } = await quiz.ask({ fish });
    if (session !== current) return;
    angler.reel();
    const float = current.spot.float;
    if (correct && river.take(current.spot)) {
      purse.add(fishId(fish), 1);
      purse.markFish(day());
      harvest.start({ count: 1, at: { x: float.x, y: 0.05, z: float.z }, height: 0.1, item: fishId(fish) });
      say(`🎣 ${FISH[fish].name}! +1`, 2);
    } else if (correct) {
      say('Cá vừa cắn đã bơi mất...', 2);
    } else {
      say(entry ? `Cá sổng mất! 「${entry.word}」 đọc là ${entry.reading}` : 'Cá sổng mất rồi!', 2.6);
    }
    current.phase = 'pause';
    current.at = now() + PAUSE;
  }

  function waitTurn(index) {
    if (session.faced === index) return;
    session.faced = index;
    const ahead = session.spot.queue.slot(index - 1);
    player.faceToward(ahead.x, ahead.z);
  }

  return {
    get active() {
      return !!session;
    },
    start(spot) {
      stop();
      if (purse.count('rod') < 1) return 'Chưa có cần câu! Ra tiệm buôn mua nhé.';
      if (purse.count('bait') < 1) return 'Hết mồi rồi! Ra tiệm buôn mua mồi giun nhé.';
      if (purse.energy < ENERGY.costs.fish) return 'Đói quá, hết sức câu rồi! Ra quán ăn nạp năng lượng nhé.';
      if (!river.hasFish(spot)) return 'Chỗ này hết cá rồi!';
      river.join(player, spot);
      session = { spot, phase: 'queue', index: -1, faced: -1, moving: false, retries: 0, at: 0 };
      follow();
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
        if (!session.moving) stop();
        return;
      }
      session.moving = false;
      const queue = session.spot.queue;
      const index = queue.indexOf(player);
      if (index < 0) {
        stop();
        return;
      }
      if (session.phase === 'aside') {
        follow();
        return;
      }
      const slot = queue.slot(index);
      const away = Math.hypot(slot.x - player.position.x, slot.z - player.position.z);
      if (session.phase === 'queue') {
        if (index !== session.index || away > SLOT_TOLERANCE) {
          if (session.retries++ >= MAX_RETRIES) {
            stop();
            return;
          }
          follow();
          return;
        }
        session.retries = 0;
        if (index > 0) waitTurn(index);
        else cast();
        return;
      }
      if (away > SLOT_TOLERANCE) {
        stop();
        return;
      }
      if (session.phase === 'waiting' && now() >= session.at) bite();
      else if (session.phase === 'pause' && now() >= session.at) {
        angler.stop();
        const queue = session.spot.queue;
        river.rotate(player, session.spot);
        if (queue.members.length < 2) {
          follow();
          return;
        }
        const aside = queue.aside(0);
        session.phase = 'aside';
        session.moving = true;
        player.requestMove(new THREE.Vector3(aside.x, 0, aside.z), false);
      }
    },
  };
}
