import { loadClip, onAudio } from './audio.js';

const VOLUME = 0.5;
const NPC_VOLUME = 0.6;
const NEAR = 3;
const FAR = 15;
const MAX_VOICES = 8;
const VARIANTS = 4;
const KINDS = ['walk', 'run'];

function place(node, prefix, x, y, z) {
  if (node[`${prefix}X`]) {
    node[`${prefix}X`].value = x;
    node[`${prefix}Y`].value = y;
    node[`${prefix}Z`].value = z;
  }
}

export class StepSound {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.clips = { walk: [], run: [] };
    this.last = { walk: -1, run: -1 };
    this.ear = { x: 0, y: 0, z: 0 };
    this.voices = 0;
    onAudio((ctx) => {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = VOLUME;
      this.out.connect(ctx.destination);
      for (const kind of KINDS) {
        for (let i = 1; i <= VARIANTS; i++) {
          loadClip(ctx, [`assets/sfx/${kind}-${i}.wav`]).then((clip) => clip && this.clips[kind].push(clip));
        }
      }
    });
  }

  listen(camera) {
    const ear = this.ear;
    const e = camera.matrixWorld.elements;
    ear.x = e[12];
    ear.y = e[13];
    ear.z = e[14];
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    if (listener.positionX) {
      place(listener, 'position', ear.x, ear.y, ear.z);
      place(listener, 'forward', -e[8], -e[9], -e[10]);
      place(listener, 'up', e[4], e[5], e[6]);
    } else {
      listener.setPosition(ear.x, ear.y, ear.z);
      listener.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
    }
  }

  pick(kind) {
    const list = this.clips[kind];
    if (!list.length) return null;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === this.last[kind]) index = (index + 1) % list.length;
    this.last[kind] = index;
    return list[index];
  }

  play(running, x, y, z, npc = false) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (npc && this.voices >= MAX_VOICES) return;
    const ear = this.ear;
    if (Math.hypot(x - ear.x, y - ear.y, z - ear.z) >= FAR) return;
    const clip = this.pick(running ? 'run' : 'walk');
    if (!clip) return;

    const source = ctx.createBufferSource();
    source.buffer = clip;
    source.playbackRate.value = 0.94 + Math.random() * 0.12;
    const gain = ctx.createGain();
    gain.gain.value = (npc ? NPC_VOLUME : 1) * (0.85 + Math.random() * 0.15);
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'linear';
    panner.refDistance = NEAR;
    panner.maxDistance = FAR;
    panner.rolloffFactor = 1;
    if (panner.positionX) place(panner, 'position', x, y, z);
    else panner.setPosition(x, y, z);

    source.connect(gain).connect(panner).connect(this.out);
    this.voices += 1;
    source.onended = () => {
      this.voices -= 1;
      panner.disconnect();
    };
    source.start();
  }
}
