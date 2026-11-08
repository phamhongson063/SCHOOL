import { FISH, ENERGY } from './config.js';
import { fishId } from './inventory.js';

const CAST_DELAY = 0.7;
const PAUSE = 1.6;

export function createPlayerFishing({ river, purse, angler, quiz, harvest, player, say, now, minutes, day }) {
  let session = null;

  function stop() {
    if (!session) return;
    session = null;
    river.release(player);
    angler.stop();
    if (quiz.open) quiz.cancel();
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

  return {
    get active() {
      return !!session;
    },
    start(spot) {
      stop();
      if (purse.count('rod') < 1) return 'Chưa có cần câu! Ra tiệm buôn mua nhé.';
      if (purse.count('bait') < 1) return 'Hết mồi rồi! Ra tiệm buôn mua mồi giun nhé.';
      if (purse.energy < ENERGY.costs.fish) return 'Đói quá, hết sức câu rồi! Ra quán ăn nạp năng lượng nhé.';
      const claimed = river.claim(player, spot.float, 0.5);
      if (!claimed) return 'Chỗ này có người ngồi câu rồi!';
      session = { spot: claimed, phase: 'idle', at: 0 };
      cast();
      return null;
    },
    stop,
    update() {
      if (!session) return;
      if (player.posture !== 'free' || player.path) {
        stop();
        return;
      }
      if (session.phase === 'waiting' && now() >= session.at) {
        if (river.hasFish(session.spot)) bite();
        else session.at = now() + 1;
      }
      else if (session.phase === 'pause' && now() >= session.at) cast();
    },
  };
}
