const MUSIC_KEY = 'langsch.music';
const MUSIC_FADE = 0.15;

let ctx = null;
let musicOut = null;
let musicOn = readMusic();
const waiting = [];
const STREAM_POOL = 6;
const streams = [];
const OGG = typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';
let silence = null;

function silentUrl() {
  if (silence) return silence;
  const buffer = new ArrayBuffer(46);
  const view = new DataView(buffer);
  const text = (at, value) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 38, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, 2, true);
  silence = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  return silence;
}

function unlockStreams() {
  if (streams.length || typeof Audio === 'undefined') return;
  for (let i = 0; i < STREAM_POOL; i++) {
    const element = new Audio();
    element.preload = 'none';
    element.src = silentUrl();
    element.play().then(() => element.pause(), () => {});
    streams.push({ element, node: null, busy: false });
  }
}

function readMusic() {
  try {
    return localStorage.getItem(MUSIC_KEY) !== 'off';
  } catch {
    return true;
  }
}

function wake() {
  unlockStreams();
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

const musicListeners = [];

export function onMusicToggle(fn) {
  musicListeners.push(fn);
}

export function setMusicEnabled(on) {
  musicOn = on;
  try {
    localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
  } catch {}
  if (musicOut) musicOut.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, MUSIC_FADE);
  for (const fn of musicListeners) fn(on);
}

function takeStream() {
  const free = streams.find((stream) => !stream.busy);
  if (free) return free;
  const stream = { element: new Audio(), node: null, busy: false };
  streams.push(stream);
  return stream;
}

export function streamTrack(context, path, { loop = true, onEnded = null } = {}) {
  const stream = takeStream();
  const { element } = stream;
  stream.busy = true;
  stream.node ??= context.createMediaElementSource(element);
  element.loop = loop;
  element.preload = 'auto';
  element.onended = onEnded;
  element.src = `${path}.${OGG ? 'ogg' : 'm4a'}`;
  return {
    node: stream.node,
    play: () => element.play().catch(() => {}),
    release() {
      element.onended = null;
      element.pause();
      stream.node.disconnect();
      element.removeAttribute('src');
      element.load();
      stream.busy = false;
    },
  };
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
