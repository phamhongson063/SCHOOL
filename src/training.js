import { BLESSING, MIND, TRAINING } from './config.js';
import { between } from './random.js';
import { economy } from './economy.js';
import { NPC } from './npcIds.js';

export const TRAINING_SPAN = TRAINING.minutes + 2;
const ASK_SECONDS = BLESSING.quizSeconds + Math.max(BLESSING.answerLock, (BLESSING.villagerAnswer[0] + BLESSING.villagerAnswer[1]) / 2);

export const trainingIntellect = (correct) => Math.floor(correct / TRAINING.intellectPer);

export const trainingEarned = (correct) => trainingIntellect(correct) - trainingIntellect(correct - 1);

export const trainingThink = () => Math.max(BLESSING.answerLock, between(...BLESSING.villagerAnswer));

export function payTraining(purse, payer = null) {
  if (!purse.spend(TRAINING.fee)) return false;
  economy.tuition(NPC.teacher, TRAINING.fee, payer);
  return true;
}

export function trainingGain({ odds, diligence, need, short = 0 }) {
  const asks = (TRAINING.minutes * 60) / ASK_SECONDS;
  const gained = (odds * asks) / TRAINING.intellectPer;
  const urgent = Math.min(gained, Math.max(0, short));
  return (urgent * TRAINING.shortValue + (gained - urgent) * MIND.intellectValue) * diligence - TRAINING.fee * need;
}

export function trainingAnswers(answer, seconds = TRAINING.minutes * 60) {
  let left = seconds - BLESSING.firstQuiz;
  let correct = 0;
  while (left > 0) {
    left -= trainingThink();
    if (left < 0) break;
    if (answer()) correct += 1;
    left -= BLESSING.quizSeconds;
  }
  return correct;
}
