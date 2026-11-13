const MUSIC_KEY = 'langsch.music';
const MUSIC_FADE = 0.15;

let ctx = null;
let musicOut = null;
let musicOn = readMusic();
const waiting = [];

function readMusic() {
  try {
    return localStorage.getItem(MUSIC_KEY) !== 'off';
  } catch {
    return true;
  }
}

function wake() {
  if (!ctx) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    ctx = new Context();
    for (const fn of waiting.splice(0)) fn(ctx);
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
}

window.addEventListener('pointerdown', wake);
window.addEventListener('keydown', wake);
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

export function onAudio(fn) {
  if (ctx) fn(ctx);
  else waiting.push(fn);
}

export function musicBus(context) {
  if (!musicOut) {
    musicOut = context.createGain();
    musicOut.gain.value = musicOn ? 1 : 0;
    musicOut.connect(context.destination);
  }
  return musicOut;
}

export const musicEnabled = () => musicOn;

export function setMusicEnabled(on) {
  musicOn = on;
  try {
    localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
  } catch {}
  if (musicOut) musicOut.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, MUSIC_FADE);
}

export async function loadClip(ctx, urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {}
  }
  return null;
}
