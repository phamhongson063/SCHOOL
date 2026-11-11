import { loadClip, musicBus, onAudio } from './audio.js';

const VOLUME = 0.25;
const FADE = 2.5;

export class Music {
  constructor(urls) {
    this.ctx = null;
    this.gain = null;
    this.clip = null;
    this.source = null;
    this.wanted = false;
    onAudio(async (ctx) => {
      this.ctx = ctx;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(musicBus(ctx));
      this.clip = await loadClip(ctx, urls);
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
    if (!ctx || !this.clip) return;
    if (this.wanted && !this.source) {
      this.source = ctx.createBufferSource();
      this.source.buffer = this.clip;
      this.source.loop = true;
      this.source.connect(this.gain);
      this.source.start();
    }
    const now = ctx.currentTime;
    const level = this.gain.gain;
    level.cancelScheduledValues(now);
    level.setValueAtTime(level.value, now);
    level.linearRampToValueAtTime(this.wanted ? VOLUME : 0, now + FADE);
  }
}
