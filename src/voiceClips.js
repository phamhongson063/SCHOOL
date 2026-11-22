import { onAudio } from './audio.js';
import { loadSound } from './cloud.js';

const clips = new Map();
let ctx = null;
let current = null;
let generation = 0;

onAudio((context) => (ctx = context));

function clipOf(name) {
  if (!clips.has(name)) clips.set(name, loadSound(name).then((bytes) => (bytes ? ctx.decodeAudioData(bytes.slice().buffer) : null)));
  return clips.get(name);
}

export function stopVoice() {
  generation++;
  if (!current) return;
  const playing = current;
  current = null;
  playing.onended = null;
  playing.stop();
  playing.done();
}

export async function playVoice(name, done = () => {}) {
  if (!ctx) return false;
  stopVoice();
  const ticket = generation;
  let clip;
  try {
    clip = await clipOf(name);
  } catch {
    clips.delete(name);
    return false;
  }
  if (ticket !== generation || !clip || ctx.state !== 'running') return false;
  const source = ctx.createBufferSource();
  source.buffer = clip;
  source.connect(ctx.destination);
  source.done = done;
  source.onended = () => {
    if (current !== source) return;
    current = null;
    done();
  };
  source.start();
  current = source;
  return true;
}
