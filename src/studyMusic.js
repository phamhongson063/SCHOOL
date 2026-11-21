import { musicBus, onAudio, streamTrack } from './audio.js';

const VOLUME = 0.85;
const FADE = 2;

export class StudyMusic {
  constructor(sets) {
    this.ctx = null;
    this.out = null;
    this.sets = sets;
    this.kind = 'study';
    this.current = null;
    this.playing = false;
    onAudio((ctx) => {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = VOLUME;
      this.out.connect(musicBus(ctx));
      if (this.playing && !this.current) this.next(true);
    });
  }

  start(kind = 'study') {
    this.playing = true;
    this.kind = kind;
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
    const paths = this.sets[this.kind]?.length ? this.sets[this.kind] : this.sets.study;
    if (!ctx || !this.playing || !paths?.length) return;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(fadeIn ? 0 : 1, now);
    if (fadeIn) gain.gain.linearRampToValueAtTime(1, now + FADE);
    gain.connect(this.out);
    const voice = { gain, track: null };
    voice.track = streamTrack(ctx, paths[Math.floor(Math.random() * paths.length)], {
      loop: false,
      onEnded: () => {
        this.drop(voice);
        if (this.current !== voice) return;
        this.current = null;
        this.next(false);
      },
    });
    voice.track.node.connect(gain);
    voice.track.play();
    this.current = voice;
  }

  drop(voice) {
    voice.track?.release();
    voice.track = null;
    voice.gain.disconnect();
  }

  fadeOut(voice) {
    if (!voice || !this.ctx) return;
    const now = this.ctx.currentTime;
    const level = voice.gain.gain;
    level.cancelScheduledValues(now);
    level.setValueAtTime(level.value, now);
    level.linearRampToValueAtTime(0, now + FADE);
    setTimeout(() => this.drop(voice), FADE * 1000 + 200);
  }
}
