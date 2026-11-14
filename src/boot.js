import { cloudEnabled, connect, signedIn, signIn, signOut } from './cloud.js';
import { RELEASE, VERSION } from './version.js';

const LOCK = 'langsch.game';
performance.setResourceTimingBufferSize?.(1000);
const loader = document.getElementById('loader');
const label = loader?.querySelector('.loader-label');
const idleLabel = label?.textContent;
const login = loader?.querySelector('.loader-login');
const versionNote = loader?.querySelector('.loader-version');
if (versionNote) versionNote.textContent = `Phiên bản ${RELEASE} · ${VERSION}`;
const waiting = new AbortController();
let releaseLock = () => {};

const holdWhileOpen = () => new Promise((resolve) => (releaseLock = resolve));

function askSignIn(message) {
  loader.classList.add('login');
  label.textContent = message ?? '';
  return new Promise((resolve) => {
    login.onclick = () => {
      login.disabled = true;
      signIn()
        .then(resolve, () => {})
        .finally(() => (login.disabled = false));
    };
  }).finally(() => {
    login.onclick = null;
    loader.classList.remove('login');
    label.textContent = idleLabel;
  });
}

async function enter() {
  if (!cloudEnabled || !loader) return;
  let message;
  for (;;) {
    try {
      if (await signedIn()) return await connect();
    } catch (error) {
      if (error?.code !== 'permission-denied') message = 'Không kết nối được';
      else {
        await signOut().catch(() => {});
        message = 'Tài khoản không được phép';
      }
    }
    await askSignIn(message);
    message = undefined;
  }
}

function startGame() {
  if (loader?.classList.contains('blocked')) {
    loader.classList.remove('blocked');
    label.textContent = idleLabel;
  }
  enter().then(() => import('./main.js'));
  return holdWhileOpen();
}

function showBlocked() {
  if (!loader) return;
  loader.classList.add('blocked');
  label.textContent = 'Game đang mở ở một tab khác';
}

addEventListener('pagehide', (event) => {
  if (!event.persisted) return;
  waiting.abort();
  releaseLock();
});

addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});

if (!navigator.locks) enter().then(() => import('./main.js'));
else {
  navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
    if (lock) return startGame();
    showBlocked();
    navigator.locks.request(LOCK, { signal: waiting.signal }, startGame).catch(() => {});
  });
}
