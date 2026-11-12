import { appCheckKey, firebaseConfig } from './firebaseConfig.js';
import { ACCOUNT_KEY, gameKeys, isGameKey } from './saveKeys.js';
import { haltStores } from './persist.js';
import { auditSeal, dropTampered } from './seal.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
const SYNC_EVERY = 30000;

export const cloudEnabled = Boolean(firebaseConfig.apiKey);

let sdk = null;
let sync = null;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function account() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function saveAccount(value) {
  try {
    if (value) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(value));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {}
}

const AUTH_HOSTS = /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//;

function allowAuthReferrer() {
  if (self.fetch.authReferrer) return;
  const nativeFetch = self.fetch.bind(self);
  const patched = (input, init) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    if (init?.referrerPolicy === 'no-referrer' && AUTH_HOSTS.test(url)) init = { ...init, referrerPolicy: 'strict-origin-when-cross-origin' };
    return nativeFetch(input, init);
  };
  patched.authReferrer = true;
  self.fetch = patched;
}

function loadSdk() {
  if (sdk) return sdk;
  allowAuthReferrer();
  sdk = (async () => {
    const [app, auth, store, check] = await Promise.all(['app', 'auth', 'firestore', 'app-check'].map((name) => import(`${SDK}firebase-${name}.js`)));
    const instance = app.initializeApp(firebaseConfig);
    if (appCheckKey) check.initializeAppCheck(instance, { provider: new check.ReCaptchaEnterpriseProvider(appCheckKey), isTokenAutoRefreshEnabled: true });
    const session = auth.getAuth(instance);
    await session.authStateReady();
    return { auth, store, session, db: store.getFirestore(instance) };
  })();
  sdk.catch(() => (sdk = null));
  return sdk;
}

function snapshot() {
  const data = {};
  for (const key of gameKeys().sort()) data[key] = localStorage.getItem(key);
  return JSON.stringify(data);
}

function restore(text) {
  const data = JSON.parse(text);
  for (const key of gameKeys()) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(data)) if (isGameKey(key) && typeof value === 'string') localStorage.setItem(key, value);
}

export async function signedIn() {
  const { session } = await loadSdk();
  return Boolean(session.currentUser);
}

export async function connect() {
  const { store, session, db } = await loadSdk();
  const user = session.currentUser;
  const saved = account();
  const ref = store.doc(db, 'saves', user.uid);
  const id = newId();
  const tampered = auditSeal();
  if (tampered.length) dropTampered(tampered);
  const local = snapshot();
  const continuing = !tampered.length && saved?.uid === user.uid && Boolean(saved?.rev);
  const result = await store.runTransaction(db, async (tx) => {
    const found = await tx.get(ref);
    const cloud = found.exists() ? found.data() : null;
    if (cloud && !(continuing && cloud.rev === saved.rev)) {
      tx.update(ref, { session: id });
      return { rev: cloud.rev, data: cloud.data };
    }
    const rev = newId();
    tx.set(ref, { data: local, rev, session: id, savedAt: store.serverTimestamp() });
    return { rev, data: local };
  });
  if (result.data !== local) {
    restore(result.data);
    const broken = auditSeal();
    if (broken.length) dropTampered(broken);
  }
  saveAccount({ uid: user.uid, name: user.displayName ?? '', email: user.email ?? '', rev: result.rev });
  startSync(store, ref, id, result.data);
}

function onHidden() {
  if (document.visibilityState === 'hidden') setTimeout(upload);
}

function startSync(store, ref, id, uploaded) {
  sync = { ref, id, uploaded, busy: null };
  sync.timer = setInterval(upload, SYNC_EVERY);
  sync.unsubscribe = store.onSnapshot(
    ref,
    (found) => {
      if (found.get('session') !== id) takenOver();
    },
    () => {},
  );
  document.addEventListener('visibilitychange', onHidden);
}

function stopSync() {
  if (!sync) return;
  clearInterval(sync.timer);
  sync.unsubscribe();
  document.removeEventListener('visibilitychange', onHidden);
  sync = null;
}

function upload() {
  if (!sync) return Promise.resolve();
  const state = sync;
  state.busy ??= push(state).finally(() => (state.busy = null));
  return state.busy;
}

async function push(state) {
  if (auditSeal().length) return;
  const data = snapshot();
  if (data === state.uploaded) return;
  const { store, db } = await loadSdk();
  const rev = newId();
  let owned = false;
  try {
    owned = await store.runTransaction(db, async (tx) => {
      const found = await tx.get(state.ref);
      if (found.get('session') !== state.id) return false;
      tx.update(state.ref, { data, rev, savedAt: store.serverTimestamp() });
      return true;
    });
  } catch {
    return;
  }
  if (!owned) return takenOver();
  state.uploaded = data;
  const saved = account();
  if (saved && sync === state) saveAccount({ ...saved, rev });
}

function takenOver() {
  if (!sync) return;
  stopSync();
  haltStores();
  saveAccount(null);
  const signedOut = loadSdk()
    .then(({ auth, session }) => auth.signOut(session))
    .catch(() => {});
  const dialog = document.getElementById('elsewhereDialog');
  if (!dialog) return;
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  document.getElementById('elsewhereBtn')?.addEventListener('click', () => signedOut.then(() => location.reload()), { once: true });
  for (const open of document.querySelectorAll('dialog[open]')) open.close();
  dialog.showModal();
}

export async function signIn() {
  const { auth, session } = await loadSdk();
  if (session.currentUser) return;
  await auth.signInWithPopup(session, new auth.GoogleAuthProvider());
}

export async function signOut() {
  await upload().catch(() => {});
  stopSync();
  try {
    const { auth, session } = await loadSdk();
    await auth.signOut(session);
  } finally {
    saveAccount(null);
  }
}
