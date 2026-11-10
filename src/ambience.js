import { loadClip, onAudio } from './audio.js';

const FADE = 2.5;

const between = ([lo, hi]) => lo + Math.random() * (hi - lo);
const sources = (path) => [`${path}.ogg`, `${path}.m4a`];

export class Ambience {
  constructor({ bed, volume = 0.3, cues = [] }) {
    this.volume = volume;
    this.ctx = null;
    this.gain = null;
    this.bed = null;
    this.source = null;
    this.wanted = false;
    this.cues = cues.map((cue) => ({ ...cue, clips: [], last: -1, wait: between(cue.every) }));
    onAudio(async (ctx) => {
      this.ctx = ctx;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(ctx.destination);
      for (const cue of this.cues) {
        for (const path of cue.files) loadClip(ctx, sources(path)).then((clip) => clip && cue.clips.push(clip));
      }
      this.bed = await loadClip(ctx, sources(bed));
      this.apply();
    });
  }

  set(on) {
    if (on === this.wanted) return;
    this.wanted = on;
    this.apply();
  }

  apply() {
    const ctx = this.ctx;
    if (!ctx || !this.bed) return;
    if (this.wanted && !this.source) {
      this.source = ctx.createBufferSource();
      this.source.buffer = this.bed;
      this.source.loop = true;
      this.source.connect(this.gain);
      this.source.start();
    }
    const now = ctx.currentTime;
    const level = this.gain.gain;
    level.cancelScheduledValues(now);
    level.setValueAtTime(level.value, now);
    level.linearRampToValueAtTime(this.wanted ? this.volume : 0, now + FADE);
  }

  update(dt) {
    if (!this.wanted || !this.ctx || this.ctx.state !== 'running') return;
    for (const cue of this.cues) {
      cue.wait -= dt;
      if (cue.wait > 0) continue;
      cue.wait = between(cue.every);
      this.play(cue);
    }
  }

  play(cue) {
    const list = cue.clips;
    if (!list.length) return;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === cue.last) index = (index + 1) % list.length;
    cue.last = index;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = list[index];
    source.playbackRate.value = 0.92 + Math.random() * 0.16;
    const gain = ctx.createGain();
    gain.gain.value = cue.volume * (0.6 + Math.random() * 0.4);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.random() * 0.8 - 0.4;
    source.connect(gain).connect(pan).connect(this.gain);
    source.onended = () => pan.disconnect();
    source.start();
  }
}
