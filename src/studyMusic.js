import { loadClip, onAudio } from './audio.js';

const VOLUME = 0.85;
const FADE = 2;

export class StudyMusic {
  constructor(paths) {
    this.ctx = null;
    this.out = null;
    this.clips = [];
    this.current = null;
    this.playing = false;
    onAudio((ctx) => {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = VOLUME;
      this.out.connect(ctx.destination);
      for (const path of paths) {
        loadClip(ctx, [`${path}.ogg`, `${path}.m4a`]).then((clip) => {
          if (!clip) return;
          this.clips.push(clip);
          if (this.playing && !this.current) this.next(true);
        });
      }
    });
  }

  start() {
    this.playing = true;
    this.fadeOut(this.current);
    this.current = null;
    this.next(true);
  }

  stop() {
    this.playing = false;
    this.fadeOut(this.current);
    this.current = null;
  }

  next(fadeIn) {
    const ctx = this.ctx;
    if (!ctx || !this.playing || !this.clips.length) return;
    const source = ctx.createBufferSource();
    source.buffer = this.clips[Math.floor(Math.random() * this.clips.length)];
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(fadeIn ? 0 : 1, now);
    if (fadeIn) gain.gain.linearRampToValueAtTime(1, now + FADE);
    source.connect(gain).connect(this.out);
    const voice = { source, gain };
    source.onended = () => {
      gain.disconnect();
      if (this.current !== voice) return;
      this.current = null;
      this.next(false);
    };
    source.start();
    this.current = voice;
  }

  fadeOut(voice) {
    if (!voice || !this.ctx) return;
    const now = this.ctx.currentTime;
    const level = voice.gain.gain;
    level.cancelScheduledValues(now);
    level.setValueAtTime(level.value, now);
    level.linearRampToValueAtTime(0, now + FADE);
    voice.source.stop(now + FADE);
  }
}
